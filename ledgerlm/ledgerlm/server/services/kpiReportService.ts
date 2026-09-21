import { sql } from "drizzle-orm";
import { db } from "../db";

export const KPI_METRICS = [
  { id: "revenue", label: "Budget / Revenue", unit: "mUSD" },
  { id: "internal_utilization", label: "Internal Utilization", unit: "percent" },
  { id: "external_utilization", label: "External Utilization", unit: "percent" },
  { id: "capacity", label: "Capacity", unit: "capacity" },
] as const;

export type KpiMetricId = (typeof KPI_METRICS)[number]["id"];

export interface KpiReportRequest {
  cubeId: string;
  year: number;
  month: number;
  entity?: string;
  forecastScenario: string;
}

type AggregateRow = {
  revenue_value: string | number | null;
  revenue_rows: string | number | null;
  internal_value: string | number | null;
  internal_rows: string | number | null;
  external_value: string | number | null;
  external_rows: string | number | null;
  capacity_value: string | number | null;
  capacity_rows: string | number | null;
};

type BreakdownRow = AggregateRow & {
  breakdown: string;
};

const KPI_BREAKDOWN_LABELS = ["MS", "MM", "SDS", "MS-External", "Integrated Service"] as const;

const ALL_ENTITIES_LABEL = "All entities";
const ACTUAL_VERSION_PREDICATE = sql`(version IS NULL OR trim(version) = '')`;
const ENTITY_PAGE_PREDICATE = sql`
  upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
    IN ('ENTITY', 'ENTITY VIEW')
`;
const UTILIZATION_PAGE_PREDICATE = sql`
  upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
    IN ('', 'BLANK')
`;

function rowsOf(result: unknown): any[] {
  return (result as { rows?: any[] }).rows ?? [];
}

function numeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueOrNull(value: number | null, rowCount: number | null): number | null {
  return rowCount && rowCount > 0 ? value : null;
}

function normalizedEntity(entity?: string): string | null {
  const value = entity?.trim();
  return value ? value.toUpperCase() : null;
}

function isWorldWideEntity(entity?: string) {
  const value = normalizedEntity(entity);
  return value === "WORLD WIDE" || value === "WORLDWIDE" || value === "WORLWIDE";
}

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (isWorldWideEntity(entity)) {
    return sql`upper(trim(coalesce(region_entity, ''))) IN ('BGSW', 'BGSV', 'BGSW/NE-MX')`;
  }
  if (selected === "NE-MX" || selected === "MEXICO") {
    return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
  }
  if (selected) {
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`
    : sql`TRUE`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (isWorldWideEntity(entity)) {
    return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLWIDE')`;
  }
  if (selected) {
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function forecastPagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(trim(coalesce(page, ''))) IN ('ENTITY', 'WORLD WIDE', 'WORLWIDE')`
    : sql`upper(trim(coalesce(page, ''))) = 'ENTITY'`;
}

function forecastScenarioPredicate(scenario: string) {
  if (scenario === "YTD Forecast") {
    return sql`lower(trim(plan_type)) = 'ytd forecast'`;
  }
  return sql`upper(trim(plan_type)) LIKE ${`${scenario.toUpperCase()} %`}`;
}

function safeScenario(scenario: string): string {
  const normalized = scenario.trim().toUpperCase();
  if (normalized === "YTD FORECAST") return "YTD Forecast";
  if (/^CF(02|05|09|11)$/.test(normalized)) return normalized;
  throw new Error("Forecast scenario must be YTD Forecast, CF02, CF05, CF09, or CF11.");
}

export function validateKpiReportRequest(payload: unknown): KpiReportRequest {
  const request = (payload ?? {}) as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string" || request.cubeId.length > 255) {
    throw new Error("A KPI cube is required.");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Select a valid reporting year.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Select a reporting month.");
  }
  return {
    cubeId: request.cubeId,
    year,
    month,
    entity: typeof request.entity === "string" ? request.entity.trim() || undefined : undefined,
    forecastScenario: safeScenario(String(request.forecastScenario || "YTD Forecast")),
  };
}

export async function getKpiReportOptions(cubeId: string) {
  const [yearsResult, entityResult, scenarioResult, actualResult] = await Promise.all([
    db.execute(sql`
      SELECT DISTINCT year
      FROM cube_plan_data
      WHERE cube_id = ${cubeId} AND year IS NOT NULL
      ORDER BY year DESC
    `),
    db.execute(sql`
      SELECT DISTINCT trim(entity) AS entity
      FROM cube_plan_data
      WHERE cube_id = ${cubeId}
        AND entity IS NOT NULL
        AND trim(entity) <> ''
        AND ${ENTITY_PAGE_PREDICATE}
      ORDER BY entity
    `),
    db.execute(sql`
      SELECT DISTINCT upper(substring(trim(plan_type) FROM '^(CF02|CF05|CF09|CF11)')) AS scenario
      FROM cube_plan_data
      WHERE cube_id = ${cubeId}
        AND upper(trim(plan_type)) ~ '^(CF02|CF05|CF09|CF11)\\s+\\d{4}$'
      ORDER BY scenario
    `),
    db.execute(sql`
      SELECT EXISTS(
        SELECT 1 FROM cube_fact_data
        WHERE cube_id = ${cubeId} AND ${ACTUAL_VERSION_PREDICATE}
      ) AS actual_available
    `),
  ]);

  const forecastScenarios = [
    "YTD Forecast",
    ...rowsOf(scenarioResult).map((row) => String(row.scenario)).filter(Boolean),
  ];
  return {
    years: rowsOf(yearsResult).map((row) => Number(row.year)).filter(Number.isFinite),
    entities: rowsOf(entityResult).map((row) => String(row.entity)).filter(Boolean),
    forecastScenarios: Array.from(new Set(forecastScenarios)),
    defaultForecastScenario: "YTD Forecast",
    actualAvailable: Boolean(rowsOf(actualResult)[0]?.actual_available),
  };
}

async function runKpiMetricSnapshot(request: KpiReportRequest) {
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const forecastPage = forecastPagePredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);

  const [actualResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
          THEN amount_usd
        END) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ), 0) AS internal_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ), 0) AS external_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'external'
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (
          WHERE cost_category = 'GB Wise END Capacity'
            AND month = ${request.month}
            AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'GB Wise END Capacity'
            AND month = ${request.month}
            AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month BETWEEN 1 AND ${request.month}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
    `),
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN ${scenario}
            AND ${forecastEntity}
            AND ${forecastPage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
          THEN CASE
            WHEN replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
            THEN replace(trim(cost_value), ',', '')::numeric
          END
          ELSE NULL
        END) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastEntity}
            AND ${forecastPage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
        ) AS revenue_rows,
        SUM(CASE WHEN ${scenario} AND ${forecastEntity}
          AND ${UTILIZATION_PAGE_PREDICATE}
          AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
          AND lower(trim(coalesce(sub_category, ''))) = 'blank'
          AND replace(trim(coalesce(value_percent, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
          THEN replace(trim(value_percent), ',', '')::numeric END) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario} AND ${forecastEntity}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND replace(trim(coalesce(value_percent, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
        ) AS internal_rows,
        SUM(CASE WHEN ${scenario} AND ${forecastEntity}
          AND ${UTILIZATION_PAGE_PREDICATE}
          AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
          AND lower(trim(coalesce(sub_category, ''))) = 'blank'
          AND replace(trim(coalesce(value_percent, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
          THEN replace(trim(value_percent), ',', '')::numeric END) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario} AND ${forecastEntity}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND replace(trim(coalesce(value_percent, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
        ) AS external_rows,
        COALESCE(
          SUM(CASE WHEN upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
            THEN replace(trim(cost_value), ',', '')::numeric END),
          SUM(CASE WHEN ${scenario} AND ${forecastEntity}
            AND ${forecastPage}
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
            THEN replace(trim(cost_value), ',', '')::numeric END)
        ) AS capacity_value,
        COALESCE(NULLIF(COUNT(*) FILTER (WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'), 0),
          COUNT(*) FILTER (WHERE ${scenario} AND ${forecastEntity}
            AND ${forecastPage}
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$')
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
    `),
  ]);

  const actual = (rowsOf(actualResult)[0] ?? {}) as AggregateRow;
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;

  const metrics = KPI_METRICS.map((definition) => {
    const field = definition.id === "revenue"
      ? "revenue"
      : definition.id === "internal_utilization"
        ? "internal"
        : definition.id === "external_utilization"
          ? "external"
          : "capacity";
    const actualRows = metricRows(actual, `${field}_rows` as keyof AggregateRow);
    const forecastRows = metricRows(forecast, `${field}_rows` as keyof AggregateRow);
    const actualValue = valueOrNull(metricValue(actual, `${field}_value` as keyof AggregateRow), actualRows);
    const isUtilization = definition.id.includes("utilization");
    const forecastValue = isUtilization
      ? null
      : valueOrNull(metricValue(forecast, `${field}_value` as keyof AggregateRow), forecastRows);
    if (actualValue === null) warnings.push(`${definition.label}: no mapped actual rows for this period and entity scope.`);
    if (!isUtilization && forecastValue === null) {
      warnings.push(`${definition.label}: no forecast rows for this period, scenario, and entity scope.`);
    }
    const variance = !isUtilization && actualValue !== null && forecastValue !== null
      ? actualValue - forecastValue
      : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: isUtilization ? 0 : forecastRows,
    };
  });

  return { metrics, warnings: Array.from(new Set(warnings)) };
}

async function runKpiBreakdownSnapshot(request: KpiReportRequest) {
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);

  const [actualResult, forecastResult] = await Promise.all([
    db.execute(sql`
      WITH mapped AS (
        SELECT *,
          CASE upper(trim(coalesce(new_service_area, '')))
            WHEN 'MS' THEN 'MS'
            WHEN 'SX' THEN 'MM'
            WHEN 'SDS' THEN 'SDS'
            WHEN 'MOBILITY SOLUTIONS EXTERNAL' THEN 'MS-External'
            WHEN 'RBEI_BD' THEN 'Integrated Service'
            WHEN 'RBEI_GS' THEN 'Integrated Service'
            WHEN 'RBEI_SO' THEN 'Integrated Service'
            WHEN 'EIGROW' THEN 'Integrated Service'
          END AS breakdown
        FROM cube_fact_data
        WHERE cube_id = ${request.cubeId}
          AND year = ${request.year}
          AND month BETWEEN 1 AND ${request.month}
          AND ${ACTUAL_VERSION_PREDICATE}
          AND ${actualEntity}
      )
      SELECT
        breakdown,
        SUM(amount_usd) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ), 0) AS internal_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ), 0) AS external_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'external'
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (
          WHERE cost_category = 'GB Wise END Capacity'
            AND month = ${request.month}
            AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'GB Wise END Capacity'
            AND month = ${request.month}
            AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM mapped
      WHERE breakdown IS NOT NULL
      GROUP BY breakdown
    `),
    db.execute(sql`
      WITH mapped AS (
        SELECT
          CASE upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
            WHEN 'MS VIEW' THEN 'MS'
            WHEN 'SX VIEW' THEN 'MM'
            WHEN 'SDS' THEN 'SDS'
            WHEN 'ITRAMS' THEN 'MS-External'
            WHEN 'BD' THEN 'Integrated Service'
            WHEN 'GS' THEN 'Integrated Service'
            WHEN 'SO' THEN 'Integrated Service'
          END AS breakdown,
          upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) AS page_name,
          lower(trim(coalesce(particulars, ''))) AS particulars_name,
          lower(trim(coalesce(sub_category, ''))) AS sub_category_name,
          CASE
            WHEN replace(trim(coalesce(cost_value, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
            THEN replace(trim(cost_value), ',', '')::numeric
          END AS numeric_value
        FROM cube_plan_data
        WHERE cube_id = ${request.cubeId}
          AND year = ${request.year}
          AND month = ${request.month}
          AND ${scenario}
          AND ${forecastEntity}
      ),
      page_values AS (
        SELECT
          breakdown,
          page_name,
          SUM(numeric_value) FILTER (
            WHERE particulars_name = 'budget (musd)' AND sub_category_name = 'total'
          ) AS revenue_total,
          COUNT(numeric_value) FILTER (
            WHERE particulars_name = 'budget (musd)' AND sub_category_name = 'total'
          ) AS revenue_total_rows,
          SUM(numeric_value) FILTER (
            WHERE particulars_name = 'budget (musd)' AND sub_category_name <> 'total'
          ) AS revenue_detail,
          COUNT(numeric_value) FILTER (
            WHERE particulars_name = 'budget (musd)' AND sub_category_name <> 'total'
          ) AS revenue_detail_rows,
          SUM(numeric_value) FILTER (
            WHERE particulars_name = 'total capacity' AND sub_category_name = 'end'
          ) AS capacity_total,
          COUNT(numeric_value) FILTER (
            WHERE particulars_name = 'total capacity' AND sub_category_name = 'end'
          ) AS capacity_total_rows,
          SUM(numeric_value) FILTER (
            WHERE particulars_name IN ('offshore capacity', 'onsite capacity', 'outsourcing capacity')
              AND sub_category_name = 'end'
          ) AS capacity_detail,
          COUNT(numeric_value) FILTER (
            WHERE particulars_name IN ('offshore capacity', 'onsite capacity', 'outsourcing capacity')
              AND sub_category_name = 'end'
          ) AS capacity_detail_rows
        FROM mapped
        WHERE breakdown IS NOT NULL
        GROUP BY breakdown, page_name
      )
      SELECT
        breakdown,
        SUM(CASE WHEN revenue_total_rows > 0 THEN revenue_total ELSE revenue_detail END) AS revenue_value,
        SUM(CASE WHEN revenue_total_rows > 0 THEN revenue_total_rows ELSE revenue_detail_rows END) AS revenue_rows,
        NULL::numeric AS internal_value,
        0::integer AS internal_rows,
        NULL::numeric AS external_value,
        0::integer AS external_rows,
        SUM(CASE WHEN capacity_total_rows > 0 THEN capacity_total ELSE capacity_detail END) AS capacity_value,
        SUM(CASE WHEN capacity_total_rows > 0 THEN capacity_total_rows ELSE capacity_detail_rows END) AS capacity_rows
      FROM page_values
      GROUP BY breakdown
    `),
  ]);

  const actualRows = new Map(rowsOf(actualResult).map((row) => [String(row.breakdown), row as BreakdownRow]));
  const forecastRows = new Map(rowsOf(forecastResult).map((row) => [String(row.breakdown), row as BreakdownRow]));

  return KPI_METRICS.map((definition) => {
    const field = definition.id === "revenue"
      ? "revenue"
      : definition.id === "internal_utilization"
        ? "internal"
        : definition.id === "external_utilization"
          ? "external"
          : "capacity";
    const isUtilization = definition.id.includes("utilization");
    return {
      metricId: definition.id,
      breakdowns: KPI_BREAKDOWN_LABELS.map((label) => {
        const actual = actualRows.get(label);
        const forecast = forecastRows.get(label);
        const actualValue = valueOrNull(
          numeric(actual?.[`${field}_value` as keyof BreakdownRow] as string | number | null),
          numeric(actual?.[`${field}_rows` as keyof BreakdownRow] as string | number | null),
        );
        const forecastValue = isUtilization ? null : valueOrNull(
          numeric(forecast?.[`${field}_value` as keyof BreakdownRow] as string | number | null),
          numeric(forecast?.[`${field}_rows` as keyof BreakdownRow] as string | number | null),
        );
        const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
        return { label, actual: actualValue, forecast: forecastValue, variance };
      }),
    };
  });
}

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

const BUSINESS_METRICS_SCOPES = [
  { id: "world-wide", code: "WW", label: "World Wide", entity: "World Wide" },
  { id: "india", code: "IN", label: "India", entity: "BGSW" },
  { id: "vietnam", code: "VN", label: "Vietnam", entity: "BGSV" },
  { id: "mexico", code: "MX", label: "Mexico", entity: "NE-MX" },
] as const;

export async function runKpiReport(request: KpiReportRequest) {
  const selected = await runKpiMetricSnapshot(request);
  const priorMonth = previousMonth(request.year, request.month);
  const historical = await Promise.all([
    runKpiMetricSnapshot({ ...request, year: request.year - 1 }),
    runKpiMetricSnapshot({ ...request, ...priorMonth }),
  ]);
  const metrics = selected.metrics.map((metric) => {
    if (!metric.id.includes("utilization")) return metric;
    return {
      ...metric,
      comparisons: {
        priorYearActual: historical[0].metrics.find((item) => item.id === metric.id)?.actual ?? null,
        previousMonthActual: historical[1].metrics.find((item) => item.id === metric.id)?.actual ?? null,
      },
    };
  });

  const scopeBadges = await Promise.all(BUSINESS_METRICS_SCOPES.map(async (scope) => {
    const scopedRequest = { ...request, entity: scope.entity };
    const [snapshot, breakdownSnapshot] = await Promise.all([
      runKpiMetricSnapshot(scopedRequest),
      runKpiBreakdownSnapshot(scopedRequest),
    ]);
    return {
      ...scope,
      metrics: snapshot.metrics.map((metric) => ({
        ...metric,
        breakdowns: breakdownSnapshot.find((item) => item.metricId === metric.id)?.breakdowns ?? [],
      })),
    };
  }));

  const scopeWarnings = scopeBadges.flatMap((scope) => scope.metrics
    .filter((metric) => metric.actual === null)
    .map((metric) => `${scope.label}: ${metric.label} has no actual source rows.`));

  return {
    periodLabel: new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }),
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics,
    warnings: Array.from(new Set([...selected.warnings, ...scopeWarnings])),
    scopeBadges,
    greenScope: {
      version: "green-v1",
      period: { year: request.year, month: request.month },
      entities: scopeBadges,
    },
  };
}