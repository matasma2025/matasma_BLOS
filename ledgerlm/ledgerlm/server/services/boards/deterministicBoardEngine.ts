import {
  BOARD_DETERMINISTIC_SCHEMA_VERSION,
  BOARD_FORMULA_ENGINE_VERSION,
  deterministicAnalysisRequestSchema,
  deterministicAnalysisResultSchema,
  type DeterministicAnalysisRequest,
  type DeterministicAnalysisResult,
  type DeterministicEvidence,
  type DeterministicMeasure,
  type DeterministicMeasureResult,
} from "@shared/boards/deterministicAnalysis";

export interface DeterministicFactRow {
  key: string;
  /** Values are ordered by period; null values are ignored by aggregations. */
  actual: Record<string, number | null | undefined>;
  budget: Record<string, number | null | undefined>;
  comparisonActual?: Record<string, number | null | undefined>;
  comparisonBudget?: Record<string, number | null | undefined>;
}

export interface DeterministicEngineInput {
  request: DeterministicAnalysisRequest;
  rows: DeterministicFactRow[];
  /** Authoritative totals from the unbounded aggregate query. */
  authoritativeTotals?: Array<DeterministicMeasureResult>;
  evidence?: DeterministicEvidence[];
}

const values = (record: Record<string, number | null | undefined>, id: string) =>
  (record[id] === undefined || record[id] === null ? [] : [Number(record[id])])
    .filter((value) => Number.isFinite(value));
export const ratioOperandKey = (measureId: string, operand: "numerator" | "denominator") =>
  `__${measureId}__${operand}`;

function ratioOperand(
  record: Record<string, number | null | undefined>,
  measure: DeterministicMeasure,
  operand: "numerator" | "denominator",
): number {
  const namespaced = ratioOperandKey(measure.id, operand);
  const raw = operand === "numerator" ? measure.numerator! : measure.denominator!;
  const id = record[namespaced] === undefined ? raw : namespaced;
  return aggregate(record, { ...measure, id, aggregation: "sum" });
}

function aggregate(record: Record<string, number | null | undefined>, measure: DeterministicMeasure): number {
  const entries = values(record, measure.id);
  if (!entries.length) return 0;
  if (measure.aggregation === "min") return Math.min(...entries);
  if (measure.aggregation === "max") return Math.max(...entries);
  if (measure.aggregation === "last" || measure.aggregation === "latest") return entries[entries.length - 1];
  return entries.reduce((sum, value) => sum + value, 0) / (measure.aggregation === "average" ? entries.length : 1);
}

function percentage(actual: number, budget: number): number | null {
  return budget === 0 ? null : (actual - budget) / Math.abs(budget) * 100;
}

function favorability(variance: number, rule: DeterministicMeasure["favorability"]): boolean | null {
  if (variance === 0 || rule === "neutral") return null;
  return rule === "higher-is-favorable" ? variance > 0 : variance < 0;
}

function reduceAggregatedValues(values: number[], aggregation: DeterministicMeasure["aggregation"]): number {
  if (!values.length) return 0;
  if (aggregation === "average") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "min") return Math.min(...values);
  if (aggregation === "max") return Math.max(...values);
  if (aggregation === "last" || aggregation === "latest") return values[values.length - 1];
  return values.reduce((sum, value) => sum + value, 0);
}

function resultFor(
  measure: DeterministicMeasure,
  actual: Record<string, number | null | undefined>,
  budget: Record<string, number | null | undefined>,
  comparisonActual?: Record<string, number | null | undefined>,
  comparisonBudget?: Record<string, number | null | undefined>,
): DeterministicMeasureResult {
  let actualValue = aggregate(actual, measure);
  let budgetValue = aggregate(budget, measure);
  if (measure.aggregation === "ratio") {
    const actualDenominator = ratioOperand(actual, measure, "denominator");
    const budgetDenominator = ratioOperand(budget, measure, "denominator");
    actualValue = actualDenominator === 0 ? 0 : ratioOperand(actual, measure, "numerator") / actualDenominator;
    budgetValue = budgetDenominator === 0 ? 0 : ratioOperand(budget, measure, "numerator") / budgetDenominator;
  }
  const variance = actualValue - budgetValue;
  let comparisonA = comparisonActual ? aggregate(comparisonActual, measure) : undefined;
  let comparisonB = comparisonBudget ? aggregate(comparisonBudget, measure) : undefined;
  if (measure.aggregation === "ratio" && comparisonActual && comparisonBudget) {
    const comparisonActualDenominator = ratioOperand(comparisonActual, measure, "denominator");
    const comparisonBudgetDenominator = ratioOperand(comparisonBudget, measure, "denominator");
    comparisonA = comparisonActualDenominator === 0
      ? 0
      : ratioOperand(comparisonActual, measure, "numerator") / comparisonActualDenominator;
    comparisonB = comparisonBudgetDenominator === 0
      ? 0
      : ratioOperand(comparisonBudget, measure, "numerator") / comparisonBudgetDenominator;
  }
  return {
    measureId: measure.id,
    actual: actualValue,
    budget: budgetValue,
    variance,
    variancePct: percentage(actualValue, budgetValue),
    comparisonActual: comparisonA,
    comparisonBudget: comparisonB,
    comparisonVariance: comparisonA === undefined || comparisonB === undefined ? undefined : comparisonA - comparisonB,
    contribution: null,
    favorable: favorability(variance, measure.favorability),
    material: Math.abs(variance) >= (measure.materiality ?? 0),
  };
}

export function runDeterministicBoardEngine(input: DeterministicEngineInput): DeterministicAnalysisResult {
  const request = deterministicAnalysisRequestSchema.parse(input.request);
  if (!request.measures.length) throw new Error("At least one measure is required");
  const measures = request.measures;
  const compareKeys = (a: DeterministicFactRow, b: DeterministicFactRow) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  const contributorRows = [...input.rows].sort(compareKeys).slice(0, request.contributorLimit);
  const allRows = [...input.rows].sort(compareKeys);
  const totalFor = (measure: DeterministicMeasure) => {
    const supplied = input.authoritativeTotals?.find((total) => total.measureId === measure.id);
    if (supplied) return supplied;
    if (measure.aggregation === "ratio") {
      const actualNumerator = allRows.reduce((sum, row) => sum + ratioOperand(row.actual, measure, "numerator"), 0);
      const budgetNumerator = allRows.reduce((sum, row) => sum + ratioOperand(row.budget, measure, "numerator"), 0);
      const actualDenominator = allRows.reduce((sum, row) => sum + ratioOperand(row.actual, measure, "denominator"), 0);
      const budgetDenominator = allRows.reduce((sum, row) => sum + ratioOperand(row.budget, measure, "denominator"), 0);
      const actual = actualDenominator === 0 ? 0 : actualNumerator / actualDenominator;
      const budget = budgetDenominator === 0 ? 0 : budgetNumerator / budgetDenominator;
      const comparison = (side: "actual" | "budget") => {
        const source = allRows.map((row) => side === "actual" ? row.comparisonActual : row.comparisonBudget).filter(Boolean) as Array<Record<string, number | null | undefined>>;
        const numeratorTotal = source.reduce((sum, values) => sum + ratioOperand(values, measure, "numerator"), 0);
        const denominatorTotal = source.reduce((sum, values) => sum + ratioOperand(values, measure, "denominator"), 0);
        return { numeratorTotal, denominatorTotal };
      };
      const comparisonActual = allRows.some((row) => row.comparisonActual) ? comparison("actual") : undefined;
      const comparisonBudget = allRows.some((row) => row.comparisonBudget) ? comparison("budget") : undefined;
      return resultFor(measure,
        { [measure.id]: actual, [ratioOperandKey(measure.id, "numerator")]: actualNumerator, [ratioOperandKey(measure.id, "denominator")]: actualDenominator },
        { [measure.id]: budget, [ratioOperandKey(measure.id, "numerator")]: budgetNumerator, [ratioOperandKey(measure.id, "denominator")]: budgetDenominator },
        comparisonActual ? { [ratioOperandKey(measure.id, "numerator")]: comparisonActual.numeratorTotal, [ratioOperandKey(measure.id, "denominator")]: comparisonActual.denominatorTotal } : undefined,
        comparisonBudget ? { [ratioOperandKey(measure.id, "numerator")]: comparisonBudget.numeratorTotal, [ratioOperandKey(measure.id, "denominator")]: comparisonBudget.denominatorTotal } : undefined);
    }
    const aggregateRows = (side: "actual" | "budget") => {
      const values = allRows.map((row) => aggregate(side === "actual" ? row.actual : row.budget, measure));
      return reduceAggregatedValues(values, measure.aggregation);
    };
    const actual = aggregateRows("actual");
    const budget = aggregateRows("budget");
    const comparisonValues = (side: "actual" | "budget") => {
      const source = allRows.map((row) => side === "actual" ? row.comparisonActual : row.comparisonBudget).filter(Boolean) as Array<Record<string, number | null | undefined>>;
      return source.length
        ? reduceAggregatedValues(source.map((values) => aggregate(values, measure)), measure.aggregation)
        : undefined;
    };
    const comparisonActual = comparisonValues("actual");
    const comparisonBudget = comparisonValues("budget");
    return resultFor(measure, { [measure.id]: actual }, { [measure.id]: budget },
      comparisonActual === undefined ? undefined : { [measure.id]: comparisonActual },
      comparisonBudget === undefined ? undefined : { [measure.id]: comparisonBudget });
  };
  const totals = measures.map(totalFor);
  const contributors = contributorRows.map((row) => ({
    key: row.key,
    measures: measures.map((measure) => resultFor(measure, row.actual, row.budget, row.comparisonActual, row.comparisonBudget)),
  }));
  for (const total of totals) {
    const denominator = Math.abs(total.variance);
    for (const contributor of contributors) {
      const item = contributor.measures.find((entry) => entry.measureId === total.measureId)!;
      item.contribution = denominator === 0 ? null : item.variance / denominator * 100;
    }
  }
  return deterministicAnalysisResultSchema.parse({
    schemaVersion: BOARD_DETERMINISTIC_SCHEMA_VERSION,
    formulaEngineVersion: BOARD_FORMULA_ENGINE_VERSION,
    measures: totals,
    contributors,
    evidence: (input.evidence ?? []).slice(0, 20),
  });
}