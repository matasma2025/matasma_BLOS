import ExcelJS from "exceljs";
import { z } from "zod";
import type { EntityPnlFinancialPlan } from "../../shared/entityPnlPlanning";

const categories = new Set([
  "revenue", "revenue hardware", "revenue software", "travel expenses", "welfare cost",
  "average capacity", "consultancy charges", "depreciation", "employee benefit",
  "end capacity", "facility cost", "material cost", "other expenses", "outsourcing cost",
]);
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export const entityPnlFinancialPlanSchema = z.object({
  version: z.literal(1),
  entity: z.string().min(1).max(200),
  sourceName: z.string().min(1).max(200),
  sourceUnit: z.literal("mINR"),
  periodBasis: z.enum(["ytd", "mtd"]),
  usdExchangeRates: z.record(z.string().max(100), z.number().finite().positive().max(1_000_000)),
  rows: z.array(z.object({
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
    category: z.string().max(200).refine((value) => categories.has(normalize(value)), "Unsupported financial plan category"),
    subcategory: z.string().min(1).max(200),
    scenario: z.string().regex(/^CF\d{2} \d{4}$/),
    value: z.number().finite().nullable(),
  }).strict()).min(1).max(10_000),
}).strict();

export function validateEntityPnlFinancialPlan(value: unknown): EntityPnlFinancialPlan {
  const plan = entityPnlFinancialPlanSchema.parse(value);
  const keys = new Set<string>();
  for (const row of plan.rows) {
    if (row.scenario.slice(-4) !== String(row.year)) throw new Error("Financial forecast scenario and fiscal year must agree.");
    const key = `${row.year}:${row.month}:${normalize(row.category)}:${normalize(row.subcategory)}:${row.scenario}`;
    if (keys.has(key)) throw new Error(`Duplicate financial plan scope: ${key}. Import a single authoritative record.`);
    keys.add(key);
    if (normalize(row.category).includes("capacity") && !["internal", "outsourcing"].includes(normalize(row.subcategory))) {
      throw new Error("Financial plan capacity must explicitly identify Internal or Outsourcing.");
    }
  }
  if (Object.keys(plan.usdExchangeRates).length > 20) throw new Error("Too many financial plan exchange rates.");
  return plan;
}

function cellValue(cell: ExcelJS.Cell): string | number | null {
  let value = cell.value;
  if (value && typeof value === "object" && "formula" in value) {
    value = value.result as ExcelJS.CellValue;
    if (value === undefined) throw new Error(`Formula ${cell.address} has no cached result. Recalculate and save the workbook.`);
  }
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number") return value;
  throw new Error(`Unsupported value at ${cell.address}.`);
}

/** Import only the explicitly confirmed financial sheet, never an operational budget sheet. */
export async function parseEntityPnlFinancialPlanWorkbook(
  bytes: Buffer,
  options: { entity: string; sourceName: string; usdExchangeRates: Record<string, number>; periodBasis?: EntityPnlFinancialPlan["periodBasis"] },
): Promise<EntityPnlFinancialPlan> {
  if (bytes.length > 10_000_000) throw new Error("Entity P&L financial workbook exceeds 10 MB.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as any);
  const sheets = workbook.worksheets.filter((sheet) => normalize(sheet.name) === "plan entity p&l");
  if (sheets.length !== 1) throw new Error("Expected one Plan Entity P&L worksheet.");
  const sheet = sheets[0];
  const expected = ["entity", "fiscalyear", "month", "category", "sub_category"];
  expected.forEach((header, index) => {
    if (normalize(cellValue(sheet.getCell(1, index + 1))) !== header) throw new Error(`Missing financial plan header ${header}.`);
  });
  const forecastColumns: Array<{ column: number; code: string }> = [];
  for (let column = 6; column <= sheet.columnCount; column++) {
    const code = String(cellValue(sheet.getCell(1, column)) ?? "").trim().toUpperCase();
    if (/^CF\d{2}$/.test(code)) forecastColumns.push({ column, code });
    else if (code && code !== "BP") throw new Error(`Unexpected financial scenario header: ${code}.`);
  }
  const rows: EntityPnlFinancialPlan["rows"] = [];
  for (let index = 2; index <= sheet.rowCount; index++) {
    const source = sheet.getRow(index);
    if (!source.hasValues) continue;
    const entity = String(cellValue(source.getCell(1)) ?? "").trim();
    if (normalize(entity) !== normalize(options.entity)) throw new Error(`Row ${index}: financial plan belongs to ${entity}, not ${options.entity}.`);
    const year = Number(cellValue(source.getCell(2)));
    const month = Number(cellValue(source.getCell(3)));
    const category = String(cellValue(source.getCell(4)) ?? "").trim();
    const subcategory = String(cellValue(source.getCell(5)) ?? "").trim();
    for (const { column, code } of forecastColumns) {
      const raw = cellValue(source.getCell(column));
      const value = raw === null || (typeof raw === "string" && !raw.trim())
        ? null : Number(typeof raw === "string" ? raw.replace(/,/g, "") : raw);
      if (value !== null && !Number.isFinite(value)) throw new Error(`Invalid financial amount at row ${index}, ${code}.`);
      rows.push({ year, month, category, subcategory, scenario: `${code} ${year}`, value });
    }
  }
  // Entirely empty CF09/CF11 columns are unavailable, not zero-valued forecasts.
  const populated = new Set(rows.filter((row) => row.value !== null).map((row) => row.scenario));
  return validateEntityPnlFinancialPlan({
    version: 1, entity: options.entity, sourceName: options.sourceName,
    sourceUnit: "mINR", periodBasis: options.periodBasis ?? "ytd", usdExchangeRates: options.usdExchangeRates,
    rows: rows.filter((row) => populated.has(row.scenario)),
  });
}

export function financialPlanUsdRate(plan: EntityPnlFinancialPlan, scenario?: string): number | undefined {
  return Object.entries(plan.usdExchangeRates).find(([key]) => normalize(key) === normalize(scenario))?.[1];
}

export function financialPlanAggregateRows(
  plan: EntityPnlFinancialPlan,
  request: { entity?: string; cfVersion?: string; currency: "INR" | "USD" },
) {
  if (!request.entity || normalize(request.entity) !== normalize(plan.entity) || !request.cfVersion) return [];
  const scenario = request.cfVersion.toLowerCase();
  const source = plan.rows.filter((row) => row.scenario.toLowerCase() === scenario);
  // A completely unpopulated subline is not part of this scenario; partial blanks remain missing.
  const populated = new Set(source.filter((row) => row.value !== null)
    .map((row) => `${row.year}:${normalize(row.category)}:${normalize(row.subcategory)}`));
  const rate = financialPlanUsdRate(plan, request.cfVersion);
  const retained = source.filter((row) => populated.has(`${row.year}:${normalize(row.category)}:${normalize(row.subcategory)}`))
    .filter((row) => normalize(row.category) !== "average capacity");
  // MTD sublines must cover every required month. Make absent records explicitly
  // missing rather than allowing the other sublines to hide an understated total.
  // Stock capacity records remain the original monthly snapshots.
  const amounts: Array<EntityPnlFinancialPlan["rows"][number] & { sourceRows: number }> = [];
  if (plan.periodBasis === "mtd") {
    const groups = new Map<string, EntityPnlFinancialPlan["rows"]>();
    for (const row of retained) {
      if (normalize(row.category) === "end capacity") { amounts.push({ ...row, sourceRows: 1 }); continue; }
      const key = `${row.year}:${normalize(row.category)}:${normalize(row.subcategory)}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    for (const group of Array.from(groups.values())) {
      const byMonth = new Map(group.map((row) => [row.month, row]));
      for (let month = 1; month <= 12; month++) {
        const row = byMonth.get(month);
        amounts.push({ ...(row ?? { ...group[0], month, value: null }), sourceRows: row ? 1 : 0 });
      }
    }
  } else amounts.push(...retained.map((row) => ({ ...row, sourceRows: 1 })));
  return amounts
    .map((row) => {
      const isCapacity = normalize(row.category) === "end capacity";
      const converted = row.value === null ? null
        : isCapacity ? row.value
        : request.currency === "INR" ? row.value * 1_000_000
        : rate ? row.value * 1_000_000 / rate : null;
      return {
        year: row.year, month: row.month, scenario: request.cfVersion!,
        cost_category: isCapacity ? "End Capacity" : normalize(row.category) === "revenue" ? "Revenue Summary" : "Cost Summary",
        entity_category: isCapacity ? "" : normalize(row.category) === "revenue" ? "Revenue" : row.category,
        resource_type: isCapacity ? row.subcategory : "",
        source_sub_category: isCapacity ? row.subcategory : "",
        amount: isCapacity ? null : converted,
        amount_complete: isCapacity || converted !== null,
        capacity: isCapacity ? converted : null,
        capacity_complete: !isCapacity || converted !== null,
        source_rows: row.sourceRows,
      };
    });
}
