import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { CronExpressionParser } from "cron-parser";
import { and, eq, lte } from "drizzle-orm";
import { db } from "../../db";
import { storage } from "../../storage";
import { boardExports, boardReports, boardSchedules, documentProcessing, documents } from "@shared/schema";
import { assertBoardSourceAccess, assertBoardDocumentAccess, type BoardSourceSelection } from "../boardSourceService";
import { boardScheduleConfigurationSchema } from "@shared/boards/boardSchedule";
import { deterministicAnalysisResultSchema } from "@shared/boards/deterministicAnalysis";
import { runDeterministicBoardEngine, ratioOperandKey, type DeterministicFactRow } from "./deterministicBoardEngine";
import { createBoardAnalysisRun, executeBoardAnalysis, getOrCreateBoardAnalysisConfig } from "./boardRunService";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 100_000;
const MAX_COLUMNS = 100;
const MAX_SHEETS = 10;
const SAFE_EXTENSIONS = new Set([".csv"]);
const FORMULA = /^[\s\u0000-\u001f]*[=+\-@]/;

export interface VaultDataset {
  documentId: string;
  documentVersion: string;
  name: string;
  headers: string[];
  rows: Array<Record<string, string | number | null>>;
  provenance: { sourceType: "vault"; documentId: string; fileName: string; rowCount: number };
  contentHash: string;
}

export interface VaultAnalysisPlan {
  request: { year?: number; dimensions?: string[]; keyColumns?: Array<{ column: string; label: string; aggregation?: "sum" | "last" | "latest" | "average" | "min" | "max" | "count" | "ratio"; valueType?: "currency" | "percentage" | "count" | "ratio" | "number"; favorability?: "higher-is-favorable" | "lower-is-favorable" | "neutral"; numerator?: string; denominator?: string; dimension?: string | null; dimensionValues?: string[] }>; months?: number[]; comparison?: { year: number; months: number[] } };
  settings: { columnMapping: { actuals: string; budget: string; forecast?: string }; scopeConfig?: { filters?: Array<{ column?: string; dimension?: string; values?: string[] }> } };
}

function uniqueHeader(headers: string[], requested: string): string {
  const matches = headers.filter((header) => header.toLowerCase() === requested.toLowerCase());
  if (matches.length !== 1) throw new Error(matches.length ? `Ambiguous Vault column mapping: ${requested}` : `Missing Vault column mapping: ${requested}`);
  return matches[0]!;
}

export function assertVaultIdentity(expected: { documentId: string; contentHash: string }, current: { documentId: string; contentHash: string }) {
  if (expected.documentId !== current.documentId || expected.contentHash !== current.contentHash) throw new Error("Vault document changed since this Board run was queued");
}

export function runVaultDeterministicAnalysis(dataset: VaultDataset, plan: VaultAnalysisPlan) {
  const headers = dataset.headers;
  const versionHeader = uniqueHeader(headers, "version");
  const yearHeader = uniqueHeader(headers, "year");
  const monthHeader = uniqueHeader(headers, "month");
  const dimensions = (plan.request.dimensions ?? []).map((dimension) => uniqueHeader(headers, dimension));
  const measures = (plan.request.keyColumns ?? []).map((key, index) => {
    const column = key.aggregation === "ratio" ? key.column : uniqueHeader(headers, key.column);
    const id = `${column}${(plan.request.keyColumns ?? []).filter((candidate) => candidate.column.toLowerCase() === key.column.toLowerCase()).length > 1 ? `.${index + 1}` : ""}`;
    const numerator = key.numerator ? uniqueHeader(headers, key.numerator) : undefined;
    const denominator = key.denominator ? uniqueHeader(headers, key.denominator) : undefined;
    if (key.aggregation === "ratio" && (!numerator || !denominator)) throw new Error(`Vault ratio ${key.label} requires explicit numerator and denominator`);
    return { ...key, id, column, numerator, denominator, aggregation: key.aggregation ?? "sum" };
  });
  if (!measures.length) throw new Error("Vault analysis requires at least one selected measure");
  const requestedMonths = plan.request.months?.length ? new Set(plan.request.months) : undefined;
  const filters = plan.settings.scopeConfig?.filters ?? [];
  const matchesFilter = (row: Record<string, string | number | null>, filter: { column?: string; dimension?: string; values?: string[] }) => {
    const header = uniqueHeader(headers, filter.column ?? filter.dimension ?? "");
    return (filter.values ?? []).map(String).includes(String(row[header] ?? ""));
  };
  const rows = dataset.rows.filter((row) => {
    const month = Number(row[monthHeader]);
    if (requestedMonths && !requestedMonths.has(month)) return false;
    return filters.every((filter) => matchesFilter(row, filter));
  });
  const aggregate = (values: number[], kind: string) => {
    if (!values.length) return 0;
    if (kind === "average") return values.reduce((a, b) => a + b, 0) / values.length;
    if (kind === "min") return Math.min(...values);
    if (kind === "max") return Math.max(...values);
    if (kind === "last" || kind === "latest") return values[values.length - 1]!;
    return values.reduce((a, b) => a + b, 0);
  };
  const sideRows = (version: string, period?: { year: number; months: number[] }) => rows.filter((row) => String(row[versionHeader]) === version
    && (!period || (Number(row[yearHeader]) === period.year && period.months.includes(Number(row[monthHeader])))));
  const valuesFor = (rowSet: typeof rows, header: string) => rowSet.map((row) => Number(row[header])).filter(Number.isFinite);
  const grouped = new Map<string, { rows: typeof rows; values: Array<string | null> }>();
  for (const row of rows) {
    const values = dimensions.map((dimension) => row[dimension] == null ? null : String(row[dimension]));
    const key = JSON.stringify(values);
    const entry = grouped.get(key) ?? { rows: [], values };
    entry.rows.push(row); grouped.set(key, entry);
  }
  if (grouped.size > 500) throw new Error("Vault scope produces more than 500 groups");
  const period = { year: Number(plan.request.year ?? rows[0]?.[yearHeader] ?? new Date().getFullYear()), months: Array.from(requestedMonths ?? new Set(rows.map((row) => Number(row[monthHeader])))) };
  const comparison = plan.request.comparison;
  const toRecord = (set: typeof rows, measure: typeof measures[number]) => {
    const result: Record<string, number> = {};
    if (measure.aggregation === "ratio") {
      result[ratioOperandKey(measure.id, "numerator")] = aggregate(valuesFor(set, measure.numerator!), "sum");
      result[ratioOperandKey(measure.id, "denominator")] = aggregate(valuesFor(set, measure.denominator!), "sum");
    } else result[measure.id] = measure.aggregation === "count" ? set.length : aggregate(valuesFor(set, measure.column), measure.aggregation);
    return result;
  };
  const total = (measure: typeof measures[number]) => {
    const actualSet = sideRows(plan.settings.columnMapping.actuals, period);
    const budgetSet = sideRows(plan.settings.columnMapping.budget, period);
    const actual = toRecord(actualSet, measure); const budget = toRecord(budgetSet, measure);
    const comparisonActual = comparison ? toRecord(sideRows(plan.settings.columnMapping.actuals, comparison), measure) : undefined;
    const comparisonBudget = comparison ? toRecord(sideRows(plan.settings.columnMapping.budget, comparison), measure) : undefined;
    return { actual, budget, comparisonActual, comparisonBudget };
  };
  const engineMeasures = measures.map((measure) => ({ id: measure.id, label: measure.label, aggregation: measure.aggregation, valueType: measure.valueType ?? "number", favorability: measure.favorability ?? "neutral", numerator: measure.numerator ? ratioOperandKey(measure.id, "numerator") : undefined, denominator: measure.denominator ? ratioOperandKey(measure.id, "denominator") : undefined, filters: [] }));
  const authoritativeTotals = engineMeasures.map((measure) => {
    const sides = total(measures.find((candidate) => candidate.id === measure.id)!);
    const input = { request: { schemaVersion: 1 as const, measures: [measure], contributorLimit: 500 }, rows: [{ key: "total", actual: sides.actual, budget: sides.budget, comparisonActual: sides.comparisonActual, comparisonBudget: sides.comparisonBudget }] };
    return runDeterministicBoardEngine(input).measures[0]!;
  });
  const factRows: DeterministicFactRow[] = Array.from(grouped, ([key, entry]) => {
    const actual: Record<string, number> = {}; const budget: Record<string, number> = {}; const comparisonActual: Record<string, number> = {}; const comparisonBudget: Record<string, number> = {};
    for (const measure of measures) {
      Object.assign(actual, toRecord(entry.rows.filter((row) => String(row[versionHeader]) === plan.settings.columnMapping.actuals && (!requestedMonths || requestedMonths.has(Number(row[monthHeader])))), measure));
      Object.assign(budget, toRecord(entry.rows.filter((row) => String(row[versionHeader]) === plan.settings.columnMapping.budget && (!requestedMonths || requestedMonths.has(Number(row[monthHeader])))), measure));
      if (comparison) {
        Object.assign(comparisonActual, toRecord(entry.rows.filter((row) => String(row[versionHeader]) === plan.settings.columnMapping.actuals && Number(row[yearHeader]) === comparison.year && comparison.months.includes(Number(row[monthHeader]))), measure));
        Object.assign(comparisonBudget, toRecord(entry.rows.filter((row) => String(row[versionHeader]) === plan.settings.columnMapping.budget && Number(row[yearHeader]) === comparison.year && comparison.months.includes(Number(row[monthHeader]))), measure));
      }
    }
    return { key, actual, budget, comparisonActual, comparisonBudget };
  });
  const result = runDeterministicBoardEngine({ request: { schemaVersion: 1, measures: engineMeasures, contributorLimit: 500 }, rows: factRows, authoritativeTotals, evidence: [{ sourceId: dataset.documentId, sourceType: "vault", queryFingerprint: `vault-${dataset.contentHash.slice(0, 32)}`, period: String(period.year), rowCount: rows.length }] });
  return deterministicAnalysisResultSchema.parse(result);
}

function safeCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function rejectFormula(value: unknown) {
  if (typeof value === "string" && FORMULA.test(value.trim())) throw new Error("Formula cells are not supported in Board Vault imports");
}

function normalizeHeaders(values: unknown[]): string[] {
  if (values.length === 0 || values.length > MAX_COLUMNS) throw new Error("The tabular source must contain 1-100 columns");
  const headers = values.map((value) => String(value ?? "").trim());
  if (headers.some((header) => !header || header.length > 200)) throw new Error("Column headers must be non-empty and at most 200 characters");
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) throw new Error("Duplicate column headers require explicit source mapping");
  return headers;
}

export function parseBoundedCsv(input: string, documentId = "preview", version = "content", name = "upload.csv"): VaultDataset {
  if (Buffer.byteLength(input) > MAX_BYTES) throw new Error("Vault source exceeds the 25 MB Board limit");
  const records: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => { pushCell(); if (row.some((value) => value !== "")) records.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === "," && !quoted) pushCell();
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && input[i + 1] === "\n") i++; pushRow(); }
    else cell += char;
    if (records.length > MAX_ROWS + 1) throw new Error("CSV exceeds the 100000 row Board limit");
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (row.length || cell) pushRow();
  if (records.length < 2) throw new Error("CSV must contain 1-100000 data rows");
  const headers = normalizeHeaders(records[0]!);
  const rows = records.slice(1).map((cells) => {
    if (cells.length !== headers.length) throw new Error("CSV rows must have a consistent number of columns");
    cells.forEach(rejectFormula);
    return Object.fromEntries(headers.map((header, index) => [header, safeCell(cells[index])]));
  });
  return { documentId, documentVersion: version, name, headers, rows, provenance: { sourceType: "vault", documentId, fileName: name, rowCount: rows.length }, contentHash: createHash("sha256").update(input).digest("hex") };
}

async function parseCsv(filePath: string, documentId: string, version: string, name: string): Promise<VaultDataset> {
  return parseBoundedCsv(await fs.readFile(filePath, "utf8"), documentId, version, name);
}

async function parseXlsx(filePath: string, documentId: string, version: string, name: string): Promise<VaultDataset> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_BYTES) throw new Error("Vault source exceeds the 25 MB Board limit");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  if (workbook.worksheets.length === 0 || workbook.worksheets.length > MAX_SHEETS) throw new Error("XLSX must contain 1-10 worksheets");
  if (workbook.worksheets.some((sheet) => sheet.state !== "visible")) throw new Error("Hidden worksheets are not supported");
  const sheet = workbook.worksheets[0]!;
  const headerValues: unknown[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => headerValues.push(cell.value));
  const headers = normalizeHeaders(headerValues);
  const rows: Array<Record<string, string | number | null>> = [];
  for (let rowNumber = 2; rowNumber <= Math.min(sheet.rowCount, MAX_ROWS + 1); rowNumber++) {
    const values: unknown[] = [];
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.SharedString) throw new Error("Formula cells are not supported in Board Vault imports");
      values.push(cell.value);
    });
    while (values.length < headers.length) values.push(null);
    if (values.length > headers.length) throw new Error("XLSX rows must have a consistent number of columns");
    values.forEach(rejectFormula);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, safeCell(values[index])])));
  }
  if (sheet.rowCount > MAX_ROWS + 1) throw new Error("XLSX exceeds the 100000 row Board limit");
  return { documentId, documentVersion: version, name, headers, rows, provenance: { sourceType: "vault", documentId, fileName: name, rowCount: rows.length }, contentHash: createHash("sha256").update(await fs.readFile(filePath)).digest("hex") };
}

export async function loadVaultBoardDataset(userId: string, documentId: string): Promise<VaultDataset> {
  await assertBoardDocumentAccess(userId, documentId);
  const doc = (await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1))[0];
  if (!doc) throw new Error("Vault document is not available");
  const ext = path.extname(doc.name).toLowerCase();
  if (!SAFE_EXTENSIONS.has(ext)) throw new Error("Board Vault analysis supports CSV and XLSX only; PDF and other files are unsupported");
  const processing = (await db.select().from(documentProcessing).where(eq(documentProcessing.documentId, documentId)).limit(1))[0];
  if (processing && processing.status !== "completed") throw new Error(`Vault document is not processed (${processing.status})`);
  const version = doc.uploadedAt.toISOString();
  if (ext === ".csv") {
    const file = await fs.readFile(doc.filePath);
    const dataset = parseBoundedCsv(file.toString("utf8"), doc.id, version, doc.name);
    return { ...dataset, documentVersion: `${version}:${dataset.contentHash}` };
  }
  throw new Error("XLSX Vault ingestion is disabled until bounded ZIP decompression is available; CSV is supported");
}

export async function getBoardSourcePreview(userId: string, selection: BoardSourceSelection) {
  await assertBoardSourceAccess(userId, selection);
  if (selection.sourceType === "vault") {
    const data = await loadVaultBoardDataset(userId, selection.documentId);
    return { sourceType: "vault", sourceId: data.documentId, version: data.documentVersion, columns: data.headers, rowCount: data.rows.length, provenance: data.provenance };
  }
  const source = await (await import("../boardSourceService")).getAuthorizedBoardSource(userId, selection);
  return { sourceType: "enterprise", sourceId: source.id, name: source.name, columns: source.columns ?? [], versions: source.versions ?? [], metadata: source.metadata };
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportDeterministicCsv(metrics: unknown): Buffer {
  const parsed = deterministicAnalysisResultSchema.parse(metrics);
  const result = parsed as { measures?: Array<Record<string, unknown>>; contributors?: Array<Record<string, unknown>> };
  const lines = ["Measure,Actual,Budget,Variance,Variance %"];
  for (const measure of result.measures ?? []) lines.push([measure.measureId, measure.actual, measure.budget, measure.variance, measure.variancePct].map(csvEscape).join(","));
  return Buffer.from(lines.join("\n"), "utf8");
}

export async function exportDeterministicXlsx(metrics: unknown): Promise<Buffer> {
  const parsed = deterministicAnalysisResultSchema.parse(metrics);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Deterministic metrics");
  sheet.addRow(["Measure", "Actual", "Budget", "Variance", "Variance %"]);
  for (const measure of ((parsed as any).measures ?? [])) sheet.addRow([csvEscape(measure.measureId), measure.actual, measure.budget, measure.variance, measure.variancePct]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function runDueBoardSchedules(now = new Date()): Promise<number> {
  const due = await db.select().from(boardSchedules)
    .where(and(eq(boardSchedules.enabled, 1), lte(boardSchedules.nextRunAt, now)));
  let executed = 0;
  for (const schedule of due) {
    // Atomic timestamp claim prevents two workers from starting the same schedule.
    const occurrenceKey = `${schedule.id}:${schedule.nextRunAt?.toISOString() ?? now.toISOString()}`;
    const nextRunAt = computeNextBoardScheduleRun(schedule, now);
    const claim = await db.update(boardSchedules).set({
      nextRunAt,
      lastRunAt: now, lastRunStatus: "claimed", updatedAt: now,
    }).where(and(eq(boardSchedules.id, schedule.id), eq(boardSchedules.enabled, 1), lte(boardSchedules.nextRunAt, now))).returning();
    if (!claim[0]) continue;
    try {
      const config = await getOrCreateBoardAnalysisConfig(schedule.boardId);
      const sourceSelection = config?.sourceConfig as BoardSourceSelection | undefined;
      if (!sourceSelection) throw new Error("Scheduled Board has no source configuration");
      await assertBoardSourceAccess(schedule.createdBy, sourceSelection);
      const run = await createBoardAnalysisRun({
        boardId: schedule.boardId, userId: schedule.createdBy,
        trigger: "schedule", idempotencyKey: `schedule:${occurrenceKey}`,
        request: { sourceSelection },
      });
      await executeBoardAnalysis(run.id);
      await db.update(boardSchedules).set({ lastRunStatus: "success", updatedAt: new Date() }).where(eq(boardSchedules.id, schedule.id));
      executed++;
    } catch {
      await db.update(boardSchedules).set({ lastRunStatus: "failed", updatedAt: new Date() }).where(eq(boardSchedules.id, schedule.id));
    }
  }
  return executed;
}

export function computeNextBoardScheduleRun(config: {
  frequency: string; interval?: number | null; intervalUnit?: string | null; timezone: string; startAt: Date;
}, after = new Date()): Date {
  const cron = config.frequency === "15-minutes" ? "*/15 * * * *"
    : config.frequency === "hourly" ? "0 * * * *"
    : config.frequency === "daily" ? "0 0 * * *"
    : config.frequency === "weekly" ? "0 0 * * 0"
    : config.frequency === "monthly" ? "0 0 1 * *" : null;
  if (cron) return CronExpressionParser.parse(cron, { currentDate: after, tz: config.timezone }).next().toDate();
  const interval = Math.max(1, config.interval ?? 1);
  const unit = config.intervalUnit === "hours" ? 3_600_000 : config.intervalUnit === "days" ? 86_400_000
    : config.intervalUnit === "weeks" ? 604_800_000 : config.intervalUnit === "months" ? 2_592_000_000 : 60_000;
  const candidate = new Date(config.startAt);
  while (candidate <= after) candidate.setTime(candidate.getTime() + interval * unit);
  return candidate;
}

export { boardSchedules, boardExports, boardReports, boardScheduleConfigurationSchema };