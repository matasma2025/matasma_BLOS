import { z } from "zod";

export const balanceSheetTotalsSchema = z.object({
  assets: z.number().finite(),
  liabilities: z.number().finite(),
  equity: z.number().finite(),
  liabilitiesAndEquity: z.number().finite(),
  balanceDifference: z.number().finite(),
  currentAssets: z.number().finite(),
  currentLiabilities: z.number().finite(),
  workingCapital: z.number().finite(),
  cash: z.number().finite(),
  receivables: z.number().finite(),
  inventory: z.number().finite(),
  debt: z.number().finite(),
  payables: z.number().finite(),
}).strict();

export const balanceSheetRatiosSchema = z.object({
  currentRatio: z.number().finite().nullable(),
  quickRatio: z.number().finite().nullable(),
  debtToEquity: z.number().finite().nullable(),
  equityRatio: z.number().finite().nullable(),
}).strict();

export const balanceSheetLineItemSchema = z.object({
  accountCode: z.string().max(100).nullable(),
  accountName: z.string().max(500),
  category: z.string().max(255),
  section: z.enum(["assets", "liabilities", "equity", "unmapped"]),
  value: z.number().finite(),
  previousValue: z.number().finite().nullable(),
  change: z.number().finite(),
  changePercent: z.number().finite().nullable(),
}).strict();

export const balanceSheetPeriodSchema = z.object({
  label: z.string().max(100),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  totals: balanceSheetTotalsSchema,
}).strict();

export const balanceSheetMovementSchema = z.object({
  accountName: z.string().max(500),
  category: z.string().max(255),
  section: z.enum(["assets", "liabilities", "equity", "unmapped"]),
  previousValue: z.number().finite(),
  value: z.number().finite(),
  change: z.number().finite(),
  changePercent: z.number().finite().nullable(),
}).strict();

export const balanceSheetCategoryBreakdownSchema = z.object({
  label: z.string().max(255),
  section: z.enum(["assets", "liabilities", "equity"]),
  value: z.number().finite(),
  previousValue: z.number().finite(),
  change: z.number().finite(),
  changePercent: z.number().finite().nullable(),
}).strict();

export const balanceSheetReportSchema = z.object({
  balanced: z.boolean(),
  difference: z.number().finite(),
  tolerance: z.number().finite(),
  currency: z.string().max(20),
  unitLabel: z.string().max(50),
  periodLabel: z.string().max(100),
  comparisonPeriodLabel: z.string().max(100).nullable().optional(),
  totals: balanceSheetTotalsSchema,
  comparisonTotals: balanceSheetTotalsSchema.nullable().optional(),
  ratios: balanceSheetRatiosSchema,
  periods: z.array(balanceSheetPeriodSchema).max(24).default([]),
  lineItems: z.array(balanceSheetLineItemSchema).max(500).default([]),
  movements: z.array(balanceSheetMovementSchema).max(20).default([]),
  categoryBreakdowns: z.array(balanceSheetCategoryBreakdownSchema).max(50).default([]),
  unmappedRows: z.array(z.string().max(500)).max(500).default([]),
  warnings: z.array(z.string().max(1_000)).max(100).default([]),
  insights: z.array(z.string().max(1_000)).max(30).default([]),
  risks: z.array(z.string().max(1_000)).max(30).default([]),
  actions: z.array(z.object({
    label: z.string().max(200),
    owner: z.string().max(200).optional(),
    detail: z.string().max(2_000),
  }).strict()).max(30).default([]),
}).strict();

export type BalanceSheetTotals = z.infer<typeof balanceSheetTotalsSchema>;
export type BalanceSheetRatios = z.infer<typeof balanceSheetRatiosSchema>;
export type BalanceSheetLineItem = z.infer<typeof balanceSheetLineItemSchema>;
export type BalanceSheetPeriod = z.infer<typeof balanceSheetPeriodSchema>;
export type BalanceSheetMovement = z.infer<typeof balanceSheetMovementSchema>;
export type BalanceSheetCategoryBreakdown = z.infer<typeof balanceSheetCategoryBreakdownSchema>;
export type BalanceSheetReport = z.infer<typeof balanceSheetReportSchema>;