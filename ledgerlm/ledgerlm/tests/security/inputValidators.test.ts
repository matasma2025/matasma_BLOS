import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoardDtoSchema,
  updateBoardDtoSchema,
  validateEnterpriseDisplayName,
} from "../../shared/inputValidators";

const validSettings = {
  analysisPrompts: "Compare actuals with budget.",
  cubeId: "7af343d4-379d-4717-a742-5c89236e395d",
  columnMapping: {
    actuals: "Actual FY25",
    budget: "Budget FY25",
    forecast: "Forecast FY25",
    rollingForecasts: ["CF01", "CF02"],
  },
  dataSources: {
    enterprise: true,
    vault: true,
    webApis: false,
    financialApis: false,
  },
};

test("accepts and normalizes ordinary board data", () => {
  const result = createBoardDtoSchema.parse({
    title: "  BGSW Monthly Variance  ",
    description: "  März financial review  ",
    templateId: null,
    settings: validSettings,
  });

  assert.equal(result.title, "BGSW Monthly Variance");
  assert.equal(result.description, "März financial review");
});

test("rejects stored injection payloads in board text", () => {
  const payloads = [
    "<script>alert(1)</script>",
    "%253Cscript%253Ealert(1)%253C%252Fscript%253E",
    "javascript:alert(1)",
    "data:text/html,<svg onload=alert(1)>",
    "${process.env.SECRET}",
    "{{constructor.constructor('alert(1)')()}}",
    "Board\u0000Name",
    "Board\u202EName",
  ];

  for (const title of payloads) {
    assert.equal(createBoardDtoSchema.safeParse({ title }).success, false, title);
  }
});

test("rejects oversized, empty, unknown, and malformed board fields", () => {
  assert.equal(createBoardDtoSchema.safeParse({ title: " ".repeat(4) }).success, false);
  assert.equal(createBoardDtoSchema.safeParse({ title: "a".repeat(201) }).success, false);
  assert.equal(createBoardDtoSchema.safeParse({ title: "Valid", userId: "attacker" }).success, false);
  assert.equal(updateBoardDtoSchema.safeParse({}).success, false);
  assert.equal(updateBoardDtoSchema.safeParse({ title: "Valid", settings: { unknown: true } }).success, false);
});

test("validates enterprise document display names without blocking normal names", () => {
  assert.equal(validateEnterpriseDisplayName("BGSW Actuals März 2026.xlsx"), null);
  assert.notEqual(validateEnterpriseDisplayName("<script>alert(1)</script>.xlsx"), null);
  assert.notEqual(validateEnterpriseDisplayName("%3Cscript%3Ealert(1)%3C%2Fscript%3E.xlsx"), null);
  assert.match(validateEnterpriseDisplayName("../financials.xlsx") || "", /path/i);
  assert.match(validateEnterpriseDisplayName("%2e%2e%2ffinancials.xlsx") || "", /path/i);
  assert.match(validateEnterpriseDisplayName("%252e%252e%255cfinancials.xlsx") || "", /path/i);
  assert.match(validateEnterpriseDisplayName("a".repeat(252) + ".xlsx") || "", /255 bytes/i);
});