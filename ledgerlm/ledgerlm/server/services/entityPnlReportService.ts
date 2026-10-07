import { sql } from "drizzle-orm";
import { db } from "../db";
import { readEntityPnlPlanningForecast } from "./entityPnlPlanningService";
import { ENTITY_PNL_CALCULATION_VERSION, type EntityPnlPlanningForecast, type EntityPnlForecastComparison, type EntityPnlFinancialPlanSource } from "../../shared/entityPnlPlanning";
import { financialPlanAggregateRows, validateEntityPnlFinancialPlan } from "./entityPnlFinancialPlanService";

export type EntityPnlComparison = "qoq" | "yoy";
export type EntityPnlCurrency = "USD" | "INR";

export interface EntityPnlReportRequest {
  cubeId: string;
  entity?: string;
  asOf: string;
  comparison: EntityPnlComparison;
  currency: EntityPnlCurrency;
  cfVersion?: string;
}

export interface EntityPnlLine {
  label: string;
  values: Record<string, number | null>;
  variance: number | null;
  variancePercent: number | null;
}

export interface EntityPnlReport {
  calculationVersion: typeof ENTITY_PNL_CALCULATION_VERSION;
  financialPlanSource?: EntityPnlFinancialPlanSource;
  entity: string;
  asOf: string;
  comparison: EntityPnlComparison;
  currency: EntityPnlCurrency;
  units: EntityPnlCurrency;
  planningForecast?: EntityPnlPlanningForecast;
  forecastComparison?: EntityPnlForecastComparison;
  expenseReconciliation?: Array<{ period: string; amount: number | null }>;
  columns: string[];
  currentLabel: string;
  comparisonLabel: string;
  forecastLabel?: string;
  yearEndLabel: string;
  lines: EntityPnlLine[];
  metrics: Record<string, number | null>;
  sourceRowCount: number;
  forecastSourceRowCount: number;
  evidence: string[];
  warnings: string[];
  summary: string;
  kpis: Array<{ label: string; value: string; change?: string; direction?: "up" | "down" | "flat" }>;
  insights: string[];
  commentary: Array<{ label: string; text: string }>;
  table: { title: string; columns: string[]; rows: Array<Array<string | number | null>> };
  chart: {
    title: string;
    series: Array<{ name: string; values: Array<{ period: string; value: number | null }> }>;
  };
  periodLabel: string;
}

export function entityPnlResultPayload(report: EntityPnlReport) {
  const { summary, kpis, insights, commentary, table, periodLabel, ...payload } = report;
  return payload;
}

interface AggregateRow {
  year: number | string;
  month: number | string;
  scenario: string | null;
  cost_category: string | null;
  entity_category: string | null;
  resource_type: string | null;
  source_sub_category: string | null;
  amount: number | string | null;
  capacity: number | string | null;
  source_rows: number | string | null;
  amount_complete?: boolean;
  capacity_complete?: boolean;
}

const ACTUAL_SCENARIO_PREDICATE = sql`
  upper(trim(coalesce(version, ''))) IN ('', 'ACTUAL', 'ACT')
`;

const VISIBLE_COST_LINES = [
  { label: "Employee Benefits", aliases: new Set(["employee benefits", "employee benefit"]) },
  { label: "Outsourcing Cost", aliases: new Set(["outsourcing cost", "outsourcing costs"]) },
  { label: "Consultancy Charges", aliases: new Set(["consultancy charges", "consultancy charge"]) },
  {
    label: "CI Charges & Other Revenue",
    aliases: new Set(["ci charges & other revenue", "ci charges", "other revenue sw", "revenue software"]),
  },
  { label: "Facilities Cost", aliases: new Set(["facilities cost", "facility cost"]) },
  { label: "Other Expenses", aliases: new Set(["other expenses", "other expense"]) },
] as const;

const CAPACITY_LINES = [
  "End Capacity On-roll",
  "End Capacity Outsourcing",
  "Total End",
  "Avg Capacity On-roll",
  "Avg Capacity Outsourcing",
  "Total Average",
] as const;

const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONEY_LINES = new Set(["Revenue", ...VISIBLE_COST_LINES.map((line) => line.label), "Total Expenses", "EBIT"]);

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCategory(value: unknown): string {
  return String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function previousMonth(year: number, month: number, offset = 1): [number, number] {
  const absolute = year * 12 + month - 1 - offset;
  return [Math.floor(absolute / 12), ((absolute % 12) + 12) % 12 + 1];
}

function quarterNumber(month: number): number {
  return Math.ceil(month / 3);
}

function quarterLabel(point: [number, number]): string {
  return `Q${quarterNumber(point[1])} ${point[0]}`;
}

function periodLabel(year: number, month: number, suffix: string): string {
  return `${MONTH_ABBREVIATIONS[month - 1]} ${year} ${suffix}`;
}

function selectedPoints(request: EntityPnlReportRequest): Array<[number, number]> {
  const [year, month] = request.asOf.split("-").map(Number);
  const points = new Set<string>([`${year}:${month}`]);
  let comparisonPoint: [number, number];
  if (request.comparison === "qoq") {
    points.add(previousMonth(year, month).join(":"));
    comparisonPoint = previousMonth(year, month, 3);
    points.add(comparisonPoint.join(":"));
    points.add(previousMonth(...comparisonPoint).join(":"));
  } else {
    comparisonPoint = [year - 1, month];
    points.add(comparisonPoint.join(":"));
  }
  const yearEndPoint: [number, number] = [year - 1, 12];
  for (const [pointYear, pointMonth] of [[year, month], comparisonPoint, yearEndPoint] as Array<[number, number]>) {
    for (let currentMonth = 1; currentMonth <= pointMonth; currentMonth += 1) {
      points.add(`${pointYear}:${currentMonth}`);
    }
  }
  return Array.from(points, (point) => point.split(":").map(Number) as [number, number])
    .sort(([leftYear, leftMonth], [rightYear, rightMonth]) => leftYear - rightYear || leftMonth - rightMonth);
}

function capacityComponent(resourceType: unknown, sourceSubCategory: unknown): "on_roll" | "outsourcing" | undefined {
  const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/-/g, " ").trim().replace(/\s+/g, " ");
  const source = normalize(sourceSubCategory);
  const resource = normalize(resourceType);
  if (["internal", "on roll", "onroll"].includes(source) || ["internal", "on roll", "onroll"].includes(resource)) {
    return "on_roll";
  }
  if (["outsourcing", "external"].includes(source) || ["outsourcing", "external"].includes(resource)) {
    return "outsourcing";
  }
  return undefined;
}

type FinancialSnapshotCategory = "revenue" | "cost";

function normalizedScenario(scenario: string): string {
  return scenario.trim().toLowerCase();
}

function snapshotKey(point: [number, number], scenario: string): string {
  return `${point[0]}:${point[1]}:${normalizedScenario(scenario)}`;
}

function snapshotValueKey(point: [number, number], scenario: string, line: string): string {
  return `${snapshotKey(point, scenario)}:${line}`;
}

function amountForPeriod(
  snapshots: Map<string, number>,
  financialCoverage: Set<string>,
  point: [number, number],
  scenario: string,
  line: string,
  comparison: EntityPnlComparison,
): number | null {
  const category: FinancialSnapshotCategory = line === "Revenue" ? "revenue" : "cost";
  if (!financialCoverage.has(`${snapshotKey(point, scenario)}:${category}`)) return null;
  const current = snapshots.get(snapshotValueKey(point, scenario, line)) ?? 0;
  if (comparison === "yoy") return current;
  if (point[1] === 3) return current;
  const priorPoint = previousMonth(...point, 3);
  if (!financialCoverage.has(`${snapshotKey(priorPoint, scenario)}:${category}`)) return null;
  return current - (snapshots.get(snapshotValueKey(priorPoint, scenario, line)) ?? 0);
}

function capacityForPeriod(
  capacity: Map<string, number>,
  capacityCoverage: Set<string>,
  point: [number, number],
  scenario: string,
  component: "on_roll" | "outsourcing",
  comparison: EntityPnlComparison,
): [number | null, number | null] {
  const [year, month] = point;
  const currentKey = snapshotKey(point, scenario);
  if (!capacityCoverage.has(`${currentKey}:${component}`)) return [null, null];

  const end = capacity.get(`${currentKey}:${component}`) ?? 0;
  const averageMonths: number[] = [];
  const startMonth = comparison === "qoq" ? month - 2 : 1;
  for (let index = startMonth; index <= month; index += 1) {
    const monthKey = snapshotKey([year, index], scenario);
    if (!capacityCoverage.has(`${monthKey}:${component}`)) return [end, null];
    averageMonths.push(capacity.get(`${monthKey}:${component}`) ?? 0);
  }
  return [end, averageMonths.reduce((sum, value) => sum + value, 0) / averageMonths.length];
}

function money(value: number | null, currency: EntityPnlCurrency): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const symbol = currency === "USD" ? "$" : "₹";
  return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function valueFrom(
  snapshots: Map<string, number>,
  financialCoverage: Set<string>,
  point: [number, number],
  scenario: string,
  comparison: EntityPnlComparison,
  line: string,
): number | null {
  return amountForPeriod(snapshots, financialCoverage, point, scenario, line, comparison);
}

function difference(current: number | null, prior: number | null): number | null {
  return current === null || prior === null ? null : current - prior;
}

export function validateEntityPnlReportRequest(payload: unknown): EntityPnlReportRequest {
  const request = (payload ?? {}) as Partial<EntityPnlReportRequest>;
  if (typeof request.cubeId !== "string" || !request.cubeId.trim() || request.cubeId.length > 255) {
    throw new Error("Select an authorized Enterprise cube for Entity P&L.");
  }
  if (typeof request.asOf !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(request.asOf)) {
    throw new Error("Select a valid Entity P&L reporting month.");
  }
  if (request.comparison !== "qoq" && request.comparison !== "yoy") {
    throw new Error("Choose a QoQ or YoY Entity P&L comparison.");
  }
  const reportingMonth = Number(request.asOf.slice(5));
  if (request.comparison === "qoq" && ![3, 6, 9, 12].includes(reportingMonth)) {
    throw new Error("QoQ Entity P&L comparisons are available only for March, June, September, or December.");
  }
  if (request.currency !== "USD" && request.currency !== "INR") {
    throw new Error("Choose USD or INR for the Entity P&L report.");
  }
  const entity = typeof request.entity === "string" ? request.entity.trim() : "";
  const cfVersion = typeof request.cfVersion === "string" ? request.cfVersion.trim() : "";
  if (entity.length > 200) throw new Error("Entity selection is too long.");
  if (cfVersion.length > 100) throw new Error("Forecast scenario name is too long.");
  if (cfVersion && !(/\bCF\d{2}\b/i.test(cfVersion) || /forecast/i.test(cfVersion))) {
    throw new Error("Choose an available CF or Forecast scenario from the selected cube.");
  }
  return {
    cubeId: request.cubeId.trim(),
    entity,
    asOf: request.asOf,
    comparison: request.comparison,
    currency: request.currency,
    ...(cfVersion ? { cfVersion } : {}),
  };
}

export function buildEntityPnlReport(rows: AggregateRow[], request: EntityPnlReportRequest, planningForecast?: EntityPnlPlanningForecast, financialPlanSource?: EntityPnlFinancialPlanSource): EntityPnlReport {
  const snapshots = new Map<string, number>();
  const capacity = new Map<string, number>();
  const rowCounts = new Map<string, number>();
  const financialCoverage = new Set<string>();
  const capacityCoverage = new Set<string>();
  const invalidFinancialCoverage = new Set<string>();
  const invalidCapacityCoverage = new Set<string>();
  for (const row of rows) {
    const year = Number(row.year);
    const month = Number(row.month);
    const scenario = String(row.scenario ?? "").trim();
    if (!Number.isInteger(year) || !Number.isInteger(month) || !scenario) continue;
    const scenarioId = normalizedScenario(scenario);
    const periodKey = snapshotKey([year, month], scenarioId);
    rowCounts.set(scenarioId, (rowCounts.get(scenarioId) ?? 0) + finiteNumber(row.source_rows));
    const amount = finiteNumber(row.amount);
    const category = normalizeCategory(row.cost_category);
    if (category.includes("end capacity")) {
      const component = capacityComponent(row.resource_type, row.source_sub_category);
      if (component) {
        const key = `${periodKey}:${component}`;
        if (row.capacity_complete === false || row.capacity === null || String(row.capacity).trim() === "" || !Number.isFinite(Number(row.capacity))) {
          invalidCapacityCoverage.add(key);
          continue;
        }
        capacityCoverage.add(key);
        capacity.set(key, (capacity.get(key) ?? 0) + finiteNumber(row.capacity));
      }
      continue;
    }
    const entityCategory = normalizeCategory(row.entity_category);
    if (category === "revenue summary" && (entityCategory === "" || entityCategory === "revenue")) {
      if (row.amount_complete === false || row.amount === null || String(row.amount).trim() === "" || !Number.isFinite(Number(row.amount))) {
        invalidFinancialCoverage.add(`${periodKey}:revenue`);
        continue;
      }
      financialCoverage.add(`${periodKey}:revenue`);
      const key = `${periodKey}:Revenue`;
      snapshots.set(key, (snapshots.get(key) ?? 0) + amount);
    } else if (category === "cost summary") {
      if (row.amount_complete === false || row.amount === null || String(row.amount).trim() === "" || !Number.isFinite(Number(row.amount))) {
        invalidFinancialCoverage.add(`${periodKey}:cost`);
        continue;
      }
      financialCoverage.add(`${periodKey}:cost`);
      const totalKey = `${periodKey}:Total Expenses`;
      snapshots.set(totalKey, (snapshots.get(totalKey) ?? 0) + amount);
      const visibleLine = VISIBLE_COST_LINES.find((line) => line.aliases.has(entityCategory))?.label;
      if (visibleLine) {
        const key = `${periodKey}:${visibleLine}`;
        snapshots.set(key, (snapshots.get(key) ?? 0) + amount);
      }
    }
  }
  invalidFinancialCoverage.forEach((key) => financialCoverage.delete(key));
  invalidCapacityCoverage.forEach((key) => capacityCoverage.delete(key));

  const [year, month] = request.asOf.split("-").map(Number);
  const currentPoint: [number, number] = [year, month];
  const comparisonPoint = request.comparison === "qoq" ? previousMonth(year, month, 3) : [year - 1, month] as [number, number];
  const yearEndPoint: [number, number] = [year - 1, 12];
  const currentLabel = request.comparison === "qoq"
    ? quarterLabel(currentPoint)
    : periodLabel(year, month, "YTD");
  const comparisonLabel = request.comparison === "qoq"
    ? quarterLabel(comparisonPoint)
    : periodLabel(comparisonPoint[0], comparisonPoint[1], "YTD");
  const forecastLabel = request.cfVersion
    ? planningForecast && !financialPlanSource && !financialCoverage.has(`${snapshotKey(currentPoint, request.cfVersion)}:revenue`)
      && !financialCoverage.has(`${snapshotKey(currentPoint, request.cfVersion)}:cost`)
      ? `${request.cfVersion} · ${periodLabel(year, month, "snapshot")}`
      : request.comparison === "qoq"
      ? `${request.cfVersion} ${currentLabel}`
      : `${request.cfVersion} YTD`
    : undefined;
  const yearEndLabel = periodLabel(yearEndPoint[0], yearEndPoint[1], "YE");
  const columns = [currentLabel, comparisonLabel, ...(forecastLabel ? [forecastLabel] : []), yearEndLabel];
  const baseLineLabels = ["Revenue", ...VISIBLE_COST_LINES.map((line) => line.label), "Total Expenses"];
  const valuesByLine = new Map<string, Record<string, number | null>>();

  for (const label of baseLineLabels) {
    const values: Record<string, number | null> = {};
    values[currentLabel] = valueFrom(snapshots, financialCoverage, currentPoint, "actual", request.comparison, label);
    values[comparisonLabel] = valueFrom(snapshots, financialCoverage, comparisonPoint, "actual", request.comparison, label);
    values[yearEndLabel] = valueFrom(snapshots, financialCoverage, yearEndPoint, "actual", "yoy", label);
    if (request.cfVersion && forecastLabel) {
      values[forecastLabel] = valueFrom(snapshots, financialCoverage, currentPoint, request.cfVersion, request.comparison, label);
    }
    valuesByLine.set(label, values);
  }

  const derivedLabels = ["EBIT", "EBIT%"];
  for (const label of derivedLabels) valuesByLine.set(label, {});
  for (const column of columns) {
    const revenue = valuesByLine.get("Revenue")?.[column] ?? null;
    const expenses = valuesByLine.get("Total Expenses")?.[column] ?? null;
    const ebit = revenue === null || expenses === null ? null : revenue - expenses;
    valuesByLine.get("EBIT")![column] = ebit;
    valuesByLine.get("EBIT%")![column] = ebit === null || revenue === null || revenue === 0
      ? null
      : (ebit / revenue) * 100;
  }

  const capacityPoints: Array<{ point: [number, number]; label: string; scenario: string }> = [
    { point: currentPoint, label: currentLabel, scenario: "actual" },
    { point: comparisonPoint, label: comparisonLabel, scenario: "actual" },
    { point: yearEndPoint, label: yearEndLabel, scenario: "actual" },
  ];
  if (request.cfVersion && forecastLabel) capacityPoints.push({ point: currentPoint, label: forecastLabel, scenario: request.cfVersion });
  const missingCapacitySnapshots = new Set<string>();
  const incompleteCapacityAverages = new Map<string, string[]>();
  for (const { point, label, scenario } of capacityPoints) {
    const periodKey = snapshotKey(point, scenario);
    if (!["on_roll", "outsourcing"].every((component) => capacityCoverage.has(`${periodKey}:${component}`))) missingCapacitySnapshots.add(label);
    const averageComparison = label === yearEndLabel ? "yoy" : request.comparison;
    const startMonth = averageComparison === "qoq" ? point[1] - 2 : 1;
    const missingAverageMonths = Array.from({ length: point[1] - startMonth + 1 }, (_, index) => index + startMonth)
      .filter((monthNumber) => !["on_roll", "outsourcing"].every((component) =>
        capacityCoverage.has(`${snapshotKey([point[0], monthNumber], scenario)}:${component}`)));
    if (missingAverageMonths.length) {
      incompleteCapacityAverages.set(
        label,
        missingAverageMonths.map((monthNumber) => `${MONTH_ABBREVIATIONS[monthNumber - 1]} ${point[0]}`),
      );
    }

    const [onRollEnd, onRollAverage] = capacityForPeriod(capacity, capacityCoverage, point, scenario, "on_roll", averageComparison);
    const [outsourcingEnd, outsourcingAverage] = capacityForPeriod(capacity, capacityCoverage, point, scenario, "outsourcing", averageComparison);
    const lineValues: Record<string, number | null> = {
      "End Capacity On-roll": onRollEnd,
      "End Capacity Outsourcing": outsourcingEnd,
      "Total End": onRollEnd === null || outsourcingEnd === null ? null : onRollEnd + outsourcingEnd,
      "Avg Capacity On-roll": onRollAverage,
      "Avg Capacity Outsourcing": outsourcingAverage,
      "Total Average": onRollAverage === null || outsourcingAverage === null ? null : onRollAverage + outsourcingAverage,
    };
    for (const capacityLabel of CAPACITY_LINES) {
      const values = valuesByLine.get(capacityLabel) ?? {};
      values[label] = lineValues[capacityLabel];
      valuesByLine.set(capacityLabel, values);
    }
  }

  const entity = request.entity?.trim() || "All entities";
  const lineLabels = [...baseLineLabels.slice(0, -1), "Total Expenses", ...derivedLabels, ...CAPACITY_LINES];
  const lines = lineLabels.map((label): EntityPnlLine => {
    const values = valuesByLine.get(label) ?? {};
    const current = values[currentLabel] ?? null;
    const prior = values[comparisonLabel] ?? null;
    const variance = current === null || prior === null ? null : current - prior;
  const variancePercent = label === "EBIT%" || variance === null || prior === null || prior === 0 ? null : (variance / Math.abs(prior)) * 100;
    return { label, values, variance, variancePercent };
  });

  const currentRevenue = valuesByLine.get("Revenue")?.[currentLabel] ?? null;
  const priorRevenue = valuesByLine.get("Revenue")?.[comparisonLabel] ?? null;
  const currentEbit = valuesByLine.get("EBIT")?.[currentLabel] ?? null;
  const priorEbit = valuesByLine.get("EBIT")?.[comparisonLabel] ?? null;
  const currentEbitPercent = valuesByLine.get("EBIT%")?.[currentLabel] ?? null;
  const priorEbitPercent = valuesByLine.get("EBIT%")?.[comparisonLabel] ?? null;
  const totalEnd = valuesByLine.get("Total End")?.[currentLabel] ?? null;
  const totalAverage = valuesByLine.get("Total Average")?.[currentLabel] ?? null;
  const revenueDelta = difference(currentRevenue, priorRevenue);
  const ebitDelta = difference(currentEbit, priorEbit);
  const mode = request.comparison === "qoq" ? "quarter" : "YTD";
  const summary = `${entity} reported ${money(currentRevenue, request.currency)} revenue and ${money(currentEbit, request.currency)} EBIT in ${currentLabel}. EBIT moved ${money(ebitDelta, request.currency)} from ${comparisonLabel}.`;
  const warnings: string[] = [];
  if ((rowCounts.get("actual") ?? 0) === 0) warnings.push("No Actual Entity P&L rows were found for the selected period and entity scope.");
  if (request.cfVersion && (rowCounts.get(normalizedScenario(request.cfVersion)) ?? 0) === 0) {
    warnings.push(`No supported financial summary or end-capacity rows were found for ${request.cfVersion}. This does not mean the cube has no forecast records.`);
  }
  if (invalidFinancialCoverage.size) warnings.push(`Some ${request.currency} amounts are missing or incomplete; affected revenue, expenses and EBIT are unavailable, not zero.`);
  if (invalidCapacityCoverage.size) warnings.push("Some capacity amounts are missing or incomplete; affected capacity measures are unavailable, not zero.");
  if (request.cfVersion && !request.entity) warnings.push("All-entity planning source scopes are displayed separately; they are not assumed to match the financial consolidated population.");
  if (planningForecast) {
    warnings.push("Available operational forecast measures are shown separately below. Missing financial expenses, currency conversions and unconfirmed period semantics are not estimated.");
    warnings.push(...planningForecast.warnings);
  }

  const requiredSnapshotChecks: Array<{
    point: [number, number];
    scenario: string;
    category: FinancialSnapshotCategory;
  }> = [];
  const requireFinancialSnapshots = (
    point: [number, number],
    scenario: string,
    comparison: EntityPnlComparison,
  ) => {
    const points = comparison === "qoq" && point[1] !== 3
      ? [point, previousMonth(...point, 3)]
      : [point];
    for (const requiredPoint of points) {
      requiredSnapshotChecks.push(
        { point: requiredPoint, scenario, category: "revenue" },
        { point: requiredPoint, scenario, category: "cost" },
      );
    }
  };
  requireFinancialSnapshots(currentPoint, "actual", request.comparison);
  requireFinancialSnapshots(comparisonPoint, "actual", request.comparison);
  requireFinancialSnapshots(yearEndPoint, "actual", "yoy");
  if (request.cfVersion) requireFinancialSnapshots(currentPoint, request.cfVersion, request.comparison);

  const missingSnapshotsByPeriod = new Map<string, {
    scenario: string;
    point: [number, number];
    categories: Set<FinancialSnapshotCategory>;
  }>();
  for (const check of requiredSnapshotChecks) {
    if (financialCoverage.has(`${snapshotKey(check.point, check.scenario)}:${check.category}`)) continue;
    const periodKey = snapshotKey(check.point, check.scenario);
    const missing = missingSnapshotsByPeriod.get(periodKey) ?? {
      scenario: check.scenario,
      point: check.point,
      categories: new Set<FinancialSnapshotCategory>(),
    };
    missing.categories.add(check.category);
    missingSnapshotsByPeriod.set(periodKey, missing);
  }
  const missingSnapshotsByScenario = new Map<string, string[]>();
  for (const missing of Array.from(missingSnapshotsByPeriod.values())) {
    const categoryLabels = (["revenue", "cost"] as const)
      .filter((category) => missing.categories.has(category))
      .map((category) => category === "revenue" ? "Revenue Summary" : "Cost Summary");
    const details = `${MONTH_ABBREVIATIONS[missing.point[1] - 1]} ${missing.point[0]}: ${categoryLabels.join(" and ")}`;
    const scenarioDetails = missingSnapshotsByScenario.get(missing.scenario) ?? [];
    scenarioDetails.push(details);
    missingSnapshotsByScenario.set(missing.scenario, scenarioDetails);
  }
  for (const [scenario, missingPeriods] of Array.from(missingSnapshotsByScenario.entries())) {
    const scenarioLabel = scenario === "actual" ? "Actual" : scenario;
    warnings.push(
      `${scenarioLabel} source snapshots are missing (${missingPeriods.join("; ")}); affected P&L values are shown as —, not zero.`,
    );
  }

  if (capacityCoverage.size === 0) {
    warnings.push("No on-roll or outsourcing capacity rows were found for this scope.");
  } else {
    if (missingCapacitySnapshots.size) {
      warnings.push(
        `Capacity snapshots are missing for ${Array.from(missingCapacitySnapshots).join(", ")}; affected end-capacity values are shown as —.`,
      );
    }
    if (incompleteCapacityAverages.size) {
      const details = Array.from(incompleteCapacityAverages.entries())
        .map(([label, months]) => `${label} (missing ${months.join(", ")})`)
        .join("; ");
      warnings.push(`${request.comparison === "qoq" ? "Quarter capacity averages (and full-year averages for YE)" : "YTD capacity averages"} are unavailable because monthly capacity snapshots are incomplete: ${details}.`);
    }
  }
  const insights = [
    revenueDelta === null
      ? `Revenue movement is unavailable because source snapshots are missing for one or more selected ${mode} periods.`
      : `Revenue changed by ${money(revenueDelta, request.currency)} between the selected ${mode} periods.`,
    ebitDelta === null
      ? "EBIT movement is unavailable because required P&L source snapshots are missing."
      : `EBIT changed by ${money(ebitDelta, request.currency)}; the report attributes movement only to governed P&L figures.`,
  ];
  const commentary = [{
    label: "Revenue and EBIT",
    text: `${currentLabel} revenue is ${money(currentRevenue, request.currency)} and EBIT is ${money(currentEbit, request.currency)}. Underlying business causes require owner commentary.`,
  }];
  const kpis = [
    {
      label: `Revenue · ${currentLabel}`,
      value: money(currentRevenue, request.currency),
      change: revenueDelta === null ? `Comparison unavailable vs ${comparisonLabel}` : `${money(revenueDelta, request.currency)} vs ${comparisonLabel}`,
      direction: revenueDelta === null ? undefined : revenueDelta >= 0 ? "up" as const : "down" as const,
    },
    {
      label: `EBIT · ${currentLabel}`,
      value: money(currentEbit, request.currency),
      change: ebitDelta === null ? `Comparison unavailable vs ${comparisonLabel}` : `${money(ebitDelta, request.currency)} vs ${comparisonLabel}`,
      direction: ebitDelta === null ? undefined : ebitDelta >= 0 ? "up" as const : "down" as const,
    },
    {
      label: `EBIT% · ${currentLabel}`,
      value: currentEbitPercent === null ? "—" : `${currentEbitPercent.toFixed(1)}%`,
      direction: currentEbitPercent === null || priorEbitPercent === null
        ? undefined
        : currentEbitPercent >= priorEbitPercent ? "up" as const : "down" as const,
    },
    {
      label: "Total End",
      value: totalEnd === null ? "—" : totalEnd.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      change: totalAverage === null
        ? `${request.comparison === "qoq" ? "Quarter" : "YTD"} average unavailable`
        : `Total average ${totalAverage.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${request.comparison === "qoq" ? "quarter" : "YTD"}`,
      direction: totalEnd === null ? undefined : "flat" as const,
    },
  ];
  const tableColumns = ["Line item", ...columns, "Variance", "%"];
  const tableRows = lines.map((line) => [
    line.label,
    ...columns.map((column) => {
      const value = line.values[column];
      if (value === null || value === undefined) return "—";
      if (line.label === "EBIT%") return `${value.toFixed(1)}%`;
      if (!MONEY_LINES.has(line.label)) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
      return money(value, request.currency);
    }),
    line.variance === null
      ? "—"
      : MONEY_LINES.has(line.label)
        ? money(line.variance, request.currency)
        : line.label === "EBIT%"
          ? `${line.variance.toFixed(1)} pp`
          : line.variance.toLocaleString("en-US", { maximumFractionDigits: 0 }),
    line.variancePercent === null ? "—" : `${line.variancePercent.toFixed(1)}%`,
  ]);
  const metrics = Object.fromEntries(lines.map((line) => [line.label, line.values[currentLabel] ?? null]));
  const expenseReconciliation = columns.map((period) => {
    const total = valuesByLine.get("Total Expenses")?.[period] ?? null;
    const displayed = VISIBLE_COST_LINES.map((line) => valuesByLine.get(line.label)?.[period] ?? null);
    return { period, amount: total === null || displayed.some((value) => value === null)
      ? null : total - displayed.reduce<number>((sum, value) => sum + (value ?? 0), 0) };
  });
  const evidence = [
    `Read ${rowCounts.get("actual") ?? 0} Actual source rows from the selected authorized cube.`,
    request.entity
      ? `Read-only run from the selected Enterprise cube for ${entity}.`
      : "Read-only run from the selected Enterprise cube across all entity rows, including blank entity values.",
    `${request.comparison.toUpperCase()} comparison: ${currentLabel} versus ${comparisonLabel}.`,
    "Total Expenses uses classified Entity P&L Cost Summary rows with nonblank entity category and subcategory; credits and reversals retain their signed contribution. Visible expense rows are a presentation subset.",
    "Revenue excludes order reasons YEH, YEI, YEJ, YEK, YN2 and GL accounts beginning 139, matching the existing Entity P&L rules.",
    "Financial values use cumulative YTD snapshots, not a sum of monthly YTD snapshots. Calendar-quarter amounts use quarter-end differences.",
    "Actual and CF are queried as separate scenarios and are never combined.",
  ];
  if (request.cfVersion) {
    evidence.push(`Read ${rowCounts.get(normalizedScenario(request.cfVersion)) ?? 0} source rows for ${request.cfVersion}; forecast amounts remain separate from Actual.`);
  }
  if (planningForecast) evidence.push(`Read ${planningForecast.sourceRowCount} planning source rows for ${planningForecast.entity}, ${planningForecast.scenario}, ${planningForecast.asOf}, blank-GB entity total scope. Operational measures are not mixed with financial snapshots.`);
  evidence.push(`Variance is current Actual minus comparison Actual, not Actual minus Forecast. Undisplayed expense categories are reconciled separately without redefining Other Expenses.`);
  const chart = {
    title: "Revenue, Expenses and EBIT",
    series: ["Revenue", "Total Expenses", "EBIT"].map((name) => ({
      name,
      values: [currentLabel, comparisonLabel].map((period) => ({
        period,
        value: valuesByLine.get(name)?.[period] ?? null,
      })),
    })),
  };
  const forecastComparison = request.cfVersion && forecastLabel ? {
    scenario: request.cfVersion,
    rows: lines.map((line) => {
      const actual = line.values[currentLabel] ?? null;
      const forecast = line.values[forecastLabel] ?? null;
      const variance = actual === null || forecast === null ? null : actual - forecast;
      return {
        label: line.label, actual, forecast, variance,
        variancePercent: line.label === "EBIT%" || variance === null || forecast === null || forecast === 0
          ? null : variance / Math.abs(forecast) * 100,
        ...(actual === null || forecast === null ? { reason: forecast === null
          ? "Comparable CF snapshot unavailable: operational budget/capacity is not a confirmed financial or mapped capacity snapshot."
          : "Actual snapshot unavailable." } : {}),
      };
    }),
  } : undefined;

  return {
    calculationVersion: ENTITY_PNL_CALCULATION_VERSION,
    ...(financialPlanSource ? { financialPlanSource } : {}),
    entity,
    asOf: request.asOf,
    comparison: request.comparison,
    currency: request.currency,
    units: request.currency,
    ...(planningForecast ? { planningForecast } : {}),
    ...(forecastComparison ? { forecastComparison } : {}),
    expenseReconciliation,
    columns,
    currentLabel,
    comparisonLabel,
    ...(forecastLabel ? { forecastLabel } : {}),
    yearEndLabel,
    lines,
    metrics,
    sourceRowCount: rowCounts.get("actual") ?? 0,
    forecastSourceRowCount: request.cfVersion ? rowCounts.get(normalizedScenario(request.cfVersion)) ?? 0 : 0,
    evidence,
    warnings,
    summary,
    kpis,
    insights,
    commentary,
    table: { title: `Entity P&L · ${entity}`, columns: tableColumns, rows: tableRows },
    chart,
    periodLabel: currentLabel,
  };
}

export async function runEntityPnlReport(request: EntityPnlReportRequest, financialPlanData?: unknown): Promise<EntityPnlReport> {
  const points = selectedPoints(request);
  const pointFilter = sql.join(
    points.map(([year, month]) => sql`(year = ${year} AND month = ${month})`),
    sql` OR `,
  );
  const entityFilter = request.entity
    ? sql`AND lower(trim(coalesce(region_entity, ''))) = lower(trim(${request.entity}))`
    : sql``;
  const scenarioFilter = request.cfVersion
    ? sql`(${ACTUAL_SCENARIO_PREDICATE} OR lower(trim(coalesce(version, ''))) = lower(${request.cfVersion}))`
    : ACTUAL_SCENARIO_PREDICATE;
  const currencyColumn = request.currency === "USD" ? sql`amount_usd` : sql`amount_inr`;
  const result = await db.execute(sql`
    SELECT
      year,
      month,
      CASE WHEN ${ACTUAL_SCENARIO_PREDICATE} THEN 'actual' ELSE trim(coalesce(version, '')) END AS scenario,
      trim(coalesce(cost_category, '')) AS cost_category,
      trim(coalesce(entity_category, '')) AS entity_category,
      trim(coalesce(resource_type, '')) AS resource_type,
      trim(coalesce(row_data ->> 'source_sub_category', '')) AS source_sub_category,
      sum(${currencyColumn}) AS amount,
      count(${currencyColumn}) = count(*) AS amount_complete,
      sum(capacity) AS capacity,
      count(capacity) = count(*) AS capacity_complete,
      count(*)::int AS source_rows
    FROM cube_fact_data
    WHERE cube_id = ${request.cubeId}
      ${entityFilter}
      AND (${pointFilter})
      AND ${scenarioFilter}
      AND (
        (lower(trim(coalesce(cost_category, ''))) = 'revenue summary'
          AND coalesce(trim(order_reason), '') NOT IN ('YEH', 'YEI', 'YEJ', 'YEK', 'YN2')
          AND coalesce(trim(gl_account), '') NOT LIKE '139%')
        OR (lower(trim(coalesce(cost_category, ''))) = 'cost summary'
          AND trim(coalesce(entity_category, '')) <> ''
          AND trim(coalesce(entity_sub_category, '')) <> '')
        OR lower(trim(coalesce(cost_category, ''))) LIKE '%end capacity%'
      )
    GROUP BY year, month, scenario, cost_category, entity_category, resource_type, source_sub_category
  `);
  let rows = ((result as unknown as { rows?: unknown[] }).rows ?? []) as AggregateRow[];
  const financialPlan = financialPlanData ? validateEntityPnlFinancialPlan(financialPlanData) : undefined;
  const matchingEntity = Boolean(financialPlan && request.entity
    && request.entity.trim().toLowerCase() === financialPlan.entity.trim().toLowerCase());
  const selectedScenario = Boolean(financialPlan && request.cfVersion
    && financialPlan.rows.some((row) => row.scenario.toLowerCase() === request.cfVersion!.toLowerCase() && row.value !== null));
  const useFinancialPlan = matchingEntity && selectedScenario;
  let financialPlanSource: EntityPnlFinancialPlanSource | undefined;
  if (useFinancialPlan && financialPlan && request.cfVersion) {
    const pointKeys = new Set(points.map((point) => point.join(":")));
    // Authoritative board-local source: never add the legacy cube CF population to it.
    rows = rows.filter((row) => normalizedScenario(String(row.scenario)) !== normalizedScenario(request.cfVersion!));
    rows.push(...financialPlanAggregateRows(financialPlan, request)
      .filter((row) => pointKeys.has(`${row.year}:${row.month}`)));
    financialPlanSource = {
      sourceName: financialPlan.sourceName, entity: financialPlan.entity,
      sourceUnit: financialPlan.sourceUnit, periodBasis: financialPlan.periodBasis,
      scenario: request.cfVersion,
      ...(financialPlan.usdExchangeRates[request.cfVersion] ? { usdExchangeRate: financialPlan.usdExchangeRates[request.cfVersion] } : {}),
    };
  }
  const planningForecast = useFinancialPlan ? undefined : await readEntityPnlPlanningForecast(request);
  const report = buildEntityPnlReport(rows, request, planningForecast, financialPlanSource);
  if (financialPlan) {
    if (!matchingEntity) report.warnings.push(`The revised financial plan covers ${financialPlan.entity} only. Select ${financialPlan.entity}; it is not a consolidated All entities forecast.`);
    else if (!selectedScenario) report.warnings.push(`The revised financial plan has no populated ${request.cfVersion ?? "selected forecast"} values. Empty forecast columns are unavailable, not zero.`);
    if (financialPlanSource) {
      report.evidence.push(`Financial forecast source: ${financialPlan.sourceName}, ${financialPlan.entity} only. Financial cells are mINR, normalized once to INR; cumulative YTD basis was confirmed by the user. Months are not summed.`);
      report.evidence.push("Financial plan: Revenue maps to Revenue Summary; other financial categories retain the existing signed expense classification. Internal/Outsourcing End Capacity maps directly; averages use the required monthly end snapshots.");
      if (request.currency === "USD") {
        const rate = financialPlanSource.usdExchangeRate;
        if (rate) report.evidence.push(`${request.cfVersion} USD conversion: source mINR × 1,000,000 ÷ ${rate} INR/USD. Actual uses existing cube USD amounts, not the forecast rate.`);
        else report.warnings.push(`No approved INR/USD rate was supplied for ${request.cfVersion}. Financial USD forecast values are unavailable; capacities remain unconverted.`);
      }
    }
  }
  return report;
}