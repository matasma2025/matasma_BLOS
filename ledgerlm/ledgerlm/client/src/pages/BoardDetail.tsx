import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Loader2, MessageSquare, FolderPlus, ShieldCheck,
  Sparkles, Database, BarChart3, FileText, ChevronRight, Clock3, History, SlidersHorizontal,
} from 'lucide-react';
import { type Board, type Chat, type CubeBoardReport } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { fetchApiFile } from '@/lib/apiFiles';
import { useToast } from '@/hooks/use-toast';
import { BoardEditorDialog } from '@/components/BoardEditorDialog';
import { StandaloneBoardAnalysisDialog } from '@/components/StandaloneBoardAnalysisDialog';
import { BoardReport } from '@/components/BoardReport';
import { BoardSourceSelector } from '@/components/BoardSourceSelector';
import { KpiTemplateReport, type KpiTemplateData } from '@/components/KpiTemplateReport';

type TabId = 'reports' | 'threads';

interface GenericRun {
  id: string;
  status: string;
  progressPercent: number;
  progressStage?: string | null;
  errorMessage?: string | null;
}

interface GenericReport {
  id: string;
  title: string;
  periodLabel?: string | null;
  result?: {
    summary?: string;
    insights?: string[];
    tables?: Array<{ title?: string; columns: string[]; rows: unknown[][] }>;
    kpiReport?: KpiTemplateData;
  };
  sourceSnapshot?: { name?: string; sourceType?: string };
  deterministicMetrics?: {
    measures?: Array<{ measureId: string; actual: number; budget: number; variance: number; variancePct: number | null; favorable: boolean | null }>;
    contributors?: Array<{ key: string; measures: Array<{ measureId: string; actual: number; variance: number; contribution: number | null }> }>;
    evidence?: Array<{ sourceType: string; sourceId: string; period: string }>;
  };
  kpiReport?: KpiTemplateData;
  createdAt: string | Date;
  status?: string;
}

const REPORT_HISTORY_PAGE_SIZE = 5;

function reportKpiData(report: GenericReport) {
  return report.kpiReport ?? report.result?.kpiReport;
}

function reportEntity(report: GenericReport) {
  const scopes = reportKpiData(report)?.scopeBadges ?? [];
  return scopes.length === 1 ? scopes[0].label : scopes.length > 1 ? 'Multiple entities' : 'All entities';
}

export default function BoardDetail() {
  const { id: boardId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAnalysisEditorOpen, setIsAnalysisEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('reports');
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [legacyReportsInitialized, setLegacyReportsInitialized] = useState(false);
  const [activeGenericReportId, setActiveGenericReportId] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(REPORT_HISTORY_PAGE_SIZE);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [scenarioFilter, setScenarioFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [finishedRunId, setFinishedRunId] = useState<string | null>(null);

  const { data: recentRuns = [] } = useQuery<GenericRun[]>({
    queryKey: ['/api/boards', boardId, 'analysis-runs'],
    queryFn: () => apiRequest('GET', `/api/boards/${boardId}/analysis-runs`) as Promise<GenericRun[]>,
    enabled: !!boardId,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!activeRunId && !finishedRunId) {
      const resumable = recentRuns.find((run) => ['queued', 'running', 'cancel_requested'].includes(run.status));
      if (resumable) setActiveRunId(resumable.id);
    }
  }, [activeRunId, finishedRunId, recentRuns]);

  const { data: board, isLoading: boardLoading } = useQuery<Board>({
    queryKey: ['/api/boards', boardId],
    enabled: !!boardId,
  });

  const { data: boardThreads = [], isLoading: threadsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/boards', boardId, 'threads'],
    enabled: !!boardId,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<CubeBoardReport[]>({
    queryKey: ['/api/boards', boardId, 'reports'],
    enabled: !!boardId,
    queryFn: () => apiRequest('GET', `/api/boards/${boardId}/reports`) as Promise<CubeBoardReport[]>,
  });

  const {
    data: genericReports = [],
    isLoading: genericReportsLoading,
    refetch: refetchGenericReports,
  } = useQuery<GenericReport[]>({
    queryKey: ['/api/boards', boardId, 'reports', 'search'],
    queryFn: () => apiRequest('GET', `/api/boards/${boardId}/reports/search`) as Promise<GenericReport[]>,
    enabled: !!boardId,
  });

  useEffect(() => {
    if (!genericReports.length) {
      setActiveGenericReportId(null);
      return;
    }
    if (!activeGenericReportId || !genericReports.some((report) => report.id === activeGenericReportId)) {
      setActiveGenericReportId(genericReports[0].id);
    }
  }, [activeGenericReportId, genericReports]);

  useEffect(() => {
    if (!reports.length) {
      setOpenReportId(null);
      setLegacyReportsInitialized(false);
      return;
    }
    if (!legacyReportsInitialized) {
      setOpenReportId(reports[0].id);
      setLegacyReportsInitialized(true);
      return;
    }
    if (openReportId && !reports.some((report) => report.id === openReportId)) {
      setOpenReportId(reports[0].id);
    }
  }, [legacyReportsInitialized, openReportId, reports]);

  useEffect(() => {
    setHistoryLimit(REPORT_HISTORY_PAGE_SIZE);
  }, [periodFilter, scenarioFilter, entityFilter, statusFilter]);

  const activeGenericReport = useMemo(
    () => genericReports.find((report) => report.id === activeGenericReportId) ?? genericReports[0],
    [activeGenericReportId, genericReports],
  );
  const periodOptions = useMemo(
    () => Array.from(new Set(genericReports.map((report) => report.periodLabel).filter((value): value is string => !!value))),
    [genericReports],
  );
  const scenarioOptions = useMemo(
    () => Array.from(new Set(genericReports.map((report) => reportKpiData(report)?.forecastScenario).filter((value): value is string => !!value))),
    [genericReports],
  );
  const entityOptions = useMemo(
    () => Array.from(new Set(genericReports.map(reportEntity))),
    [genericReports],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(genericReports.map((report) => report.status ?? 'complete'))),
    [genericReports],
  );
  const filteredHistory = useMemo(
    () => genericReports.filter((report) => {
      if (report.id === activeGenericReport?.id) return false;
      const kpiReport = reportKpiData(report);
      return (periodFilter === 'all' || report.periodLabel === periodFilter)
        && (scenarioFilter === 'all' || kpiReport?.forecastScenario === scenarioFilter)
        && (entityFilter === 'all' || reportEntity(report) === entityFilter)
        && (statusFilter === 'all' || (report.status ?? 'complete') === statusFilter);
    }),
    [activeGenericReport?.id, entityFilter, genericReports, periodFilter, scenarioFilter, statusFilter],
  );

  const { data: activeRun } = useQuery<GenericRun>({
    queryKey: ['/api/boards', boardId, 'analysis-runs', activeRunId],
    queryFn: () => apiRequest('GET', `/api/boards/${boardId}/analysis-runs/${activeRunId}`) as Promise<GenericRun>,
    enabled: !!boardId && !!activeRunId,
    refetchInterval: activeRunId ? 1500 : false,
  });

  useEffect(() => {
    if (!activeRun) return;
    if (['complete', 'error', 'cancelled'].includes(activeRun.status)) {
      if (activeRun.status === 'complete') {
        queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'reports', 'search'] });
        void refetchGenericReports().then(({ data }) => {
          if (data?.[0]) setActiveGenericReportId(data[0].id);
        });
        toast({ title: 'Governed report ready', description: activeRun.progressStage || 'Analysis complete.' });
      } else if (activeRun.status === 'error') {
        toast({ title: 'Analysis failed', description: activeRun.errorMessage || 'The report could not be generated.', variant: 'destructive' });
      }
      setFinishedRunId(activeRun.id);
      setActiveRunId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'analysis-runs'] });
    }
  }, [activeRun, boardId, refetchGenericReports, toast]);

  const governedRunMutation = useMutation({
    mutationFn: () => {
      const settings = board.settings as any ?? {};
      const config = settings.analysisConfig ?? {};
      return apiRequest('POST', `/api/boards/${board.id}/analysis-runs`, {
        year: config.year ?? new Date().getFullYear(),
        months: config.months?.length ? config.months : [new Date().getMonth() + 1],
        dimensions: config.dimensions ?? settings.defaultDimensions ?? ['Entity', 'Sector', 'Cost Category'],
        keyColumns: config.keyColumns ?? settings.keyColumns ?? undefined,
        excludedColumns: config.excludedColumns ?? undefined,
        comparison: config.comparison ?? undefined,
      }) as Promise<GenericRun>;
    },
    onSuccess: (run) => {
      setFinishedRunId(null);
      setActiveRunId(run.id);
    },
    onError: (error: Error) => toast({ title: 'Could not start analysis', description: error.message, variant: 'destructive' }),
  });

  const cancelRunMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/boards/${board.id}/analysis-runs/${activeRunId}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/boards', board.id, 'analysis-runs', activeRunId] }),
    onError: (error: Error) => toast({ title: 'Could not cancel analysis', description: error.message, variant: 'destructive' }),
  });

  const exportMutation = useMutation({
    mutationFn: (input: { reportId: string; format: 'csv' | 'xlsx' | 'pptx'; scopeCode?: string }) =>
      apiRequest('POST', `/api/boards/${board.id}/reports/${input.reportId}/exports`, {
        format: input.format,
        ...(input.scopeCode ? { scopeCode: input.scopeCode } : {}),
      }) as Promise<{ downloadUrl: string }>,
    onSuccess: async ({ downloadUrl }, input) => {
      try {
        await fetchApiFile(downloadUrl, {
          filename: `board-${board.id}${input.scopeCode ? `-${input.scopeCode}` : '-summary'}.${input.format}`,
        });
      } catch (error) {
        toast({
          title: 'Download unavailable',
          description: error instanceof Error ? error.message : 'The exported file could not be downloaded.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => toast({ title: 'Export unavailable', description: error.message, variant: 'destructive' }),
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!board) throw new Error('Board not found');
      const boardSettings = board.settings as any;
      const chatResponse = await apiRequest('POST', '/api/chats', {
        title: `${board.title} — Analysis`,
        templateMessage: boardSettings?.analysisPrompts || `Let's analyse using ${board.title}`,
      }) as Chat;
      await apiRequest('POST', `/api/boards/${board.id}/threads`, { chatId: chatResponse.id });
      return chatResponse;
    },
    onSuccess: (data: Chat) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'threads'] });
      navigate(`/chat/${data.id}`);
    },
    onError: () =>
      toast({ title: 'Error', description: 'Failed to create analysis chat', variant: 'destructive' }),
  });

  const handleRunStarted = (run: { id: string }) => {
    setActiveRunId(run.id);
    setActiveTab('reports');
    queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'reports', 'search'] });
  };

  if (boardLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading board…</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-muted-foreground" data-testid="text-board-not-found">Board not found</div>
        <Button onClick={() => navigate('/boards')} data-testid="button-back-not-found">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Boards
        </Button>
      </div>
    );
  }

  const boardSettings = board.settings as any ?? {};
  const boardTemplateKey = boardSettings.templateKey ?? '';
  const hasCube = !!boardSettings.cubeId;
  const mapping = boardSettings.columnMapping ?? {};
  const isStandaloneBoard = boardTemplateKey !== 'variance-analysis' || !mapping.actuals || !mapping.budget;
  const reportTemplate = typeof boardSettings.boardFlow?.reportTemplate === 'string'
    ? boardSettings.boardFlow.reportTemplate
    : '';
  const templateSource = reportTemplate.match(/^# Source:\s*(.+)$/m)?.[1]?.trim();

  return (
    <div className="h-full flex-1 bg-muted/20 p-4 lg:p-6 overflow-hidden">
      <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/boards')} data-testid="button-back-boards">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-board-title">
              {board.title}
            </h1>
            {hasCube && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Database className="w-3 h-3" />
                Cube linked
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)} data-testid="button-edit-board">
              Edit Board
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setIsAnalysisEditorOpen(true)}
              disabled={governedRunMutation.isPending || !!activeRunId}
              data-testid="button-run-analysis"
            >
              {governedRunMutation.isPending || activeRunId ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{activeRun?.progressStage || 'Running…'}</>
              ) : (
                <><Sparkles className="w-4 h-4" />Run Analysis</>
              )}
            </Button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
          {/* Meta section */}
          <div className="space-y-4">
            <BoardSourceSelector boardId={board.id} />
             {!hasCube && !isStandaloneBoard && (
              <Card className="p-4 border-amber-200 bg-amber-50">
                <div className="flex items-start gap-2 text-sm text-amber-800">
                  <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                   <p>Select an authorized source in the source selector or connect a data source in <strong>Edit Board</strong> before running this Board.</p>
                </div>
              </Card>
            )}
            {activeRun && activeRunId && (
              <Card className="p-4 border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{activeRun.progressStage || 'Preparing analysis…'}</span>
                  <span className="text-muted-foreground">{activeRun.progressPercent ?? 0}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${activeRun.progressPercent ?? 0}%` }} />
                </div>
                {['queued', 'running', 'cancel_requested'].includes(activeRun.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => cancelRunMutation.mutate()}
                    disabled={cancelRunMutation.isPending}
                    aria-label="Cancel governed analysis"
                  >
                    {cancelRunMutation.isPending ? 'Cancelling…' : 'Cancel analysis'}
                  </Button>
                )}
              </Card>
            )}
            {board.description && (
              <div className="space-y-1">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide" data-testid="text-description-label">Description</h2>
                <p className="text-sm" data-testid="text-board-description">{board.description}</p>
              </div>
            )}

             {/* Standalone configuration summary */}
             {isStandaloneBoard && (
               <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                 <div className="flex items-center gap-2">
                   <Database className="w-4 h-4 text-primary" />
                   <span className="text-sm font-medium">Standalone Board configuration</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   <Badge variant="secondary" className="text-xs">{boardTemplateKey === 'kpi-metrics' ? 'KPI Metrics' : boardTemplateKey === 'entity-pnl' ? 'Entity P&L' : 'Balance Sheet'}</Badge>
                   {boardSettings.boardFlow?.scope?.version && <Badge variant="outline" className="text-xs">Version · {boardSettings.boardFlow.scope.version}</Badge>}
                   {boardSettings.boardFlow?.scope?.entity && <Badge variant="outline" className="text-xs">Entity · {boardSettings.boardFlow.scope.entity}</Badge>}
                 </div>
                 <p className="text-xs text-muted-foreground">
                   Runs use the selected authorized source and configured period. Actuals and Budget mappings are not required.
                 </p>
               </div>
             )}

             {/* Legacy compatibility summary */}
             {!isStandaloneBoard && hasCube && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Smart Analysis — Column Mapping</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapping.actuals && (
                    <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">actuals → {mapping.actuals}</Badge>
                  )}
                  {mapping.budget && (
                    <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">budget → {mapping.budget}</Badge>
                  )}
                  {mapping.forecast && (
                    <Badge className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-100">forecast → {mapping.forecast}</Badge>
                  )}
                  {(mapping.rollingForecasts ?? []).map((rf: string) => (
                    <Badge key={rf} variant="outline" className="text-xs">{rf}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                   Click <strong>Run Analysis</strong> to generate the configured Board report.
                </p>
              </div>
            )}

            {boardSettings?.dataSources && (
              <div className="flex flex-wrap gap-2" data-testid="container-data-sources">
                {boardSettings.dataSources.enterprise && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-enterprise">Enterprise Data</Badge>
                )}
                {boardSettings.dataSources.vault && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-vault">Vault Documents</Badge>
                )}
                {boardSettings.dataSources.webApis && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-web">Web APIs</Badge>
                )}
                {boardSettings.dataSources.financialApis && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-financial">Financial APIs</Badge>
                )}
              </div>
            )}
          </div>

          {/* ── Tabs ───────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex border-b gap-1">
              {([
                { id: 'reports' as TabId,  label: 'Reports',          icon: BarChart3,    count: genericReports.length + (isStandaloneBoard ? 0 : reports.length) },
                { id: 'threads' as TabId,  label: 'Analysis Threads', icon: MessageSquare, count: boardThreads.length },
              ] as { id: TabId; label: string; icon: any; count: number }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Reports tab */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                {activeGenericReport && (() => {
                  const report = activeGenericReport;
                  const kpiReport = reportKpiData(report);
                  return (
                    <section className="space-y-2" aria-labelledby="active-report-heading">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active report</p>
                          <h2 id="active-report-heading" className="sr-only">Active report</h2>
                        </div>
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Clock3 className="h-3 w-3" />
                          {new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </Badge>
                      </div>
                      <Card className="p-5 space-y-3 border-primary/20 shadow-sm" data-testid={`card-governed-report-${report.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{report.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {report.sourceSnapshot?.sourceType === 'enterprise' ? 'Enterprise Data' : 'Vault'}
                              {report.sourceSnapshot?.name ? ` · ${report.sourceSnapshot.name}` : ''}
                              {report.periodLabel ? ` · ${report.periodLabel}` : ''}
                              {kpiReport?.forecastScenario ? ` · ${kpiReport.forecastScenario}` : ''}
                            </p>
                          </div>
                          <Badge variant="secondary">Governed</Badge>
                        </div>
                        {!isStandaloneBoard && report.deterministicMetrics?.measures?.length ? (
                          <div className="space-y-2" aria-label="Verified deterministic metrics">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Verified metrics</p>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => exportMutation.mutate({ reportId: report.id, format: 'csv' })} disabled={exportMutation.isPending}>CSV</Button>
                                <Button variant="outline" size="sm" onClick={() => exportMutation.mutate({ reportId: report.id, format: 'xlsx' })} disabled={exportMutation.isPending}>XLSX</Button>
                              </div>
                           </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead><tr>{['Measure', 'Actual', 'Budget', 'Variance', 'Variance %', 'Favorability'].map((column) => <th key={column} className="border px-2 py-1 text-left bg-muted">{column}</th>)}</tr></thead>
                                <tbody>{report.deterministicMetrics.measures.map((measure) => (
                                  <tr key={measure.measureId}>
                                    <td className="border px-2 py-1 font-medium">{measure.measureId}</td>
                                    <td className="border px-2 py-1">{measure.actual}</td>
                                    <td className="border px-2 py-1">{measure.budget}</td>
                                    <td className="border px-2 py-1">{measure.variance}</td>
                                    <td className="border px-2 py-1">{measure.variancePct ?? '—'}</td>
                                    <td className="border px-2 py-1">{measure.favorable === null ? 'Neutral' : measure.favorable ? 'Favorable' : 'Unfavorable'}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Calculated by the governed deterministic engine. AI narrative below is explanatory only.</p>
                         </div>
                        ) : null}
                        {isStandaloneBoard && kpiReport?.metrics?.length ? (
                          <KpiTemplateReport
                            title={report.title}
                            periodLabel={report.periodLabel}
                            sourceName={report.sourceSnapshot?.name}
                            templateSource={templateSource}
                            kpiReport={kpiReport}
                            onExport={(scopeCode) => exportMutation.mutate({ reportId: report.id, format: 'pptx', scopeCode })}
                            isExporting={exportMutation.isPending}
                          />
                        ) : null}
                        {report.result?.summary && <p className="text-sm whitespace-pre-wrap">{report.result.summary}</p>}
                        {!!report.result?.insights?.length && (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            {report.result.insights.slice(0, 5).map((insight) => <li key={insight}>{insight}</li>)}
                          </ul>
                        )}
                        {report.result?.tables?.[0] && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead><tr>{report.result.tables[0].columns.map((column) => <th key={column} className="border px-2 py-1 text-left bg-muted">{column}</th>)}</tr></thead>
                              <tbody>{report.result.tables[0].rows.slice(0, 10).map((row, index) => <tr key={index}>{row.map((value, cellIndex) => <td key={cellIndex} className="border px-2 py-1">{String(value ?? '')}</td>)}</tr>)}</tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    </section>
                  );
                })()}

                {genericReports.length > 1 && (
                  <Card className="overflow-hidden" data-testid="section-report-history">
                    <div className="border-b bg-muted/20 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-primary" />
                          <div>
                            <h3 className="text-sm font-semibold">Report history</h3>
                            <p className="text-xs text-muted-foreground">{filteredHistory.length} matching report{filteredHistory.length === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          Filter history
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <Select value={periodFilter} onValueChange={setPeriodFilter}>
                          <SelectTrigger className="h-8 text-xs" data-testid="select-report-period"><SelectValue placeholder="All periods" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All periods</SelectItem>{periodOptions.map((period) => <SelectItem key={period} value={period}>{period}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
                          <SelectTrigger className="h-8 text-xs" data-testid="select-report-scenario"><SelectValue placeholder="All scenarios" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All scenarios</SelectItem>{scenarioOptions.map((scenario) => <SelectItem key={scenario} value={scenario}>{scenario}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                          <SelectTrigger className="h-8 text-xs" data-testid="select-report-entity"><SelectValue placeholder="All entities" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All entities</SelectItem>{entityOptions.map((entity) => <SelectItem key={entity} value={entity}>{entity}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-8 text-xs" data-testid="select-report-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All statuses</SelectItem>{statusOptions.map((status) => <SelectItem key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="divide-y">
                      {filteredHistory.slice(0, historyLimit).map((report) => {
                        const kpiReport = reportKpiData(report);
                        return (
                          <button
                            key={report.id}
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                            onClick={() => setActiveGenericReportId(report.id)}
                            data-testid={`button-view-report-${report.id}`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium">{report.title}</span>
                                <Badge variant="outline" className="h-5 text-[10px]">{report.status ?? 'complete'}</Badge>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {report.periodLabel || 'No period'}
                                {kpiReport?.forecastScenario ? ` · ${kpiReport.forecastScenario}` : ''}
                                {` · ${reportEntity(report)}`}
                                {` · ${new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-primary">View</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        );
                      })}
                      {!filteredHistory.length && (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="text-empty-report-history">
                          No reports match these filters.
                        </div>
                      )}
                    </div>

                    {historyLimit < filteredHistory.length && (
                      <div className="border-t bg-muted/10 p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryLimit((limit) => limit + REPORT_HISTORY_PAGE_SIZE)}
                          data-testid="button-load-more-reports"
                        >
                          Load more
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
                {(genericReportsLoading || (!isStandaloneBoard && reportsLoading))
                  && genericReports.length === 0
                  && (isStandaloneBoard || reports.length === 0) && (
                  <div className="text-center py-10 text-muted-foreground">Loading reports…</div>
                )}
                {!genericReportsLoading
                  && (isStandaloneBoard || !reportsLoading)
                  && genericReports.length === 0
                  && (isStandaloneBoard || reports.length === 0) && (
                  <Card className="p-12 text-center border-dashed">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                       {isStandaloneBoard
                         ? 'Click "Run Analysis" to generate a report using this Board’s template, source, and configured scope.'
                         : hasCube
                           ? 'Click "Run Analysis" to generate the configured Board report from your source data.'
                           : 'Edit this board and connect an authorized source to enable analysis reports.'}
                    </p>
                     {isStandaloneBoard || hasCube ? (
                      <Button onClick={() => setIsAnalysisEditorOpen(true)} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Run First Analysis
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                        <Database className="w-4 h-4 mr-2" />
                        Connect Cube
                      </Button>
                    )}
                  </Card>
                )}
                {!isStandaloneBoard && reports.length > 0 && (
                  <div className="space-y-4">
                     {reports.map((report) => (
                       <div key={report.id}>
                        <BoardReport
                          report={{ ...report, id: report.id } as CubeBoardReport}
                          boardId={boardId!}
                           expanded={openReportId === report.id}
                           onExpandedChange={(expanded) => setOpenReportId(expanded ? report.id : null)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Threads tab */}
            {activeTab === 'threads' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => createChatMutation.mutate()} disabled={createChatMutation.isPending}>
                    {createChatMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                    ) : (
                      <><MessageSquare className="w-4 h-4 mr-2" />New Chat</>
                    )}
                  </Button>
                </div>

                {threadsLoading ? (
                  <div className="text-center py-10 text-muted-foreground" data-testid="text-loading-threads">
                    Loading analysis threads…
                  </div>
                ) : boardThreads.length === 0 ? (
                  <Card className="p-12 text-center" data-testid="card-empty-threads">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <FolderPlus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">No analysis threads yet</h3>
                    <p className="text-sm text-muted-foreground mb-4" data-testid="text-empty-description">
                      Start a conversation-based analysis with this board's configuration
                    </p>
                    <Button onClick={() => createChatMutation.mutate()} disabled={createChatMutation.isPending} data-testid="button-start-first-analysis">
                      {createChatMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                      ) : (
                        <><MessageSquare className="w-4 h-4 mr-2" />Start Analysis</>
                      )}
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {boardThreads.map((chat) => (
                      <Card
                        key={chat.id}
                        className="p-5 space-y-3 hover:shadow-md cursor-pointer transition-shadow"
                        onClick={() => navigate(`/chat/${chat.id}`)}
                        data-testid={`card-thread-${chat.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate" data-testid={`text-thread-title-${chat.id}`}>{chat.title}</h3>
                            <p className="text-xs text-muted-foreground" data-testid={`text-thread-date-${chat.id}`}>
                              {new Date(chat.createdAt).toLocaleDateString()} at{' '}
                              {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <BoardEditorDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        board={board}
      />

      {isAnalysisEditorOpen && (
        <StandaloneBoardAnalysisDialog
          open={isAnalysisEditorOpen}
          onOpenChange={setIsAnalysisEditorOpen}
          board={board}
          onRunStarted={handleRunStarted}
        />
      )}
    </div>
  );
}
