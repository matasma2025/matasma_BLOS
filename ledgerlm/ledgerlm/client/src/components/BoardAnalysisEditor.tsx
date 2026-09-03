/**
 * BoardAnalysisEditor — Phase 2
 *
 * New in Phase 2:
 *  - Dimension picker (chip multi-select)
 *  - Live data preview card (auto-fetches when period changes)
 *  - Period comparison (toggle + second year/month picker, defaults to prior year)
 *  - Collapsible prompt editor
 */

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Sparkles, Info, ChevronDown, ChevronUp,
  TrendingUp, Database, BarChart3, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { type Board, type CubeBoardReport } from '@shared/schema';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const QUARTERS = [
  { label: 'Q1', months: [1,2,3] },
  { label: 'Q2', months: [4,5,6] },
  { label: 'Q3', months: [7,8,9] },
  { label: 'Q4', months: [10,11,12] },
];

const ALL_DIMENSIONS = [
  'Entity', 'Sector', 'Cost Category', 'Resource Type',
  'Location', 'Project GB', 'Planning GB', 'Salary Level',
];
const DEFAULT_DIMENSIONS = ['Entity', 'Sector', 'Cost Category'];

const DEFAULT_USER_PROMPT = `Perform a Budget vs Actual variance analysis for the period: {{period}}.

**Summary totals:**
- Total Actual: {{total_actual}} USD  |  Total Budget: {{total_budget}} USD
- Total Variance: {{total_variance}} ({{total_variance_pct}})
{{#comparison}}
- Comparison Period: {{comparison_period}} | Comparison Variance: {{comparison_total_variance}} | YoY Change: {{yoy_change}}
{{/comparison}}

**Variance by dimension ({{dimensions}}):**
{{variance_table}}

**Top unfavorable variance drivers:**
{{top_unfavorable}}

**Top favorable variance drivers:**
{{top_favorable}}

{{comparison_table}}

Please provide:
1. ### Executive Summary — total variance and business impact in 3 sentences.
2. ### Variance Bridge — break down contributions by dimension.
3. ### Root Cause Analysis — why did this variance occur?
4. ### Top 5 Unfavorable Drivers — each with explanation.
5. ### Recommendations — 5 specific actions to close the gap.

Format with ### headings.`;

interface PreviewData {
  actualsTotal: number;
  budgetTotal: number;
  variance: number;
  variancePct: number | null;
  rowCount: number;
  actualsVersion: string;
  budgetVersion: string;
  dimensionValues: Record<string, string[]>;
}

interface BoardAnalysisEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  onReportGenerated: (report: CubeBoardReport) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BoardAnalysisEditor({ open, onOpenChange, board, onReportGenerated }: BoardAnalysisEditorProps) {
  const { toast } = useToast();
  const settings = (board.settings as any) ?? {};
  const mapping  = settings.columnMapping ?? {};

  const currentYear = new Date().getFullYear();

  // Period state
  const [year, setYear]         = useState(currentYear);
  const [months, setMonths]     = useState<number[]>([new Date().getMonth() + 1]);

  // Dimension picker
  const [dimensions, setDimensions] = useState<string[]>(settings.defaultDimensions ?? DEFAULT_DIMENSIONS);

  // Comparison period
  const [enableComparison, setEnableComparison] = useState(false);
  const [compYear, setCompYear]   = useState(currentYear - 1);
  const [compMonths, setCompMonths] = useState<number[]>([new Date().getMonth() + 1]);

  // Prompt
  const [userPrompt, setUserPrompt] = useState(settings.userPromptTemplate ?? DEFAULT_USER_PROMPT);
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  // Extra context
  const [extraContext, setExtraContext] = useState('');

  // Sync comparison months to primary months
  useEffect(() => { setCompMonths(months); }, [months]);
  useEffect(() => { if (!open) { setExtraContext(''); setShowPromptEditor(false); } }, [open]);

  // Live data preview (debounced — only fires when cube + period are ready)
  const hasCube    = !!settings.cubeId;
  const hasMapping = !!(mapping.actuals && mapping.budget);
  const hasMonths  = months.length > 0;
  const previewKey = [settings.cubeId, mapping.actuals, mapping.budget, year, months.join(',')];

  const { data: preview, isFetching: previewLoading, isError: previewError } = useQuery<PreviewData>({
    queryKey: ['/api/boards', board.id, 'preview-data', ...previewKey],
    enabled: open && hasCube && hasMapping && hasMonths,
    queryFn: () =>
      apiRequest('GET', `/api/boards/${board.id}/preview-data?year=${year}&months=${months.join(',')}`) as Promise<PreviewData>,
    staleTime: 30_000,
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const toggleMonth = (m: number) =>
    setMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b));

  const toggleCompMonth = (m: number) =>
    setCompMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b));

  const selectQuarter = (ms: number[]) => setMonths(ms);
  const selectCompQuarter = (ms: number[]) => setCompMonths(ms);

  const toggleDimension = (d: string) =>
    setDimensions((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  // ── Run analysis mutation ────────────────────────────────────────────────────

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!settings.cubeId) throw new Error('No data cube configured. Edit the board and select a cube first.');
      if (months.length === 0) throw new Error('Please select at least one month.');
      return apiRequest('POST', `/api/boards/${board.id}/run-analysis`, {
        year,
        months,
        dimensions,
        userPromptTemplate: userPrompt,
        extraContext: extraContext || undefined,
        comparison: enableComparison && compMonths.length > 0
          ? { year: compYear, months: compMonths }
          : undefined,
      }) as Promise<CubeBoardReport>;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', board.id, 'reports'] });
      toast({ title: 'Report ready', description: `${report.periodLabel} variance analysis generated.` });
      onOpenChange(false);
      onReportGenerated(report);
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message || 'Failed to generate report', variant: 'destructive' }),
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Run Variance Analysis
          </DialogTitle>
          <DialogDescription>
            Configure the period and dimensions, then generate your AI-powered BvA report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">

          {/* ── No-cube warning ─────────────────────────────────────── */}
          {!hasCube && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                No data cube configured. <strong>Edit the board</strong> and select a cube + column mapping first.
              </p>
            </div>
          )}

          {/* ── Column mapping badge strip ──────────────────────────── */}
          {hasCube && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Column Mapping</p>
              <div className="flex flex-wrap gap-2">
                {mapping.actuals  && <Badge variant="secondary" className="text-xs gap-1"><Database className="w-3 h-3"/>actuals → {mapping.actuals}</Badge>}
                {mapping.budget   && <Badge variant="secondary" className="text-xs">budget → {mapping.budget}</Badge>}
                {mapping.forecast && <Badge variant="outline"   className="text-xs">forecast → {mapping.forecast}</Badge>}
              </div>
            </div>
          )}

          {/* ── Period picker ──────────────────────────────────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Analysis Period</Label>

            {/* Year row */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10">Year</span>
              <div className="flex gap-1">
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <button key={y} onClick={() => setYear(y)}
                    className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${year === y ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Quarter shortcuts */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground w-10">Quick</span>
              {QUARTERS.map((q) => (
                <button key={q.label} onClick={() => selectQuarter(q.months)}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${JSON.stringify(months) === JSON.stringify(q.months) ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border hover:bg-muted'}`}>
                  {q.label}
                </button>
              ))}
              <button onClick={() => setMonths([1,2,3,4,5,6,7,8,9,10,11,12])}
                className={`px-2 py-1 rounded text-xs border transition-colors ${months.length === 12 ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border hover:bg-muted'}`}>
                Full Year
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-6 gap-1">
              {MONTH_NAMES.map((name, i) => {
                const m = i + 1;
                return (
                  <button key={m} onClick={() => toggleMonth(m)}
                    className={`py-1.5 rounded text-xs font-medium border transition-colors ${months.includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {months.length === 0 ? 'none' : months.map((m) => MONTH_NAMES[m - 1]).join(', ')} {year}
            </p>
          </div>

          {/* ── Live data preview ──────────────────────────────────── */}
          {hasCube && hasMapping && (
            <div className={`rounded-lg border p-3 transition-colors ${
              previewLoading ? 'bg-muted/20' :
              previewError   ? 'border-red-200 bg-red-50' :
              preview && preview.rowCount === 0 ? 'border-amber-200 bg-amber-50' :
              preview ? 'border-green-200 bg-green-50' : 'bg-muted/20'
            }`}>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking data availability…
                </div>
              ) : previewError ? (
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  Could not load data preview. Check cube configuration.
                </div>
              ) : preview ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {preview.rowCount === 0
                      ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                      : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    <span className={`text-sm font-medium ${preview.rowCount === 0 ? 'text-amber-700' : 'text-green-700'}`}>
                      {preview.rowCount === 0 ? 'No data found for this period' : `${preview.rowCount.toLocaleString()} rows found`}
                    </span>
                  </div>
                  {preview.rowCount > 0 && (
                    <>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="text-green-800">Actuals: <strong>${(preview.actualsTotal / 1_000_000).toFixed(1)}M</strong></span>
                        <span className="text-blue-800">Budget: <strong>${(preview.budgetTotal / 1_000_000).toFixed(1)}M</strong></span>
                        <span className={preview.variance > 0 ? 'text-red-700' : 'text-green-700'}>
                          Variance: <strong>{preview.variance >= 0 ? '+' : ''}{(preview.variance / 1_000_000).toFixed(1)}M
                          {preview.variancePct !== null ? ` (${preview.variancePct >= 0 ? '+' : ''}${preview.variancePct.toFixed(1)}%)` : ''}</strong>
                        </span>
                      </div>
                      {/* Dimension value chips */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(preview.dimensionValues)
                          .filter(([, vals]) => vals.length > 0)
                          .map(([dim, vals]) => (
                            <span key={dim} className="text-xs bg-white/70 border rounded px-1.5 py-0.5 text-gray-600">
                              {dim}: {vals.slice(0, 3).join(', ')}{vals.length > 3 ? ` +${vals.length - 3}` : ''}
                            </span>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Select a period to preview data availability.</div>
              )}
            </div>
          )}

          {/* ── Dimension picker ───────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                Group Variance By
              </Label>
              <div className="flex gap-2">
                <button onClick={() => setDimensions(DEFAULT_DIMENSIONS)} className="text-xs text-muted-foreground hover:text-foreground">Default</button>
                <button onClick={() => setDimensions(ALL_DIMENSIONS)} className="text-xs text-muted-foreground hover:text-foreground">All</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DIMENSIONS.map((d) => {
                const selected = dimensions.includes(d);
                const vals = preview?.dimensionValues[d];
                return (
                  <button key={d} onClick={() => toggleDimension(d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                    }`}>
                    {d}{vals && vals.length > 0 ? ` (${vals.length})` : ''}
                  </button>
                );
              })}
            </div>
            {dimensions.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one dimension.</p>
            )}
          </div>

          {/* ── Comparison period ──────────────────────────────────── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Period Comparison</Label>
                <Badge variant="outline" className="text-xs">YoY / QoQ</Badge>
              </div>
              <Switch checked={enableComparison} onCheckedChange={setEnableComparison} />
            </div>
            {enableComparison && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Compare <strong>{months.map(m => MONTH_NAMES[m-1]).join(', ')} {year}</strong> against:
                </p>
                {/* Comp year */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">Year</span>
                  <div className="flex gap-1">
                    {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                      <button key={y} onClick={() => setCompYear(y)}
                        className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${compYear === y ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Comp quarter shortcuts */}
                <div className="flex gap-1 flex-wrap">
                  {QUARTERS.map((q) => (
                    <button key={q.label} onClick={() => selectCompQuarter(q.months)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${JSON.stringify(compMonths) === JSON.stringify(q.months) ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border hover:bg-muted'}`}>
                      {q.label}
                    </button>
                  ))}
                </div>
                {/* Comp month grid */}
                <div className="grid grid-cols-6 gap-1">
                  {MONTH_NAMES.map((name, i) => {
                    const m = i + 1;
                    return (
                      <button key={m} onClick={() => toggleCompMonth(m)}
                        className={`py-1 rounded text-xs font-medium border transition-colors ${compMonths.includes(m) ? 'bg-primary/80 text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                        {name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comparing against: <strong>{compMonths.map(m => MONTH_NAMES[m-1]).join(', ')} {compYear}</strong>
                </p>
              </div>
            )}
          </div>

          {/* ── Prompt editor (collapsible) ────────────────────────── */}
          <div className="space-y-2">
            <button onClick={() => setShowPromptEditor(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full">
              {showPromptEditor ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
              Analysis Prompt Template
              <span className="text-xs text-muted-foreground font-normal">(click to {showPromptEditor ? 'hide' : 'edit'})</span>
            </button>
            {showPromptEditor && (
              <div className="space-y-2">
                <Textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} rows={12}
                  className="font-mono text-xs" />
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {['{{period}}','{{variance_table}}','{{total_variance}}','{{comparison_table}}',
                      '{{top_unfavorable}}','{{dimensions}}'].map((ph) => (
                      <code key={ph} className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/10"
                        onClick={() => setUserPrompt((p: string) => p + ph)}>
                        {ph}
                      </code>
                    ))}
                  </div>
                  <button onClick={() => setUserPrompt(DEFAULT_USER_PROMPT)}
                    className="text-xs text-muted-foreground hover:text-foreground">Reset</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Extra context ──────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Extra Context <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea value={extraContext} onChange={(e) => setExtraContext(e.target.value)} rows={2}
              placeholder="e.g. Focus on BGSW entity. Ignore VKM resources. Note: March had a one-time adjustment." />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={runMutation.isPending}>Cancel</Button>
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || !hasCube || months.length === 0 || dimensions.length === 0}
            className="gap-2">
            {runMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin"/>Generating…</>
              : <><Sparkles className="w-4 h-4"/>Generate Report</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
