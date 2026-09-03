/**
 * BoardReport — Phase 2
 *
 * New in Phase 2:
 *  - 6 quick-intent follow-up buttons (open linked board thread chats)
 *  - Export PDF (print-based)
 *  - Export CSV (client-side from varianceData JSON)
 *  - Comparison period badge
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trash2, Calendar, Database, ChevronDown, ChevronUp,
  Download, FileSpreadsheet, Printer, TrendingUp, Loader2,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { type CubeBoardReport } from '@shared/schema';

// ── Intent definitions ────────────────────────────────────────────────────────

const INTENTS = [
  { id: 'drill_top_driver', icon: '🔍', label: 'Drill into top driver' },
  { id: 'root_causes',      icon: '💡', label: 'Root causes'          },
  { id: 'cfo_brief',        icon: '📊', label: 'CFO brief'            },
  { id: 'action_plan',      icon: '🎯', label: 'Action plan'          },
  { id: 'trend_outlook',    icon: '📈', label: 'Trend & outlook'      },
  { id: 'entity_drill',     icon: '🏢', label: 'Entity breakdown'     },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface VRow { k: string; a: number; b: number; v: number; vp: number | null; f: boolean; ca?: number; cb?: number; cv?: number; yoy?: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function varRowsToCsv(rows: VRow[], periodLabel: string, compLabel?: string | null): string {
  const fmt = (n: number) => n.toFixed(2);
  const hasComp = rows.some((r) => r.ca !== undefined);

  const headers = hasComp
    ? ['Dimension','Actual','Budget','Variance','Variance%','Favorable',
       `Comp Actual (${compLabel ?? 'Prior'})`,`Comp Budget`,`Comp Variance`,`YoY Change`]
    : ['Dimension','Actual','Budget','Variance','Variance%','Favorable'];

  const dataRows = rows.map((r) => {
    const base = [
      `"${r.k}"`, fmt(r.a), fmt(r.b), fmt(r.v),
      r.vp !== null ? r.vp.toFixed(2) : '',
      r.f ? 'Yes' : 'No',
    ];
    if (hasComp) base.push(
      fmt(r.ca ?? 0), fmt(r.cb ?? 0), fmt(r.cv ?? 0),
      r.yoy !== undefined ? fmt(r.yoy) : '',
    );
    return base.join(',');
  });

  return [`"LedgerLM Variance Report — ${periodLabel}"`, headers.join(','), ...dataRows].join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printReport(title: string, content: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #111; }
      h1 { font-size: 1.4rem; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 24px; }
      h3 { font-size: 1rem; margin: 24px 0 8px; color: #1d4ed8; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 0.85rem; }
      th { background: #f1f5f9; padding: 6px 10px; text-align: left; border: 1px solid #e2e8f0; }
      td { padding: 5px 10px; border: 1px solid #e2e8f0; }
      tr:nth-child(even) { background: #f8fafc; }
      p, li { font-size: 0.9rem; line-height: 1.6; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; }
      .meta { font-size: 0.75rem; color: #64748b; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <div class="header">
      <h1>${title}</h1>
      <div class="meta">LedgerLM · ${new Date().toLocaleDateString()}</div>
    </div>
    <div id="content"></div>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
    <script>
      document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
      window.onload = () => { window.print(); };
    <\/script>
  </body></html>`);
  win.document.close();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BoardReportProps {
  report: CubeBoardReport;
  boardId: string;
}

export function BoardReport({ report, boardId }: BoardReportProps) {
  const { toast }    = useToast();
  const [, navigate] = useLocation();
  const [expanded, setExpanded]     = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);

  const mapping    = report.columnMapping as any ?? {};
  const varData    = report.varianceData  as VRow[] | null;
  const compLabel  = report.comparisonPeriodLabel ?? null;

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/boards/${boardId}/reports/${report.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'reports'] });
      toast({ title: 'Report deleted' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete report', variant: 'destructive' }),
  });

  // ── Follow-up intent ─────────────────────────────────────────────────────

  const followUpMutation = useMutation({
    mutationFn: async (intent: string) => {
      setPendingIntent(intent);
      return apiRequest('POST', `/api/boards/${boardId}/reports/${report.id}/follow-up`, { intent }) as Promise<{ chatId: string }>;
    },
    onSuccess: ({ chatId }) => {
      setPendingIntent(null);
      navigate(`/chat/${chatId}`);
    },
    onError: () => {
      setPendingIntent(null);
      toast({ title: 'Error', description: 'Could not create follow-up chat', variant: 'destructive' });
    },
  });

  // ── Export helpers ───────────────────────────────────────────────────────

  const handleExportCsv = () => {
    if (!varData?.length) { toast({ title: 'No variance data available for export' }); return; }
    const csv  = varRowsToCsv(varData, report.periodLabel, compLabel);
    const name = `LedgerLM_${report.periodLabel.replace(/\s/g, '_')}_Variance.csv`;
    downloadCsv(csv, name);
  };

  const handlePrint = () => {
    if (!report.rawAnalysis) return;
    printReport(report.title, report.rawAnalysis);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Card className="overflow-hidden border-border">
      {/* Header */}
      <div className="px-5 py-4 bg-primary/5 border-b flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{report.title}</h3>
            <Badge variant="secondary" className="text-xs gap-1">
              <Calendar className="w-3 h-3"/>{report.periodLabel}
            </Badge>
            {compLabel && (
              <Badge variant="outline" className="text-xs gap-1 text-blue-700 border-blue-200 bg-blue-50">
                <TrendingUp className="w-3 h-3"/>vs {compLabel}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {mapping.actuals && (
              <Badge variant="outline" className="text-xs gap-1">
                <Database className="w-3 h-3"/>actuals: {mapping.actuals}
              </Badge>
            )}
            {mapping.budget && <Badge variant="outline" className="text-xs">budget: {mapping.budget}</Badge>}
            <span className="text-xs text-muted-foreground">
              {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            <Trash2 className="w-4 h-4"/>
          </Button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-5 py-4 space-y-4">

          {/* Markdown analysis */}
          {report.rawAnalysis ? (
            <div className="prose prose-sm max-w-none
              prose-headings:font-semibold prose-headings:text-foreground
              prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
              prose-p:text-sm prose-p:leading-relaxed
              prose-li:text-sm prose-strong:text-foreground
              prose-table:text-sm prose-th:bg-muted prose-th:px-3 prose-th:py-2
              prose-td:px-3 prose-td:py-1.5 prose-tr:border-b">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.rawAnalysis}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No analysis content.</p>
          )}

          {/* ── Quick-intent follow-up buttons ───────────────────── */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Drill Deeper</p>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((intent) => (
                <Button key={intent.id} variant="outline" size="sm"
                  className="text-xs h-8 gap-1.5"
                  disabled={followUpMutation.isPending}
                  onClick={() => followUpMutation.mutate(intent.id)}>
                  {pendingIntent === intent.id
                    ? <Loader2 className="w-3 h-3 animate-spin"/>
                    : <span>{intent.icon}</span>}
                  {intent.label}
                </Button>
              ))}
            </div>
          </div>

          {/* ── Export row ─────────────────────────────────────── */}
          <div className="border-t pt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5"/>Export PDF
              </Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8" onClick={handleExportCsv}
                disabled={!varData?.length}>
                <FileSpreadsheet className="w-3.5 h-3.5"/>Export CSV
              </Button>
            </div>
            <button onClick={() => setShowPrompt((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {showPrompt ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
              {showPrompt ? 'Hide' : 'Show'} resolved prompt
            </button>
          </div>

          {/* Resolved prompt (collapsible) */}
          {showPrompt && report.userPromptFinal && (
            <pre className="p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60">
              {report.userPromptFinal}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}
