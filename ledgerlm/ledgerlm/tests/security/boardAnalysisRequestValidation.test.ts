import assert from "node:assert/strict";
import test from "node:test";
import { boardAnalysisRequestSchema } from "../../shared/inputValidators";

const defaultBoardPrompt = `Perform a Budget vs Actual variance analysis for {{period}}.
{{#comparison}}
Comparison: {{comparison_table}}
{{/comparison}}
Total actual: {{total_actual}} USD
Total budget: {{total_budget}} USD
Variance: {{total_variance}} ({{total_variance_pct}})
Dimensions: {{dimensions}}
{{variance_table}}
{{top_unfavorable}}
{{top_favorable}}`;

test("accepts the native Board editor payload and known prompt placeholders", () => {
  const parsed = boardAnalysisRequestSchema.parse({
    year: 2026,
    months: [1, 2, 3],
    dimensions: ["Entity", "Sector"],
    userPromptTemplate: defaultBoardPrompt,
    comparison: { year: 2025, months: [1, 2, 3] },
  });
  assert.equal(parsed.year, 2026);
});

test("rejects unknown prompt placeholders, markup, and non-executable period aliases", () => {
  assert.throws(() => boardAnalysisRequestSchema.parse({
    year: 2026,
    months: [1],
    userPromptTemplate: "{{secret_source_rows}}",
  }));
  assert.throws(() => boardAnalysisRequestSchema.parse({
    year: 2026,
    months: [1],
    userPromptTemplate: "<script>alert(1)</script>",
  }));
  assert.throws(() => boardAnalysisRequestSchema.parse({
    period: "Q1 2026",
  }));
  assert.throws(() => boardAnalysisRequestSchema.parse({
    comparisonBasis: { mode: "year-ago", periods: ["Q1 2025"] },
  }));
});