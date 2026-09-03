/**
 * Additive-only PostgreSQL schema synchronization.
 *
 * The desired schema is generated from shared/schema.ts by Drizzle Kit. The
 * live database is inspected through PostgreSQL's catalogs. Only operations
 * that preserve existing tables and rows are planned:
 *
 *   - create missing tables
 *   - add compatible missing columns
 *   - add missing primary/unique/foreign-key constraints after data preflight
 *   - add missing indexes
 *   - add or strengthen compatible defaults/nullability
 *
 * Existing tables, columns, constraints, indexes, and data are never dropped.
 * Incompatible changes abort the complete transaction and require a reviewed
 * versioned migration.
 */

import { execFileSync } from "child_process";
import { createHash } from "crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import pkg from "pg";
import {
  getClientConfig,
  prepareDatabaseExtensions,
} from "./db-prepare";

const { Client } = pkg;

interface DesiredColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  default?: string | number | boolean;
  identity?: {
    type: "always" | "byDefault";
    name: string;
    increment: string;
    startWith: string;
    minValue: string;
    maxValue: string;
    cache: string;
    cycle: boolean;
  };
}

interface DesiredIndex {
  name: string;
  columns: Array<{
    expression: string;
    isExpression: boolean;
    asc: boolean;
    nulls: "first" | "last";
  }>;
  isUnique: boolean;
  concurrently: boolean;
  method: string;
  with: Record<string, string>;
}

interface DesiredForeignKey {
  name: string;
  tableFrom: string;
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
  onDelete?: string;
  onUpdate?: string;
}

interface DesiredUniqueConstraint {
  name: string;
  columns: string[];
  nullsNotDistinct?: boolean;
}

interface DesiredTable {
  name: string;
  schema: string;
  columns: Record<string, DesiredColumn>;
  indexes: Record<string, DesiredIndex>;
  foreignKeys: Record<string, DesiredForeignKey>;
  compositePrimaryKeys: Record<string, { name: string; columns: string[] }>;
  uniqueConstraints: Record<string, DesiredUniqueConstraint>;
  checkConstraints: Record<string, unknown>;
}

interface DesiredSnapshot {
  tables: Record<string, DesiredTable>;
  enums: Record<string, unknown>;
  sequences: Record<string, unknown>;
  views: Record<string, unknown>;
}

interface ExistingColumn {
  tableName: string;
  columnName: string;
  dataType: string;
  notNull: boolean;
  defaultValue: string | null;
}

interface PlannedOperation {
  phase: number;
  description: string;
  sql: string;
}

interface GeneratedDesiredSchema {
  snapshot: DesiredSnapshot;
  schemaHash: string;
  createTableSql: Map<string, string>;
  createIndexSql: Map<string, string>;
}

const INTERNAL_TABLES = new Set([
  "__drizzle_migrations",
  "ledgerlm_schema_sync_history",
]);

const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--check");
const projectRoot = resolve(process.cwd());
const targetSchema = (process.env.DB_SCHEMA || "public").trim();

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(targetSchema)) {
  throw new Error(`Invalid DB_SCHEMA identifier: ${targetSchema}`);
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeType(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bcharacter varying\b/g, "varchar")
    .replace(/\btimestamp without time zone\b/g, "timestamp")
    .replace(/\btimestamp with time zone\b/g, "timestamptz")
    .replace(/\s+/g, " ")
    .trim();
}

function renderDefault(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return String(value);
}

function normalizeDefault(value: string | number | boolean): string {
  let normalized = renderDefault(value)
    .toLowerCase()
    .replace(/::character varying/g, "")
    .replace(/::text/g, "")
    .replace(/\s+/g, " ")
    .trim();

  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function splitGeneratedStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function addIfNotExistsToCreateTable(statement: string): string {
  return statement.replace(/^CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ");
}

function addIfNotExistsToCreateIndex(statement: string): string {
  return statement.replace(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+/i,
    (_match, unique: string | undefined) =>
      `CREATE ${unique ?? ""}INDEX IF NOT EXISTS `,
  );
}

function generateDesiredSchema(): GeneratedDesiredSchema {
  const outputDirectory = mkdtempSync(join(tmpdir(), "ledgerlm-safe-schema-"));
  try {
    const drizzleBinary = resolve(
      projectRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit",
    );

    execFileSync(
      drizzleBinary,
      [
        "generate",
        "--dialect",
        "postgresql",
        "--schema",
        resolve(projectRoot, "shared", "schema.ts"),
        "--out",
        outputDirectory,
        "--name",
        "safe-push-desired-schema",
        "--prefix",
        "timestamp",
      ],
      { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
    );

    const metaDirectory = join(outputDirectory, "meta");
    const snapshotFile = readdirSync(metaDirectory).find((file) =>
      file.endsWith("_snapshot.json"),
    );
    const sqlFile = readdirSync(outputDirectory).find((file) =>
      file.endsWith(".sql"),
    );
    if (!snapshotFile || !sqlFile) {
      throw new Error("Drizzle did not generate the expected schema snapshot");
    }

    const snapshotContent = readFileSync(
      join(metaDirectory, snapshotFile),
      "utf8",
    );
    const generatedSql = readFileSync(join(outputDirectory, sqlFile), "utf8");
    const snapshot = JSON.parse(snapshotContent) as DesiredSnapshot;
    const schemaHash = createHash("sha256")
      .update(snapshotContent)
      .digest("hex");

    const checkConstraintCount = Object.values(snapshot.tables ?? {}).reduce(
      (count, table) =>
        count + Object.keys(table.checkConstraints ?? {}).length,
      0,
    );
    if (
      Object.keys(snapshot.enums ?? {}).length > 0 ||
      Object.keys(snapshot.sequences ?? {}).length > 0 ||
      Object.keys(snapshot.views ?? {}).length > 0 ||
      checkConstraintCount > 0
    ) {
      throw new Error(
        "Safe push does not yet support schema enums, standalone sequences, views, or check constraints. Use a reviewed migration.",
      );
    }

    const createTableSql = new Map<string, string>();
    const createIndexSql = new Map<string, string>();
    for (const statement of splitGeneratedStatements(generatedSql)) {
      const tableMatch = statement.match(/^CREATE TABLE "([^"]+)"/i);
      if (tableMatch) {
        createTableSql.set(
          tableMatch[1],
          addIfNotExistsToCreateTable(statement),
        );
        continue;
      }

      const indexMatch = statement.match(
        /^CREATE\s+(?:UNIQUE\s+)?INDEX "([^"]+)"/i,
      );
      if (indexMatch) {
        createIndexSql.set(
          indexMatch[1],
          addIfNotExistsToCreateIndex(statement),
        );
      }
    }

    return { snapshot, schemaHash, createTableSql, createIndexSql };
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
}

function buildIdentityClause(column: DesiredColumn): string {
  if (!column.identity) return "";
  const identity = column.identity;
  const generation =
    identity.type === "byDefault" ? "BY DEFAULT" : "ALWAYS";
  const cycle = identity.cycle ? " CYCLE" : "";
  return (
    ` GENERATED ${generation} AS IDENTITY (` +
    `SEQUENCE NAME ${quoteIdentifier(identity.name)} ` +
    `INCREMENT BY ${identity.increment} ` +
    `MINVALUE ${identity.minValue} ` +
    `MAXVALUE ${identity.maxValue} ` +
    `START WITH ${identity.startWith} ` +
    `CACHE ${identity.cache}${cycle})`
  );
}

function buildColumnDefinition(column: DesiredColumn): string {
  const defaultClause =
    column.default === undefined
      ? ""
      : ` DEFAULT ${renderDefault(column.default)}`;
  const nullClause = column.notNull ? " NOT NULL" : "";
  return (
    `${quoteIdentifier(column.name)} ${column.type}` +
    buildIdentityClause(column) +
    defaultClause +
    nullClause
  );
}

function buildConstraintKey(tableName: string, constraintName: string): string {
  return `${tableName}\0${constraintName}`;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string" || value === "{}") {
    return [];
  }
  const content = value.startsWith("{") && value.endsWith("}")
    ? value.slice(1, -1)
    : value;
  if (!content) return [];
  return content
    .split(",")
    .map((item) => item.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"'));
}

function buildUniqueSemanticKey(
  tableName: string,
  columns: string[],
): string {
  return `${tableName}\0unique\0${columns.join("\0")}`;
}

function buildPrimarySemanticKey(
  tableName: string,
  columns: string[],
): string {
  return `${tableName}\0primary\0${columns.join("\0")}`;
}

function normalizeReferentialAction(value?: string): string {
  const normalized = (value ?? "no action").toLowerCase();
  const aliases: Record<string, string> = {
    a: "no action",
    r: "restrict",
    c: "cascade",
    n: "set null",
    d: "set default",
  };
  return aliases[normalized] ?? normalized;
}

function buildForeignKeySemanticKey(
  tableFrom: string,
  columnsFrom: string[],
  tableTo: string,
  columnsTo: string[],
  onDelete?: string,
  onUpdate?: string,
): string {
  return [
    tableFrom,
    "foreign",
    columnsFrom.join(","),
    tableTo,
    columnsTo.join(","),
    normalizeReferentialAction(onDelete),
    normalizeReferentialAction(onUpdate),
  ].join("\0");
}

function normalizeIndexDefinition(value: string): string {
  return value
    .toLowerCase()
    .replace(/;\s*$/, "")
    .replace(/"/g, "")
    .replace(
      new RegExp(`\\b${targetSchema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`, "g"),
      "",
    )
    .replace(/\bif not exists\b/g, "")
    .replace(
      /^(create\s+(?:unique\s+)?index)\s+\S+\s+on\s+/,
      "$1 on ",
    )
    .replace(/\s*,\s*/g, ",")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function describeTarget(): string {
  if (process.env.DB_HOST || process.env.DB_NAME) {
    return `${process.env.DB_HOST ?? "(host unset)"}/${process.env.DB_NAME ?? "(database unset)"} schema=${targetSchema}`;
  }
  const value = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!value) return "(database not configured)";
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}/${parsed.pathname.replace(/^\//, "")} schema=${targetSchema}`;
  } catch {
    return "(configured database URL)";
  }
}

async function tableHasRows(
  client: InstanceType<typeof Client>,
  tableName: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (SELECT 1 FROM ${quoteIdentifier(tableName)} LIMIT 1) AS present`,
  );
  return Boolean(result.rows[0]?.present);
}

async function columnHasNulls(
  client: InstanceType<typeof Client>,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM ${quoteIdentifier(tableName)}
      WHERE ${quoteIdentifier(columnName)} IS NULL
      LIMIT 1
    ) AS present`,
  );
  return Boolean(result.rows[0]?.present);
}

async function constraintValuesConflict(
  client: InstanceType<typeof Client>,
  tableName: string,
  columns: string[],
  requireNonNull: boolean,
): Promise<boolean> {
  const quotedColumns = columns.map(quoteIdentifier);
  const nullPredicate = requireNonNull
    ? quotedColumns.map((column) => `${column} IS NOT NULL`).join(" AND ")
    : "TRUE";
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM ${quoteIdentifier(tableName)}
      WHERE ${nullPredicate}
      GROUP BY ${quotedColumns.join(", ")}
      HAVING COUNT(*) > 1
      LIMIT 1
    ) AS present`,
  );
  return Boolean(result.rows[0]?.present);
}

async function foreignKeyHasOrphans(
  client: InstanceType<typeof Client>,
  foreignKey: DesiredForeignKey,
): Promise<boolean> {
  const sourceAlias = "source_row";
  const targetAlias = "target_row";
  const sourceNotNull = foreignKey.columnsFrom
    .map(
      (column) =>
        `${sourceAlias}.${quoteIdentifier(column)} IS NOT NULL`,
    )
    .join(" AND ");
  const match = foreignKey.columnsFrom
    .map(
      (column, index) =>
        `${targetAlias}.${quoteIdentifier(foreignKey.columnsTo[index])} = ` +
        `${sourceAlias}.${quoteIdentifier(column)}`,
    )
    .join(" AND ");

  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM ${quoteIdentifier(foreignKey.tableFrom)} ${sourceAlias}
      WHERE ${sourceNotNull || "TRUE"}
        AND NOT EXISTS (
          SELECT 1
          FROM ${quoteIdentifier(foreignKey.tableTo)} ${targetAlias}
          WHERE ${match}
        )
      LIMIT 1
    ) AS present`,
  );
  return Boolean(result.rows[0]?.present);
}

async function foreignKeySourceHasValues(
  client: InstanceType<typeof Client>,
  foreignKey: DesiredForeignKey,
): Promise<boolean> {
  const sourceNotNull = foreignKey.columnsFrom
    .map((column) => `${quoteIdentifier(column)} IS NOT NULL`)
    .join(" AND ");
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM ${quoteIdentifier(foreignKey.tableFrom)}
      WHERE ${sourceNotNull || "TRUE"}
      LIMIT 1
    ) AS present`,
  );
  return Boolean(result.rows[0]?.present);
}

function buildForeignKeySql(foreignKey: DesiredForeignKey): string {
  const onDelete =
    foreignKey.onDelete && foreignKey.onDelete !== "no action"
      ? ` ON DELETE ${foreignKey.onDelete.toUpperCase()}`
      : "";
  const onUpdate =
    foreignKey.onUpdate && foreignKey.onUpdate !== "no action"
      ? ` ON UPDATE ${foreignKey.onUpdate.toUpperCase()}`
      : "";
  return (
    `ALTER TABLE ${quoteIdentifier(foreignKey.tableFrom)} ` +
    `ADD CONSTRAINT ${quoteIdentifier(foreignKey.name)} ` +
    `FOREIGN KEY (${foreignKey.columnsFrom.map(quoteIdentifier).join(", ")}) ` +
    `REFERENCES ${quoteIdentifier(foreignKey.tableTo)} ` +
    `(${foreignKey.columnsTo.map(quoteIdentifier).join(", ")})` +
    `${onDelete}${onUpdate}`
  );
}

async function buildPlan(
  client: InstanceType<typeof Client>,
  desired: GeneratedDesiredSchema,
): Promise<{
  operations: PlannedOperation[];
  blockers: string[];
  warnings: string[];
}> {
  const operations: PlannedOperation[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  const tableRows = await client.query<{
    table_name: string;
  }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${quoteLiteral(targetSchema)}
      AND table_type = 'BASE TABLE'
  `);
  const existingTables = new Set(
    tableRows.rows.map((row) => row.table_name),
  );

  const columnRows = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    not_null: boolean;
    default_value: string | null;
  }>(`
    SELECT
      cls.relname AS table_name,
      attr.attname AS column_name,
      format_type(attr.atttypid, attr.atttypmod) AS data_type,
      attr.attnotnull AS not_null,
      pg_get_expr(def.adbin, def.adrelid) AS default_value
    FROM pg_attribute attr
    JOIN pg_class cls ON cls.oid = attr.attrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    LEFT JOIN pg_attrdef def
      ON def.adrelid = attr.attrelid
      AND def.adnum = attr.attnum
    WHERE ns.nspname = ${quoteLiteral(targetSchema)}
      AND cls.relkind IN ('r', 'p')
      AND attr.attnum > 0
      AND NOT attr.attisdropped
  `);
  const existingColumns = new Map<string, ExistingColumn>();
  for (const row of columnRows.rows) {
    existingColumns.set(`${row.table_name}\0${row.column_name}`, {
      tableName: row.table_name,
      columnName: row.column_name,
      dataType: row.data_type,
      notNull: row.not_null,
      defaultValue: row.default_value,
    });
  }

  const constraintRows = await client.query<{
    table_name: string;
    constraint_name: string;
    constraint_type: string;
    columns: unknown;
    foreign_table: string | null;
    foreign_columns: unknown;
    on_delete: string;
    on_update: string;
  }>(`
    SELECT
      cls.relname AS table_name,
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      ARRAY(
        SELECT attr.attname
        FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, position)
        JOIN pg_attribute attr
          ON attr.attrelid = con.conrelid
          AND attr.attnum = key.attnum
        ORDER BY key.position
      ) AS columns,
      foreign_cls.relname AS foreign_table,
      CASE
        WHEN con.confkey IS NULL THEN NULL
        ELSE ARRAY(
          SELECT attr.attname
          FROM unnest(con.confkey) WITH ORDINALITY AS key(attnum, position)
          JOIN pg_attribute attr
            ON attr.attrelid = con.confrelid
            AND attr.attnum = key.attnum
          ORDER BY key.position
        )
      END AS foreign_columns,
      con.confdeltype AS on_delete,
      con.confupdtype AS on_update
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    LEFT JOIN pg_class foreign_cls ON foreign_cls.oid = con.confrelid
    WHERE ns.nspname = ${quoteLiteral(targetSchema)}
  `);
  const existingConstraints = new Set(
    constraintRows.rows.map((row) =>
      buildConstraintKey(row.table_name, row.constraint_name),
    ),
  );
  const existingPrimaryKeys = new Set(
    constraintRows.rows
      .filter((row) => row.constraint_type === "p")
      .map((row) =>
        buildPrimarySemanticKey(row.table_name, toStringArray(row.columns)),
      ),
  );
  const tablesWithPrimaryKeys = new Set(
    constraintRows.rows
      .filter((row) => row.constraint_type === "p")
      .map((row) => row.table_name),
  );
  const existingUniqueConstraints = new Set(
    constraintRows.rows
      .filter((row) => row.constraint_type === "u")
      .map((row) =>
        buildUniqueSemanticKey(row.table_name, toStringArray(row.columns)),
      ),
  );
  const existingForeignKeys = new Set(
    constraintRows.rows
      .filter(
        (row) =>
          row.constraint_type === "f" &&
          row.foreign_table &&
          toStringArray(row.foreign_columns).length > 0,
      )
      .map((row) =>
        buildForeignKeySemanticKey(
          row.table_name,
          toStringArray(row.columns),
          row.foreign_table!,
          toStringArray(row.foreign_columns),
          row.on_delete,
          row.on_update,
        ),
      ),
  );

  const indexRows = await client.query<{
    table_name: string;
    index_name: string;
    index_definition: string;
  }>(`
    SELECT
      tablename AS table_name,
      indexname AS index_name,
      indexdef AS index_definition
    FROM pg_indexes
    WHERE schemaname = ${quoteLiteral(targetSchema)}
  `);
  const existingIndexByName = new Map(
    indexRows.rows.map((row) => [
      `${row.table_name}\0${row.index_name}`,
      normalizeIndexDefinition(row.index_definition),
    ]),
  );
  const existingIndexSemantics = new Set(
    indexRows.rows.map((row) =>
      normalizeIndexDefinition(row.index_definition),
    ),
  );

  const desiredTableNames = new Set(
    Object.values(desired.snapshot.tables).map((table) => table.name),
  );
  const protectedExtraTables = [...existingTables].filter(
    (table) => !desiredTableNames.has(table) && !INTERNAL_TABLES.has(table),
  );
  if (protectedExtraTables.length > 0) {
    warnings.push(
      `${protectedExtraTables.length} database table(s) are not declared in schema.ts and will be preserved: ` +
      protectedExtraTables.sort().join(", "),
    );
  }

  for (const table of Object.values(desired.snapshot.tables)) {
    const tableExists = existingTables.has(table.name);
    if (!tableExists) {
      const createSql = desired.createTableSql.get(table.name);
      if (!createSql) {
        blockers.push(
          `${table.name}: Drizzle did not produce a CREATE TABLE statement`,
        );
        continue;
      }
      operations.push({
        phase: 10,
        description: `create missing table ${table.name}`,
        sql: createSql,
      });
    }

    const desiredColumnNames = new Set(Object.keys(table.columns));
    if (tableExists) {
      const extraColumns = columnRows.rows
        .filter(
          (row) =>
            row.table_name === table.name &&
            !desiredColumnNames.has(row.column_name),
        )
        .map((row) => row.column_name);
      if (extraColumns.length > 0) {
        warnings.push(
          `${table.name}: existing extra column(s) will be preserved: ${extraColumns.join(", ")}`,
        );
      }
    }

    for (const column of Object.values(table.columns)) {
      if (!tableExists) continue;

      const existing = existingColumns.get(
        `${table.name}\0${column.name}`,
      );
      if (!existing) {
        const hasRows = await tableHasRows(client, table.name);
        if (
          hasRows &&
          column.notNull &&
          column.default === undefined &&
          !column.identity
        ) {
          blockers.push(
            `${table.name}.${column.name}: cannot add a required column without a default to a table containing rows`,
          );
          continue;
        }
        if (hasRows && column.identity) {
          blockers.push(
            `${table.name}.${column.name}: adding an identity column to a populated table requires a reviewed migration`,
          );
          continue;
        }

        operations.push({
          phase: 20,
          description: `add missing column ${table.name}.${column.name}`,
          sql:
            `ALTER TABLE ${quoteIdentifier(table.name)} ` +
            `ADD COLUMN IF NOT EXISTS ${buildColumnDefinition(column)}`,
        });
        continue;
      }

      if (normalizeType(existing.dataType) !== normalizeType(column.type)) {
        blockers.push(
          `${table.name}.${column.name}: type differs (` +
          `database=${existing.dataType}, schema=${column.type}); automatic type changes are disabled`,
        );
      }

      if (column.notNull && !existing.notNull) {
        if (await columnHasNulls(client, table.name, column.name)) {
          blockers.push(
            `${table.name}.${column.name}: schema requires NOT NULL but existing rows contain NULL`,
          );
        } else {
          operations.push({
            phase: 30,
            description: `set NOT NULL on ${table.name}.${column.name}`,
            sql:
              `ALTER TABLE ${quoteIdentifier(table.name)} ` +
              `ALTER COLUMN ${quoteIdentifier(column.name)} SET NOT NULL`,
          });
        }
      } else if (!column.notNull && existing.notNull) {
        blockers.push(
          `${table.name}.${column.name}: database is NOT NULL but schema is nullable; dropping constraints requires review`,
        );
      }

      if (
        column.default !== undefined &&
        existing.defaultValue === null &&
        !column.identity
      ) {
        operations.push({
          phase: 30,
          description: `set default on ${table.name}.${column.name}`,
          sql:
            `ALTER TABLE ${quoteIdentifier(table.name)} ` +
            `ALTER COLUMN ${quoteIdentifier(column.name)} ` +
            `SET DEFAULT ${renderDefault(column.default)}`,
        });
      } else if (
        column.default !== undefined &&
        existing.defaultValue !== null &&
        normalizeDefault(existing.defaultValue) !==
          normalizeDefault(column.default)
      ) {
        blockers.push(
          `${table.name}.${column.name}: default differs (` +
          `database=${existing.defaultValue}, schema=${renderDefault(column.default)}); changing defaults requires review`,
        );
      } else if (
        column.default === undefined &&
        existing.defaultValue !== null &&
        !column.identity
      ) {
        warnings.push(
          `${table.name}.${column.name}: existing database default will be preserved`,
        );
      }
    }

    if (tableExists) {
      const primaryColumns = Object.values(table.columns)
        .filter((column) => column.primaryKey)
        .map((column) => column.name);
      const compositePrimaryKeys = Object.values(
        table.compositePrimaryKeys ?? {},
      );
      const primaryKey =
        compositePrimaryKeys[0]?.columns ?? primaryColumns;
      const primarySemanticKey = buildPrimarySemanticKey(
        table.name,
        primaryKey,
      );

      if (
        primaryKey.length > 0 &&
        !existingPrimaryKeys.has(primarySemanticKey)
      ) {
        if (tablesWithPrimaryKeys.has(table.name)) {
          blockers.push(
            `${table.name}: database primary-key columns differ from schema.ts; replacing a primary key requires review`,
          );
          continue;
        }
        const hasNull = await Promise.all(
          primaryKey.map((column) =>
            columnHasNulls(client, table.name, column),
          ),
        );
        const hasDuplicates = await constraintValuesConflict(
          client,
          table.name,
          primaryKey,
          false,
        );
        if (hasNull.some(Boolean) || hasDuplicates) {
          blockers.push(
            `${table.name}: cannot add primary key (${primaryKey.join(", ")}) because existing data contains NULL or duplicate values`,
          );
        } else {
          operations.push({
            phase: 40,
            description: `add missing primary key to ${table.name}`,
            sql:
              `ALTER TABLE ${quoteIdentifier(table.name)} ` +
              `ADD CONSTRAINT ${quoteIdentifier(`${table.name}_pkey`)} ` +
              `PRIMARY KEY (${primaryKey.map(quoteIdentifier).join(", ")})`,
          });
        }
      }
    }

    if (tableExists) {
      for (const unique of Object.values(table.uniqueConstraints ?? {})) {
        const key = buildConstraintKey(table.name, unique.name);
        const semanticKey = buildUniqueSemanticKey(
          table.name,
          unique.columns,
        );
        if (existingUniqueConstraints.has(semanticKey)) continue;
        if (existingConstraints.has(key)) {
          blockers.push(
            `${table.name}.${unique.name}: constraint name exists with a different definition`,
          );
          continue;
        }

        if (
          await constraintValuesConflict(
            client,
            table.name,
            unique.columns,
            true,
          )
        ) {
          blockers.push(
            `${table.name}.${unique.name}: cannot add unique constraint because duplicate values exist`,
          );
          continue;
        }

        const nullsNotDistinct = unique.nullsNotDistinct
          ? " NULLS NOT DISTINCT"
          : "";
        operations.push({
          phase: 40,
          description: `add unique constraint ${unique.name}`,
          sql:
            `ALTER TABLE ${quoteIdentifier(table.name)} ` +
            `ADD CONSTRAINT ${quoteIdentifier(unique.name)} ` +
            `UNIQUE${nullsNotDistinct} (` +
            `${unique.columns.map(quoteIdentifier).join(", ")})`,
        });
      }
    }
  }

  for (const table of Object.values(desired.snapshot.tables)) {
    for (const foreignKey of Object.values(table.foreignKeys ?? {})) {
      const key = buildConstraintKey(
        foreignKey.tableFrom,
        foreignKey.name,
      );
      const semanticKey = buildForeignKeySemanticKey(
        foreignKey.tableFrom,
        foreignKey.columnsFrom,
        foreignKey.tableTo,
        foreignKey.columnsTo,
        foreignKey.onDelete,
        foreignKey.onUpdate,
      );
      if (existingForeignKeys.has(semanticKey)) continue;
      if (existingConstraints.has(key)) {
        blockers.push(
          `${foreignKey.name}: constraint name exists with a different definition`,
        );
        continue;
      }

      const sourceWillExist =
        existingTables.has(foreignKey.tableFrom) ||
        desiredTableNames.has(foreignKey.tableFrom);
      const targetWillExist =
        existingTables.has(foreignKey.tableTo) ||
        desiredTableNames.has(foreignKey.tableTo);
      if (!sourceWillExist || !targetWillExist) {
        blockers.push(
          `${foreignKey.name}: referenced source or target table is unavailable`,
        );
        continue;
      }

      const sourceColumnsExist = foreignKey.columnsFrom.every((column) =>
        existingColumns.has(`${foreignKey.tableFrom}\0${column}`),
      );
      const targetColumnsExist = foreignKey.columnsTo.every((column) =>
        existingColumns.has(`${foreignKey.tableTo}\0${column}`),
      );
      const plannedColumnOnExistingTable =
        (existingTables.has(foreignKey.tableFrom) && !sourceColumnsExist) ||
        (existingTables.has(foreignKey.tableTo) && !targetColumnsExist);
      if (plannedColumnOnExistingTable) {
        const sourceHasRows =
          existingTables.has(foreignKey.tableFrom) &&
          (await tableHasRows(client, foreignKey.tableFrom));
        const targetHasRows =
          existingTables.has(foreignKey.tableTo) &&
          (await tableHasRows(client, foreignKey.tableTo));
        if (sourceHasRows || targetHasRows) {
          blockers.push(
            `${foreignKey.name}: adding an FK together with columns on a populated table requires a reviewed migration`,
          );
          continue;
        }
      }

      if (
        existingTables.has(foreignKey.tableFrom) &&
        sourceColumnsExist
      ) {
        if (
          existingTables.has(foreignKey.tableTo) &&
          targetColumnsExist &&
          (await foreignKeyHasOrphans(client, foreignKey))
        ) {
          blockers.push(
            `${foreignKey.name}: cannot add foreign key because orphaned rows exist`,
          );
          continue;
        }
        if (
          !existingTables.has(foreignKey.tableTo) &&
          (await foreignKeySourceHasValues(client, foreignKey))
        ) {
          blockers.push(
            `${foreignKey.name}: existing source rows reference a target table that would be newly created and empty`,
          );
          continue;
        }
      }

      operations.push({
        phase: 50,
        description: `add foreign key ${foreignKey.name}`,
        sql: buildForeignKeySql(foreignKey),
      });
    }

    for (const index of Object.values(table.indexes ?? {})) {
      const indexSql = desired.createIndexSql.get(index.name);
      if (!indexSql) {
        blockers.push(
          `${table.name}.${index.name}: Drizzle did not produce a CREATE INDEX statement`,
        );
        continue;
      }
      if (
        index.concurrently ||
        Object.keys(index.with ?? {}).length > 0 ||
        index.columns.some((column) => column.isExpression) ||
        /\bWHERE\b/i.test(indexSql)
      ) {
        blockers.push(
          `${table.name}.${index.name}: concurrent, partial, expression, and storage-parameter indexes require a reviewed migration`,
        );
        continue;
      }
      const semanticKey = normalizeIndexDefinition(indexSql);
      if (existingIndexSemantics.has(semanticKey)) continue;

      const nameKey = `${table.name}\0${index.name}`;
      const existingDefinition = existingIndexByName.get(nameKey);
      if (existingDefinition && existingDefinition !== semanticKey) {
        blockers.push(
          `${table.name}.${index.name}: index name exists with a different definition`,
        );
        continue;
      }

      if (
        index.isUnique &&
        existingTables.has(table.name) &&
        (await constraintValuesConflict(
          client,
          table.name,
          index.columns.map((column) => column.expression),
          true,
        ))
      ) {
        blockers.push(
          `${table.name}.${index.name}: cannot create unique index because duplicate values exist`,
        );
        continue;
      }

      operations.push({
        phase: 60,
        description: `create missing index ${index.name}`,
        sql: indexSql,
      });
    }
  }

  return {
    operations: operations.sort((a, b) => a.phase - b.phase),
    blockers,
    warnings,
  };
}

async function ensureHistoryTable(
  client: InstanceType<typeof Client>,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ledgerlm_schema_sync_history (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      schema_hash VARCHAR(64) NOT NULL UNIQUE,
      operation_count INTEGER NOT NULL,
      target_environment VARCHAR(100),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function main(): Promise<void> {
  console.log("====================================================");
  console.log("[db-safe-push] Additive-only schema synchronization");
  console.log(`[db-safe-push] Target: ${describeTarget()}`);
  console.log(`[db-safe-push] Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log("====================================================");

  const desired = generateDesiredSchema();
  const client = new Client(getClientConfig());
  await client.connect();

  try {
    await client.query(
      `SET search_path TO ${quoteIdentifier(targetSchema)}, public`,
    );
    await client.query(
      "SELECT pg_advisory_lock(hashtext('ledgerlm_safe_schema_push'))",
    );
    if (!dryRun) {
      await prepareDatabaseExtensions(client);
    }
    const plan = await buildPlan(client, desired);

    for (const warning of plan.warnings) {
      console.warn(`[db-safe-push] PRESERVED: ${warning}`);
    }

    if (plan.blockers.length > 0) {
      console.error("");
      console.error("[db-safe-push] BLOCKED — no schema changes were applied:");
      for (const blocker of plan.blockers) {
        console.error(`  - ${blocker}`);
      }
      console.error("");
      console.error(
        "Create a reviewed migration for these incompatible differences. " +
        "Drops, truncation, and automatic type conversions are never allowed here.",
      );
      process.exitCode = 2;
      return;
    }

    if (plan.operations.length > 0) {
      console.log("");
      console.log(
        `[db-safe-push] Safe additive plan (${plan.operations.length} operation(s)):`,
      );
      for (const [index, operation] of plan.operations.entries()) {
        console.log(`  ${index + 1}. ${operation.description}`);
      }
    } else {
      console.log("[db-safe-push] Database already satisfies schema.ts.");
    }

    if (dryRun) {
      console.log("");
      console.log("[db-safe-push] Dry run complete; no changes were applied.");
      return;
    }

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query("SET LOCAL statement_timeout = '15min'");
      for (const operation of plan.operations) {
        console.log(`[db-safe-push] Applying: ${operation.description}`);
        await client.query(operation.sql);
      }
      await ensureHistoryTable(client);
      await client.query(
        `INSERT INTO ledgerlm_schema_sync_history
          (schema_hash, operation_count, target_environment)
         VALUES ($1, $2, $3)
         ON CONFLICT (schema_hash) DO NOTHING`,
        [
          desired.schemaHash,
          plan.operations.length,
          process.env.APP_ENV ||
            process.env.NODE_ENV ||
            process.env.ENVIRONMENT ||
            "unknown",
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    console.log("");
    console.log(
      `[db-safe-push] Applied ${plan.operations.length} additive operation(s) and recorded the schema baseline.`,
    );
    console.log(
      "[db-safe-push] Existing tables, columns, and rows were preserved.",
    );
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('ledgerlm_safe_schema_push'))")
      .catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    "[db-safe-push] Fatal:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});