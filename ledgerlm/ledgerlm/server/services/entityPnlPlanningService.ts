import { sql } from "drizzle-orm";
import { db } from "../db";
import type { EntityPnlPlanningForecast } from "../../shared/entityPnlPlanning";

export interface PlanningRow {
  particulars: string | null;
  sub_category: string | null;
  cost_value: string | number | null;
  entity?: string | null;
  page?: string | null;
}

const MEASURES = [
  ["Budget — Offshore", "budget (musd)", "offshore", "USD"],
  ["Budget — Onsite", "budget (musd)", "onsite", "USD"],
  ["Budget — Outsourcing", "budget (musd)", "outsourcing", "USD"],
  ["Capacity — Offshore End", "offshore capacity", "end", "capacity"],
  ["Capacity — Offshore Average", "offshore capacity", "average", "capacity"],
  ["Capacity — Onsite End", "onsite capacity", "end", "capacity"],
  ["Capacity — Onsite Average", "onsite capacity", "average", "capacity"],
  ["Capacity — Outsourcing End", "outsourcing capacity", "end", "capacity"],
  ["Capacity — Outsourcing Average", "outsourcing capacity", "average", "capacity"],
] as const;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildEntityPnlPlanningForecast(
  rows: PlanningRow[],
  scope: { scenario: string; asOf: string; entity: string },
): EntityPnlPlanningForecast {
  const warnings = [
    "Planning budgets are supplied in million USD and normalized to USD here. They are not substituted for P&L revenue: the forecast financial period basis is unconfirmed.",
    "Planning capacity Average values are shown as supplied, not recalculated or assumed to be YTD. Offshore and Onsite are not automatically combined into On-roll.",
  ];
  const metrics = MEASURES.map(([label, particulars, subCategory, unit]) => {
    const matching = rows.filter((row) =>
      normalize(row.particulars) === particulars && normalize(row.sub_category) === subCategory);
    const values = new Set(matching.map((row) => numeric(row.cost_value)));
    const conflicting = values.size > 1;
    const sourceValue = values.size === 1 ? Array.from(values)[0] : null;
    const status = conflicting ? "conflicting" as const
      : sourceValue === null || sourceValue === undefined ? "missing" as const : "available" as const;
    if (conflicting) warnings.push(`${label}: conflicting planning records; no first/last row was selected and values were not summed.`);
    else if (matching.length > 1 && status === "available") {
      warnings.push(`${label}: ${matching.length} identical planning records counted once.`);
    }
    return { label, value: status === "available" ? sourceValue! * (unit === "USD" ? 1_000_000 : 1) : null, unit, status };
  });
  return { ...scope, sourceRowCount: rows.length, metrics, warnings };
}

export async function readEntityPnlPlanningForecast(request: {
  cubeId: string; entity?: string; asOf: string; cfVersion?: string;
}): Promise<EntityPnlPlanningForecast | undefined> {
  if (!request.cfVersion) return undefined;
  const [year, month] = request.asOf.split("-").map(Number);
  const entity = request.entity?.trim() || "";
  const entityFilter = entity
    ? sql`AND lower(trim(coalesce(entity, ''))) = lower(${entity})`
    : sql``;
  const result = await db.execute(sql`
    SELECT entity, page, particulars, sub_category, cost_value
    FROM cube_plan_data
    WHERE cube_id = ${request.cubeId}
      AND year = ${year} AND month = ${month}
      AND lower(trim(plan_type)) = lower(trim(${request.cfVersion}))
      ${entityFilter}
      AND trim(coalesce(gb, '')) = ''
      AND (
        (lower(regexp_replace(trim(coalesce(entity, '')), '\\s+', ' ', 'g')) = 'world wide'
          AND lower(regexp_replace(trim(coalesce(page, '')), '\\s+', ' ', 'g')) = 'world wide')
        OR (lower(regexp_replace(trim(coalesce(entity, '')), '\\s+', ' ', 'g')) <> 'world wide'
          AND lower(trim(coalesce(page, ''))) = 'entity')
      )
      AND lower(trim(particulars)) IN ('budget (musd)', 'offshore capacity', 'onsite capacity', 'outsourcing capacity')
  `);
  const rows = ((result as unknown as { rows?: PlanningRow[] }).rows ?? []);
  if (!rows.length) return undefined;
  if (!entity) return buildEntityPnlPlanningBreakdown(rows, { scenario: request.cfVersion, asOf: request.asOf });
  return buildEntityPnlPlanningForecast(rows, { scenario: request.cfVersion, asOf: request.asOf, entity });
}

export function buildEntityPnlPlanningBreakdown(
  rows: PlanningRow[],
  scope: { scenario: string; asOf: string },
): EntityPnlPlanningForecast {
  const groups = new Map<string, PlanningRow[]>();
  for (const row of rows) {
    const entity = normalize(row.entity);
    const page = normalize(row.page);
    if (!entity || page !== (entity === "world wide" ? "world wide" : "entity")) continue;
    groups.set(entity, [...(groups.get(entity) ?? []), row]);
  }
  const entityBreakdowns = Array.from(groups.values()).map((group) =>
    buildEntityPnlPlanningForecast(group, { ...scope, entity: group[0].entity!.trim() }));
  return {
    ...scope, entity: "All entities — separate planning source scopes",
    sourceRowCount: entityBreakdowns.reduce((sum, item) => sum + item.sourceRowCount, 0),
    metrics: [], entityBreakdowns,
    warnings: [
      "All-entity planning is shown by source entity, not summed. World Wide is a separate source total, not an additional entity.",
      "Planning coverage is not proven to match the financial All entities population; no consolidated financial or capacity forecast is inferred.",
      ...entityBreakdowns.flatMap((item) => item.warnings.map((warning) => `${item.entity}: ${warning}`)),
    ],
  };
}
