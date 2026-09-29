import assert from "node:assert/strict";
import test from "node:test";
import { removeEmptyPlaceholderParagraphs } from "../../server/services/boards/kpiPptxExportService";

test("removes a paragraph containing only an empty KPI placeholder", () => {
  const emptySummaryParagraph = '<a:p><a:pPr marL="0"/><a:r><a:t>{{ww_budget_revenue_summary}}</a:t></a:r></a:p>';
  const detailParagraph = '<a:p><a:pPr marL="0"/><a:r><a:t>{{ww_budget_revenue_detail}}</a:t></a:r></a:p>';

  assert.equal(
    removeEmptyPlaceholderParagraphs(
      `<p:txBody>${emptySummaryParagraph}${detailParagraph}</p:txBody>`,
      ["{{ww_budget_revenue_summary}}"],
    ),
    `<p:txBody>${detailParagraph}</p:txBody>`,
  );
});

test("preserves paragraphs with visible text and leaves XML unchanged without empty tokens", () => {
  const mixedParagraph = '<a:p><a:r><a:t>Summary: {{ww_budget_revenue_summary}}</a:t></a:r></a:p>';
  const detailParagraph = '<a:p><a:r><a:t>{{ww_budget_revenue_detail}}</a:t></a:r></a:p>';
  const xml = `<p:txBody>${mixedParagraph}${detailParagraph}</p:txBody>`;

  assert.equal(removeEmptyPlaceholderParagraphs(xml, ["{{ww_budget_revenue_summary}}"]), xml);
  assert.equal(removeEmptyPlaceholderParagraphs(xml, []), xml);
});

test("matches a placeholder split across runs without deleting neighboring paragraphs", () => {
  const splitSummaryParagraph = '<a:p><a:r><a:t>{{ww_budget_</a:t></a:r><a:r><a:t>revenue_summary}}</a:t></a:r></a:p>';
  const detailParagraph = '<a:p><a:r><a:t>Actual 12.3</a:t></a:r></a:p>';

  assert.equal(
    removeEmptyPlaceholderParagraphs(
      `${splitSummaryParagraph}${detailParagraph}`,
      ["{{ww_budget_revenue_summary}}"],
    ),
    detailParagraph,
  );
});