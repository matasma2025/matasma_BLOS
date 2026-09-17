import { sql } from "drizzle-orm";
import { db } from "../../../db";
import type { DeterministicEngineInput, DeterministicFactRow } from "../deterministicBoardEngine";
import { ratioOperandKey, runDeterministicBoardEngine } from "../deterministicBoardEngine";
import type { DeterministicMeasure, DeterministicMeasureResult } from "@shared/boards/deterministicAnalysis";
import type { BoardScopeFilter, BoardScopeQueryPlan } from "./scopeQueryPlanner";
import { ENTERPRISE_DIMENSIONS, ENTERPRISE_MEASURES } from "./sourceSchemaService";

type VersionPeriod = { version: string; year: number; months: number[] };
type QueryRow = { dimension_key: string; value?: string | number; numerator?: string | number; denominator?: string | number };
const allowedColumns = new Set(Object.keys(ENTERPRISE_MEASURES));

function dedupeFilters(filters: BoardScopeFilter[]): BoardScopeFilter[] {
  const seen = new Set<string>();
  return filters.filter((filter) => {
    const key = `${filter.dbColumn}:${[...filter.values].sort().join("\u0001")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function conditions(period: VersionPeriod, filters: BoardScopeFilter[]) {
  const clauses = [
    sql`cube_id = ${period.version.split("\u0000")[0]}`,
    sql`version = ${period.version.split("\u0000")[1]}`,
    sql`year = ${period.year}`,
    sql`month IN (${sql.join(period.months.map((month) => sql`${month}`), sql`, `)})`,
  ];
  for (const filter of dedupeFilters(filters)) {
    if (!/^[a-z_]+$/.test(filter.dbColumn)) throw new Error("Unsupported Enterprise filter column");
    clauses.push(sql`${sql.raw(filter.dbColumn)}::text IN (${sql.join(filter.values.map((value) => sql`${value}`), sql`, `)})`);
  }
  return sql.join(clauses, sql` AND `);
}

function groupExpressions(plan: BoardScopeQueryPlan) {
  const columns = plan.dimensions.map((dimension) => {
    const column = ENTERPRISE_DIMENSIONS[dimension as keyof typeof ENTERPRISE_DIMENSIONS];
    if (!column) throw new Error("Unsupported Enterprise dimension");
    return column;
  });
  if (!columns.length) throw new Error("Board analysis requires at least one permitted Enterprise dimension");
  return {
    // JSON preserves tuple boundaries, embedded separators, and SQL nulls.
    select: sql.raw(`json_build_array(${columns.join(", ")})::text`),
    groupBy: sql.raw(columns.join(", ")),
  };
}

function aggregateExpression(measure: DeterministicMeasure, column: string) {
  if (!allowedColumns.has(column)) throw new Error("Unsupported Enterprise measure");
  const identifier = sql.raw(`${column}::float`);
  if (measure.aggregation === "count") return sql`COUNT(${sql.raw(column)})`;
  if (measure.aggregation === "average") return sql`COALESCE(AVG(${identifier}), 0)`;
  if (measure.aggregation === "min") return sql`COALESCE(MIN(${identifier}), 0)`;
  if (measure.aggregation === "max") return sql`COALESCE(MAX(${identifier}), 0)`;
  return sql`COALESCE(SUM(${identifier}), 0)`;
}

function makeMeasure(id: string, source: BoardScopeQueryPlan["measures"][number]): DeterministicMeasure {
  const aggregations = new Set(["sum", "last", "average", "min", "max", "count", "ratio"]);
  const valueTypes = new Set(["currency", "percentage", "count", "ratio", "number"]);
  const favorability = new Set(["higher-is-favorable", "lower-is-favorable", "neutral"]);
  if (!aggregations.has(source.aggregation) || !valueTypes.has(source.valueType) || !favorability.has(source.favorability)) {
    throw new Error(`Invalid deterministic measure definition: ${id}`);
  }
  if (source.aggregation === "ratio" && (!source.numerator || !source.denominator)) {
    throw new Error(`Ratio measure ${id} requires explicit operands`);
  }
  return {
    id, label: source.label, aggregation: source.aggregation as DeterministicMeasure["aggregation"],
    valueType: source.valueType, favorability: source.favorability,
    numerator: source.numerator, denominator: source.denominator, filters: [],
  };
}

async function queryMeasure(cubeId: string, version: string, period: { year: number; months: number[] }, plan: BoardScopeQueryPlan, measure: BoardScopeQueryPlan["measures"][number], grouped: boolean) {
  const definition = makeMeasure(measure.id, measure);
  const filters = [...plan.filters, ...measure.filters];
  const periodForQuery = { version: `${cubeId}\u0000${version}`, year: period.year, months: period.months };
  const where = conditions(periodForQuery, filters);
  const group = groupExpressions(plan);
  const latest = definition.aggregation === "last" || definition.aggregation === "latest";
  const baseWhere = latest
    ? sql`${where} AND month = (SELECT MAX(month) FROM cube_fact_data WHERE ${where})`
    : where;
  const key = grouped ? sql`${group.select} AS dimension_key,` : sql``;
  const groupBy = grouped ? sql` GROUP BY ${group.groupBy} ORDER BY dimension_key LIMIT ${plan.maxGroups + 1}` : sql``;
  if (definition.aggregation === "ratio") {
    const numerator = aggregateExpression(definition, definition.numerator!);
    const denominator = aggregateExpression(definition, definition.denominator!);
    const result = await db.execute(sql`SELECT ${key} ${numerator} AS numerator, ${denominator} AS denominator FROM cube_fact_data WHERE ${baseWhere}${groupBy}`);
    return ((result.rows ?? result) as unknown as QueryRow[]).map((row) => ({ ...row, value: Number(row.denominator) === 0 ? 0 : Number(row.numerator) / Number(row.denominator) }));
  }
  const expression = aggregateExpression(definition, measure.column);
  const result = await db.execute(sql`SELECT ${key} ${expression} AS value FROM cube_fact_data WHERE ${baseWhere}${groupBy}`);
  return ((result.rows ?? result) as unknown as QueryRow[]).map((row) => ({ ...row, value: Number(row.value) || 0 }));
}

export async function executeEnterpriseDeterministicAnalysis(params: {
  cubeId: string;
  plan: BoardScopeQueryPlan;
  actualVersion?: string;
  budgetVersion?: string;
  sourceName?: string;
}): Promise<ReturnType<typeof runDeterministicBoardEngine>> {
  const measures = params.plan.measures.map((measure) => makeMeasure(measure.id, measure));
  const periods: Array<{ label: "actual" | "budget" | "comparisonActual" | "comparisonBudget"; version: string; period: { year: number; months: number[] } }> = [
    { label: "actual", version: params.actualVersion ?? "actuals", period: { year: params.plan.year, months: params.plan.months } },
    { label: "budget", version: params.budgetVersion ?? "budget", period: { year: params.plan.year, months: params.plan.months } },
  ];
  if (params.plan.comparison) {
    periods.push({ label: "comparisonActual", version: params.actualVersion ?? "actuals", period: params.plan.comparison });
    periods.push({ label: "comparisonBudget", version: params.budgetVersion ?? "budget", period: params.plan.comparison });
  }
  const groupedRows = new Map<string, DeterministicFactRow>();
  const totals = new Map<string, { actual?: QueryRow; budget?: QueryRow; comparisonActual?: QueryRow; comparisonBudget?: QueryRow }>();
  for (const measure of params.plan.measures) {
    for (const period of periods) {
      const totalRows = await queryMeasure(params.cubeId, period.version, period.period, params.plan, measure, false);
      const grouped = await queryMeasure(params.cubeId, period.version, period.period, params.plan, measure, true);
      const total = totals.get(measure.id) ?? {};
      total[period.label] = totalRows[0] ?? { value: 0 };
      totals.set(measure.id, total);
      for (const row of grouped) {
        const current = groupedRows.get(row.dimension_key) ?? { key: row.dimension_key, actual: {}, budget: {} };
        const target = period.label === "actual" ? current.actual
          : period.label === "budget" ? current.budget
          : period.label === "comparisonActual" ? (current.comparisonActual ??= {})
          : (current.comparisonBudget ??= {});
        target[measure.id] = Number(row.value) || 0;
        if (measure.aggregation === "ratio") {
          target[ratioOperandKey(measure.id, "numerator")] = Number(row.numerator) || 0;
          target[ratioOperandKey(measure.id, "denominator")] = Number(row.denominator) || 0;
        }
        groupedRows.set(row.dimension_key, current);
      }
    }
  }
  if (groupedRows.size > params.plan.maxGroups) throw new Error(`Board scope produces more than ${params.plan.maxGroups} groups; reduce dimensions or filters`);
  const authoritativeTotals: DeterministicMeasureResult[] = measures.map((measure) => {
    const total = totals.get(measure.id)!;
    const actual = Number(total.actual?.value) || 0;
    const budget = Number(total.budget?.value) || 0;
    const comparisonActual = total.comparisonActual ? Number(total.comparisonActual.value) || 0 : undefined;
    const comparisonBudget = total.comparisonBudget ? Number(total.comparisonBudget.value) || 0 : undefined;
    const variance = actual - budget;
    return {
      measureId: measure.id, actual, budget, variance,
      variancePct: budget === 0 ? null : variance / Math.abs(budget) * 100,
      comparisonActual, comparisonBudget,
      comparisonVariance: comparisonActual === undefined || comparisonBudget === undefined ? undefined : comparisonActual - comparisonBudget,
      contribution: null,
      favorable: variance === 0 || measure.favorability === "neutral" ? null : measure.favorability === "higher-is-favorable" ? variance > 0 : variance < 0,
      material: Math.abs(variance) >= (measure.materiality ?? 0),
    };
  });
  const request: DeterministicEngineInput["request"] = { schemaVersion: 1, measures, contributorLimit: params.plan.maxGroups };
  return runDeterministicBoardEngine({ request, rows: Array.from(groupedRows.values()), authoritativeTotals, evidence: [{ sourceId: params.cubeId, sourceType: "enterprise", queryFingerprint: "enterprise-deterministic-v1", period: `${params.plan.year}`, rowCount: groupedRows.size }] });
}