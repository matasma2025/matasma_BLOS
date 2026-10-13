import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import {
  administerBoardTemplate, boardTemplateHash, BoardTemplateError, isBoschDomain,
  protectBoardTemplateSettings, publicBoardSettings, reportTemplateForExport, validateBoardTemplatePptx,
} from "../../server/services/boards/boardTemplateGovernance";

const old = () => ({
  templateKey: "entity-pnl", cubeId: "retained-cube",
  boardFlow: { scope: { year: "2026" }, reportTemplate: "Original {{period}}", reportTemplatePptxBase64: "T0xE" },
});
const rejected = (operation: () => unknown) => assert.throws(operation,
  (error: unknown) => error instanceof BoardTemplateError && error.status === 403);

test("Bosch policy uses the exact registered domain, not an email suffix or role", () => {
  assert.ok(isBoschDomain("Bosch.com"));
  for (const name of ["fakebosch.com", "bosch.com.attacker.test", "ledgerlm.ai", undefined]) assert.ok(!isBoschDomain(name));
});

test("ordinary saves cannot add, replace, clear, or administratively override template fields", () => {
  for (const proposed of [
    { boardFlow: { reportTemplate: "changed" } },
    { boardFlow: { reportTemplate: "" } },
    { boardFlow: { reportTemplate: null } },
    { boardFlow: { reportTemplatePptxBase64: "TkVX" } },
    { boardFlow: { reportTemplatePptxBase64: "" } },
    { boardFlow: { reportTemplatePptxBase64: null } },
    { boardTemplateAdministration: { revision: 50 } },
    null,
  ]) rejected(() => protectBoardTemplateSettings(old(), proposed));
});

test("normal creation cannot introduce a template, including an admin's normal wizard", () => {
  rejected(() => protectBoardTemplateSettings({}, { boardFlow: { reportTemplate: "uploaded" } }));
  rejected(() => protectBoardTemplateSettings({}, { boardFlow: { reportTemplatePptxBase64: "TkVX" } }));
  assert.deepEqual(protectBoardTemplateSettings({}, { title: "ordinary" }), { title: "ordinary" });
});

test("unchanged legacy echoes and omission preserve templates without freezing source/period edits", () => {
  const current = old();
  const before = JSON.stringify(current);
  for (const boardFlow of [{ scope: { year: "2027" } }, { ...current.boardFlow, scope: { year: "2027" } }]) {
    const saved = protectBoardTemplateSettings(current, { cubeId: "new-cube", boardFlow }) as any;
    assert.equal(saved.cubeId, "new-cube");
    assert.equal(saved.boardFlow.scope.year, "2027");
    assert.equal(saved.boardFlow.reportTemplate, current.boardFlow.reportTemplate);
    assert.equal(saved.boardFlow.reportTemplatePptxBase64, current.boardFlow.reportTemplatePptxBase64);
  }
  assert.equal(JSON.stringify(current), before);
});

test("administration replacement preserves other settings and captures the original legacy export", () => {
  const current = old();
  const updated = administerBoardTemplate(current, {
    reportTemplate: "New layout", reportTemplatePptxBase64: "TkVX", expectedHash: boardTemplateHash(current),
  }, "admin", "2026-10-12T00:00:00Z");
  assert.equal(updated.cubeId, current.cubeId);
  assert.deepEqual(updated.boardFlow.scope, current.boardFlow.scope);
  assert.equal(updated.boardFlow.reportTemplatePptxBase64, "TkVX");
  assert.equal(updated.boardTemplateAdministration.revision, 1);
  assert.equal(reportTemplateForExport({}, updated), "T0xE");
  const again = administerBoardTemplate(updated, {
    reportTemplatePptxBase64: "TkVYVA==", expectedHash: boardTemplateHash(updated),
  }, "another-admin");
  assert.equal(reportTemplateForExport({}, again), "T0xE");
  assert.equal(again.boardTemplateAdministration.revision, 2);
});

test("published changes never alter old report snapshot exports, including built-in snapshots", () => {
  const current = administerBoardTemplate(old(), { reportTemplatePptxBase64: "TkVX",
    expectedHash: boardTemplateHash(old()) }, "admin");
  assert.equal(reportTemplateForExport({ configSnapshot: { boardSettings: old() } }, current), "T0xE");
  assert.equal(reportTemplateForExport({ configSnapshot: { boardSettings: current } }, current), "TkVX");
  assert.equal(reportTemplateForExport({ configSnapshot: { boardSettings: { boardFlow: {} } } }, current), undefined);
});

test("legacy report without an uploaded template stays built-in after administration upload", () => {
  const updated = administerBoardTemplate({}, { reportTemplatePptxBase64: "TkVX",
    expectedHash: boardTemplateHash({}) }, "admin");
  assert.equal(reportTemplateForExport({}, updated), undefined);
});

test("text import clears only current PPTX; historical exports retain the old file", () => {
  const updated = administerBoardTemplate(old(), { reportTemplate: "Text only", clearPptx: true,
    expectedHash: boardTemplateHash(old()) }, "admin");
  assert.equal(updated.boardFlow.reportTemplatePptxBase64, undefined);
  assert.equal(reportTemplateForExport({}, updated), "T0xE");
  assert.equal(reportTemplateForExport({ configSnapshot: { boardSettings: updated } }, updated), undefined);
});

test("stale administrator revision cannot overwrite a newer upload", () => {
  const updated = administerBoardTemplate(old(), { reportTemplate: "new",
    expectedHash: boardTemplateHash(old()) }, "admin");
  assert.throws(() => administerBoardTemplate(updated, { reportTemplate: "stale",
    expectedHash: boardTemplateHash(old()) }, "admin"),
  (error: unknown) => error instanceof BoardTemplateError && error.status === 409);
});

test("private baseline remains server-side and survives ordinary Board saves", () => {
  const current = administerBoardTemplate(old(), { reportTemplate: "new", expectedHash: boardTemplateHash(old()) }, "admin");
  assert.ok(!Object.hasOwn(publicBoardSettings(current) as object, "boardTemplateAdministration"));
  const saved = protectBoardTemplateSettings(current, { boardFlow: { scope: { year: "2028" } } }) as any;
  assert.deepEqual(saved.boardTemplateAdministration, current.boardTemplateAdministration);
  assert.equal(reportTemplateForExport({}, saved), "T0xE");
});

test("archive validation rejects non-PPTX, corrupt XML, macros and excessive expansion", () => {
  assert.throws(() => validateBoardTemplatePptx(Buffer.from("plain text").toString("base64")));
  const files = { "[Content_Types].xml": strToU8("<Types/>"),
    "ppt/presentation.xml": strToU8("<presentation/>"), "ppt/slides/slide1.xml": strToU8("<slide/>") };
  validateBoardTemplatePptx(Buffer.from(zipSync(files)).toString("base64"));
  for (const addition of [
    { "ppt/vbaProject.bin": new Uint8Array([1]) },
    { "ppt/slides/slide1.xml": strToU8("<unclosed>") },
    { "ppt/slides/slide1.xml": strToU8('<!DOCTYPE slide [<!ENTITY x "unsafe">]><slide>&x;</slide>') },
    { "ppt/oversize": new Uint8Array(51 * 1024 * 1024) },
  ]) assert.throws(() => validateBoardTemplatePptx(Buffer.from(zipSync({ ...files, ...addition })).toString("base64")));
});

test("admin routes explicitly require active admin and fresh step-up; ordinary saves use the lock", () => {
  const admin = readFileSync("server/routes/boardTemplateAdministration.ts", "utf8");
  assert.match(admin, /app\.put\([^,]+, requireActiveAdmin, requireRecentAdminStepUp/);
  assert.match(admin, /getBoschMasterTemplate\(domainId, req\.params\.templateSlug\)/);
  assert.doesNotMatch(admin, /ownedDomainQuery|domainBoard\(/);
  assert.match(admin, /IS NOT DISTINCT FROM/);
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /protectBoardTemplateSettings\(\{\}, parsed\.settings\)/);
  assert.match(routes, /protectBoardTemplateSettings\(board\.settings, changes\.settings\)/);
});
