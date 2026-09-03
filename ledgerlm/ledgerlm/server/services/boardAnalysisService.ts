/**
 * Smart Analysis Board — core analysis engine (Phase 2).
 *
 * Features:
 *  - previewBoardData  — lightweight data check + dimension value discovery
 *  - runBoardAnalysis  — full BvA report generation with optional period comparison
 *  - getCubeVersions   — list available version values for a cube
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { cubeBoardReports, type CubeBoardReport } from '@shared/schema';
import { streamFinancialAnalysis, type DomainAiConfig } from '../openai';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColumnMapping {
  actuals: string;
  budget: string;
  forecast?: string;
  rollingForecasts?: string[];
}

export interface ComparisonPeriod {
  year: number;
  months: number[];
  label?: string;
}

export interface AnalysisRequest {
  boardId: string;
  cubeId: string;
  columnMapping: ColumnMapping;
  year: number;
  months: number[];
  dimensions: string[];
  systemPromptTemplate: string;
  userPromptTemplate: string;
  extraContext?: string;
  comparison?: ComparisonPeriod;
  domainAiConfig?: DomainAiConfig;
}

export interface PreviewData {
  actualsTotal: number;
  budgetTotal: number;
  variance: number;
  variancePct: number | null;
  rowCount: number;
  actualsVersion: string;
  budgetVersion: string;
  dimensionValues: Record<string, string[]>;
}

// Compact variance row stored as JSONB for CSV export
interface VRow {
  k: string;          // dimension key
  a: number;          // actual
  b: number;          // budget
  v: number;          // variance
  vp: number | null;  // variance %
  f: boolean;         // favorable
  ca?: number;        // comparison actual
  cb?: number;        // comparison budget
  cv?: number;        // comparison variance
  yoy?: number;       // yoy / period-over-period change
}

interface AggRow {
  dimension_key: string;
  total_amount_usd: string | number;
  total_capacity: string | number;
  total_headcount: string | number;
  total_billed_capacity: string | number;
}

interface Metrics { amountUsd: number; capacity: number; headcount: number; billedCapacity: number }

interface VarianceRow {
  dimensionKey: string;
  actual: number;
  budget: number;
  variance: number;
  variancePct: number | null;
  favorable: boolean;
}

// ── Dimension name → DB column (hardcoded → safe for sql.raw) ─────────────────
export const DIMENSION_TO_COLUMN: Record<string, string> = {
  Entity:            'region_entity',
  Sector:            'sector',
  'Cost Category':   'cost_category',
  'Resource Type':   'resource_type',
  Location:          'onsite_offshore',
  'Project GB':      'project_gb',
  'Planning GB':     'planning_gb',
  'Salary Level':    'salary_level',
  'Cost Center':     'cost_center',
  'Service Area':    'service_area',
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchFactData(
  cubeId: string,
  version: string,
  year: number,
  months: number[],
  dimensions: string[],
): Promise<Record<string, Metrics>> {
  const dbCols = dimensions.map((d) => DIMENSION_TO_COLUMN[d]).filter(Boolean);
  const groupCols = dbCols.length > 0 ? dbCols : ['region_entity', 'cost_category'];
  const selectExpr = groupCols.map((c) => `COALESCE(${c}::text, 'Unknown')`).join(` || ' | ' || `);
  const groupByExpr = groupCols.join(', ');
  const monthsSql = sql.join(months.map((m) => sql`${m}`), sql`, `);

  const result = await db.execute(
    sql`SELECT ${sql.raw(selectExpr)} AS dimension_key,
               COALESCE(SUM(amount_usd::float),      0) AS total_amount_usd,
               COALESCE(SUM(capacity::float),        0) AS total_capacity,
               COALESCE(SUM(headcount::float),       0) AS total_headcount,
               COALESCE(SUM(billed_capacity::float), 0) AS total_billed_capacity
        FROM cube_fact_data
        WHERE cube_id = ${cubeId} AND version = ${version}
          AND year = ${year} AND month IN (${monthsSql})
        GROUP BY ${sql.raw(groupByExpr)}
        ORDER BY total_amount_usd DESC
        LIMIT 60`
  );

  const map: Record<string, Metrics> = {};
  for (const row of (result.rows ?? result) as unknown as AggRow[]) {
    map[row.dimension_key] = {
      amountUsd:      Number(row.total_amount_usd)      || 0,
      capacity:       Number(row.total_capacity)        || 0,
      headcount:      Number(row.total_headcount)       || 0,
      billedCapacity: Number(row.total_billed_capacity) || 0,
    };
  }
  return map;
}

// ── Preview data (lightweight — for the pre-run card) ─────────────────────────

export async function previewBoardData(params: {
  cubeId: string;
  columnMapping: ColumnMapping;
  year: number;
  months: number[];
}): Promise<PreviewData> {
  const { cubeId, columnMapping, year, months } = params;
  const monthsSql = sql.join(months.map((m) => sql`${m}`), sql`, `);
  const actVer = columnMapping.actuals;
  const bgtVer = columnMapping.budget;

  // Total actuals + budget + row count in one query
  const totals = await db.execute(
    sql`SELECT
          COUNT(*) AS row_count,
          COALESCE(SUM(CASE WHEN version = ${actVer} THEN amount_usd::float ELSE 0 END), 0) AS actuals_total,
          COALESCE(SUM(CASE WHEN version = ${bgtVer} THEN amount_usd::float ELSE 0 END), 0) AS budget_total
        FROM cube_fact_data
        WHERE cube_id = ${cubeId}
          AND year = ${year}
          AND month IN (${monthsSql})
          AND version IN (${actVer}, ${bgtVer})`
  );
  const t = ((totals.rows ?? totals) as unknown as any[])[0] ?? {};
  const actualsTotal = Number(t.actuals_total) || 0;
  const budgetTotal  = Number(t.budget_total)  || 0;
  const rowCount     = Number(t.row_count)     || 0;
  const variance     = actualsTotal - budgetTotal;
  const variancePct  = budgetTotal !== 0 ? (variance / Math.abs(budgetTotal)) * 100 : null;

  // Dimension distinct values
  const dimResult = await db.execute(
    sql`SELECT
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT region_entity::text),    NULL)::text AS entities,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT sector::text),           NULL)::text AS sectors,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT cost_category::text),    NULL)::text AS cost_categories,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT resource_type::text),    NULL)::text AS resource_types,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT onsite_offshore::text),  NULL)::text AS locations,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT salary_level::text),     NULL)::text AS salary_levels
        FROM cube_fact_data
        WHERE cube_id = ${cubeId} AND year = ${year} AND month IN (${monthsSql})`
  );
  const d = ((dimResult.rows ?? dimResult) as unknown as any[])[0] ?? {};

  const parsePgArray = (v: string | null): string[] => {
    if (!v || v === '{}') return [];
    return v.replace(/^\{|\}$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '').trim()).filter(Boolean).slice(0, 10);
  };

  return {
    actualsTotal, budgetTotal, variance, variancePct, rowCount,
    actualsVersion: actVer,
    budgetVersion:  bgtVer,
    dimensionValues: {
      Entity:            parsePgArray(d.entities),
      Sector:            parsePgArray(d.sectors),
      'Cost Category':   parsePgArray(d.cost_categories),
      'Resource Type':   parsePgArray(d.resource_types),
      Location:          parsePgArray(d.locations),
      'Salary Level':    parsePgArray(d.salary_levels),
    },
  };
}

// ── Variance computation ──────────────────────────────────────────────────────

function computeVariance(
  actuals: Record<string, Metrics>,
  budget:  Record<string, Metrics>,
): VarianceRow[] {
  const allKeys = Array.from(new Set([...Object.keys(actuals), ...Object.keys(budget)]));
  return allKeys
    .map((key) => {
      const actual    = actuals[key]?.amountUsd ?? 0;
      const budgetVal = budget[key]?.amountUsd  ?? 0;
      const variance  = actual - budgetVal;
      const variancePct = budgetVal !== 0 ? (variance / Math.abs(budgetVal)) * 100 : null;
      return { dimensionKey: key, actual, budget: budgetVal, variance, variancePct, favorable: variance <= 0 };
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

// ── Markdown table builders ───────────────────────────────────────────────────

function buildVarianceTable(rows: VarianceRow[], limit = 30): string {
  const fmt    = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtPct = (n: number | null) => n !== null ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : 'N/A';
  const header = '| Dimension | Actual (USD) | Budget (USD) | Variance | Var% | Status |';
  const sep    = '|---|---|---|---|---|---|';
  return [header, sep, ...rows.slice(0, limit).map((r) => {
    const sign   = r.variance >= 0 ? '+' : '';
    const status = r.variance === 0 ? '➖ Neutral' : r.favorable ? '✅ Fav' : '⚠️ Unfav';
    return `| ${r.dimensionKey} | ${fmt(r.actual)} | ${fmt(r.budget)} | ${sign}${fmt(r.variance)} | ${fmtPct(r.variancePct)} | ${status} |`;
  })].join('\n');
}

function buildComparisonTable(
  primary: VarianceRow[],
  comp: Record<string, VarianceRow>,
  limit = 20,
): string {
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const header = '| Dimension | Primary Var | Comparison Var | YoY Change | Trend |';
  const sep    = '|---|---|---|---|---|';
  return [header, sep, ...primary.slice(0, limit).map((r) => {
    const cv = comp[r.dimensionKey];
    if (!cv) return `| ${r.dimensionKey} | ${fmt(r.variance)} | N/A | N/A | — |`;
    const yoy   = r.variance - cv.variance;
    const trend = yoy < 0 ? '📈 Improving' : yoy > 0 ? '📉 Worsening' : '➖ Flat';
    return `| ${r.dimensionKey} | ${fmt(r.variance)} | ${fmt(cv.variance)} | ${yoy >= 0 ? '+' : ''}${fmt(yoy)} | ${trend} |`;
  })].join('\n');
}

// ── Template resolution ───────────────────────────────────────────────────────

function resolveTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return result;
}

export function formatPeriod(year: number, months: number[]): string {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (months.length === 1) return `${names[months[0] - 1]} ${year}`;
  if (months.length === 3 && months[0] % 3 === 1) return `Q${Math.ceil(months[0] / 3)} ${year}`;
  return `${names[months[0] - 1]}–${names[months[months.length - 1] - 1]} ${year}`;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runBoardAnalysis(request: AnalysisRequest): Promise<CubeBoardReport> {
  const periodLabel = formatPeriod(request.year, request.months);
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  // 1. Fetch primary actuals + budget in parallel (+ optional comparison)
  const compLabel = request.comparison
    ? (request.comparison.label ?? formatPeriod(request.comparison.year, request.comparison.months))
    : null;

  const fetches: Promise<Record<string, Metrics>>[] = [
    fetchFactData(request.cubeId, request.columnMapping.actuals, request.year, request.months, request.dimensions),
    fetchFactData(request.cubeId, request.columnMapping.budget,  request.year, request.months, request.dimensions),
  ];
  if (request.comparison) {
    fetches.push(fetchFactData(request.cubeId, request.columnMapping.actuals, request.comparison.year, request.comparison.months, request.dimensions));
    fetches.push(fetchFactData(request.cubeId, request.columnMapping.budget,  request.comparison.year, request.comparison.months, request.dimensions));
  }
  const [actualsData, budgetData, compActualsData, compBudgetData] = await Promise.all(fetches);

  // 2. Compute primary variance
  const varianceRows       = computeVariance(actualsData, budgetData);
  const topUnfavorable     = varianceRows.filter((r) => r.variance > 0).slice(0, 5);
  const topFavorable       = varianceRows.filter((r) => r.variance < 0).slice(0, 5);
  const totalActual        = Object.values(actualsData).reduce((s, r) => s + r.amountUsd, 0);
  const totalBudget        = Object.values(budgetData).reduce((s, r) => s + r.amountUsd, 0);
  const totalVariance      = totalActual - totalBudget;
  const totalVarPct        = totalBudget !== 0 ? ((totalVariance / Math.abs(totalBudget)) * 100).toFixed(1) : 'N/A';

  // 3. Compute comparison variance (if requested)
  let compVarianceRows: VarianceRow[] = [];
  let compVarianceByKey: Record<string, VarianceRow> = {};
  let compTotalVariance = 0;
  if (compActualsData && compBudgetData) {
    compVarianceRows = computeVariance(compActualsData, compBudgetData);
    compVarianceByKey = Object.fromEntries(compVarianceRows.map((r) => [r.dimensionKey, r]));
    compTotalVariance = Object.values(compActualsData).reduce((s, r) => s + r.amountUsd, 0)
                       - Object.values(compBudgetData).reduce((s, r) => s + r.amountUsd, 0);
  }

  // 4. Build compact varianceData for CSV export
  const varianceData: VRow[] = varianceRows.map((r) => {
    const row: VRow = { k: r.dimensionKey, a: r.actual, b: r.budget, v: r.variance, vp: r.variancePct, f: r.favorable };
    const cv = compVarianceByKey[r.dimensionKey];
    if (cv) {
      row.ca  = cv.actual;
      row.cb  = cv.budget;
      row.cv  = cv.variance;
      row.yoy = r.variance - cv.variance;
    }
    return row;
  });

  // 5. Build prompt tables
  const varianceTable     = buildVarianceTable(varianceRows);
  const comparisonTable   = compVarianceRows.length > 0
    ? buildComparisonTable(varianceRows, compVarianceByKey)
    : '';

  // 6. Resolve template
  const templateVars: Record<string, string> = {
    period:              periodLabel,
    actuals_column:      request.columnMapping.actuals,
    budget_column:       request.columnMapping.budget,
    forecast_column:     request.columnMapping.forecast ?? 'N/A',
    variance_table:      varianceTable,
    actuals_table:       varianceTable,
    budget_table:        varianceTable,
    total_actual:        fmt(totalActual),
    total_budget:        fmt(totalBudget),
    total_variance:      `${totalVariance >= 0 ? '+' : ''}${fmt(totalVariance)}`,
    total_variance_pct:  `${totalVariance >= 0 ? '+' : ''}${totalVarPct}%`,
    top_unfavorable:     topUnfavorable.map((r, i) => `${i + 1}. ${r.dimensionKey}: +${fmt(r.variance)} USD`).join('\n') || 'None',
    top_favorable:       topFavorable.map((r, i) => `${i + 1}. ${r.dimensionKey}: ${fmt(r.variance)} USD`).join('\n') || 'None',
    dimensions:          request.dimensions.join(', '),
    data_rows_count:     String(varianceRows.length),
    // Comparison fields
    comparison_period:   compLabel ?? 'N/A',
    comparison_table:    comparisonTable || 'No comparison period selected.',
    comparison_total_variance: compTotalVariance !== 0
      ? `${compTotalVariance >= 0 ? '+' : ''}${fmt(compTotalVariance)}`
      : 'N/A',
    yoy_change:          compTotalVariance !== 0 && totalBudget !== 0
      ? `${((totalVariance - compTotalVariance) / Math.abs(totalBudget) * 100).toFixed(1)}%`
      : 'N/A',
  };

  const resolvedUserPrompt = resolveTemplate(request.userPromptTemplate, templateVars)
    + (compLabel && comparisonTable
        ? `\n\n**Period-over-Period Comparison (${periodLabel} vs ${compLabel}):**\n${comparisonTable}`
        : '')
    + (request.extraContext?.trim()
        ? `\n\n**Additional context from analyst:**\n${request.extraContext}`
        : '');

  // 7. Call LLM
  let rawAnalysis = '';
  try {
    for await (const chunk of streamFinancialAnalysis({ query: resolvedUserPrompt, domainAiConfig: request.domainAiConfig })) {
      rawAnalysis += chunk;
    }
  } catch (err) {
    rawAnalysis = `⚠️ Analysis generation failed: ${err instanceof Error ? err.message : String(err)}\n\nResolved prompt:\n${resolvedUserPrompt}`;
  }

  // 8. Persist report
  const result = await db
    .insert(cubeBoardReports)
    .values({
      boardId:               request.boardId,
      title:                 `${periodLabel} — Variance Analysis${compLabel ? ` vs ${compLabel}` : ''}`,
      periodLabel,
      year:                  request.year,
      months:                request.months,
      columnMapping:         request.columnMapping,
      dimensions:            request.dimensions,
      userPromptFinal:       resolvedUserPrompt,
      rawAnalysis,
      varianceData,
      comparisonPeriodLabel: compLabel ?? null,
      status:                'complete',
    })
    .returning();

  return result[0];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getCubeVersions(cubeId: string): Promise<string[]> {
  const result = await db.execute(
    sql`SELECT DISTINCT version FROM cube_fact_data WHERE cube_id = ${cubeId} AND version IS NOT NULL ORDER BY version`
  );
  return ((result.rows ?? result) as unknown as { version: string }[]).map((r) => r.version);
}

// Intent catalogue for follow-up chat seeding
export const FOLLOW_UP_INTENTS: Record<string, { label: string; icon: string; question: string }> = {
  drill_top_driver: {
    label: 'Drill into top driver',
    icon: '🔍',
    question: 'Drill deeper into the #1 unfavorable variance driver from this report. What specific factors caused it? Is this structural or a one-time event? Which dimension values (entities, sectors, cost categories) are most responsible?',
  },
  root_causes: {
    label: 'Root cause analysis',
    icon: '💡',
    question: 'Provide a thorough root cause analysis of the variances in this report. Consider pricing changes, volume/mix effects, structural factors, and external drivers. Identify the 3–5 most important root causes with supporting evidence.',
  },
  cfo_brief: {
    label: 'CFO executive brief',
    icon: '📊',
    question: 'Write a CFO-ready executive summary of this variance report. Maximum 3 bullet points, plain English, no technical jargon. Format: 1) Bottom line (total variance + %), 2) Primary cause, 3) Recommended action.',
  },
  action_plan: {
    label: 'Action plan',
    icon: '🎯',
    question: 'Create a prioritized action plan to close the unfavorable variances in this report. List 5 specific, actionable steps with suggested owners, 30/60/90-day timeline, and expected financial impact.',
  },
  trend_outlook: {
    label: 'Trend & outlook',
    icon: '📈',
    question: 'Based on this period\'s variance, what is the trend? Is performance improving or deteriorating? If current trends continue, what is your full-year outlook vs budget? Identify any early warning signals.',
  },
  entity_drill: {
    label: 'Entity breakdown',
    icon: '🏢',
    question: 'Break down the variance by entity (BGSW, BGSV, etc.). For each entity explain their specific variance driver, whether their performance is acceptable vs plan, and which entity requires the most urgent attention.',
  },
};
