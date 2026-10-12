import type { BalanceSheetReport } from "@shared/boards/balanceSheet";
import { z } from "zod";

type Fact = NonNullable<BalanceSheetReport["commentaryFacts"]>[number];
export interface CommentaryAccount {
  identity: string;
  name: string;
  category: string;
  section: "assets" | "liabilities" | "equity";
  value: number;
}

const shortName = (name: string) => name.length > 36 ? `${name.slice(0, 33)}…` : name;
export function hasBalanceSheetComparison(report: BalanceSheetReport) {
  return Boolean(report.comparisonTotals)
    || Boolean(report.comparisonPeriodLabel && report.categoryBreakdowns.some((item) => item.previousValue !== 0));
}
function formatter(report: BalanceSheetReport) {
  const scale = report.currency.toUpperCase() === "INR" ? 1_000_000 : 1;
  const unit = scale === 1_000_000 ? "mINR" : report.unitLabel || report.currency;
  const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value / scale);
  const signed = (value: number) => `${value < 0 ? "−" : "+"}${money(Math.abs(value))}`;
  return { money, signed, unit };
}

/** Evidence uses complete source rows, not the report's capped movements array. */
export function buildBalanceSheetCommentaryFacts(
  report: BalanceSheetReport,
  current?: CommentaryAccount[],
  previous?: CommentaryAccount[],
): Fact[] {
  const { money, signed, unit } = formatter(report);
  const comparable = hasBalanceSheetComparison(report);
  const aggregate = (rows: CommentaryAccount[]) => {
    const map = new Map<string, CommentaryAccount>();
    for (const row of rows) {
      const key = JSON.stringify([row.section, row.category, row.identity]);
      const old = map.get(key);
      map.set(key, { ...row, value: row.value + (old?.value ?? 0) });
    }
    return map;
  };
  const currentAccounts = aggregate(current ?? []);
  const previousAccounts = aggregate(previous ?? []);
  const facts: Fact[] = [];
  report.categoryBreakdowns.forEach((category, index) => {
    const base = { category: category.label, section: category.section };
    const add = (kind: Fact["kind"], text: string) => facts.push({ ...base, id: `bs-${index}-${kind}`, kind, text });
    const pct = category.previousValue === 0 ? "" : ` (${(Math.abs(category.change / category.previousValue) * 100).toFixed(1)}%)`;
    add("movement", comparable
      ? `${category.change === 0 ? "Unchanged" : category.change > 0 ? "Up" : "Down"}${category.change === 0 ? "" : ` ${money(Math.abs(category.change))} ${unit}${pct}`}; ${money(category.previousValue)} → ${money(category.value)} ${unit}.`
      : `Closing balance ${money(category.value)} ${unit}; prior-period comparison unavailable.`);
    const belongs = (row: CommentaryAccount) => row.section === category.section && row.category === category.label;
    const currentRows = Array.from(currentAccounts.values()).filter(belongs);
    const previousRows = Array.from(previousAccounts.values()).filter(belongs);
    // Do not attribute a statement subtotal to detail whose classification does
    // not reconcile. This is particularly important for residual categories.
    const reconciles = (rows: CommentaryAccount[], value: number) =>
      Math.abs(rows.reduce((sum, row) => sum + row.value, 0) - value) <= Math.max(1, Math.abs(value) * 1e-8);
    const covered = current !== undefined && previous !== undefined
      && reconciles(currentRows, category.value)
      && (!comparable || reconciles(previousRows, category.previousValue));
    if (comparable && covered) {
      const keys = new Set([
        ...Array.from(currentAccounts.entries()).filter(([, row]) => belongs(row)).map(([key]) => key),
        ...Array.from(previousAccounts.entries()).filter(([, row]) => belongs(row)).map(([key]) => key),
      ]);
      const drivers = Array.from(keys).map((key) => {
        const now = currentAccounts.get(key), prior = previousAccounts.get(key);
        return { name: (now ?? prior)!.name, change: (now?.value ?? 0) - (prior?.value ?? 0),
          availability: !now ? " (absent in current rows)" : !prior ? " (new in loaded rows)" : "" };
      }).filter((row) => row.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      if (drivers.length) {
        add("drivers", `Account movements: ${drivers.slice(0, 2).map((row) => `${shortName(row.name)} ${signed(row.change)}${row.availability}`).join("; ")} ${unit}.${drivers.some((row) => row.change > 0) && drivers.some((row) => row.change < 0) ? " Increases and decreases offset within this category." : ""}`);
      }
    }
    if (covered && category.value > 0 && currentRows.length) {
      const largest = [...currentRows].sort((a, b) => b.value - a.value)[0];
      add("composition", `${shortName(largest.name)} represents ${(largest.value / category.value * 100).toFixed(1)}% of this category (${money(largest.value)} ${unit}).`);
    }
    if (!covered && report.totals.assets > 0) {
      const oldAssets = report.comparisonTotals?.assets;
      add("composition", `Closing share of total assets: ${(category.value / report.totals.assets * 100).toFixed(1)}%${oldAssets && oldAssets > 0 ? ` vs ${(category.previousValue / oldAssets * 100).toFixed(1)}% previously` : ""}. Account attribution needs supporting detail.`);
    }
    if (!covered) add("coverage", "Account-level attribution is not reconciled to this chart category; supporting detail is required.");
    else if (!facts.some((fact) => fact.category === category.label && fact.section === category.section && fact.kind !== "movement")) {
      add("coverage", "No account movements were identified in the reconciled source rows.");
    }
  });
  return facts;
}

const selectionSchema = z.object({
  selections: z.array(z.object({
    category: z.string(),
    section: z.enum(["assets", "liabilities", "equity"]),
    evidenceIds: z.array(z.string()).min(1).max(1),
  }).strict()).max(50),
}).strict();

export function applyBalanceSheetCommentary(
  report: BalanceSheetReport,
  response?: string,
): BalanceSheetReport {
  const facts = report.commentaryFacts ?? buildBalanceSheetCommentaryFacts(report);
  let selections: z.infer<typeof selectionSchema>["selections"] | undefined;
  if (response) {
    const parsed = selectionSchema.parse(JSON.parse(response.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()));
    const categories = report.categoryBreakdowns;
    if (parsed.selections.length !== categories.length) throw new Error("Incomplete commentary selection");
    const seen = new Set<string>();
    for (const selection of parsed.selections) {
      const key = `${selection.section}|${selection.category}`;
      if (seen.has(key) || !categories.some((item) => item.section === selection.section && item.label === selection.category)) {
        throw new Error("Unknown or duplicate commentary category");
      }
      seen.add(key);
      if (new Set(selection.evidenceIds).size !== selection.evidenceIds.length
        || selection.evidenceIds.some((id) => !facts.some((fact) => fact.id === id && fact.section === selection.section
          && fact.category === selection.category && fact.kind !== "movement"))) {
        throw new Error("Unsupported commentary evidence");
      }
    }
    selections = parsed.selections;
  }
  const source = selections ? "ai-selected" as const : "factual-fallback" as const;
  return {
    ...report, commentaryFacts: facts, commentaryStatus: source,
    categoryCommentary: report.categoryBreakdowns.map((category) => {
      const available = facts.filter((fact) => fact.category === category.label && fact.section === category.section);
      const selection = selections?.find((item) => item.category === category.label && item.section === category.section);
      const chosen = selection
        ? selection.evidenceIds.map((id) => available.find((fact) => fact.id === id)!)
        : available.filter((fact) => fact.kind !== "movement").slice(0, 1);
      const rendered = [...available.filter((fact) => fact.kind === "movement"), ...chosen];
      return { category: category.label, section: category.section, text: rendered.map((fact) => fact.text).join(" "),
        evidenceIds: rendered.map((fact) => fact.id), source };
    }),
  };
}
