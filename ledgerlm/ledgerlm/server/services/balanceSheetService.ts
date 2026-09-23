import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import ExcelJS from "exceljs";
import { db } from "../db";
import { cubeBalanceSheetData, cubes } from "@shared/schema";
import type {
  BalanceSheetLineItem,
  BalanceSheetPeriod,
  BalanceSheetReport,
  BalanceSheetTotals,
} from "@shared/boards/balanceSheet";

const balanceSheetRowSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
  periodLabel: z.string().max(100).optional().nullable(),
  entity: z.string().max(255).optional().nullable(),
  companyId: z.string().max(255).optional().nullable(),
  subsidiary: z.string().max(255).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  accountCode: z.string().max(100).optional().nullable(),
  accountName: z.string().max(500),
  section: z.enum(["assets", "liabilities", "equity"]),
  category: z.string().max(255),
  amountLocal: z.number().finite().optional().nullable(),
  amountReporting: z.number().finite(),
  currency: z.string().max(20).default("USD"),
  sourceFile: z.string().max(255).optional().nullable(),
  sourceRowNumber: z.number().int().optional().nullable(),
}).strict();

export const balanceSheetIngestionSchema = z.object({
  rows: z.array(balanceSheetRowSchema).min(1).max(100_000),
  replacePeriods: z.array(z.object({
    fiscalYear: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
  }).strict()).max(24).optional(),
}).strict();

type RawBalanceSheetRow = z.infer<typeof balanceSheetRowSchema>;

export type BalanceSheetImportRow = RawBalanceSheetRow;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("result" in value) return cellText((value as { result?: unknown }).result);
    if ("text" in value) return cellText((value as { text?: unknown }).text);
    if ("richText" in value && Array.isArray((value as { richText?: unknown[] }).richText)) {
      return ((value as { richText: Array<{ text?: unknown }> }).richText)
        .map((part) => cellText(part.text))
        .join("");
    }
  }
  return String(value).trim();
}

function cellNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = cellText(value).replace(/,/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!normalized || normalized === "-" || /^#/.test(normalized)) return null;
  const parsed = Number(normalized.replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function periodFromCell(value: unknown): { fiscalYear: number; month: number; periodLabel: string } | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const fiscalYear = value.getFullYear();
    const month = value.getMonth() + 1;
    return {
      fiscalYear,
      month,
      periodLabel: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(value),
    };
  }
  const text = cellText(value);
  const match = text.match(/^(?:(\d{1,2})[\/-])?(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1] ?? 1);
  const fiscalYear = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return {
    fiscalYear,
    month,
    periodLabel: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(fiscalYear, month - 1, 1)),
  };
}

function classifyWorkbookRow(section: "assets" | "liabilities" | "equity", category: string, accountName: string) {
  if (section !== "liabilities") return section;
  const categoryText = category.trim().toLowerCase();
  const accountText = accountName.trim().toLowerCase();
  if (
    categoryText === "equity"
    || /^total:\s*equity\b/.test(accountText)
    || /^(subscribed capital|capital surplus|earned surplus reserves|unappropriate earnings\/losses|non-controlling interests)\b/.test(accountText)
  ) return "equity" as const;
  return section;
}

/**
 * Reads the supplied Balance Sheet workbook format:
 * - BS-Assets and BS-Liabilities sheets
 * - column D: account particulars
 * - column E: account number
 * - date columns: point-in-time balances
 *
 * Leaf accounts and subtotal rows are retained. Report calculations select the
 * appropriate subtotal rows for statement totals and use leaf rows for account
 * movement detail, so the standalone output can preserve the workbook's full
 * asset and liability presentation without double-counting.
 */
export async function parseBalanceSheetWorkbook(filePath: string, sourceFile: string): Promise<BalanceSheetImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rows: BalanceSheetImportRow[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name.toLowerCase();
    const section: BalanceSheetImportRow["section"] | null = sheetName.includes("liabil")
      ? "liabilities"
      : sheetName.includes("asset")
        ? "assets"
        : sheetName.includes("equity")
          ? "equity"
          : null;
    if (!section) continue;

    const periodColumns: Array<{ column: number; period: NonNullable<ReturnType<typeof periodFromCell>> }> = [];
    worksheet.getRow(1).eachCell((cell, column) => {
      const period = periodFromCell(cell.value);
      if (period) periodColumns.push({ column, period });
    });
    if (!periodColumns.length) {
      throw new Error(`${worksheet.name} does not contain any month/year balance columns.`);
    }

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const accountName = cellText(row.getCell(4).value);
      if (!accountName) continue;
      const accountCode = cellText(row.getCell(5).value) || null;
      const category = cellText(row.getCell(3).value) || cellText(row.getCell(2).value) || section;
      const rowSection = classifyWorkbookRow(section, category, accountName);
      for (const { column, period } of periodColumns) {
        const amountReporting = cellNumber(row.getCell(column).value);
        if (amountReporting === null) continue;
        rows.push({
          fiscalYear: period.fiscalYear,
          month: period.month,
          periodLabel: period.periodLabel,
          entity: null,
          companyId: null,
          subsidiary: null,
          location: null,
          accountCode,
          accountName,
          section: rowSection,
          category,
          amountLocal: amountReporting,
          amountReporting,
          currency: "INR",
          sourceFile,
          sourceRowNumber: rowNumber,
        });
      }
    }
  }

  if (!rows.length) {
    throw new Error("The workbook does not contain readable Balance Sheet account rows.");
  }
  return rows;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function categoryHas(category: string, ...terms: string[]) {
  const normalized = category.trim().toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function emptyTotals(): BalanceSheetTotals {
  return {
    assets: 0,
    liabilities: 0,
    equity: 0,
    liabilitiesAndEquity: 0,
    balanceDifference: 0,
    currentAssets: 0,
    currentLiabilities: 0,
    workingCapital: 0,
    cash: 0,
    receivables: 0,
    inventory: 0,
    debt: 0,
    payables: 0,
  };
}

function totalsForRows(rows: Array<{
  section: string;
  category: string;
  value: number;
}>): BalanceSheetTotals {
  const totals = emptyTotals();
  for (const row of rows) {
    if (row.section === "assets") totals.assets += row.value;
    if (row.section === "liabilities") totals.liabilities += row.value;
    if (row.section === "equity") totals.equity += row.value;
    if (row.section === "assets" && categoryHas(row.category, "current asset", "current assets")) totals.currentAssets += row.value;
    if (row.section === "liabilities" && categoryHas(row.category, "current liabilit", "current liab")) totals.currentLiabilities += row.value;
    if (categoryHas(row.category, "cash", "cash equivalent")) totals.cash += row.value;
    if (categoryHas(row.category, "receivable", "accounts receivable", "trade debtor")) totals.receivables += row.value;
    if (categoryHas(row.category, "inventor")) totals.inventory += row.value;
    if (categoryHas(row.category, "debt", "borrow", "loan", "bond")) totals.debt += row.value;
    if (categoryHas(row.category, "payable", "accounts payable", "trade creditor")) totals.payables += row.value;
  }
  totals.liabilitiesAndEquity = totals.liabilities + totals.equity;
  totals.balanceDifference = totals.assets - totals.liabilitiesAndEquity;
  totals.workingCapital = totals.currentAssets - totals.currentLiabilities;
  for (const key of Object.keys(totals) as Array<keyof BalanceSheetTotals>) {
    totals[key] = round(totals[key]);
  }
  return totals;
}

function periodLabel(year: number, month: number, supplied?: string | null) {
  return supplied?.trim() || `${new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, month - 1, 1))} ${year}`;
}

function reportValue(section: string, value: unknown): number {
  const numeric = numberValue(value);
  return section === "assets" ? numeric : Math.abs(numeric);
}

type BalanceSheetSourceRow = {
  section: string;
  category: string;
  accountName: string;
  amountReporting: unknown;
};

function isSummaryRow(row: Pick<BalanceSheetSourceRow, "accountName">) {
  return /^total\s*:/i.test(row.accountName.trim());
}

function summaryAmount(rows: BalanceSheetSourceRow[], labels: string[]): number | null {
  const wanted = new Set(labels.map((label) => label.trim().toLowerCase()));
  const row = rows.find((candidate) => wanted.has(candidate.accountName.trim().toLowerCase()));
  return row ? reportValue(row.section, row.amountReporting) : null;
}

function sumSummaryAmounts(rows: BalanceSheetSourceRow[], labels: string[]): number | null {
  const values = labels
    .map((label) => summaryAmount(rows, [label]))
    .filter((value): value is number => value !== null);
  return values.length ? round(values.reduce((total, value) => total + value, 0)) : null;
}

function totalsForPeriod(rows: BalanceSheetSourceRow[]): BalanceSheetTotals {
  const detailRows = rows.filter((row) => !isSummaryRow(row));
  const fallback = totalsForRows(detailRows.length ? detailRows : rows);
  const assets = summaryAmount(rows, ["Total: Assets"]) ?? fallback.assets;
  const equity = summaryAmount(rows, ["Total: Equity"]) ?? fallback.equity;
  const liabilitiesAndEquity = summaryAmount(rows, ["Total: Liabilities and equity"]) ?? fallback.liabilitiesAndEquity;
  const liabilities = summaryAmount(rows, ["Total: Liabilities"])
    ?? (summaryAmount(rows, ["Total: Liabilities and equity"]) !== null
      ? round(liabilitiesAndEquity - equity)
      : fallback.liabilities);
  const currentAssets = summaryAmount(rows, ["Total: Current assets"]) ?? fallback.currentAssets;
  const currentLiabilities = summaryAmount(rows, ["Total: Current liabilities"]) ?? fallback.currentLiabilities;
  const cash = summaryAmount(rows, ["Total: Cash and cash equivalents"]) ?? fallback.cash;
  const receivables = summaryAmount(rows, ["Total: Trade receivables"]) ?? fallback.receivables;

  return {
    ...fallback,
    assets: round(assets),
    liabilities: round(liabilities),
    equity: round(equity),
    liabilitiesAndEquity: round(liabilitiesAndEquity),
    balanceDifference: round(assets - liabilitiesAndEquity),
    currentAssets: round(currentAssets),
    currentLiabilities: round(currentLiabilities),
    workingCapital: round(currentAssets - currentLiabilities),
    cash: round(cash),
    receivables: round(receivables),
  };
}

function reportCategoryLabel(section: string, category: string, accountName: string): string {
  const value = `${category} ${accountName}`.trim().toLowerCase();
  if (section === "equity") return "Equity & reserves";
  if (section === "assets") {
    if (value.includes("cash and cash equivalent") || value.includes("bank balance") || value.includes("marketable securities")) return "Cash & Cash equivalents";
    if (value.includes("trade receivable") || value.includes("contract asset")) return "Trade Receivables";
    if (value.includes("right-of-use") || value.includes("right of use")) return "Right-of-use assets";
    if (value.includes("tangible fixed") || value.includes("fixed asset") || value.includes("intangible asset")) return "Fixed Assets";
    if (value.includes("investment")) return "Investments in Group Entities";
    if (
      value.includes("non-current")
      || value.includes("non current")
      || value.includes("deferred tax")
      || value.includes("income tax receivables > 1 y")
      || value.includes("loans > 1 y")
    ) return "Other Noncurrent assets";
    return "Other current assets";
  }
  if (value.includes("trade payable")) return "Trade Payables";
  if (value.includes("equity") || value.includes("reserve") || value.includes("surplus")) return "Equity & reserves";
  if (value.includes("lease liabil")) return "Lease liabilities";
  if (
    value.includes("non-current")
    || value.includes("non current")
    || value.includes("provisions for pensions")
    || value.includes("income tax provisions > 1 y")
    || value.includes("other liabilities > 1 y")
  ) return "Non-current liabilities & provisions";
  if (value.includes("provision")) return "Provisions";
  return "Other Liabilities";
}

function referenceCategoryBreakdowns(
  currentRows: BalanceSheetSourceRow[],
  previousRows: BalanceSheetSourceRow[],
  currentTotals: BalanceSheetTotals,
  previousTotals: BalanceSheetTotals,
) {
  const hasStatementTotals = currentRows.some((row) => isSummaryRow(row))
    && previousRows.some((row) => isSummaryRow(row));
  if (!hasStatementTotals) return null;

  const amount = (rows: BalanceSheetSourceRow[], labels: string[], fallback = 0) =>
    sumSummaryAmounts(rows, labels) ?? fallback;
  const currentCash = amount(currentRows, [
    "Total: Cash and cash equivalents",
    "Total: Marketable securities ≤ 1 y.",
  ]);
  const previousCash = amount(previousRows, [
    "Total: Cash and cash equivalents",
    "Total: Marketable securities ≤ 1 y.",
  ]);
  const currentTrade = amount(currentRows, ["Total: Trade receivables"]);
  const previousTrade = amount(previousRows, ["Total: Trade receivables"]);
  const currentContractAssets = amount(currentRows, ["Total: Contract assets (CA) > 1 y"]);
  const previousContractAssets = amount(previousRows, ["Total: Contract assets (CA) > 1 y"]);
  const currentTradeAndUnbilled = currentTrade + currentContractAssets;
  const previousTradeAndUnbilled = previousTrade + previousContractAssets;
  const currentInvestments = amount(currentRows, ["Total: Investments (wo B-a)"]);
  const previousInvestments = amount(previousRows, ["Total: Investments (wo B-a)"]);
  const currentFixedAssets = amount(currentRows, [
    "Total: Tangible fixed assets",
    "Total: Intangible assets",
  ]);
  const previousFixedAssets = amount(previousRows, [
    "Total: Tangible fixed assets",
    "Total: Intangible assets",
  ]);
  const currentRightOfUse = amount(currentRows, ["Total: Right-of-use assets leasing"]);
  const previousRightOfUse = amount(previousRows, ["Total: Right-of-use assets leasing"]);
  const currentOtherNoncurrent = Math.max(
    0,
    currentTotals.assets - currentTotals.currentAssets
      - currentInvestments - currentFixedAssets - currentRightOfUse - currentContractAssets,
  );
  const previousOtherNoncurrent = Math.max(
    0,
    previousTotals.assets - previousTotals.currentAssets
      - previousInvestments - previousFixedAssets - previousRightOfUse - previousContractAssets,
  );
  const currentOtherCurrent = Math.max(0, currentTotals.currentAssets - currentCash - currentTrade);
  const previousOtherCurrent = Math.max(0, previousTotals.currentAssets - previousCash - previousTrade);

  const currentTradePayables = amount(currentRows, [
    "Total: Trade payables and notes payable",
    "Total: Trade payables",
  ]);
  const previousTradePayables = amount(previousRows, [
    "Total: Trade payables and notes payable",
    "Total: Trade payables",
  ]);
  const currentLease = amount(currentRows, [
    "Total: Lease liabilities (lessee) ≤ 1 y",
    "Total: Lease liabilities (lessee) > 1 y",
  ]);
  const previousLease = amount(previousRows, [
    "Total: Lease liabilities (lessee) ≤ 1 y",
    "Total: Lease liabilities (lessee) > 1 y",
  ]);
  const currentProvisions = amount(currentRows, ["Total: Current provisions"]);
  const previousProvisions = amount(previousRows, ["Total: Current provisions"]);
  const currentNoncurrentLiabilities = amount(currentRows, [
    "Total: Non-current provisions",
    "Total: Other Liabilities > 1 y",
  ]);
  const previousNoncurrentLiabilities = amount(previousRows, [
    "Total: Non-current provisions",
    "Total: Other Liabilities > 1 y",
  ]);
  const currentOtherLiabilities = Math.max(
    0,
    currentTotals.liabilities - currentTradePayables - currentLease - currentProvisions - currentNoncurrentLiabilities,
  );
  const previousOtherLiabilities = Math.max(
    0,
    previousTotals.liabilities - previousTradePayables - previousLease - previousProvisions - previousNoncurrentLiabilities,
  );

  const values: Array<{
    label: string;
    section: "assets" | "liabilities" | "equity";
    value: number;
    previousValue: number;
  }> = [
    { label: "Cash & Cash equivalents", section: "assets", value: currentCash, previousValue: previousCash },
    { label: "Trade Receivables", section: "assets", value: currentTradeAndUnbilled, previousValue: previousTradeAndUnbilled },
    { label: "Other current assets", section: "assets", value: currentOtherCurrent, previousValue: previousOtherCurrent },
    { label: "Investments in Group Entities", section: "assets", value: currentInvestments, previousValue: previousInvestments },
    { label: "Fixed Assets", section: "assets", value: currentFixedAssets, previousValue: previousFixedAssets },
    { label: "Other Noncurrent assets", section: "assets", value: currentOtherNoncurrent, previousValue: previousOtherNoncurrent },
    { label: "Right-of-use assets", section: "assets", value: currentRightOfUse, previousValue: previousRightOfUse },
    { label: "Trade Payables", section: "liabilities", value: currentTradePayables, previousValue: previousTradePayables },
    { label: "Other Liabilities", section: "liabilities", value: currentOtherLiabilities, previousValue: previousOtherLiabilities },
    { label: "Equity & reserves", section: "equity", value: currentTotals.equity, previousValue: previousTotals.equity },
    { label: "Lease liabilities", section: "liabilities", value: currentLease, previousValue: previousLease },
    { label: "Provisions", section: "liabilities", value: currentProvisions, previousValue: previousProvisions },
    { label: "Non-current liabilities & provisions", section: "liabilities", value: currentNoncurrentLiabilities, previousValue: previousNoncurrentLiabilities },
  ];

  return values.map((item) => {
    const value = round(item.value);
    const previousValue = round(item.previousValue);
    const change = round(value - previousValue);
    return {
      ...item,
      value,
      previousValue,
      change,
      changePercent: previousValue === 0 ? null : round(change / Math.abs(previousValue)),
    };
  });
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round(numerator / denominator);
}

function reportRatios(totals: BalanceSheetTotals) {
  return {
    currentRatio: ratio(totals.currentAssets, totals.currentLiabilities),
    quickRatio: ratio(totals.currentAssets - totals.inventory, totals.currentLiabilities),
    debtToEquity: ratio(totals.debt, totals.equity),
    equityRatio: ratio(totals.equity, totals.assets),
  };
}

function lineItemKey(row: { accountCode?: string | null; accountName: string; category: string; section: string }) {
  return `${row.section}|${row.accountCode ?? ""}|${row.accountName}|${row.category}`;
}

export async function ingestBalanceSheetRows(cubeId: string, input: unknown) {
  const parsed = balanceSheetIngestionSchema.parse(input);
  const cube = (await db.select({ id: cubes.id, schemaType: cubes.schemaType }).from(cubes).where(eq(cubes.id, cubeId)).limit(1))[0];
  if (!cube) throw new Error("Balance Sheet cube not found");
  if (cube.schemaType !== "balance_sheet") throw new Error("Rows can only be ingested into a balance_sheet cube");

  const replacePeriods = parsed.replacePeriods ?? Array.from(new Map(
    parsed.rows.map((row) => [`${row.fiscalYear}-${row.month}`, { fiscalYear: row.fiscalYear, month: row.month }]),
  ).values());

  // The default deployment uses Drizzle's Neon HTTP driver, which does not
  // support interactive transactions. Keep each statement separate so this
  // ingestion works in Neon as well as the node-postgres deployment.
  for (const period of replacePeriods) {
    await db.delete(cubeBalanceSheetData).where(and(
      eq(cubeBalanceSheetData.cubeId, cubeId),
      eq(cubeBalanceSheetData.fiscalYear, period.fiscalYear),
      eq(cubeBalanceSheetData.month, period.month),
    ));
  }
  await db.insert(cubeBalanceSheetData).values(parsed.rows.map((row) => ({
    ...row,
    cubeId,
    amountReporting: String(row.amountReporting),
    amountLocal: row.amountLocal === null || row.amountLocal === undefined ? null : String(row.amountLocal),
  })));

  return { cubeId, inserted: parsed.rows.length, replacedPeriods: replacePeriods };
}

export async function listBalanceSheetPeriods(cubeId: string) {
  const rows = await db.selectDistinct({
    year: cubeBalanceSheetData.fiscalYear,
    month: cubeBalanceSheetData.month,
  }).from(cubeBalanceSheetData)
    .where(eq(cubeBalanceSheetData.cubeId, cubeId))
    .orderBy(desc(cubeBalanceSheetData.fiscalYear), desc(cubeBalanceSheetData.month));
  return rows.map((row) => ({ year: Number(row.year), month: Number(row.month) }));
}

export interface BalanceSheetReportRequest {
  cubeId: string;
  year: number;
  months: number[];
  entity?: string;
  currency?: string;
  tolerance?: number;
}

export async function runBalanceSheetReport(request: BalanceSheetReportRequest): Promise<BalanceSheetReport> {
  if (!Number.isInteger(request.year) || request.year < 1900 || request.year > 2200) {
    throw new Error("Select a valid Balance Sheet year.");
  }
  const months = Array.from(new Set(request.months.map(Number))).filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b);
  if (!months.length) throw new Error("Select at least one Balance Sheet month.");

  const loadRows = async (year: number, selectedMonths: number[]) => {
    const filters = [
      eq(cubeBalanceSheetData.cubeId, request.cubeId),
      eq(cubeBalanceSheetData.fiscalYear, year),
      inArray(cubeBalanceSheetData.month, selectedMonths),
    ];
    if (request.entity?.trim()) filters.push(eq(cubeBalanceSheetData.entity, request.entity.trim()));
    return db.select().from(cubeBalanceSheetData).where(and(...filters));
  };

  let reportYear = request.year;
  let reportMonths = months;
  let rows = await loadRows(reportYear, reportMonths);
  if (!rows.length) {
    const latestPeriod = (await listBalanceSheetPeriods(request.cubeId))[0];
    if (!latestPeriod) {
      throw new Error(`No Balance Sheet data is available in cube ${request.cubeId}.`);
    }
    reportYear = latestPeriod.year;
    reportMonths = [latestPeriod.month];
    rows = await loadRows(reportYear, reportMonths);
  } else {
    // Ignore selected months that are not loaded while retaining the requested
    // year and the loaded periods that can actually be reported.
    const loadedMonths = new Set(rows.map((row) => row.month));
    reportMonths = reportMonths.filter((month) => loadedMonths.has(month));
  }

  const currentMonth = reportMonths[reportMonths.length - 1];
  const currentRows = rows.filter((row) => row.month === currentMonth);
  const previousPeriod = (await listBalanceSheetPeriods(request.cubeId))
    .find((period) => period.year < reportYear || (period.year === reportYear && period.month < currentMonth));
  const previousRows = previousPeriod
    ? (await db.select().from(cubeBalanceSheetData).where(and(
      eq(cubeBalanceSheetData.cubeId, request.cubeId),
      eq(cubeBalanceSheetData.fiscalYear, previousPeriod.year),
      eq(cubeBalanceSheetData.month, previousPeriod.month),
      ...(request.entity?.trim() ? [eq(cubeBalanceSheetData.entity, request.entity.trim())] : []),
    ))).map((row) => row)
    : [];

  const currentDetailRows = currentRows.filter((row) => !isSummaryRow(row));
  const previousDetailRows = previousRows.filter((row) => !isSummaryRow(row));
  const totals = totalsForPeriod(currentRows);
  const previousTotals = totalsForPeriod(previousRows);
  const tolerance = request.tolerance ?? 0.01;
  const currency = request.currency || currentRows[0]?.currency || "USD";
  const itemMap = new Map<string, { accountCode: string | null; accountName: string; category: string; section: "assets" | "liabilities" | "equity"; value: number; previousValue: number | null }>();
  for (const row of currentDetailRows) {
    const key = lineItemKey(row);
    const existing = itemMap.get(key);
    if (existing) existing.value += reportValue(row.section, row.amountReporting);
    else itemMap.set(key, {
      accountCode: row.accountCode,
      accountName: row.accountName,
      category: row.category,
      section: row.section as "assets" | "liabilities" | "equity",
      value: reportValue(row.section, row.amountReporting),
      previousValue: null,
    });
  }
  const previousMap = new Map<string, number>();
  for (const row of previousDetailRows) {
    const key = lineItemKey(row);
    previousMap.set(key, (previousMap.get(key) ?? 0) + reportValue(row.section, row.amountReporting));
  }
  const lineItems: BalanceSheetLineItem[] = Array.from(itemMap.values()).map((item) => {
    const previousValue = previousMap.get(lineItemKey(item));
    const value = round(item.value);
    const change = round(value - (previousValue ?? 0));
    return {
      accountCode: item.accountCode,
      accountName: item.accountName,
      category: reportCategoryLabel(item.section, item.category, item.accountName),
      section: item.section,
      value,
      previousValue: previousValue === undefined ? null : round(previousValue),
      change,
      changePercent: previousValue === undefined || previousValue === 0 ? null : round(change / Math.abs(previousValue)),
    };
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 500);

  const periods: BalanceSheetPeriod[] = reportMonths.map((month) => {
    const periodRows = rows.filter((row) => row.month === month);
    return {
      label: periodLabel(reportYear, month, rows.find((row) => row.month === month)?.periodLabel),
      year: reportYear,
      month,
      totals: totalsForPeriod(periodRows),
    };
  });
  const movements = lineItems.slice(0, 20).map((item) => ({
    accountName: item.accountName,
    category: item.category,
    section: item.section,
    previousValue: item.previousValue ?? 0,
    value: item.value,
    change: item.change,
    changePercent: item.changePercent,
  }));
  const categoryMap = new Map<string, {
    label: string;
    section: "assets" | "liabilities" | "equity";
    value: number;
    previousValue: number;
  }>();
  for (const row of currentDetailRows) {
    const section = row.section as "assets" | "liabilities" | "equity";
    const label = reportCategoryLabel(section, row.category, row.accountName);
    const key = `${section}|${label}`;
    const existing = categoryMap.get(key);
    if (existing) existing.value += reportValue(section, row.amountReporting);
    else categoryMap.set(key, { label, section, value: reportValue(section, row.amountReporting), previousValue: 0 });
  }
  for (const row of previousDetailRows) {
    const section = row.section as "assets" | "liabilities" | "equity";
    const label = reportCategoryLabel(section, row.category, row.accountName);
    const key = `${section}|${label}`;
    const existing = categoryMap.get(key);
    if (existing) existing.previousValue += reportValue(section, row.amountReporting);
    else categoryMap.set(key, { label, section, value: 0, previousValue: reportValue(section, row.amountReporting) });
  }
  const legacyCategoryBreakdowns = Array.from(categoryMap.values()).map((item) => {
    const value = round(item.value);
    const previousValue = round(item.previousValue);
    const change = round(value - previousValue);
    return {
      label: item.label,
      section: item.section,
      value,
      previousValue,
      change,
      changePercent: previousValue === 0 ? null : round(change / Math.abs(previousValue)),
    };
  }).sort((a, b) => {
    const sectionOrder = { assets: 0, liabilities: 1, equity: 2 };
    return sectionOrder[a.section] - sectionOrder[b.section] || Math.abs(b.value) - Math.abs(a.value);
  }).slice(0, 50);
  const categoryBreakdowns = referenceCategoryBreakdowns(currentRows, previousRows, totals, previousTotals)
    ?? legacyCategoryBreakdowns;
  const balanced = Math.abs(totals.balanceDifference) <= tolerance;
  const periodWasAdjusted = reportYear !== request.year
    || reportMonths.length !== months.length
    || reportMonths.some((month, index) => month !== months[index]);
  const warnings = [
    ...(periodWasAdjusted
      ? [`The requested period had no loaded Balance Sheet rows; this report uses ${periodLabel(reportYear, currentMonth)} instead.`]
      : []),
    ...(!balanced ? [`Balance Sheet is out of balance by ${totals.balanceDifference.toFixed(2)} ${currency}.`] : []),
    ...(previousRows.length ? [] : ["No prior-period Balance Sheet rows were available; movement comparisons use zero only where a current account is new."]),
  ];
  const insights = [
    `Assets total ${totals.assets.toFixed(2)} ${currency}; liabilities and equity total ${totals.liabilitiesAndEquity.toFixed(2)} ${currency}.`,
    totals.currentLiabilities > 0 && totals.currentAssets > 0
      ? `Current ratio is ${reportRatios(totals).currentRatio?.toFixed(2) ?? "not available"}.`
      : "Current asset and current liability categories were not fully mapped.",
  ];
  const ratios = reportRatios(totals);
  const risks = [
    ...(ratios.currentRatio !== null && ratios.currentRatio < 1 ? ["Current liabilities exceed current assets."] : []),
    ...(ratios.debtToEquity !== null && ratios.debtToEquity > 2 ? ["Debt-to-equity exceeds 2.0x."] : []),
    ...(!balanced ? ["Investigate account completeness or classification before relying on liquidity ratios."] : []),
  ];

  return {
    balanced,
    difference: round(totals.balanceDifference),
    tolerance,
    currency,
    unitLabel: currency,
    periodLabel: periodLabel(reportYear, currentMonth, currentRows[0]?.periodLabel),
    comparisonPeriodLabel: previousPeriod ? periodLabel(previousPeriod.year, previousPeriod.month, previousRows[0]?.periodLabel) : null,
    totals,
    ratios,
    periods,
    lineItems,
    movements,
    categoryBreakdowns,
    unmappedRows: [],
    warnings,
    insights,
    risks,
    actions: [
      ...(balanced ? [] : [{ label: "Reconcile balance difference", detail: "Review missing, duplicated, or misclassified account rows in the dedicated Balance Sheet cube." }]),
      ...(previousRows.length ? [] : [{ label: "Load prior period", detail: "Ingest the prior month into the Balance Sheet cube to enable movement comparisons." }]),
    ],
  };
}