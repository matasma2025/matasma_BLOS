import type { BalanceSheetSection } from "./metrics";

// Rolls a detailed balance sheet up into the handful of lines a management
// report actually shows ("Cash & cash equivalents", "Trade payables", …).
//
// The roll-up is keyed on CAPTIONS, not row positions. A spreadsheet that maps
// presentation lines by absolute cell reference (Sheet!F11) silently points at
// the wrong figure the moment a line item is inserted above it; matching the
// caption survives that. Anything the rules do not recognise is reported as
// unmapped rather than being quietly dropped into an "other" bucket.

export type RollupGroup = {
  label: string;
  section: BalanceSheetSection;
  /** Current/non-current placement, used for the current-assets subtotal. */
  term: "current" | "non-current";
  /**
   * Claim matching lines regardless of their own term. A management report
   * presents some balances together whatever their maturity — unbilled revenue
   * sits with trade receivables, deferred income with other liabilities — so
   * these rules are exempt from the term routing that everything else obeys.
   */
  anyTerm?: boolean;
  /** Matched against the line item's category caption, then its own caption. */
  match: RegExp;
};

/**
 * Default presentation lines. Ordered as a balance sheet reads: current before
 * non-current, equity first on the funding side. Earlier groups win, so the
 * specific ones are listed before the catch-alls.
 */
export const DEFAULT_ROLLUP: RollupGroup[] = [
  // Reconciliation to the sheet's own totals. Listed first so it is claimed
  // before any keyword rule, and shown as its own line rather than folded into
  // a real category — a difference the source does not explain should be
  // visible, not absorbed.
  {
    label: "Unallocated difference (assets)",
    section: "Assets",
    term: "current",
    match: /unallocated difference/i,
  },
  {
    label: "Unallocated difference (liabilities)",
    section: "Liabilities",
    term: "current",
    match: /unallocated difference/i,
  },

  // --- Assets, current ---
  {
    label: "Cash & cash equivalents",
    section: "Assets",
    term: "current",
    match: /\b(cash|bank balances?|cheques?|marketable securit(?:y|ies)|money market)\b/i,
  },
  {
    label: "Trade receivables & unbilled",
    section: "Assets",
    term: "current",
    anyTerm: true,
    match: /\b(trade receivables?|unbilled|contract assets?)\b/i,
  },
  // Catch-all for the current side. Everything not claimed above belongs here,
  // whatever it is called.
  { label: "Other current assets", section: "Assets", term: "current", match: /.*/ },

  // --- Assets, non-current ---
  {
    label: "Investments",
    section: "Assets",
    term: "non-current",
    match: /\b(investments?)\b/i,
  },
  {
    label: "Right-of-use assets",
    section: "Assets",
    term: "non-current",
    match: /\b(right[-\s]?of[-\s]?use|rou|leased assets?)\b/i,
  },
  {
    label: "Fixed assets",
    section: "Assets",
    term: "non-current",
    match: /\b(tangible|intangible|fixed assets?|property|plant|equipment|goodwill)\b/i,
  },
  { label: "Other non-current assets", section: "Assets", term: "non-current", match: /.*/ },

  // --- Equity ---
  { label: "Equity & reserves", section: "Equity", term: "non-current", match: /.*/ },

  // --- Liabilities, current ---
  {
    label: "Trade payables",
    section: "Liabilities",
    term: "current",
    match: /\b(trade payables?|notes payables?|creditors?)\b/i,
  },
  {
    label: "Lease liabilities",
    section: "Liabilities",
    term: "current",
    match: /\blease liabilit(?:y|ies)/i,
  },
  {
    label: "Provisions",
    section: "Liabilities",
    term: "current",
    match: /\bprovisions?\b/i,
  },
  {
    label: "Other liabilities",
    section: "Liabilities",
    term: "current",
    anyTerm: true,
    match: /\b(contract liabilit(?:y|ies)|deferred (?:revenue|income))\b/i,
  },
  { label: "Other liabilities", section: "Liabilities", term: "current", match: /.*/ },

  // --- Liabilities, non-current ---
  {
    label: "Lease liabilities",
    section: "Liabilities",
    term: "non-current",
    match: /\blease liabilit(?:y|ies)/i,
  },
  {
    label: "Non-current liabilities & provisions",
    section: "Liabilities",
    term: "non-current",
    match: /.*/,
  },
];

/**
 * Balance sheets are supplied in mINR. A second currency is only reported when
 * the board says what rate to use — a figure converted at a guessed rate is
 * worse than no figure at all, so an absent rate means mINR only.
 *
 * Understood forms: "USD to INR = 88.5", "1 USD = 88.5 INR", "USD/INR 88.5",
 * "conversion rate 88.5", "@ 88.5 INR/USD".
 */
export function parseUsdInrRate(text: string | null | undefined): number | null {
  if (!text) return null;
  const patterns = [
    /\bUSD\s*(?:to|\/|-|=|:)\s*INR\s*(?:=|:|@|is|of|at)?\s*([\d.,]+)/i,
    /\b1\s*USD\s*(?:=|:|@|is)\s*([\d.,]+)\s*INR/i,
    /\bINR\s*(?:\/|per)\s*USD\s*(?:=|:|@)?\s*([\d.,]+)/i,
    /\b(?:conversion|exchange|fx)\s*rate\s*(?:=|:|@|of|is)?\s*([\d.,]+)/i,
    /@\s*([\d.,]+)\s*INR\s*\/?\s*USD/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const rate = Number(m[1].replace(/,/g, ""));
    // A plausible USD/INR rate. Anything outside this is a misread of some
    // other number in the prompt, and converting by it would be silently wrong.
    if (Number.isFinite(rate) && rate >= 20 && rate <= 500) return rate;
  }
  return null;
}

export type UnitScale = {
  /** Divide source figures by this to reach the reporting unit. */
  divisor: number;
  /** What the scaled figures are in, e.g. "mINR". */
  label: string;
  /** Whether the board said so, or it was inferred from magnitude. */
  source: "stated" | "detected";
  /** Plain-English note for the prompt and the deck. */
  note: string;
};

/**
 * Decide the reporting unit. Balance sheets are exported in raw INR but
 * presented in millions, so the figures have to be divided down somewhere —
 * and doing it twice, or not at all, is off by a factor of a million.
 *
 * An explicit statement in the board prompt always wins. Failing that the scale
 * is inferred from magnitude: a balance sheet already in mINR essentially never
 * runs to eight figures, so anything that large is raw INR. Either way the
 * choice is reported rather than applied silently.
 */
export function resolveUnits(text: string | null | undefined, maxAbsolute: number): UnitScale {
  const s = String(text ?? "");
  const stated = (divisor: number, how: string): UnitScale => ({
    divisor,
    label: "mINR",
    source: "stated",
    note: `${how} (stated on the board).`,
  });

  const fromUnit = (unit: string): UnitScale | null => {
    const u = unit.toLowerCase().replace(/\s+/g, "");
    if (/^(m(n|illions?)?inr|inrm(n|illions?)?|millions?(ofinr)?|mn)$/.test(u)) {
      return stated(1, "Figures are already in millions of INR and are used as supplied");
    }
    if (/^(thousands?|k|inrthousands?)$/.test(u)) {
      return stated(1_000, "Figures are in thousands of INR and are divided by 1,000 to reach mINR");
    }
    if (/^(inr|rupees?|rs)$/.test(u)) {
      return stated(1_000_000, "Figures are in INR and are divided by 1,000,000 to reach mINR");
    }
    return null;
  };

  // What unit the DATA is in wins over what unit to present it in. A prompt
  // routinely says both ("the data is in INR, present in mINR"), and reading
  // the presentation unit as the source one leaves every figure a million times
  // too large.
  const sourceStatement =
    /\b(?:data|figures?|amounts?|values?|numbers?|sheet|input)\s+(?:is|are|come|comes|arrive|arrives)?\s*(?:provided\s+)?in\s+([A-Za-z ]{2,18}?)\b/i.exec(s);
  if (sourceStatement) {
    const hit = fromUnit(sourceStatement[1]);
    if (hit) return hit;
  }

  // Otherwise any unit mention at all.
  const anyStatement = /\bin\s+([A-Za-z ]{2,18}?)\b/i.exec(s);
  if (anyStatement) {
    const hit = fromUnit(anyStatement[1]);
    if (hit) return hit;
  }

  // Nothing stated — infer. 10,000,000 in mINR would be 10 trillion INR.
  const raw = maxAbsolute >= 10_000_000;
  return {
    divisor: raw ? 1_000_000 : 1,
    label: "mINR",
    source: "detected",
    note: raw
      ? "No unit was stated; the figures are large enough to be raw INR, so they have been divided by 1,000,000 to reach mINR. State the unit on the board if that is wrong."
      : "No unit was stated; the figures are already at millions scale and are used as supplied.",
  };
}

export type RollupLine = {
  label: string;
  section: BalanceSheetSection;
  term: "current" | "non-current";
  /** Period → amount. */
  values: Map<string, number>;
  /** Which source captions fed this line, for audit. */
  sources: string[];
};

export type RollupResult = {
  lines: RollupLine[];
  /** Captions no rule claimed — reported, never silently absorbed. */
  unmapped: { item: string; section: BalanceSheetSection; category: string | null }[];
};

export type RollupInput = {
  items: Map<string, Map<string, number>>;
  sections: Map<string, BalanceSheetSection>;
  itemCategories: Map<string, string>;
  periods: string[];
  /** Signed-convention normaliser from the caller. */
  amount: (item: string, period: string) => number;
  /** Current/non-current classifier from the caller. */
  term: (item: string) => "current" | "non-current" | "unknown";
  /**
   * Identity key → the caption to match and display. Keys carry section and
   * category too, so matching the raw key would let a group's pattern hit words
   * from the section ("Non-current assets") rather than the line itself.
   */
  label: (item: string) => string;
};

/**
 * Group detail line items into presentation lines.
 *
 * Detail rows are summed directly — subtotal rows are never used as inputs, so
 * a line can't be counted twice via its own "Total:" row. Matching prefers the
 * item's category caption (the level the report is actually organised at) and
 * falls back to the line item's own caption.
 */
export function rollUpBalanceSheet(
  input: RollupInput,
  groups: RollupGroup[] = DEFAULT_ROLLUP,
): RollupResult {
  const { items, sections, itemCategories, periods, amount, label } = input;

  const lines = new Map<string, RollupLine>();
  const unmapped: RollupResult["unmapped"] = [];

  for (const item of items.keys()) {
    const section = sections.get(item) ?? "Unclassified";
    const caption = label(item);
    if (section === "Unclassified") {
      unmapped.push({ item: caption, section, category: itemCategories.get(item) ?? null });
      continue;
    }
    const category = itemCategories.get(item) ?? null;
    const itemTerm = input.term(item);

    // Route on the item's OWN term. A caption keyword must never move a line
    // across the current/non-current divide: "Loans > 1 y" matches the word
    // "loans" in the current-assets rule, and letting that win reports a
    // non-current balance as current — the totals still foot, so nothing looks
    // wrong until the line items are compared against the source. Rules marked
    // anyTerm are the deliberate exceptions.
    const pool = groups.filter(
      (g) => g.section === section && (g.anyTerm || itemTerm === "unknown" || g.term === itemTerm),
    );
    const usable = pool.length ? pool : groups.filter((g) => g.section === section);
    const group =
      section === "Equity"
        ? usable[0]
        : usable.find((g) => g.match.test(category ?? "") || g.match.test(caption));

    if (!group) {
      unmapped.push({ item: caption, section, category });
      continue;
    }

    let line = lines.get(group.label);
    if (!line) {
      line = {
        label: group.label,
        section: group.section,
        term: group.term,
        values: new Map(),
        sources: [],
      };
      lines.set(group.label, line);
    }
    const source = category ?? caption;
    if (!line.sources.includes(source)) line.sources.push(source);
    for (const p of periods) {
      line.values.set(p, (line.values.get(p) ?? 0) + amount(item, p));
    }
  }

  // Emit in the declared group order so the table reads like a balance sheet.
  // Several groups may share a label — one rule per term, plus a catch-all —
  // and they all feed the same line, so the label is emitted once.
  const seen = new Set<string>();
  const ordered: RollupLine[] = [];
  for (const g of groups) {
    if (seen.has(g.label)) continue;
    const line = lines.get(g.label);
    if (!line) continue;
    seen.add(g.label);
    // A line that is zero in every period says nothing; the reconciliation line
    // in particular should only appear when there is something to reconcile.
    if (periods.every((p) => (line.values.get(p) ?? 0) === 0)) continue;
    ordered.push(line);
  }

  return { lines: ordered, unmapped };
}
