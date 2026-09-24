import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Presentation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EntityPnlLine {
  label: string;
  values: Record<string, number | null>;
  variance: number | null;
  variancePercent: number | null;
}

interface EntityPnlPayload {
  entity: string;
  asOf: string;
  comparison: "qoq" | "yoy";
  currency: "USD" | "INR";
  units?: string;
  columns: string[];
  currentLabel: string;
  comparisonLabel: string;
  forecastLabel?: string;
  yearEndLabel: string;
  lines: EntityPnlLine[];
  evidence: string[];
  warnings: string[];
  chart?: {
    title: string;
    series: Array<{ name: string; values: Array<{ period: string; value: number | null }> }>;
  };
}

interface EntityPnlTemplateReportProps {
  title: string;
  periodLabel?: string | null;
  report: EntityPnlPayload;
  summary?: string;
  kpis?: Array<{ label: string; value: string; change?: string; direction?: string }>;
  insights?: string[];
  commentary?: Array<{ label: string; text: string }>;
  onExport: (format: "pdf" | "pptx") => void;
  isExporting?: boolean;
}

const MONEY_LINES = new Set([
  "Revenue",
  "Employee Benefits",
  "Outsourcing Cost",
  "Consultancy Charges",
  "CI Charges & Other Revenue",
  "Facilities Cost",
  "Other Expenses",
  "Total Expenses",
  "EBIT",
]);

function formatAmount(value: number | null | undefined, currency: "USD" | "INR") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const symbol = currency === "USD" ? "$" : "₹";
  return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatCell(line: EntityPnlLine, value: number | null | undefined, currency: "USD" | "INR") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (line.label === "EBIT%") return `${value.toFixed(1)}%`;
  if (MONEY_LINES.has(line.label)) return formatAmount(value, currency);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatVariance(line: EntityPnlLine, currency: "USD" | "INR") {
  if (line.variance === null) return "—";
  if (line.label === "EBIT%") return `${line.variance.toFixed(1)} pp`;
  return formatCell(line, line.variance, currency);
}

export function EntityPnlTemplateReport({
  title,
  periodLabel,
  report,
  summary,
  kpis = [],
  insights = [],
  commentary = [],
  onExport,
  isExporting = false,
}: EntityPnlTemplateReportProps) {
  const chartData = (report.chart?.series ?? []).flatMap((series) => series.values.map((item) => item.period))
    .filter((period, index, all) => all.indexOf(period) === index)
    .map((period) => {
      const point: Record<string, string | number | null> = { period };
      for (const series of report.chart?.series ?? []) {
        point[series.name] = series.values.find((item) => item.period === period)?.value ?? null;
      }
      return point;
    });

  return (
    <div className="space-y-4" data-testid="entity-pnl-template-report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Badge variant="secondary">Entity P&amp;L</Badge>
            <Badge variant="outline">{report.entity}</Badge>
            <Badge variant="outline">{report.comparison.toUpperCase()}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel || report.currentLabel} · Values in {report.units || report.currency}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onExport("pdf")} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button size="sm" onClick={() => onExport("pptx")} disabled={isExporting}>
            <Presentation className="mr-2 h-4 w-4" /> PowerPoint
          </Button>
        </div>
      </div>

      {summary && <p className="text-sm leading-6">{summary}</p>}

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{kpi.value}</p>
                {kpi.change && <p className="mt-1 text-xs text-muted-foreground">{kpi.change}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">{report.chart?.title || "Revenue, Expenses and EBIT"}</CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
                <Tooltip formatter={(value) => formatAmount(Number(value), report.currency)} />
                <Legend />
                <Bar dataKey="Revenue" fill="#388e8e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Total Expenses" fill="#d98b34" radius={[3, 3, 0, 0]} />
                <Bar dataKey="EBIT" fill="#64748b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Profit &amp; Loss and capacity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="border px-3 py-2 text-left font-semibold">Line item</th>
                  {report.columns.map((column) => (
                    <th key={column} className="border px-3 py-2 text-right font-semibold">{column}</th>
                  ))}
                  <th className="border px-3 py-2 text-right font-semibold">Variance</th>
                  <th className="border px-3 py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => {
                  const isSubtotal = ["Total Expenses", "EBIT", "Total End", "Total Average"].includes(line.label);
                  return (
                    <tr key={line.label} className={isSubtotal ? "bg-muted/40 font-semibold" : "hover:bg-muted/20"}>
                      <td className="border px-3 py-2 text-left">{line.label}</td>
                      {report.columns.map((column) => (
                        <td key={column} className="border px-3 py-2 text-right tabular-nums">
                          {formatCell(line, line.values[column], report.currency)}
                        </td>
                      ))}
                      <td className="border px-3 py-2 text-right tabular-nums">
                        {formatVariance(line, report.currency)}
                      </td>
                      <td className="border px-3 py-2 text-right tabular-nums">
                        {line.variancePercent === null ? "—" : `${line.variancePercent.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {(insights.length > 0 || commentary.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {insights.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Key insights</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {insights.map((insight) => <li key={insight}>{insight}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
          {commentary.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Commentary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {commentary.map((item) => (
                  <div key={item.label}>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(report.warnings.length > 0 || report.evidence.length > 0) && (
        <Card className="bg-muted/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evidence and data notes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.warnings.map((warning) => <p key={warning} className="text-sm text-amber-700">{warning}</p>)}
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {report.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}