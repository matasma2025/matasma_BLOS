/*
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('BGSW', 'BGSV', 'BGSW/NE-MX')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
          AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = (rowsOf(actualResult)[0] ?? {}) as AggregateRow;
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

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
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : definition.id.includes("utilization")
          ? ["Actual utilization is billed capacity ÷ allocated capacity; forecast values are source-provided percentages."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualGroup = sql`
    CASE
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
        THEN 'ms'
    END
  `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ), 0) AS internal_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
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
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 * /
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics: selectedSnapshot.metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}import { sql } from "drizzle-orm";
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function isWorldWideEntity(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return selected === "WORLD WIDE" || selected === "WORLDWIDE" || selected === "WORLWIDE";
}

function usesDetailedActualWorkbook(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return isWorldWideEntity(entity)
    || selected === "BGSW"
    || selected === "BGSV"
    || selected === "NE-MX"
    || selected === "MEXICO";
}

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  if (isWorldWideEntity(entity)) {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function actualRevenueHardwarePredicate(entity?: string) {
  if (usesDetailedActualWorkbook(entity)) return sql`TRUE`;
  return sql`
    lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
    AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
  `;
}

function actualPlanEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (!selected) return sql`FALSE`;
  if (isWorldWideEntity(entity)) {
    return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
  }
  if (selected === "NE-MX" || selected === "MEXICO") {
    return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
  }
  return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO" || selected === "MEXICO/NE-MX") {
      return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
}

function forecastRevenuePagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'`;
}

function forecastCapacityPagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const forecastRevenuePage = forecastRevenuePagePredicate(request.entity);
  const forecastCapacityPage = forecastCapacityPagePredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;

  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
          THEN amount_usd
        END) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = ${
              worldWide ? "WORLD WIDE" : "ENTITY VIEW"
            }
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
        `)
      : db.execute(sql`
          SELECT NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        NULL::numeric AS internal_value,
        0 AS internal_rows,
        NULL::numeric AS external_value,
        0 AS external_rows,
        COALESCE(
          SUM(${numericText("cost_value")}) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          ),
          SUM(${numericText("cost_value")}) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          )
        ) AS capacity_value,
        COALESCE(
          NULLIF(COUNT(*) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          ), 0),
          COUNT(*) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          )
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = { ...((rowsOf(actualResult)[0] ?? {}) as AggregateRow) };
  if (workbookActuals) {
    const planCapacity = (rowsOf(actualCapacityPlanResult)[0] ?? {}) as AggregateRow;
    const factCapacity = numeric(actual.capacity_value);
    const planCapacityValue = numeric(planCapacity.capacity_value);
    const factCapacityRows = numeric(actual.capacity_rows) ?? 0;
    const planCapacityRows = numeric(planCapacity.capacity_rows) ?? 0;
    actual.capacity_value = factCapacity !== null || planCapacityValue !== null
      ? (factCapacity ?? 0) + (planCapacityValue ?? 0)
      : null;
    actual.capacity_rows = factCapacityRows + planCapacityRows;
  }
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

  const metrics = KPI_METRICS.map((definition) => {
    const field = definition.id === "revenue"
      ? "revenue"
      : definition.id === "internal_utilization"
        ? "internal"
        : definition.id === "external_utilization"
          ? "external"
          : "capacity";
    const actualRows = metricRows(actual, `${field}_rows` as keyof AggregateRow);
    const isUtilization = definition.id.includes("utilization");
    const forecastRows = isUtilization ? 0 : metricRows(forecast, `${field}_rows` as keyof AggregateRow);
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = isUtilization ? null : valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null && !isUtilization) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : isUtilization
          ? ["Actual utilization is compared with prior-year and previous-month Actuals; no Forecast source is used."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const actualGroup = workbookActuals
    ? sql`
        CASE
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS'
            OR upper(trim(coalesce(new_service_area, ''))) = 'SDS'
            THEN 'sds'
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) IN (
            'CONNECTED MOBILITY SOLUTIONS',
            'MOBILITY SOLUTIONS EXTERNAL',
            'ITRAMS'
          ) THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO')
            THEN 'integrated_service'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'SX'
            THEN 'mm'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'MS'
            THEN 'ms'
        END
      `
    : sql`
        CASE
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
            THEN 'ms'
        END
      `;
  const actualRevenueFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS')
          OR (${actualGroup} = 'ms_external'
            AND upper(trim(coalesce(split_itrams_sds, ''))) IN (
              'CONNECTED MOBILITY SOLUTIONS',
              'MOBILITY SOLUTIONS EXTERNAL',
              'ITRAMS'))
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
      `
    : sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND ${actualRevenueHardware}
      `;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SDS')
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE ${actualRevenueFilter}
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${actualRevenueFilter}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            CASE
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
                THEN 'ms'
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM')
                THEN 'mm'
              WHEN upper(trim(coalesce(gb, ''))) = 'SDS'
                THEN 'sds'
              WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                THEN 'integrated_service'
            END AS group_key,
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('MS VIEW', 'SX VIEW', 'NE-MM')
              OR (
                ${
                  worldWide
                    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
                    : sql`TRUE`
                }
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
          GROUP BY 1
        `)
      : db.execute(sql`
          SELECT NULL::text AS group_key, NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  if (workbookActuals) {
    for (const row of rowsOf(actualCapacityPlanResult) as BreakdownRow[]) {
      if (!row.group_key) continue;
      const existing = actual.get(row.group_key) ?? {
        group_key: row.group_key,
        revenue_value: null,
        revenue_rows: 0,
        internal_value: null,
        internal_rows: 0,
        external_value: null,
        external_rows: 0,
        capacity_value: null,
        capacity_rows: 0,
      };
      const existingCapacity = numeric(existing.capacity_value);
      const planCapacity = numeric(row.capacity_value);
      existing.capacity_value = existingCapacity !== null || planCapacity !== null
        ? (existingCapacity ?? 0) + (planCapacity ?? 0)
        : null;
      existing.capacity_rows = (numeric(existing.capacity_rows) ?? 0) + (numeric(row.capacity_rows) ?? 0);
      actual.set(row.group_key, existing);
    }
  }
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 * /
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const selectedHistorical = historicalSnapshots.find(({ scope }) =>
    requestedEntity === normalizedEntity(scope.entity)
  );
  const metrics = selectedSnapshot.metrics.map((metric) => {
    if (!metric.id.includes("utilization")) return metric;
    const priorYear = selectedHistorical?.priorYear.metrics.find((item) => item.id === metric.id);
    const previousMonth = selectedHistorical?.previousYtd.metrics.find((item) => item.id === metric.id);
    return {
      ...metric,
      comparisons: {
        priorYearActual: priorYear?.actual ?? null,
        priorYearSourceRows: priorYear?.actualSourceRows ?? 0,
        previousMonthActual: previousMonth?.actual ?? null,
        previousMonthSourceRows: previousMonth?.actualSourceRows ?? 0,
      },
    };
  });
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}import { sql } from "drizzle-orm";
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('BGSW', 'BGSV', 'BGSW/NE-MX')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
          AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = (rowsOf(actualResult)[0] ?? {}) as AggregateRow;
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

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
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : definition.id.includes("utilization")
          ? ["Actual utilization is billed capacity ÷ allocated capacity; forecast values are source-provided percentages."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualGroup = sql`
    CASE
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
        THEN 'ms'
    END
  `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ), 0) AS internal_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
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
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 * /
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics: selectedSnapshot.metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}*/
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function isWorldWideEntity(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return selected === "WORLD WIDE" || selected === "WORLDWIDE" || selected === "WORLWIDE";
}

function usesDetailedActualWorkbook(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return isWorldWideEntity(entity)
    || selected === "BGSW"
    || selected === "BGSV"
    || selected === "NE-MX"
    || selected === "MEXICO";
}

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  if (isWorldWideEntity(entity)) {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function actualRevenueHardwarePredicate(entity?: string) {
  if (usesDetailedActualWorkbook(entity)) return sql`TRUE`;
  return sql`
    lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
    AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
  `;
}

function actualPlanEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (!selected) return sql`FALSE`;
  if (isWorldWideEntity(entity)) {
    return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
  }
  if (selected === "NE-MX" || selected === "MEXICO") {
    return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
  }
  return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO" || selected === "MEXICO/NE-MX") {
      return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
}

function forecastRevenuePagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'`;
}

function forecastCapacityPagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const forecastRevenuePage = forecastRevenuePagePredicate(request.entity);
  const forecastCapacityPage = forecastCapacityPagePredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;

  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
          THEN amount_usd
        END) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = ${
              worldWide ? "WORLD WIDE" : "ENTITY VIEW"
            }
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
        `)
      : db.execute(sql`
          SELECT NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        NULL::numeric AS internal_value,
        0 AS internal_rows,
        NULL::numeric AS external_value,
        0 AS external_rows,
        COALESCE(
          SUM(${numericText("cost_value")}) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          ),
          SUM(${numericText("cost_value")}) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          )
        ) AS capacity_value,
        COALESCE(
          NULLIF(COUNT(*) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          ), 0),
          COUNT(*) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          )
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = { ...((rowsOf(actualResult)[0] ?? {}) as AggregateRow) };
  if (workbookActuals) {
    const planCapacity = (rowsOf(actualCapacityPlanResult)[0] ?? {}) as AggregateRow;
    const factCapacity = numeric(actual.capacity_value);
    const planCapacityValue = numeric(planCapacity.capacity_value);
    const factCapacityRows = numeric(actual.capacity_rows) ?? 0;
    const planCapacityRows = numeric(planCapacity.capacity_rows) ?? 0;
    actual.capacity_value = factCapacity !== null || planCapacityValue !== null
      ? (factCapacity ?? 0) + (planCapacityValue ?? 0)
      : null;
    actual.capacity_rows = factCapacityRows + planCapacityRows;
  }
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

  const metrics = KPI_METRICS.map((definition) => {
    const field = definition.id === "revenue"
      ? "revenue"
      : definition.id === "internal_utilization"
        ? "internal"
        : definition.id === "external_utilization"
          ? "external"
          : "capacity";
    const actualRows = metricRows(actual, `${field}_rows` as keyof AggregateRow);
    const isUtilization = definition.id.includes("utilization");
    const forecastRows = isUtilization ? 0 : metricRows(forecast, `${field}_rows` as keyof AggregateRow);
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = isUtilization ? null : valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null && !isUtilization) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : isUtilization
          ? ["Actual utilization is compared with prior-year and previous-month Actuals; no Forecast source is used."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const actualGroup = workbookActuals
    ? sql`
        CASE
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS'
            OR upper(trim(coalesce(new_service_area, ''))) = 'SDS'
            THEN 'sds'
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) IN (
            'CONNECTED MOBILITY SOLUTIONS',
            'MOBILITY SOLUTIONS EXTERNAL',
            'ITRAMS'
          ) THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO')
            THEN 'integrated_service'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'SX'
            THEN 'mm'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'MS'
            THEN 'ms'
        END
      `
    : sql`
        CASE
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
            THEN 'ms'
        END
      `;
  const actualRevenueFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS')
          OR (${actualGroup} = 'ms_external'
            AND upper(trim(coalesce(split_itrams_sds, ''))) IN (
              'CONNECTED MOBILITY SOLUTIONS',
              'MOBILITY SOLUTIONS EXTERNAL',
              'ITRAMS'))
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
      `
    : sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND ${actualRevenueHardware}
      `;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SDS')
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE ${actualRevenueFilter}
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${actualRevenueFilter}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            CASE
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
                THEN 'ms'
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM')
                THEN 'mm'
              WHEN upper(trim(coalesce(gb, ''))) = 'SDS'
                THEN 'sds'
              WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                THEN 'integrated_service'
            END AS group_key,
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('MS VIEW', 'SX VIEW', 'NE-MM')
              OR (
                ${
                  worldWide
                    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
                    : sql`TRUE`
                }
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
          GROUP BY 1
        `)
      : db.execute(sql`
          SELECT NULL::text AS group_key, NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  if (workbookActuals) {
    for (const row of rowsOf(actualCapacityPlanResult) as BreakdownRow[]) {
      if (!row.group_key) continue;
      const existing = actual.get(row.group_key) ?? {
        group_key: row.group_key,
        revenue_value: null,
        revenue_rows: 0,
        internal_value: null,
        internal_rows: 0,
        external_value: null,
        external_rows: 0,
        capacity_value: null,
        capacity_rows: 0,
      };
      const existingCapacity = numeric(existing.capacity_value);
      const planCapacity = numeric(row.capacity_value);
      existing.capacity_value = existingCapacity !== null || planCapacity !== null
        ? (existingCapacity ?? 0) + (planCapacity ?? 0)
        : null;
      existing.capacity_rows = (numeric(existing.capacity_rows) ?? 0) + (numeric(row.capacity_rows) ?? 0);
      actual.set(row.group_key, existing);
    }
  }
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 */
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const selectedHistorical = historicalSnapshots.find(({ scope }) =>
    requestedEntity === normalizedEntity(scope.entity)
  );
  const metrics = selectedSnapshot.metrics.map((metric) => {
    if (!metric.id.includes("utilization")) return metric;
    const priorYear = selectedHistorical?.priorYear.metrics.find((item) => item.id === metric.id);
    const previousMonth = selectedHistorical?.previousYtd.metrics.find((item) => item.id === metric.id);
    return {
      ...metric,
      comparisons: {
        priorYearActual: priorYear?.actual ?? null,
        priorYearSourceRows: priorYear?.actualSourceRows ?? 0,
        previousMonthActual: previousMonth?.actual ?? null,
        previousMonthSourceRows: previousMonth?.actualSourceRows ?? 0,
      },
    };
  });
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}/*
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('BGSW', 'BGSV', 'BGSW/NE-MX')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
          AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = (rowsOf(actualResult)[0] ?? {}) as AggregateRow;
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

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
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : definition.id.includes("utilization")
          ? ["Actual utilization is billed capacity ÷ allocated capacity; forecast values are source-provided percentages."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualGroup = sql`
    CASE
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
        THEN 'ms'
    END
  `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ), 0) AS internal_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
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
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 * /
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics: selectedSnapshot.metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}import { sql } from "drizzle-orm";
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function isWorldWideEntity(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return selected === "WORLD WIDE" || selected === "WORLDWIDE" || selected === "WORLWIDE";
}

function usesDetailedActualWorkbook(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return isWorldWideEntity(entity)
    || selected === "BGSW"
    || selected === "BGSV"
    || selected === "NE-MX"
    || selected === "MEXICO";
}

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  if (isWorldWideEntity(entity)) {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function actualRevenueHardwarePredicate(entity?: string) {
  if (usesDetailedActualWorkbook(entity)) return sql`TRUE`;
  return sql`
    lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
    AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
  `;
}

function actualPlanEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (!selected) return sql`FALSE`;
  if (isWorldWideEntity(entity)) {
    return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
  }
  if (selected === "NE-MX" || selected === "MEXICO") {
    return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
  }
  return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO" || selected === "MEXICO/NE-MX") {
      return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
}

function forecastRevenuePagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'`;
}

function forecastCapacityPagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const forecastRevenuePage = forecastRevenuePagePredicate(request.entity);
  const forecastCapacityPage = forecastCapacityPagePredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;

  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
          THEN amount_usd
        END) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = ${
              worldWide ? "WORLD WIDE" : "ENTITY VIEW"
            }
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
        `)
      : db.execute(sql`
          SELECT NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        NULL::numeric AS internal_value,
        0 AS internal_rows,
        NULL::numeric AS external_value,
        0 AS external_rows,
        COALESCE(
          SUM(${numericText("cost_value")}) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          ),
          SUM(${numericText("cost_value")}) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          )
        ) AS capacity_value,
        COALESCE(
          NULLIF(COUNT(*) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          ), 0),
          COUNT(*) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          )
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = { ...((rowsOf(actualResult)[0] ?? {}) as AggregateRow) };
  if (workbookActuals) {
    const planCapacity = (rowsOf(actualCapacityPlanResult)[0] ?? {}) as AggregateRow;
    const factCapacity = numeric(actual.capacity_value);
    const planCapacityValue = numeric(planCapacity.capacity_value);
    const factCapacityRows = numeric(actual.capacity_rows) ?? 0;
    const planCapacityRows = numeric(planCapacity.capacity_rows) ?? 0;
    actual.capacity_value = factCapacity !== null || planCapacityValue !== null
      ? (factCapacity ?? 0) + (planCapacityValue ?? 0)
      : null;
    actual.capacity_rows = factCapacityRows + planCapacityRows;
  }
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

  const metrics = KPI_METRICS.map((definition) => {
    const field = definition.id === "revenue"
      ? "revenue"
      : definition.id === "internal_utilization"
        ? "internal"
        : definition.id === "external_utilization"
          ? "external"
          : "capacity";
    const actualRows = metricRows(actual, `${field}_rows` as keyof AggregateRow);
    const isUtilization = definition.id.includes("utilization");
    const forecastRows = isUtilization ? 0 : metricRows(forecast, `${field}_rows` as keyof AggregateRow);
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = isUtilization ? null : valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null && !isUtilization) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : isUtilization
          ? ["Actual utilization is compared with prior-year and previous-month Actuals; no Forecast source is used."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const actualGroup = workbookActuals
    ? sql`
        CASE
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS'
            OR upper(trim(coalesce(new_service_area, ''))) = 'SDS'
            THEN 'sds'
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) IN (
            'CONNECTED MOBILITY SOLUTIONS',
            'MOBILITY SOLUTIONS EXTERNAL',
            'ITRAMS'
          ) THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO')
            THEN 'integrated_service'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'SX'
            THEN 'mm'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'MS'
            THEN 'ms'
        END
      `
    : sql`
        CASE
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
            THEN 'ms'
        END
      `;
  const actualRevenueFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS')
          OR (${actualGroup} = 'ms_external'
            AND upper(trim(coalesce(split_itrams_sds, ''))) IN (
              'CONNECTED MOBILITY SOLUTIONS',
              'MOBILITY SOLUTIONS EXTERNAL',
              'ITRAMS'))
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
      `
    : sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND ${actualRevenueHardware}
      `;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SDS')
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE ${actualRevenueFilter}
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${actualRevenueFilter}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            CASE
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
                THEN 'ms'
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM')
                THEN 'mm'
              WHEN upper(trim(coalesce(gb, ''))) = 'SDS'
                THEN 'sds'
              WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                THEN 'integrated_service'
            END AS group_key,
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('MS VIEW', 'SX VIEW', 'NE-MM')
              OR (
                ${
                  worldWide
                    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
                    : sql`TRUE`
                }
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
          GROUP BY 1
        `)
      : db.execute(sql`
          SELECT NULL::text AS group_key, NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  if (workbookActuals) {
    for (const row of rowsOf(actualCapacityPlanResult) as BreakdownRow[]) {
      if (!row.group_key) continue;
      const existing = actual.get(row.group_key) ?? {
        group_key: row.group_key,
        revenue_value: null,
        revenue_rows: 0,
        internal_value: null,
        internal_rows: 0,
        external_value: null,
        external_rows: 0,
        capacity_value: null,
        capacity_rows: 0,
      };
      const existingCapacity = numeric(existing.capacity_value);
      const planCapacity = numeric(row.capacity_value);
      existing.capacity_value = existingCapacity !== null || planCapacity !== null
        ? (existingCapacity ?? 0) + (planCapacity ?? 0)
        : null;
      existing.capacity_rows = (numeric(existing.capacity_rows) ?? 0) + (numeric(row.capacity_rows) ?? 0);
      actual.set(row.group_key, existing);
    }
  }
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 * /
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const selectedHistorical = historicalSnapshots.find(({ scope }) =>
    requestedEntity === normalizedEntity(scope.entity)
  );
  const metrics = selectedSnapshot.metrics.map((metric) => {
    if (!metric.id.includes("utilization")) return metric;
    const priorYear = selectedHistorical?.priorYear.metrics.find((item) => item.id === metric.id);
    const previousMonth = selectedHistorical?.previousYtd.metrics.find((item) => item.id === metric.id);
    return {
      ...metric,
      comparisons: {
        priorYearActual: priorYear?.actual ?? null,
        priorYearSourceRows: priorYear?.actualSourceRows ?? 0,
        previousMonthActual: previousMonth?.actual ?? null,
        previousMonthSourceRows: previousMonth?.actualSourceRows ?? 0,
      },
    };
  });
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}import { sql } from "drizzle-orm";
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('BGSW', 'BGSV', 'BGSW/NE-MX')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (selected === "WORLD WIDE" || selected === "WORLWIDE") {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${UTILIZATION_PAGE_PREDICATE}
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
          AND lower(trim(coalesce(sub_category, ''))) = 'end'
          AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = (rowsOf(actualResult)[0] ?? {}) as AggregateRow;
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

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
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : definition.id.includes("utilization")
          ? ["Actual utilization is billed capacity ÷ allocated capacity; forecast values are source-provided percentages."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualGroup = sql`
    CASE
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
      WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
        OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
        THEN 'ms'
    END
  `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
            AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Revenue Summary'
            AND ${actualBudgetInclude}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        ), 0) AS internal_value,
        COUNT(*) FILTER (
          WHERE cost_category = 'Billing Utilization'
            AND lower(trim(coalesce(resource_type, ''))) = 'internal'
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        SUM(billed_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
        ) / NULLIF(SUM(allocated_capacity) FILTER (
          WHERE cost_category = 'Billing Utilization' AND lower(trim(coalesce(resource_type, ''))) = 'external'
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
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 * /
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics: selectedSnapshot.metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}*/
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

type BreakdownRow = AggregateRow & { group_key: string };

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
const numericText = (column: "cost_value" | "value_percent") => sql.raw(
  `CASE WHEN replace(trim(coalesce(${column}, '')), ',', '') ~ '^-?(?:\\d+\\.?\\d*|\\.\\d+)$'
    THEN replace(trim(${column}), ',', '')::numeric END`,
);

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

function isWorldWideEntity(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return selected === "WORLD WIDE" || selected === "WORLDWIDE" || selected === "WORLWIDE";
}

function usesDetailedActualWorkbook(entity?: string): boolean {
  const selected = normalizedEntity(entity);
  return isWorldWideEntity(entity)
    || selected === "BGSW"
    || selected === "BGSV"
    || selected === "NE-MX"
    || selected === "MEXICO";
}

function actualEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO") {
      return sql`upper(trim(coalesce(region_entity, ''))) IN ('NE-MX', 'BGSW/NE-MX')`;
    }
    return sql`upper(trim(coalesce(region_entity, ''))) = ${selected}`;
  }
  // "All entities" intentionally includes unassigned source rows but excludes
  // the dedicated World Wide aggregate so it is not double-counted.
  return sql`upper(trim(coalesce(region_entity, ''))) NOT IN ('WORLD WIDE', 'WORLWIDE')`;
}

function actualBudgetIncludePredicate(entity?: string) {
  if (isWorldWideEntity(entity)) {
    return sql`lower(trim(coalesce(include_exclude, ''))) = 'include'`;
  }
  return sql`TRUE`;
}

function actualRevenueHardwarePredicate(entity?: string) {
  if (usesDetailedActualWorkbook(entity)) return sql`TRUE`;
  return sql`
    lower(trim(coalesce(sub_cost_category, ''))) <> 'revenue hardware'
    AND lower(trim(coalesce(cost_category_class, ''))) <> 'revenue hardware'
  `;
}

function actualPlanEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (!selected) return sql`FALSE`;
  if (isWorldWideEntity(entity)) {
    return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
  }
  if (selected === "NE-MX" || selected === "MEXICO") {
    return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
  }
  return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
}

function forecastEntityPredicate(entity?: string) {
  const selected = normalizedEntity(entity);
  if (selected) {
    if (isWorldWideEntity(entity)) {
      return sql`upper(trim(coalesce(entity, ''))) IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
    }
    if (selected === "NE-MX" || selected === "MEXICO" || selected === "MEXICO/NE-MX") {
      return sql`upper(trim(coalesce(entity, ''))) = 'NE-MX'`;
    }
    return sql`upper(trim(coalesce(entity, ''))) = ${selected}`;
  }
  return sql`upper(trim(coalesce(entity, ''))) NOT IN ('WORLD WIDE', 'WORLDWIDE', 'WORLWIDE')`;
}

function forecastRevenuePagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY'`;
}

function forecastCapacityPagePredicate(entity?: string) {
  return isWorldWideEntity(entity)
    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
    : sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'ENTITY VIEW'`;
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
  const request = payload as Partial<KpiReportRequest>;
  const year = Number(request.year);
  const month = Number(request.month);
  if (!request.cubeId || typeof request.cubeId !== "string") {
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
    entity: request.entity?.trim() || undefined,
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
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const forecastRevenuePage = forecastRevenuePagePredicate(request.entity);
  const forecastCapacityPage = forecastCapacityPagePredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(new_service_area, ''))) IN ('MS', 'SX')
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;

  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
          THEN amount_usd
        END) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
            AND ${actualBudgetInclude}
            AND ${actualRevenueHardware}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = ${
              worldWide ? "WORLD WIDE" : "ENTITY VIEW"
            }
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
        `)
      : db.execute(sql`
          SELECT NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastRevenuePage}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND lower(trim(coalesce(sub_category, ''))) = 'total'
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        NULL::numeric AS internal_value,
        0 AS internal_rows,
        NULL::numeric AS external_value,
        0 AS external_rows,
        COALESCE(
          SUM(${numericText("cost_value")}) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          ),
          SUM(${numericText("cost_value")}) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
          )
        ) AS capacity_value,
        COALESCE(
          NULLIF(COUNT(*) FILTER (
            WHERE upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
              AND ${forecastCapacityPage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          ), 0),
          COUNT(*) FILTER (
            WHERE ${scenario}
              AND ${forecastRevenuePage}
              AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
              AND lower(trim(coalesce(sub_category, ''))) = 'end'
              AND ${numericText("cost_value")} IS NOT NULL
          )
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
    `),
  ]);

  const actual = { ...((rowsOf(actualResult)[0] ?? {}) as AggregateRow) };
  if (workbookActuals) {
    const planCapacity = (rowsOf(actualCapacityPlanResult)[0] ?? {}) as AggregateRow;
    const factCapacity = numeric(actual.capacity_value);
    const planCapacityValue = numeric(planCapacity.capacity_value);
    const factCapacityRows = numeric(actual.capacity_rows) ?? 0;
    const planCapacityRows = numeric(planCapacity.capacity_rows) ?? 0;
    actual.capacity_value = factCapacity !== null || planCapacityValue !== null
      ? (factCapacity ?? 0) + (planCapacityValue ?? 0)
      : null;
    actual.capacity_rows = factCapacityRows + planCapacityRows;
  }
  const forecast = (rowsOf(forecastResult)[0] ?? {}) as AggregateRow;
  const warnings: string[] = [];
  const metricValue = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]);
  const metricRows = (row: AggregateRow, field: keyof AggregateRow) => numeric(row[field]) ?? 0;
  const actualLabel = "Anaplan actuals · unversioned actual export rows";
  const forecastLabel = `MBR workbook · ${request.forecastScenario}`;

  const metrics = KPI_METRICS.map((definition) => {
    const field = definition.id === "revenue"
      ? "revenue"
      : definition.id === "internal_utilization"
        ? "internal"
        : definition.id === "external_utilization"
          ? "external"
          : "capacity";
    const actualRows = metricRows(actual, `${field}_rows` as keyof AggregateRow);
    const isUtilization = definition.id.includes("utilization");
    const forecastRows = isUtilization ? 0 : metricRows(forecast, `${field}_rows` as keyof AggregateRow);
    const actualValue = valueOrNull(
      metricValue(actual, `${field}_value` as keyof AggregateRow),
      actualRows,
    );
    const forecastValue = isUtilization ? null : valueOrNull(
      metricValue(forecast, `${field}_value` as keyof AggregateRow),
      forecastRows,
    );
    if (actualValue === null) warnings.push(`${definition.label}: no mapped Anaplan actual rows for this period and entity scope.`);
    if (forecastValue === null && !isUtilization) warnings.push(`${definition.label}: no MBR forecast rows for this period, scenario, and entity scope.`);
    const variance = actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null;
    return {
      ...definition,
      actual: actualValue,
      forecast: forecastValue,
      variance,
      variancePercent: variance !== null && forecastValue !== null && forecastValue !== 0
        ? variance / forecastValue
        : null,
      actualSourceRows: actualRows,
      forecastSourceRows: forecastRows,
      remarks: definition.id === "capacity"
        ? ["Forecast capacity is the End-of-month sum of Offshore, Outsourcing, and Onsite Capacity."]
        : isUtilization
          ? ["Actual utilization is compared with prior-year and previous-month Actuals; no Forecast source is used."]
          : ["Actual revenue uses Anaplan Revenue rows; forecast uses MBR Budget (mUSD) source values."],
    };
  });

  return {
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}

const GREEN_BREAKDOWNS = [
  { id: "ms", label: "MS" },
  { id: "mm", label: "MM" },
  { id: "sds", label: "SDS" },
  {
    id: "ms_external",
    label: "MS-External",
  },
  {
    id: "integrated_service",
    label: "Integrated Service",
  },
] as const;

async function runGreenBreakdowns(request: KpiReportRequest) {
  const worldWide = isWorldWideEntity(request.entity);
  const workbookActuals = usesDetailedActualWorkbook(request.entity);
  const actualEntity = actualEntityPredicate(request.entity);
  const actualBudgetInclude = actualBudgetIncludePredicate(request.entity);
  const actualRevenueHardware = actualRevenueHardwarePredicate(request.entity);
  const actualPlanEntity = actualPlanEntityPredicate(request.entity);
  const forecastEntity = forecastEntityPredicate(request.entity);
  const scenario = forecastScenarioPredicate(request.forecastScenario);
  const actualPeriod = sql`month = ${request.month}`;
  const actualGroup = workbookActuals
    ? sql`
        CASE
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS'
            OR upper(trim(coalesce(new_service_area, ''))) = 'SDS'
            THEN 'sds'
          WHEN upper(trim(coalesce(split_itrams_sds, ''))) IN (
            'CONNECTED MOBILITY SOLUTIONS',
            'MOBILITY SOLUTIONS EXTERNAL',
            'ITRAMS'
          ) THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO')
            THEN 'integrated_service'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'SX'
            THEN 'mm'
          WHEN upper(trim(coalesce(new_service_area, ''))) = 'MS'
            THEN 'ms'
        END
      `
    : sql`
        CASE
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('ITRAMS', 'MOBILITY SOLUTIONS EXTERNAL') THEN 'ms_external'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SDS', 'SDS_CORPORATE', 'CORP-SDS') THEN 'sds'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('SX_DELIVERY', 'SX-UNALLOCATED', 'CORP-SX') THEN 'mm'
          WHEN upper(trim(coalesce(project_gb, ''))) IN ('M-OTHERS')
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'XC%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'PS%'
            OR upper(trim(coalesce(project_gb, ''))) LIKE 'VM%'
            THEN 'ms'
        END
      `;
  const actualRevenueFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(split_itrams_sds, ''))) = 'SDS')
          OR (${actualGroup} = 'ms_external'
            AND upper(trim(coalesce(split_itrams_sds, ''))) IN (
              'CONNECTED MOBILITY SOLUTIONS',
              'MOBILITY SOLUTIONS EXTERNAL',
              'ITRAMS'))
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
      `
    : sql`
        lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
        AND ${actualBudgetInclude}
        AND ${actualRevenueHardware}
      `;
  const internalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'internal'
      `;
  const externalActualFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'billing utilization summary'
        AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
        AND (
          (${actualGroup} = 'ms' AND upper(trim(coalesce(new_service_area, ''))) = 'MS')
          OR (${actualGroup} = 'mm' AND upper(trim(coalesce(new_service_area, ''))) = 'SX')
        )
      `
    : sql`
        cost_category = 'Billing Utilization'
        AND lower(trim(coalesce(resource_type, ''))) = 'external'
      `;
  const internalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(
          SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(not_allocated_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(ms_capacity) FILTER (WHERE ${internalActualFilter})
          + SUM(vkm_capacity) FILTER (WHERE ${internalActualFilter})
          - SUM(non_linear_capacity) FILTER (WHERE ${internalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${internalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${internalActualFilter}), 0)
      `;
  const externalActualValue = workbookActuals
    ? sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(
          SUM(payable_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_not_allocated_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_ms_cap) FILTER (WHERE ${externalActualFilter})
          + SUM(payable_vkm_cap) FILTER (WHERE ${externalActualFilter})
          - SUM(payable_non_linear_cap) FILTER (WHERE ${externalActualFilter}),
          0
        )
      `
    : sql`
        SUM(billed_capacity) FILTER (WHERE ${externalActualFilter})
        / NULLIF(SUM(allocated_capacity) FILTER (WHERE ${externalActualFilter}), 0)
      `;
  const actualCapacityFilter = workbookActuals
    ? sql`
        lower(trim(coalesce(cost_category, ''))) = 'gb wise end capacity'
        AND upper(trim(coalesce(service_area, ''))) NOT IN (
          'CORPORATE', 'RBEI_CORPORATE', 'SDS_CORPORATE'
        )
        AND lower(trim(coalesce(resource_type, ''))) IN ('internal', 'external')
        AND ${
          worldWide
            ? sql`upper(trim(coalesce(onsite_offshore, ''))) IN ('OFFSHORE', 'ONSITE')`
            : sql`upper(trim(coalesce(onsite_offshore, ''))) = 'OFFSHORE'`
        }
        AND (
          (${actualGroup} = 'ms'
            AND upper(trim(coalesce(new_service_area, ''))) = 'MS'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE')
          OR (${actualGroup} = 'mm'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SX'
            AND upper(trim(coalesce(project_type, ''))) <> 'FIXEDPRICE'
            AND upper(trim(coalesce(proj_dept, ''))) NOT IN ('CR/RAL-IN', 'CR/RDT-IN', 'CR/RTC-IN'))
          OR (${actualGroup} = 'sds'
            AND upper(trim(coalesce(new_service_area, ''))) = 'SDS')
          OR (${actualGroup} = 'integrated_service'
            AND upper(trim(coalesce(project_gb, ''))) IN ('BD', 'GS', 'SO'))
        )
        AND month = ${request.month}
      `
    : sql`
        cost_category = 'GB Wise END Capacity'
        AND month = ${request.month}
        AND upper(trim(coalesce(sector, ''))) <> 'INDIRECT'
      `;
  const forecastGroup = sql`
    CASE
      WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO') THEN 'integrated_service'
      WHEN upper(trim(coalesce(gb, ''))) = 'ITRAMS' THEN 'ms_external'
      WHEN upper(trim(coalesce(gb, ''))) = 'SDS' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('INTEGRATED SERVICE', 'INTEGRATED SERVICES') THEN 'integrated_service'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SDS VIEW' THEN 'sds'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW' THEN 'ms'
      WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM') THEN 'mm'
    END
  `;
  const [actualResult, actualCapacityPlanResult, forecastResult] = await Promise.all([
    db.execute(sql`
      SELECT
        ${actualGroup} AS group_key,
        SUM(amount_usd) FILTER (
          WHERE ${actualRevenueFilter}
        ) / 1000000.0 AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${actualRevenueFilter}
            AND amount_usd IS NOT NULL
        ) AS revenue_rows,
        ${internalActualValue} AS internal_value,
        COUNT(*) FILTER (
          WHERE ${internalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS internal_rows,
        ${externalActualValue} AS external_value,
        COUNT(*) FILTER (
          WHERE ${externalActualFilter}
            AND allocated_capacity IS NOT NULL
        ) AS external_rows,
        SUM(capacity) FILTER (WHERE ${actualCapacityFilter}) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${actualCapacityFilter}
            AND capacity IS NOT NULL
        ) AS capacity_rows
      FROM cube_fact_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND ${actualPeriod}
        AND ${ACTUAL_VERSION_PREDICATE}
        AND ${actualEntity}
        AND ${actualGroup} IS NOT NULL
      GROUP BY 1
    `),
    workbookActuals
      ? db.execute(sql`
          SELECT
            CASE
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
                THEN 'ms'
              WHEN upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('SX VIEW', 'NE-MM')
                THEN 'mm'
              WHEN upper(trim(coalesce(gb, ''))) = 'SDS'
                THEN 'sds'
              WHEN upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                THEN 'integrated_service'
            END AS group_key,
            SUM(${numericText("cost_value")}) AS capacity_value,
            COUNT(*) FILTER (
              WHERE ${numericText("cost_value")} IS NOT NULL
            ) AS capacity_rows
          FROM cube_plan_data
          WHERE cube_id = ${request.cubeId}
            AND year = ${request.year}
            AND month = ${request.month}
            AND upper(trim(coalesce(plan_type, ''))) IN ('ACTUAL', 'ACTUALS')
            AND ${actualPlanEntity}
            AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) IN ('MS VIEW', 'SX VIEW', 'NE-MM')
              OR (
                ${
                  worldWide
                    ? sql`upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'WORLD WIDE'`
                    : sql`TRUE`
                }
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
          GROUP BY 1
        `)
      : db.execute(sql`
          SELECT NULL::text AS group_key, NULL::numeric AS capacity_value, 0 AS capacity_rows
          WHERE FALSE
        `),
    db.execute(sql`
      SELECT
        ${forecastGroup} AS group_key,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
        ) AS revenue_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(particulars, ''))) = 'budget (musd)'
            AND (
              (
                ${forecastGroup} = 'ms'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'MS VIEW'
              )
              OR (
                ${forecastGroup} = 'mm'
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'SX VIEW'
              )
              OR (
                ${forecastGroup} = 'sds'
                AND upper(trim(coalesce(gb, ''))) = 'SDS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'ms_external'
                AND upper(trim(coalesce(gb, ''))) = 'ITRAMS'
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
              OR (
                ${forecastGroup} = 'integrated_service'
                AND upper(trim(coalesce(gb, ''))) IN ('BD', 'GS', 'SO')
                AND lower(trim(coalesce(sub_category, ''))) = 'total'
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS revenue_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS internal_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'internal utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS internal_rows,
        SUM(${numericText("value_percent")}) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
        ) AS external_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND ${forecastGroup} IN ('ms', 'mm')
            AND lower(trim(coalesce(particulars, ''))) = 'outsourcing utilization (%)'
            AND lower(trim(coalesce(sub_category, ''))) = 'blank'
            AND ${numericText("value_percent")} IS NOT NULL
        ) AS external_rows,
        SUM(${numericText("cost_value")}) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
        ) AS capacity_value,
        COUNT(*) FILTER (
          WHERE ${scenario}
            AND lower(trim(coalesce(sub_category, ''))) = 'end'
            AND (
              (
                ${forecastGroup} IN ('ms', 'mm')
                AND lower(trim(coalesce(particulars, ''))) IN (
                  'offshore capacity', 'outsourcing capacity', 'onsite capacity'
                )
                AND upper(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g'))
                  IN ('MS VIEW', 'SX VIEW')
              )
              OR (
                ${forecastGroup} IN ('sds', 'integrated_service')
                AND lower(trim(coalesce(particulars, ''))) = 'total capacity'
                AND upper(trim(coalesce(gb, ''))) IN ('SDS', 'BD', 'GS', 'SO')
              )
            )
            AND ${numericText("cost_value")} IS NOT NULL
        ) AS capacity_rows
      FROM cube_plan_data
      WHERE cube_id = ${request.cubeId}
        AND year = ${request.year}
        AND month = ${request.month}
        AND ${forecastEntity}
        AND ${forecastGroup} IS NOT NULL
      GROUP BY 1
    `),
  ]);
  const actual = new Map(rowsOf(actualResult).map((row: BreakdownRow) => [row.group_key, row]));
  if (workbookActuals) {
    for (const row of rowsOf(actualCapacityPlanResult) as BreakdownRow[]) {
      if (!row.group_key) continue;
      const existing = actual.get(row.group_key) ?? {
        group_key: row.group_key,
        revenue_value: null,
        revenue_rows: 0,
        internal_value: null,
        internal_rows: 0,
        external_value: null,
        external_rows: 0,
        capacity_value: null,
        capacity_rows: 0,
      };
      const existingCapacity = numeric(existing.capacity_value);
      const planCapacity = numeric(row.capacity_value);
      existing.capacity_value = existingCapacity !== null || planCapacity !== null
        ? (existingCapacity ?? 0) + (planCapacity ?? 0)
        : null;
      existing.capacity_rows = (numeric(existing.capacity_rows) ?? 0) + (numeric(row.capacity_rows) ?? 0);
      actual.set(row.group_key, existing);
    }
  }
  const forecast = new Map(rowsOf(forecastResult).map((row: BreakdownRow) => [row.group_key, row]));
  return GREEN_BREAKDOWNS.map((definition) => {
    const actualRow = actual.get(definition.id);
    const forecastRow = forecast.get(definition.id);
    return {
      id: definition.id,
      label: definition.label,
      metrics: KPI_METRICS.map((metric) => {
        const field = metric.id === "revenue" ? "revenue"
          : metric.id === "internal_utilization" ? "internal"
            : metric.id === "external_utilization" ? "external" : "capacity";
        const isUtilization = metric.id.includes("utilization");
        const actualRows = numeric(actualRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const forecastRows = isUtilization
          ? 0
          : numeric(forecastRow?.[`${field}_rows` as keyof BreakdownRow] as any) ?? 0;
        const actualValue = valueOrNull(numeric(actualRow?.[`${field}_value` as keyof BreakdownRow] as any), actualRows);
        const forecastValue = isUtilization
          ? null
          : valueOrNull(numeric(forecastRow?.[`${field}_value` as keyof BreakdownRow] as any), forecastRows);
        return { id: metric.id, ...greenValue({
          ...metric,
          actual: actualValue,
          forecast: forecastValue,
          variance: actualValue !== null && forecastValue !== null ? actualValue - forecastValue : null,
          variancePercent: actualValue !== null && forecastValue !== null && forecastValue !== 0
            ? (actualValue - forecastValue) / forecastValue : null,
          actualSourceRows: actualRows,
          forecastSourceRows: forecastRows,
          remarks: [],
        }) };
      }),
    };
  });
}

const BUSINESS_METRICS_SCOPES = [
  { id: "global", label: "World Wide (Global)", code: "WW", entity: "World Wide" },
  { id: "india", label: "India (BGSW)", code: "IN", entity: "BGSW" },
  { id: "vietnam", label: "Vietnam (BGSV)", code: "VN", entity: "BGSV" },
  { id: "mexico", label: "Mexico (NE-MX)", code: "MX", entity: "NE-MX" },
] as const;

type BusinessMetricsScope = (typeof BUSINESS_METRICS_SCOPES)[number];
type KpiSnapshot = Awaited<ReturnType<typeof runKpiMetricSnapshot>>;

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function greenValue(metric: KpiSnapshot["metrics"][number] | undefined) {
  return {
    actual: metric?.actual ?? null,
    forecast: metric?.forecast ?? null,
    variance: metric?.variance ?? null,
    variancePercent: metric?.variancePercent ?? null,
    actualSourceRows: metric?.actualSourceRows ?? 0,
    forecastSourceRows: metric?.forecastSourceRows ?? 0,
  };
}

function displayKpiValue(value: number, unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "capacity") return `${Math.round(value).toLocaleString()} HC`;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mUSD`;
}

function comparisonUnit(unit: (typeof KPI_METRICS)[number]["unit"]): string {
  if (unit === "percent") return "percentage points";
  if (unit === "capacity") return "HC";
  return "mUSD";
}

function narrativeLine(
  scope: BusinessMetricsScope,
  metric: KpiSnapshot["metrics"][number] | undefined,
): string {
  if (!metric || metric.actual === null || metric.forecast === null || metric.variance === null) {
    return `${scope.label}: no complete governed Actual-versus-Forecast comparison is available for this period.`;
  }
  if (metric.variance === 0) {
    return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is in line with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
  }
  const direction = metric.variance > 0 ? "higher" : "lower";
  return `${scope.label}: Actual ${displayKpiValue(metric.actual, metric.unit)} is ${direction} by ${displayKpiValue(Math.abs(metric.variance), metric.unit === "percent" ? "percent" : metric.unit).replace("%", ` ${comparisonUnit(metric.unit)}`)} compared with forecast ${displayKpiValue(metric.forecast, metric.unit)}.`;
}

function buildBusinessMetricsNarrative(
  scopeSnapshots: { scope: BusinessMetricsScope; snapshot: KpiSnapshot }[],
  phaseTwoPeriod: string,
) {
  const metricSections = KPI_METRICS.map((definition) => {
    const lines = scopeSnapshots.map(({ scope, snapshot }) =>
      narrativeLine(scope, snapshot.metrics.find((metric) => metric.id === definition.id)),
    );
    return {
      id: definition.id,
      title: definition.id === "capacity" ? "Capacity (Internal + External)" : definition.label,
      status: "in_scope" as const,
      summary: lines[0],
      lines: lines.slice(1),
    };
  });

  return [
    ...metricSections,
    {
      id: "ebit",
      title: "EBIT",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No EBIT number is displayed until an approved governed source mapping and definition are available."],
    },
    {
      id: "capex",
      title: "Capex",
      status: "phase_2" as const,
      summary: `Out of scope for ${phaseTwoPeriod} — planned for Phase 2.`,
      lines: ["No Capex number is displayed until an approved governed source mapping and definition are available."],
    },
  ];
}

/**
 * Builds a deterministic report snapshot. The current board selection remains
 * the headline KPI set, while the fixed Business Metrics panel carries the
 * governed World Wide, BGSW, BGSV, and NE-MX comparisons side-by-side.
 */
export async function runKpiReport(request: KpiReportRequest) {
  const selectedSnapshot = await runKpiMetricSnapshot(request);
  const requestedEntity = normalizedEntity(request.entity);
  const scopeSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      snapshot: requestedEntity === normalizedEntity(scope.entity)
        ? selectedSnapshot
        : await runKpiMetricSnapshot({ ...request, entity: scope.entity }),
    })),
  );
  const scopeBreakdowns = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => ({
      scope,
      breakdowns: await runGreenBreakdowns({ ...request, entity: scope.entity }),
    })),
  );
  const warnings = Array.from(new Set([
    ...selectedSnapshot.warnings,
    ...scopeSnapshots.flatMap(({ snapshot }) => snapshot.warnings),
  ]));
  const priorMonth = previousMonth(request.year, request.month);
  const historicalSnapshots = await Promise.all(
    BUSINESS_METRICS_SCOPES.map(async (scope) => {
      const [priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns] = await Promise.all([
        runKpiMetricSnapshot({ ...request, year: request.year - 1, entity: scope.entity }),
        runKpiMetricSnapshot({ ...request, ...priorMonth, entity: scope.entity }),
        runGreenBreakdowns({ ...request, year: request.year - 1, entity: scope.entity }),
        runGreenBreakdowns({ ...request, ...priorMonth, entity: scope.entity }),
      ]);
      return { scope, priorYear, previousYtd, priorYearBreakdowns, previousYtdBreakdowns };
    }),
  );
  const selectedHistorical = historicalSnapshots.find(({ scope }) =>
    requestedEntity === normalizedEntity(scope.entity)
  );
  const metrics = selectedSnapshot.metrics.map((metric) => {
    if (!metric.id.includes("utilization")) return metric;
    const priorYear = selectedHistorical?.priorYear.metrics.find((item) => item.id === metric.id);
    const previousMonth = selectedHistorical?.previousYtd.metrics.find((item) => item.id === metric.id);
    return {
      ...metric,
      comparisons: {
        priorYearActual: priorYear?.actual ?? null,
        priorYearSourceRows: priorYear?.actualSourceRows ?? 0,
        previousMonthActual: previousMonth?.actual ?? null,
        previousMonthSourceRows: previousMonth?.actualSourceRows ?? 0,
      },
    };
  });
  const periodLabel = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const phaseTwoPeriod = new Date(Date.UTC(request.year, request.month - 1, 1)).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  return {
    periodLabel,
    entityLabel: request.entity || ALL_ENTITIES_LABEL,
    forecastScenario: request.forecastScenario,
    actualSourceLabel: "Anaplan actuals · unversioned actual export rows",
    forecastSourceLabel: `MBR workbook · ${request.forecastScenario}`,
    metrics,
    warnings,
    scopeBadges: scopeSnapshots.map(({ scope, snapshot }) => ({
      ...scope,
      status: "in_scope" as const,
      metrics: snapshot.metrics,
    })),
    greenScope: {
      version: "green-v1" as const,
      period: { year: request.year, month: request.month },
      entities: scopeSnapshots.map(({ scope, snapshot }) => {
        const historical = historicalSnapshots.find((item) => item.scope.id === scope.id);
        const breakdowns = scopeBreakdowns.find((item) => item.scope.id === scope.id)?.breakdowns ?? [];
        const metric = (source: KpiSnapshot, id: KpiMetricId) =>
          source.metrics.find((item) => item.id === id);
        const currentMetric = (id: KpiMetricId) => metric(snapshot, id);
        const priorYearMetric = (id: KpiMetricId) =>
          historical ? metric(historical.priorYear, id) : undefined;
        const previousYtdMetric = (id: KpiMetricId) =>
          historical ? metric(historical.previousYtd, id) : undefined;
        return {
          id: scope.id,
          code: scope.code,
          label: scope.label,
          entity: scope.entity,
          sections: KPI_METRICS.map((definition) => ({
            id: definition.id,
            title: definition.id === "capacity"
              ? "Capacity (Internal + External)"
              : definition.label,
            unit: definition.unit,
            total: greenValue(currentMetric(definition.id)),
            breakdowns: breakdowns.map((breakdown) => ({
              id: breakdown.id,
              label: breakdown.label,
              value: breakdown.metrics.find((item) => item.id === definition.id)
                ?? greenValue(undefined),
              comparisons: definition.id.includes("utilization")
                ? {
                    priorYearYtd: historical?.priorYearBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                    previousMonthYtd: historical?.previousYtdBreakdowns
                      .find((item) => item.id === breakdown.id)?.metrics
                      .find((item) => item.id === definition.id) ?? greenValue(undefined),
                  }
                : undefined,
            })),
            comparisons: definition.id.includes("utilization")
              ? {
                  priorYearYtd: greenValue(priorYearMetric(definition.id)),
                  previousMonthYtd: greenValue(previousYtdMetric(definition.id)),
                }
              : undefined,
          })),
        };
      }),
    },
    narrative: buildBusinessMetricsNarrative(scopeSnapshots, phaseTwoPeriod),
  };
}

export async function saveKpiReport(
  userId: string,
  title: string,
  request: KpiReportRequest,
  report: unknown,
) {
  const result = await db.execute(sql`
    INSERT INTO cube_kpi_reports (cube_id, user_id, title, request, report)
    VALUES (
      ${request.cubeId},
      ${userId},
      ${title},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(report)}::jsonb
    )
    RETURNING id, cube_id, title, request, report, created_at
  `);
  return rowsOf(result)[0];
}

export async function listSavedKpiReports(userId: string) {
  const result = await db.execute(sql`
    SELECT id, cube_id, title, request, report, created_at
    FROM cube_kpi_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  return rowsOf(result);
}