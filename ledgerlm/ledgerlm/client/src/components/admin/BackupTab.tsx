import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HardDrive, RefreshCw, PlayCircle, CheckCircle2, XCircle, Database, Cpu, Clock,
  Cloud, CloudOff, Settings2, Loader2, AlertTriangle, ChevronDown, ChevronRight,
  CalendarClock, Download, ListChecks,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// ── Types ────────────────────────────────────────────────────────────────────

interface BackupRecord {
  id: string; filename: string; sizeBytes: number; status: 'success' | 'failed';
  triggeredBy: string; blobUrl: string | null; errorMessage: string | null; createdAt: string;
}

interface SystemStatus {
  database: { sizeBytes: number; tableCount: number; status: string; provider: string };
  auditLog: { totalEvents: number };
  lastBackup: { status: string; filename: string; sizeBytes: number; createdAt: string } | null;
  python: { status: string };
  uptime: number;
}

interface SchedulerSettings {
  backupUtcHour: number;
  blobConnectionStringSet: boolean;
  blobConnectionStringMasked: string | null;
  blobContainer: string;
  updatedAt: string;
}

interface SchedulerLog {
  id: string;
  jobType: 'backup' | 'retention';
  triggeredBy: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  details: Record<string, any> | null;
  errorMessage: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function nextRunLabel(utcHour: number) {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(utcHour, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const diffMs = next.getTime() - now.getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return `in ${h}h ${m}m (${String(utcHour).padStart(2, '0')}:00 UTC)`;
}

const OK = new Set(['healthy', 'connected', 'ok', 'success']);

function StatusDot({ status }: { status: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 shrink-0 ${OK.has(status) ? 'bg-green-500' : 'bg-red-500'}`} />;
}

function JobStatusBadge({ status }: { status: SchedulerLog['status'] }) {
  if (status === 'success') return <Badge variant="default" className="text-xs gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Success</Badge>;
  if (status === 'failed')  return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
  return <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-300"><Loader2 className="h-3 w-3 animate-spin" /> Running</Badge>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BackupTab() {
  const { toast } = useToast();

  const [countdown, setCountdown] = useState(15);
  const [blobConnStr, setBlobConnStr] = useState('');
  const [blobContainer, setBlobContainer] = useState('ledgerlm-backups');
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testingBlob, setTestingBlob] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [schedulerHour, setSchedulerHour] = useState<string>('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    useQuery<SystemStatus>({ queryKey: ['/api/super-admin/system-status'], refetchInterval: 30_000 });

  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } =
    useQuery<BackupRecord[]>({ queryKey: ['/api/super-admin/backups'], refetchInterval: 30_000 });

  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } =
    useQuery<SchedulerSettings>({
      queryKey: ['/api/super-admin/scheduler-settings'],
      onSuccess: (d) => {
        if (!schedulerHour) setSchedulerHour(String(d.backupUtcHour));
        if (!blobContainer) setBlobContainer(d.blobContainer);
      },
    });

  const { data: schedulerLogs = [], isLoading: logsLoading, refetch: refetchLogs } =
    useQuery<SchedulerLog[]>({ queryKey: ['/api/super-admin/scheduler-logs'], refetchInterval: 15_000 });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const triggerBackupMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/super-admin/backups/trigger', {}),
    onSuccess: () => {
      toast({ title: 'Backup started', description: 'Database backup queued. Results will appear in the history below.' });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/super-admin/backups'] });
        queryClient.invalidateQueries({ queryKey: ['/api/super-admin/system-status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/super-admin/scheduler-logs'] });
      }, 5000);
    },
    onError: (e: any) => toast({ title: 'Backup failed to start', description: e.message, variant: 'destructive' }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (patch: { backupUtcHour?: number; blobConnectionString?: string; blobContainer?: string }) =>
      apiRequest('PATCH', '/api/super-admin/scheduler-settings', patch),
    onSuccess: () => {
      toast({ title: 'Settings saved' });
      refetchSettings();
      setBlobConnStr('');
      setTestResult(null);
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTestBlob = async () => {
    setTestingBlob(true);
    setTestResult(null);
    try {
      const res = await apiRequest('POST', '/api/super-admin/scheduler-settings/test-blob', {
        connectionString: blobConnStr || undefined,
        container: blobContainer,
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTestingBlob(false);
    }
  };

  const handleSaveBlob = () => {
    const patch: any = { blobContainer };
    if (blobConnStr) patch.blobConnectionString = blobConnStr;
    saveSettingsMutation.mutate(patch);
  };

  const handleSaveScheduler = () => {
    saveSettingsMutation.mutate({ backupUtcHour: Number(schedulerHour) });
  };

  const handleRefreshAll = () => {
    refetchStatus(); refetchBackups(); refetchSettings(); refetchLogs();
  };

  const hasRunningJob = schedulerLogs.some(l => l.status === 'running');
  useEffect(() => {
    if (!hasRunningJob) return;
    setCountdown(15);
    const iv = setInterval(() => setCountdown(c => {
      if (c <= 1) { refetchLogs(); return 15; }
      return c - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [hasRunningJob]);

  const aiHealthy = OK.has(status?.python.status ?? '');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Top action bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {settings?.blobConnectionStringSet
            ? 'Backups upload to Azure Blob Storage after completion.'
            : 'Backups are stored locally — configure Azure Blob in settings to enable cloud storage.'}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleRefreshAll}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => triggerBackupMutation.mutate()}
            disabled={triggerBackupMutation.isPending}
          >
            {triggerBackupMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <PlayCircle className="h-4 w-4" />}
            {triggerBackupMutation.isPending ? 'Starting…' : 'Take Backup Now'}
          </Button>
        </div>
      </div>

      {/* ── Status strip ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-muted/20 px-1 py-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/60">

          {/* Database */}
          <div className="px-4 py-1 lg:py-0 lg:first:pl-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">
              <Database className="h-3 w-3" /> Database
            </p>
            {statusLoading ? <div className="h-4 bg-muted rounded animate-pulse w-20" /> : (
              <>
                <div className="flex items-center text-sm font-semibold leading-tight">
                  <StatusDot status={status?.database.status ?? ''} />
                  {status?.database.status ?? '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {status?.database.provider} · {fmtBytes(status?.database.sizeBytes ?? 0)} · {status?.database.tableCount} tables
                </p>
              </>
            )}
          </div>

          {/* AI Engine */}
          <div className="px-4 py-1 lg:py-0">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">
              <Cpu className="h-3 w-3" /> AI Engine
            </p>
            {statusLoading ? <div className="h-4 bg-muted rounded animate-pulse w-20" /> : (
              <>
                <div className={`flex items-center text-sm font-semibold leading-tight ${!aiHealthy ? 'text-red-600' : ''}`}>
                  <StatusDot status={status?.python.status ?? ''} />
                  {status?.python.status ?? '—'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {!aiHealthy ? 'Check Python service' : 'Document & query processor'}
                </p>
              </>
            )}
          </div>

          {/* Uptime */}
          <div className="px-4 py-1 lg:py-0">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">
              <Clock className="h-3 w-3" /> Uptime
            </p>
            {statusLoading ? <div className="h-4 bg-muted rounded animate-pulse w-16" /> : (
              <>
                <p className="text-sm font-semibold leading-tight">{fmtUptime(status?.uptime ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(status?.auditLog.totalEvents ?? 0).toLocaleString()} audit events
                </p>
              </>
            )}
          </div>

          {/* Last Backup */}
          <div className="px-4 py-1 lg:py-0">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">
              <HardDrive className="h-3 w-3" /> Last Backup
            </p>
            {statusLoading ? <div className="h-4 bg-muted rounded animate-pulse w-24" /> : status?.lastBackup ? (
              <>
                <div className="flex items-center text-sm font-semibold leading-tight">
                  <StatusDot status={status.lastBackup.status} />
                  {status.lastBackup.status}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(status.lastBackup.createdAt)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold leading-tight text-amber-600">Never run</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Use "Take Backup Now" above</p>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Configuration accordion ─────────────────────────────────────────── */}
      <div className="rounded-lg border overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          onClick={() => setConfigExpanded(!configExpanded)}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Configuration</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">— Azure Blob · Scheduler</span>
          </div>
          <div className="flex items-center gap-2">
            {settings?.blobConnectionStringSet ? (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 text-green-700 border-green-300 bg-green-50 px-1.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> Blob ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 text-orange-600 border-orange-300 bg-orange-50 px-1.5">
                <CloudOff className="h-2.5 w-2.5" /> Local only
              </Badge>
            )}
            {!settingsLoading && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 text-violet-700 border-violet-300 bg-violet-50 px-1.5">
                <CalendarClock className="h-2.5 w-2.5" />
                {String(settings?.backupUtcHour ?? 2).padStart(2, '0')}:00 UTC
              </Badge>
            )}
            {configExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {configExpanded && (
          <div className="border-t">
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/60">

              {/* ── Azure Blob Storage ───────────────────────────────────────── */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-semibold">Azure Blob Storage</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Backups are uploaded to Azure after <code className="bg-muted px-1 rounded text-[11px]">pg_dump</code> completes.
                  The connection string is stored encrypted and never exposed in full.
                </p>

                {settings?.blobConnectionStringSet && (
                  <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Connection string saved. Enter a new one below to replace it.
                  </div>
                )}

                <div>
                  <Label className="text-xs font-medium mb-1 block">Connection String</Label>
                  <Input
                    type="password"
                    placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=..."
                    value={blobConnStr}
                    onChange={(e) => { setBlobConnStr(e.target.value); setTestResult(null); }}
                    className="text-xs font-mono h-8"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Azure Portal → Storage Account → Security + networking → Access keys → Connection string
                  </p>
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs font-medium mb-1 block">Container Name</Label>
                    <Input
                      placeholder="ledgerlm-backups"
                      value={blobContainer}
                      onChange={(e) => setBlobContainer(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                {testResult && (
                  <div className={`rounded-md border px-3 py-2 text-xs flex items-center gap-2 ${testResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                    {testResult.ok ? 'Connection successful — container is writable.' : `Failed: ${testResult.error}`}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleTestBlob} disabled={testingBlob}>
                    {testingBlob ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
                    {testingBlob ? 'Testing…' : 'Test Connection'}
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveBlob} disabled={saveSettingsMutation.isPending}>
                    {saveSettingsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              </div>

              {/* ── Scheduler ───────────────────────────────────────────────── */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-violet-500" />
                  <h4 className="text-sm font-semibold">Scheduler</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Both the backup and retention engine run once daily at this time.
                  Takes effect on the next server restart or the following day's cycle.
                </p>

                {settingsLoading ? (
                  <div className="h-8 bg-muted rounded animate-pulse w-48" />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Daily Run Time (UTC)</Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={schedulerHour || String(settings?.backupUtcHour ?? 2)}
                          onValueChange={setSchedulerHour}
                        >
                          <SelectTrigger className="h-8 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={String(i)} className="text-xs">
                                {String(i).padStart(2, '0')}:00 UTC{i === 2 ? ' (default)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveScheduler} disabled={saveSettingsMutation.isPending}>
                          {saveSettingsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5" />}
                          Save
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md bg-violet-50 border border-violet-100 px-3 py-2">
                      <p className="text-xs text-violet-700 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Next run {nextRunLabel(Number(schedulerHour || settings?.backupUtcHour || 2))}
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── History (tabbed) ────────────────────────────────────────────────── */}
      <div className="rounded-lg border overflow-hidden">
        <Tabs defaultValue="runs">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
            <TabsList className="h-7 bg-transparent p-0 gap-0.5">
              <TabsTrigger
                value="runs"
                className="text-xs h-7 px-3 gap-1.5 rounded data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Run Log
                {schedulerLogs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">({schedulerLogs.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="text-xs h-7 px-3 gap-1.5 rounded data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <HardDrive className="h-3.5 w-3.5" />
                Backup Files
                {backups.length > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">({backups.length})</span>
                )}
              </TabsTrigger>
            </TabsList>

            {hasRunningJob ? (
              <span className="text-xs text-blue-600 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Auto-refreshing in {countdown}s
              </span>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={handleRefreshAll}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            )}
          </div>

          {/* Run Log tab */}
          <TabsContent value="runs" className="m-0">
            {logsLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !schedulerLogs.length ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <ListChecks className="h-9 w-9 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No runs recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Scheduler runs appear here after the first backup or retention job executes.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5 text-xs h-8"
                  onClick={() => triggerBackupMutation.mutate()}
                  disabled={triggerBackupMutation.isPending}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {triggerBackupMutation.isPending ? 'Starting…' : 'Take Backup Now'}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="text-xs">Started</TableHead>
                    <TableHead className="text-xs">Job</TableHead>
                    <TableHead className="text-xs">Triggered By</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Duration</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulerLogs.map((log) => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell className="font-mono whitespace-nowrap">{fmtDate(log.startedAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${log.jobType === 'backup' ? 'text-blue-700 border-blue-200 bg-blue-50' : 'text-orange-700 border-orange-200 bg-orange-50'}`}
                        >
                          {log.jobType === 'backup' ? <HardDrive className="h-3 w-3 mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                          {log.jobType === 'backup' ? 'Backup' : 'Retention'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.triggeredBy}</TableCell>
                      <TableCell><JobStatusBadge status={log.status} /></TableCell>
                      <TableCell className="font-mono">{fmtDuration(log.durationMs)}</TableCell>
                      <TableCell className="max-w-xs">
                        {log.status === 'failed' && log.errorMessage ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate" title={log.errorMessage}>{log.errorMessage.slice(0, 80)}</span>
                          </span>
                        ) : log.details ? (
                          <span className="text-muted-foreground">
                            {log.jobType === 'backup'
                              ? `${fmtBytes(log.details.sizeBytes ?? 0)}${log.details.uploadedToAzure ? ' · Azure ✓' : ' · local only'}`
                              : `${log.details.totalRowsDeleted ?? 0} rows deleted across ${log.details.policiesRun ?? 0} policies`}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Backup Files tab */}
          <TabsContent value="files" className="m-0">
            {backupsLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !backups.length ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <HardDrive className="h-9 w-9 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No backup files yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Backup files appear here after your first successful backup completes.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5 text-xs h-8"
                  onClick={() => triggerBackupMutation.mutate()}
                  disabled={triggerBackupMutation.isPending}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {triggerBackupMutation.isPending ? 'Starting…' : 'Take Backup Now'}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">Filename</TableHead>
                    <TableHead className="text-xs">Size</TableHead>
                    <TableHead className="text-xs">Triggered By</TableHead>
                    <TableHead className="text-xs">Storage</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.id} className="text-xs">
                      <TableCell className="font-mono whitespace-nowrap">{fmtDate(b.createdAt)}</TableCell>
                      <TableCell className="font-mono">{b.filename}</TableCell>
                      <TableCell>{fmtBytes(b.sizeBytes)}</TableCell>
                      <TableCell>{b.triggeredBy}</TableCell>
                      <TableCell>
                        {b.blobUrl ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-300">
                              <CheckCircle2 className="h-3 w-3" /> Azure Blob
                            </Badge>
                            <a
                              href={b.blobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Download backup"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                            Local only
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {b.status === 'success' ? (
                          <Badge variant="default" className="text-xs gap-1 bg-green-600">
                            <CheckCircle2 className="h-3 w-3" /> Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs gap-1" title={b.errorMessage ?? ''}>
                            <XCircle className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

        </Tabs>
      </div>

    </div>
  );
}
