import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BOSCH_TEMPLATE_DEFINITIONS, boschMasterDetail, isBoschTemplateSlug,
  inheritBoschMasterTemplate, type BoschMaster,
} from "../../server/services/boards/boschTemplateCatalog";
import {
  protectBoardTemplateIdentity, protectBoardTemplateSettings, stripUnchangedFinancialPlanEcho,
  reportTemplateForExport,
} from "../../server/services/boards/boardTemplateGovernance";
import { updateBoardDtoSchema } from "../../shared/inputValidators";

function master(slug = "entity-pnl", revision = 2): BoschMaster {
  return { domainId: "bosch-test-domain", templateSlug: slug,
    reportTemplate: "Master report", reportTemplatePptxBase64: "TUFTVEVS",
    revision, fileName: "master.pptx", updatedAt: new Date("2026-10-12T00:00:00Z"), updatedBy: null };
}

test("the master catalog has exactly three fixed definitions, not user Board IDs", () => {
  assert.deepEqual(BOSCH_TEMPLATE_DEFINITIONS.map((item) => item.templateSlug),
    ["kpi-metrics", "balance-sheet-tracker", "entity-pnl"]);
  for (const invalid of ["TESTEntity P&L", "variance-analysis", "entity-pnl-extra", "881f403e-1715-43f4-83ab-e816e8c6078d"]) {
    assert.equal(isBoschTemplateSlug(invalid), false);
  }
});

test("master detail exposes an optimistic token and metadata but never file bytes", () => {
  const detail = boschMasterDetail(master());
  assert.equal(detail.templateSlug, "entity-pnl");
  assert.equal(detail.name, "Entity P&L");
  assert.equal(detail.hasPptx, true);
  assert.match(detail.expectedHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(detail, "reportTemplatePptxBase64"), false);
  assert.notEqual(detail.expectedHash, boschMasterDetail(master("entity-pnl", 3)).expectedHash);
});

test("new Boards inherit template fields without replacing source, plan, entity or periods", () => {
  const settings = { cubeId: "selected-source", analysisPrompts: "User analysis",
    dataSources: { enterprise: true }, columnMapping: { actuals: "Actual" },
    boardFlow: { scope: { entity: "MS", year: "2026", month: "7", currency: "USD" },
      comparisonBasis: "same-period-last-year" } };
  const original = JSON.stringify(settings);
  const inherited = inheritBoschMasterTemplate(settings, master());
  assert.equal(inherited.templateKey, "entity-pnl");
  assert.equal(inherited.cubeId, settings.cubeId);
  assert.equal(inherited.analysisPrompts, settings.analysisPrompts);
  assert.deepEqual(inherited.columnMapping, settings.columnMapping);
  assert.deepEqual(inherited.dataSources, settings.dataSources);
  assert.deepEqual(inherited.boardFlow.scope, settings.boardFlow.scope);
  assert.equal(inherited.boardFlow.comparisonBasis, settings.boardFlow.comparisonBasis);
  assert.equal(inherited.boardFlow.reportTemplatePptxBase64, "TUFTVEVS");
  assert.equal(JSON.stringify(settings), original);
});

test("master updates are copy-on-creation: old Boards and saved exports are unchanged", () => {
  const first = master();
  const existing = inheritBoschMasterTemplate({}, first);
  const before = JSON.stringify(existing);
  const updated = { ...first, reportTemplate: "new", reportTemplatePptxBase64: "TkVX", revision: 3 };
  const createdLater = inheritBoschMasterTemplate({}, updated);
  assert.equal(createdLater.boardFlow.reportTemplatePptxBase64, "TkVX");
  assert.equal(JSON.stringify(existing), before);
  assert.equal(reportTemplateForExport({ configSnapshot: { boardSettings: existing } }, createdLater), "TUFTVEVS");
});

test("Balance Sheet always uses the built-in renderer, even with an inappropriate stored master file", () => {
  const settings = inheritBoschMasterTemplate({ cubeId: "balance-sheet-source" }, master("balance-sheet-tracker"));
  assert.equal(settings.cubeId, "balance-sheet-source");
  assert.equal(settings.boardFlow.reportTemplate, "");
  assert.equal(settings.boardFlow.reportTemplatePptxBase64, undefined);
});

test("old null-ID editor echoes preserve the Board association; type-switch attempts fail", () => {
  const current = { templateId: "original-id", settings: { templateKey: "entity-pnl" } };
  assert.equal(protectBoardTemplateIdentity(current, { templateId: null }).templateId, "original-id");
  assert.throws(() => protectBoardTemplateIdentity(current, { templateId: "another-id" }));
  assert.throws(() => protectBoardTemplateIdentity(current, { settings: { templateKey: "kpi-metrics" } }));
  assert.doesNotThrow(() => protectBoardTemplateIdentity(current, { settings: { templateKey: "entity-pnl" } }));
});

test("financial planning survives ordinary saves, including cached legacy editor echoes", () => {
  const plan = { cubeId: "plan-source", entity: "MS", periods: ["2026-07"], uploadId: "upload" };
  const current = { templateKey: "entity-pnl", entityPnlFinancialPlan: plan,
    boardFlow: { reportTemplate: "locked", scope: { month: "7" } } };
  const echo = { title: "Edited entity report", settings: { templateKey: "entity-pnl",
    entityPnlFinancialPlan: JSON.parse(JSON.stringify(plan)), boardFlow: { scope: { month: "8" } } } };
  const normalized = stripUnchangedFinancialPlanEcho(current, echo);
  const parsed = updateBoardDtoSchema.parse(normalized);
  const saved = protectBoardTemplateSettings(current, parsed.settings) as any;
  assert.deepEqual(saved.entityPnlFinancialPlan, plan);
  assert.equal(saved.boardFlow.reportTemplate, "locked");
  assert.equal(saved.boardFlow.scope.month, "8");
  assert.throws(() => stripUnchangedFinancialPlanEcho(current,
    { settings: { entityPnlFinancialPlan: { ...plan, cubeId: "tampered" } } }));
  assert.throws(() => stripUnchangedFinancialPlanEcho({}, echo));
  assert.deepEqual((protectBoardTemplateSettings({ entityPnlFinancialPlan: plan }, null) as any).entityPnlFinancialPlan, plan);
});

test("admin save targets master storage only and seed cannot overwrite uploaded configurations", () => {
  const catalog = readFileSync("server/services/boards/boschTemplateCatalog.ts", "utf8");
  assert.match(catalog, /ON CONFLICT \(domain_id, template_slug\) DO NOTHING/);
  assert.match(catalog, /db\.update\(masters\)/);
  assert.match(catalog, /eq\(masters\.domainId, master\.domainId\)/);
  assert.match(catalog, /eq\(masters\.revision, master\.revision\)/);
  assert.doesNotMatch(catalog, /db\.update\(boards\)|userId.*boards/);
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /inheritBoschMasterTemplate\(parsed\.settings/);
  assert.equal((routes.match(/inheritBoschMasterTemplate\(parsed\.settings/g) ?? []).length, 1);
});
