import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import test from "node:test";
import { strToU8, unzipSync, zipSync } from "fflate";
import { parseBalanceSheetWorkbook } from "../../server/services/balanceSheetService";

async function createFormulaWorkbook(cachedValue: string | null): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BS-Assets");
  sheet.getCell("F1").value = new Date(2026, 5, 1);
  sheet.getCell("B2").value = "Current assets";
  sheet.getCell("C2").value = "Cash and cash equivalents";
  sheet.getCell("D2").value = "Cash formula result";
  sheet.getCell("E2").value = "1000";
  sheet.getCell("F2").value = { formula: "1-1", result: 0 };

  const original = new Uint8Array(await workbook.xlsx.writeBuffer());
  const archive = unzipSync(original);
  const worksheetPath = "xl/worksheets/sheet1.xml";
  const worksheetXml = new TextDecoder().decode(archive[worksheetPath]);
  const formulaCell = /(<c\b[^>]*r="F2"[^>]*>[\s\S]*?<v\b[^>]*>)[\s\S]*?(<\/v>[\s\S]*?<\/c>)/;
  assert.match(worksheetXml, formulaCell);
  archive[worksheetPath] = strToU8(
    worksheetXml.replace(formulaCell, `$1${cachedValue ?? ""}$2`),
  );
  return zipSync(archive);
}

test("imports a cached formula result of zero from XLSX XML", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ledgerlm-balance-sheet-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "cached-zero.xlsx");
  await writeFile(filePath, await createFormulaWorkbook("0"));

  const rows = await parseBalanceSheetWorkbook(filePath, "cached-zero.xlsx");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amountReporting, 0);
  assert.equal(rows[0].category, "Current assets | Cash and cash equivalents");
});

test("fails explicitly when a formula has no numeric cached result", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ledgerlm-balance-sheet-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "missing-cache.xlsx");
  await writeFile(filePath, await createFormulaWorkbook(null));

  await assert.rejects(
    parseBalanceSheetWorkbook(filePath, "missing-cache.xlsx"),
    /Could not read numeric cached results for 1 Balance Sheet formula cells/,
  );
});