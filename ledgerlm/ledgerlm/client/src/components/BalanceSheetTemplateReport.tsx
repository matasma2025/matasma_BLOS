import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BalanceSheetReport } from "@shared/boards/balanceSheet";

interface BalanceSheetTemplateReportProps {
  title: string;
  report: BalanceSheetReport;
  onExport?: () => void;
  isExporting?: boolean;
}

const money = (value: number, currency: string) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} ${currency}`;

export function BalanceSheetTemplateReport({
  title,
  report,
  onExport,
  isExporting = false,
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
    <Card className="border-primary/20 bg-primary/[0.02] p-4 space-y-4" data-testid="card-balance-sheet-report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Balance Sheet</p>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{report.periodLabel} · {report.currency}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={report.balanced ? "secondary" : "destructive"}>
            {report.balanced ? "Balanced" : `Difference ${money(report.difference, report.currency)}`}
          </Badge>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
              {isExporting ? "Exporting…" : "PowerPoint"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {totalCards.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-base font-semibold">{money(value, report.currency)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ratioCards.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-base font-semibold">{value === null ? "—" : `${value.toFixed(2)}x`}</p>
          </div>
        ))}
      </div>

      {(report.warnings.length > 0 || report.risks.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-1">
          {[...report.warnings, ...report.risks].slice(0, 6).map((warning) => <p key={warning}>• {warning}</p>)}
        </div>
      )}

      {report.periods.length > 1 && (
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period trend</p>
          <table className="w-full text-xs border-collapse">
            <thead><tr>{["Period", "Assets", "Liabilities", "Equity", "Difference"].map((label) => <th key={label} className="border px-2 py-1 text-left bg-muted">{label}</th>)}</tr></thead>
            <tbody>{report.periods.map((period) => <tr key={`${period.year}-${period.month}`}>
              <td className="border px-2 py-1 font-medium">{period.label}</td>
              <td className="border px-2 py-1">{money(period.totals.assets, report.currency)}</td>
              <td className="border px-2 py-1">{money(period.totals.liabilities, report.currency)}</td>
              <td className="border px-2 py-1">{money(period.totals.equity, report.currency)}</td>
              <td className="border px-2 py-1">{money(period.totals.balanceDifference, report.currency)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Material account movements</p>
        <table className="w-full text-xs border-collapse">
          <thead><tr>{["Account", "Section", "Category", "Value", "Change"].map((label) => <th key={label} className="border px-2 py-1 text-left bg-muted">{label}</th>)}</tr></thead>
          <tbody>{report.movements.slice(0, 10).map((movement) => <tr key={`${movement.section}-${movement.accountName}-${movement.category}`}>
            <td className="border px-2 py-1 font-medium">{movement.accountName}</td>
            <td className="border px-2 py-1 capitalize">{movement.section}</td>
            <td className="border px-2 py-1">{movement.category}</td>
            <td className="border px-2 py-1">{money(movement.value, report.currency)}</td>
            <td className={`border px-2 py-1 ${movement.change < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(movement.change, report.currency)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Calculated from the dedicated Balance Sheet cube. Narrative and risks are explanatory; source account values remain deterministic.</p>
    </Card>
  );
}