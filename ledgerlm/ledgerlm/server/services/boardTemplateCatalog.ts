import { db } from "../db";
import { boardTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

export type BoardSourceType = "enterprise" | "vault";

export interface BoardTemplateDefinition {
  slug: string;
  name: string;
  description: string;
  tier: "standard" | "custom";
  sourceTypes: BoardSourceType[];
  defaultConfig: Record<string, unknown>;
}

const standardConfig = (sourceTypes: BoardSourceType[], analysisPrompts: string) => ({
  analysisPrompts,
  dataSources: {
    enterprise: sourceTypes.includes("enterprise"),
    vault: sourceTypes.includes("vault"),
    webApis: false,
    financialApis: false,
  },
  boardSourceTypes: sourceTypes,
});

const DEFINITIONS: BoardTemplateDefinition[] = [
  {
    slug: "entity-pnl",
    name: "Entity P&L",
    description: "Review revenue, cost, margin, and variance by legal entity.",
    tier: "standard",
    sourceTypes: ["enterprise"],
    defaultConfig: standardConfig(["enterprise"], "Analyze the Entity P&L with deterministic totals and entity-level drivers."),
  },
  {
    slug: "kpi-metrics",
    name: "KPI Metrics",
    description: "Track governed operational and financial KPIs over time.",
    tier: "standard",
    sourceTypes: ["enterprise"],
    defaultConfig: standardConfig(["enterprise"], "Analyze governed KPI metrics, changes, and material exceptions."),
  },
  {
    slug: "variance-analysis",
    name: "Variance Analysis",
    description: "Compare actuals with budget or forecast and explain the largest drivers.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Perform a controlled variance analysis and separate facts from interpretation."),
  },
  {
    slug: "trend-analysis",
    name: "Trend Analysis",
    description: "Identify direction, inflections, and persistent changes across periods.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Analyze historical trends without forecasting beyond the available source periods."),
  },
  {
    slug: "balance-sheet-tracker",
    name: "Balance Sheet Analysis",
    description: "Review assets, liabilities, equity, liquidity, and balance integrity.",
    tier: "standard",
    sourceTypes: ["enterprise"],
    defaultConfig: standardConfig(["vault", "enterprise"], "Analyze balance-sheet integrity first, then liquidity, leverage, and material movements."),
  },
  {
    slug: "audit-preparation",
    name: "Audit Preparation",
    description: "Organize audit evidence, completeness checks, and risk items.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Prepare an audit-oriented review with explicit evidence gaps and risks."),
  },
  {
    slug: "cashflow-monitoring",
    name: "Cashflow Monitoring",
    description: "Monitor inflows, outflows, working capital, and liquidity risks.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Review cash movements and liquidity signals using only supplied evidence."),
  },
  {
    slug: "company-research",
    name: "Company Research",
    description: "Summarize company financial documents and material business signals.",
    tier: "standard",
    sourceTypes: ["vault", "enterprise"],
    defaultConfig: standardConfig(["vault", "enterprise"], "Summarize company evidence, risks, and opportunities without inventing facts."),
  },
  {
    slug: "custom-kpi-board",
    name: "Custom KPI Board",
    description: "Build a personal KPI view from an authorized source.",
    tier: "custom",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Analyze the selected KPIs and clearly label calculated versus source values."),
  },
  {
    slug: "financial-ratios-dashboard",
    name: "Financial Ratios Dashboard",
    description: "Calculate and explain liquidity, leverage, and profitability ratios.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Calculate ratios only when denominators are present and non-zero."),
  },
  {
    slug: "investor-updates",
    name: "Investor Updates",
    description: "Create concise stakeholder updates from authorized financial evidence.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Create an evidence-based investor update with performance, risks, and actions."),
  },
  {
    slug: "quarterly-pnl-review",
    name: "Quarterly P&L Review",
    description: "Review quarterly revenue, expenses, profit, and material changes.",
    tier: "standard",
    sourceTypes: ["enterprise", "vault"],
    defaultConfig: standardConfig(["enterprise", "vault"], "Review the quarterly P&L and explain material movements by period and dimension."),
  },
];

export function getBoardTemplateDefinitions(): BoardTemplateDefinition[] {
  return DEFINITIONS.map((definition) => ({ ...definition, defaultConfig: { ...definition.defaultConfig } }));
}

export function getBoardTemplateDefinition(slug: string): BoardTemplateDefinition | undefined {
  return DEFINITIONS.find((definition) => definition.slug === slug);
}

export function getDefaultBoardConfig(slug: string): Record<string, unknown> {
  return getBoardTemplateDefinition(slug)?.defaultConfig ?? {};
}

export async function seedBoardTemplateCatalog(): Promise<void> {
  for (const definition of DEFINITIONS) {
    const existing = await db.select({ id: boardTemplates.id }).from(boardTemplates)
      .where(eq(boardTemplates.slug, definition.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(boardTemplates).values({
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        defaultConfig: definition.defaultConfig,
      });
    }
  }
}