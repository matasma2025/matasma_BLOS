export type BalanceSheetRollupSection = "assets" | "liabilities" | "equity";
export type BalanceSheetTerm = "current" | "non-current" | "unknown";

export interface BalanceSheetRollupItem {
  section: string;
  category: string;
  accountName: string;
  value: number;
}

export interface BalanceSheetRollupLine {
  label: string;
  section: BalanceSheetRollupSection;
  value: number;
  sources: string[];
}

export interface BalanceSheetRollupResult {
  lines: BalanceSheetRollupLine[];
  unmapped: Array<{
    item: string;
    section: string;
    category: string | null;
  }>;
}

interface RollupGroup {
  label: string;
  section: BalanceSheetRollupSection;
  term: BalanceSheetTerm;
  anyTerm?: boolean;
  catchAll?: boolean;
  match: RegExp;
}

const DEFAULT_ROLLUP: RollupGroup[] = [
  {
    label: "Unallocated difference (assets)",
    section: "assets",
    term: "current",
    anyTerm: true,
    match: /unallocated difference/i,
  },
  {
    label: "Unallocated difference (liabilities)",
    section: "liabilities",
    term: "current",
    anyTerm: true,
    match: /unallocated difference/i,
  },
  {
    label: "Cash & Cash equivalents",
    section: "assets",
    term: "current",
    match: /\b(cash|bank balances?|cheques?|marketable securit(?:y|ies)|money market)\b/i,
  },
  {
    label: "Trade Receivables",
    section: "assets",
    term: "current",
    anyTerm: true,
    match: /\b(trade receivables?|unbilled|contract assets?)\b/i,
  },
  {
    label: "Other current assets",
    section: "assets",
    term: "current",
    catchAll: true,
    match: /.*/,
  },
  {
    label: "Investments in Group Entities",
    section: "assets",
    term: "non-current",
    match: /\b(investments?)\b/i,
  },
  {
    label: "Right-of-use assets",
    section: "assets",
    term: "non-current",
    match: /\b(right[-\s]?of[-\s]?use|rou|leased assets?)\b/i,
  },
  {
    label: "Fixed Assets",
    section: "assets",
    term: "non-current",
    match: /\b(tangible|intangible|fixed assets?|property|plant|equipment|goodwill)\b/i,
  },
  {
    label: "Other Noncurrent assets",
    section: "assets",
    term: "non-current",
    catchAll: true,
    match: /.*/,
  },
  {
    label: "Equity & reserves",
    section: "equity",
    term: "non-current",
    catchAll: true,
    match: /.*/,
  },
  {
    label: "Trade Payables",
    section: "liabilities",
    term: "current",
    match: /\b(trade payables?|notes payables?|creditors?)\b/i,
  },
  {
    label: "Lease liabilities",
    section: "liabilities",
    term: "current",
    match: /\blease liabilit(?:y|ies)/i,
  },
  {
    label: "Provisions",
    section: "liabilities",
    term: "current",
    match: /\bprovisions?\b/i,
  },
  {
    label: "Other Liabilities",
    section: "liabilities",
    term: "current",
    anyTerm: true,
    match: /\b(contract liabilit(?:y|ies)|deferred (?:revenue|income))\b/i,
  },
  {
    label: "Other Liabilities",
    section: "liabilities",
    term: "current",
    catchAll: true,
    match: /.*/,
  },
  {
    label: "Lease liabilities",
    section: "liabilities",
    term: "non-current",
    match: /\blease liabilit(?:y|ies)/i,
  },
  {
    label: "Non-current liabilities & provisions",
    section: "liabilities",
    term: "non-current",
    catchAll: true,
    match: /.*/,
  },
];

function classifyTerm(category: string, accountName: string): BalanceSheetTerm {
  const text = `${category} ${accountName}`.toLowerCase();
  if (
    /\bnon[\s-]?current\b/.test(text)
    || />\s*1\s*(?:y|year)s?\b/.test(text)
    || /\b(?:over|more than)\s+1\s+year\b/.test(text)
  ) return "non-current";
  if (
    /\bcurrent\b/.test(text)
    || /(?:≤|<=|<)\s*1\s*(?:y|year)s?\b/.test(text)
    || /\bwithin\s+1\s+year\b/.test(text)
  ) return "current";
  return "unknown";
}

export function rollUpBalanceSheetDetailRows(
  items: BalanceSheetRollupItem[],
): BalanceSheetRollupResult {
  const lines = new Map<string, BalanceSheetRollupLine>();
  const unmapped: BalanceSheetRollupResult["unmapped"] = [];

  for (const item of items) {
    if (!["assets", "liabilities", "equity"].includes(item.section)) {
      unmapped.push({
        item: item.accountName,
        section: item.section,
        category: item.category || null,
      });
      continue;
    }

    const section = item.section as BalanceSheetRollupSection;
    const category = item.category.trim();
    const caption = item.accountName.trim();
    const term = section === "equity" ? "non-current" : classifyTerm(category, caption);
    const candidates = DEFAULT_ROLLUP.filter((group) => {
      if (group.section !== section) return false;
      if (term === "unknown") return !group.catchAll;
      return group.anyTerm || group.term === term;
    });
    const group = section === "equity"
      ? candidates[0]
      : candidates.find((candidate) =>
        candidate.match.test(category) || candidate.match.test(caption),
      );

    if (!group) {
      unmapped.push({
        item: caption,
        section,
        category: category || null,
      });
      continue;
    }

    const key = `${group.section}|${group.label}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        label: group.label,
        section: group.section,
        value: 0,
        sources: [],
      };
      lines.set(key, line);
    }
    line.value += item.value;
    for (const source of [category, caption]) {
      if (source && !line.sources.includes(source)) line.sources.push(source);
    }
  }

  const ordered: BalanceSheetRollupLine[] = [];
  const seen = new Set<string>();
  for (const group of DEFAULT_ROLLUP) {
    const key = `${group.section}|${group.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const line = lines.get(key);
    if (line && line.value !== 0) ordered.push(line);
  }

  return { lines: ordered, unmapped };
}