import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ShieldCheck, Sparkles } from 'lucide-react';
import { ReportDownloadFooter } from '@/components/reports/ReportDownloadFooter';
import { reportFrame, reportHeader, reportTitle, reportEyebrow, reportMetricCard, reportWarning } from '@/components/reports/reportStyles';

interface KpiMetric {
  label: string;
  actual: number | null;
  forecast?: number | null;
  variance?: number | null;
  variancePercent?: number | null;
  breakdowns?: Array<{
    label: string;
    actual: number | null;
    forecast?: number | null;
    variance?: number | null;
  }>;
}

interface KpiScope {
  id: string;
  code: string;
  label: string;
  entity: string;
  metrics: KpiMetric[];
}

export interface KpiTemplateData {
  scope?: string;
  periodLabel?: string;
  forecastScenario?: string;
  actualSourceLabel?: string;
  forecastSourceLabel?: string;
  metrics: KpiMetric[];
  scopeBadges?: KpiScope[];
  warnings?: string[];
}

interface KpiTemplateReportProps {
  title: string;
  periodLabel?: string | null;
  sourceName?: string;
  templateSource?: string;
  kpiReport: KpiTemplateData;
  onExport?: (scopeCode?: string) => void;
  isExporting?: boolean;
  showDownloadFooter?: boolean;
}

const SCOPE_COLORS = [
  { accent: '#0f766e', soft: '#ccfbf1', surface: '#f0fdfa', text: '#115e59' },
  { accent: '#db2777', soft: '#fce7f3', surface: '#fdf2f8', text: '#9d174d' },
  { accent: '#d97706', soft: '#fef3c7', surface: '#fffbeb', text: '#92400e' },
  { accent: '#7c3aed', soft: '#ede9fe', surface: '#f5f3ff', text: '#5b21b6' },
];

function numberValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function metricValue(metric: KpiMetric, value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const label = metric.label.toLowerCase();
  if (label.includes('utilization')) {
    return `${numberValue(Math.abs(value) <= 1.5 ? value * 100 : value)}%`;
  }
  if (label.includes('revenue')) return `${numberValue(value)} mUSD`;
  return numberValue(value);
}

function metricKey(label: string) {
  return label.toLowerCase().replace(/[^a-z]+/g, '-');
}

export function KpiTemplateReport({
  title,
  periodLabel,
  sourceName,
  templateSource,
  kpiReport,
  onExport,
  isExporting = false,
  showDownloadFooter = true,
}: KpiTemplateReportProps) {
  const scopes: KpiScope[] = kpiReport.scopeBadges?.length
    ? kpiReport.scopeBadges
    : [{
      id: 'aggregate',
      code: 'ALL',
      label: 'All entities',
      entity: '',
      metrics: kpiReport.metrics,
    }];
  const reportPeriod = kpiReport.periodLabel ?? periodLabel ?? 'Selected period';

  return (
    <div
      className={reportFrame}
      data-testid="kpi-template-report"
    >
      <div className={reportHeader}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`${reportEyebrow} mb-2 flex items-center gap-2`}>
              <Sparkles className="h-3.5 w-3.5" />
              Imported KPI presentation
            </div>
            <h2 className={reportTitle}>
              Business Metrics <span className="text-teal-700">{reportPeriod}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-teal-900/15 bg-white text-teal-800 hover:bg-teal-100">
              {scopes.length} slides
            </Badge>
            {kpiReport.forecastScenario && (
              <Badge className="border-teal-900/15 bg-white text-teal-800 hover:bg-teal-100">
                {kpiReport.forecastScenario}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-teal-900/15 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Internal · Governed Enterprise Data · KPI Metrics Board
          </span>
          {sourceName && <span>{sourceName}</span>}
          {templateSource && <span>Template: {templateSource}</span>}
        </div>
      </div>

      <div className="border-b border-teal-900/15 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Decision / info to GLs</p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Worldwide and regional KPI view for {reportPeriod}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>{kpiReport.actualSourceLabel ?? 'Actuals: governed enterprise source'}</p>
            <p>{kpiReport.forecastSourceLabel ?? 'Forecast: configured planning source'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-xl border border-teal-900/15 bg-white p-4" data-testid="kpi-report-catalog">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Report catalog</p>
              <p className="mt-1 text-sm font-medium text-slate-800">Uploaded presentation sections</p>
              <p className="mt-1 text-xs text-slate-500">
                Select a section to jump to its rendered report output.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{scopes.length} slides</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {scopes.map((scope, index) => {
              const colors = SCOPE_COLORS[index % SCOPE_COLORS.length];
              return (
                <div
                  key={`catalog-${scope.id}`}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
                >
                  <a href={`#kpi-slide-${scope.code.toLowerCase()}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                      style={{ backgroundColor: colors.soft, color: colors.text }}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        Slide {index + 1} · {scope.label}
                      </span>
                      <span className="block text-[11px] text-slate-500">{scope.code} · Rendered KPI section</span>
                    </span>
                  </a>
                  {onExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => onExport(scope.code)}
                      disabled={isExporting}
                      aria-label={`Download ${scope.label} PowerPoint`}
                    >
                      <Download className="h-3 w-3" />
                      PPT
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Business metrics</p>
            <p className="mt-1 text-sm text-slate-600">Four-entity scope from the uploaded presentation template</p>
          </div>
          <span className="text-xs text-slate-500">Scroll to review all slides</span>
        </div>

        <div className="space-y-5">
          {scopes.map((scope, index) => {
            const colors = SCOPE_COLORS[index % SCOPE_COLORS.length];
            return (
              <section
                key={scope.id}
                id={`kpi-slide-${scope.code.toLowerCase()}`}
                className="scroll-mt-4 overflow-hidden rounded-xl border border-teal-900/15 bg-white shadow-sm"
                style={{ borderTop: `4px solid ${colors.accent}` }}
                data-testid={`kpi-template-slide-${scope.code}`}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                      style={{ backgroundColor: colors.soft, color: colors.text }}
                    >
                      {scope.code}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900">{scope.label}</h3>
                      <p className="text-xs text-slate-500">
                        {scope.entity || 'Global scope'} · Slide {index + 1} of {scopes.length}
                      </p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: colors.soft, color: colors.text }}
                  >
                    Governed metrics
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {scope.metrics.map((metric) => (
                    <div
                      key={`${scope.id}-${metricKey(metric.label)}`}
                       className={reportMetricCard}
                      style={{ borderColor: `${colors.accent}33`, backgroundColor: colors.surface }}
                    >
                      <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                       <p className="mt-1 text-xl font-semibold tabular-nums text-teal-950">
                        {metricValue(metric, metric.actual)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        {metric.forecast !== undefined && (
                          <span>Forecast: {metricValue(metric, metric.forecast)}</span>
                        )}
                        {metric.variance !== undefined && metric.variance !== null && (
                          <span>Variance: {metricValue(metric, metric.variance)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
                  {scope.label} · {reportPeriod} · Source and governance metadata retained
                </div>
              </section>
            );
          })}
        </div>

        {!!kpiReport.warnings?.length && (
          <div className={`${reportWarning} text-xs`}>
            <p className="font-semibold">Warnings / data-quality notes</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {kpiReport.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}
        {onExport && showDownloadFooter && (
          <ReportDownloadFooter>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => onExport()}
              disabled={isExporting}
              data-testid="button-download-summary-ppt"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Preparing PPT…' : 'Download summary PPT'}
            </Button>
          </ReportDownloadFooter>
        )}
      </div>
    </div>
  );
}