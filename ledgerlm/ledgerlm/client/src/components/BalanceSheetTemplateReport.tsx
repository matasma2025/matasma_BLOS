import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReportDownloadFooter } from "@/components/reports/ReportDownloadFooter";
import { reportFrame, reportInsetHeader, reportTitle, reportEyebrow, reportMetricCard, reportWarning, reportTh, reportScroll } from "@/components/reports/reportStyles";
import type { BalanceSheetReport } from "@shared/boards/balanceSheet";

interface BalanceSheetTemplateReportProps {
  title: string;
  report: BalanceSheetReport;
  onExport?: () => void;
  isExporting?: boolean;
  showDownloadFooter?: boolean;
}

const money = (value: number, currency: string) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} ${currency}`;

export function BalanceSheetTemplateReport({
  title,
  report,
  onExport,
  isExporting = false,
  showDownloadFooter = true,
}: BalanceSheetTemplateReportProps) {
  const totalCards = [
    ["Assets", report.totals.assets],
    ["Liabilities", report.totals.liabilities],
    ["Equity", report.totals.equity],
    ["Liabilities + Equity", report.totals.liabilitiesAndEquity],
  ] as const;
  const ratioCards = [
    ["Current ratio", report.ratios.currentRatio],
    ["Quick ratio", report.ratios.quickRatio],
    ["Debt / equity", report.ratios.debtToEquity],
    ["Equity ratio", report.ratios.equityRatio],
  ] as const;

  return (
    <Card className={`${reportFrame} p-4 sm:p-6 space-y-5`} data-testid="card-balance-sheet-report">
      <div className={`${reportInsetHeader} flex flex-wrap items-start justify-between gap-3`}>
        <div>
          <p className={reportEyebrow}>Balance Sheet</p>
          <h3 className={reportTitle}>{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{report.periodLabel} · {report.currency}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={report.balanced ? "secondary" : "destructive"}>
            {report.balanced ? "Balanced" : `Difference ${money(report.difference, report.currency)}`}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {totalCards.map(([label, value]) => (
          <div key={label} className={reportMetricCard}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-teal-950">{money(value, report.currency)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ratioCards.map(([label, value]) => (
          <div key={label} className={reportMetricCard}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-teal-950">{value === null ? "—" : `${value.toFixed(2)}x`}</p>
          </div>
        ))}
      </div>

      {(report.warnings.length > 0 || report.risks.length > 0) && (
        <div className={`${reportWarning} space-y-1`}>
          {[...report.warnings, ...report.risks].slice(0, 6).map((warning) => <p key={warning}>• {warning}</p>)}
        </div>
      )}

      {report.periods.length > 1 && (
        <div className={reportScroll}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period trend</p>
          <table className="w-full text-xs border-collapse">
            <thead><tr>{["Period", "Assets", "Liabilities", "Equity", "Difference"].map((label) => <th key={label} className={reportTh}>{label}</th>)}</tr></thead>
            <tbody>{report.periods.map((period) => <tr key={`${period.year}-${period.month}`}>
              <td className="border border-teal-900/10 px-3 py-2 font-medium">{period.label}</td>
              <td className="border border-teal-900/10 px-3 py-2">{money(period.totals.assets, report.currency)}</td>
              <td className="border border-teal-900/10 px-3 py-2">{money(period.totals.liabilities, report.currency)}</td>
              <td className="border border-teal-900/10 px-3 py-2">{money(period.totals.equity, report.currency)}</td>
              <td className="border border-teal-900/10 px-3 py-2">{money(period.totals.balanceDifference, report.currency)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      {report.categoryBreakdowns.length > 0 && (
        <div className={reportScroll}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chart categories and source captions</p>
          <table className="w-full text-xs border-collapse">
            <thead><tr>{["Chart line", "Section", "Value", "Source captions"].map((label) => <th key={label} className={reportTh}>{label}</th>)}</tr></thead>
            <tbody>{report.categoryBreakdowns.slice(0, 12).map((item) => <tr key={`${item.section}-${item.label}`}>
              <td className="border border-teal-900/10 px-3 py-2 font-medium">{item.label}</td>
              <td className="border border-teal-900/10 px-3 py-2 capitalize">{item.section}</td>
              <td className="border border-teal-900/10 px-3 py-2">{money(item.value, report.currency)}</td>
              <td className="border border-teal-900/10 px-3 py-2 text-muted-foreground">
                {item.sourceCaptions?.length
                  ? `${item.sourceCaptions.slice(0, 4).join(" · ")}${item.sourceCaptions.length > 4 ? ` · +${item.sourceCaptions.length - 4} more` : ""}`
                  : "Statement subtotals"}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      {report.unmappedRows.length > 0 && (
        <div className={`${reportWarning}`}>
          <p className="font-semibold">Unmapped source rows ({report.unmappedRows.length})</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
            {report.unmappedRows.slice(0, 10).map((row) => <li key={row}>{row}</li>)}
          </ul>
          {report.unmappedRows.length > 10 && <p className="mt-1 text-xs">Showing 10 of {report.unmappedRows.length} rows.</p>}
        </div>
      )}

      <div className={reportScroll}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Material account movements</p>
        <table className="w-full text-xs border-collapse">
          <thead><tr>{["Account", "Section", "Category", "Value", "Change"].map((label) => <th key={label} className={reportTh}>{label}</th>)}</tr></thead>
          <tbody>{report.movements.slice(0, 10).map((movement) => <tr key={`${movement.section}-${movement.accountName}-${movement.category}`}>
            <td className="border border-teal-900/10 px-3 py-2 font-medium">{movement.accountName}</td>
            <td className="border border-teal-900/10 px-3 py-2 capitalize">{movement.section}</td>
            <td className="border border-teal-900/10 px-3 py-2">{movement.category}</td>
            <td className="border border-teal-900/10 px-3 py-2">{money(movement.value, report.currency)}</td>
            <td className={`border border-teal-900/10 px-3 py-2 ${movement.change < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(movement.change, report.currency)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Calculated from the dedicated Balance Sheet cube. Narrative and risks are explanatory; source account values remain deterministic.</p>
      {onExport && showDownloadFooter && (
        <ReportDownloadFooter>
          <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
            {isExporting ? "Exporting…" : "PowerPoint"}
          </Button>
        </ReportDownloadFooter>
      )}
    </Card>
  );
}