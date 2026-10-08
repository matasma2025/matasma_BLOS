/** Operational planning measures are not assumed to be financial YTD snapshots. */
export const ENTITY_PNL_CALCULATION_VERSION = "entity-pnl-financial-plan-v4-mtd";

/** Board-local financial facts; these do not replace any shared cube facts. */
export interface EntityPnlFinancialPlan {
  version: 1;
  entity: string;
  sourceName: string;
  sourceUnit: "mINR";
  periodBasis: "ytd" | "mtd";
  usdExchangeRates: Record<string, number>;
  rows: Array<{
    year: number;
    month: number;
    category: string;
    subcategory: string;
    scenario: string;
    value: number | null;
  }>;
}

export interface EntityPnlFinancialPlanSource {
  sourceName: string;
  entity: string;
  sourceUnit: "mINR";
  periodBasis: "ytd" | "mtd";
  scenario: string;
  usdExchangeRate?: number;
  storageScope?: "cube" | "board";
  revision?: number;
}

export interface EntityPnlPlanningForecast {
  scenario: string;
  asOf: string;
  entity: string;
  sourceRowCount: number;
  /** Per-source entities, never a sum of overlapping total and detail scopes. */
  entityBreakdowns?: EntityPnlPlanningForecast[];
  metrics: Array<{
    label: string;
    value: number | null;
    unit: "USD" | "capacity";
    status: "available" | "missing" | "conflicting";
  }>;
  warnings: string[];
}

export interface EntityPnlForecastComparison {
  scenario: string;
  rows: Array<{
    label: string;
    actual: number | null;
    forecast: number | null;
    variance: number | null;
    variancePercent: number | null;
    reason?: string;
  }>;
}
