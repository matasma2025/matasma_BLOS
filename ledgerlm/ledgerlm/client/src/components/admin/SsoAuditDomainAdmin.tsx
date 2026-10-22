/**
 * SsoAuditDomainAdmin — domain-scoped SSO audit log viewer.
 *
 * Used inside the User Management page (AdminUsers.tsx).
 * Domain admins see ONLY their own domain's events.
 * Super admins pass domainId so they see the selected tenant's events.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, RefreshCw, LogIn, UserPlus, UserX, ShieldAlert, ArrowRightLeft, ShieldCheck, Search, CalendarDays } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { fetchApiFile } from '@/lib/apiFiles';

interface SsoAuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  ip_address: string | null;
  status: 'success' | 'failed';
  details: Record<string, unknown> | null;
  created_at: string;
}

interface SsoAuditStats {
  totalEvents: number;
  loginsLast30d: number;
  provisionedLast30d: number;
  deactivatedLast30d: number;
  roleChangesLast30d: number;
}

interface Props {
  /** domain DB id — used as query key so data refreshes when domain switches */
  domainId: string;
  domainName?: string;
  /** when true, appends ?domainId= so the server knows which tenant to scope to */
  isSuperAdmin?: boolean;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All SSO Events' },
  { value: 'SSO_LOGIN', label: 'Login Success' },
  { value: 'SSO_LOGIN_FAILED', label: 'Login Failed' },
  { value: 'SSO_USER_PROVISIONED', label: 'User Provisioned' },
  { value: 'SSO_USER_DEACTIVATED', label: 'User Deactivated' },
  { value: 'SSO_ROLE_SYNCED', label: 'Role Synced (Login)' },
  { value: 'SSO_ROLE_UPDATED', label: 'Role Updated (Sync Job)' },
];

const ACTION_META: Record<string, { icon: JSX.Element; label: string; color: string }> = {
  SSO_LOGIN:            { icon: <LogIn className="h-3.5 w-3.5 text-primary" />,         label: 'Login',          color: 'text-primary' },
  SSO_LOGIN_FAILED:     { icon: <ShieldAlert className="h-3.5 w-3.5 text-red-500" />,   label: 'Login Failed',   color: 'text-red-600' },
  SSO_USER_PROVISIONED: { icon: <UserPlus className="h-3.5 w-3.5 text-emerald-600" />,  label: 'Provisioned',    color: 'text-emerald-700' },
  SSO_USER_DEACTIVATED: { icon: <UserX className="h-3.5 w-3.5 text-amber-600" />,       label: 'Deactivated',    color: 'text-amber-700' },
  SSO_ROLE_SYNCED:      { icon: <ArrowRightLeft className="h-3.5 w-3.5 text-violet-500" />, label: 'Role Synced',  color: 'text-violet-700' },
  SSO_ROLE_UPDATED:     { icon: <ArrowRightLeft className="h-3.5 w-3.5 text-violet-400" />, label: 'Role Updated', color: 'text-violet-600' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getEmail(log: SsoAuditLog)      { return String(log.details?.email ?? log.user_id ?? '—'); }
function getRoleChange(log: SsoAuditLog) {
  const d = log.details;
  if (!d) return '—';
  if (d.oldRole && d.newRole) return `${d.oldRole} → ${d.newRole}`;
  if (d.role) return String(d.role);
  return '—';
}
function getTriggeredBy(log: SsoAuditLog) {
  const t = log.details?.triggeredBy;
  return t === 'background_sync' ? 'Sync Job' : t === 'login' ? 'Login' : '—';
}
function getFailureReason(log: SsoAuditLog) { return String(log.details?.reason ?? ''); }

export default function SsoAuditDomainAdmin({ domainId, domainName, isSuperAdmin }: Props) {
  const [filterAction, setFilterAction] = useState('');
  const [filterEmail,  setFilterEmail]  = useState('');
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const buildParams = (extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (isSuperAdmin && domainId) p.set('domainId', domainId);
    if (filterAction) p.set('action', filterAction);
    if (filterEmail)  p.set('email', filterEmail);
    if (filterFrom)   p.set('from', filterFrom);
    if (filterTo)     p.set('to', filterTo);
    p.set('page', String(page));
    p.set('limit', String(LIMIT));
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p;
  };

  const params = buildParams();

  const { data, isLoading, refetch } = useQuery<{ logs: SsoAuditLog[]; total: number; page: number }>({
    queryKey: ['/api/domain-admin/sso-audit-logs', domainId, params.toString()],
    queryFn: () => apiRequest('GET', `/api/domain-admin/sso-audit-logs?${params}`),
    enabled: !!domainId,
    refetchInterval: 30_000,
  });

  const statsParams = new URLSearchParams();
  if (isSuperAdmin && domainId) statsParams.set('domainId', domainId);

  const { data: stats } = useQuery<SsoAuditStats>({
    queryKey: ['/api/domain-admin/sso-audit-logs/stats', domainId],
    queryFn: () => apiRequest('GET', `/api/domain-admin/sso-audit-logs/stats?${statsParams}`),
    enabled: !!domainId,
    refetchInterval: 60_000,
  });

  const handleExport = async () => {
    const ep = buildParams();
    ep.delete('page'); ep.delete('limit');
    await fetchApiFile(
      `/api/domain-admin/sso-audit-logs/export?${ep}`,
      { filename: 'domain-sso-audit-logs.csv' },
    );
  };

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);
  const hasFilters = !!(filterAction || filterEmail || filterFrom || filterTo);
  const metrics = [
    { title: 'Total SSO Events', value: (stats?.totalEvents ?? 0).toLocaleString(), note: 'All recorded events', accent: 'bg-slate-400', tone: 'text-foreground' },
    { title: 'Logins (30d)', value: String(stats?.loginsLast30d ?? 0), note: 'Successful sign-ins', accent: 'bg-primary', tone: 'text-primary' },
    { title: 'Provisioned (30d)', value: String(stats?.provisionedLast30d ?? 0), note: 'New user accounts', accent: 'bg-emerald-600', tone: 'text-emerald-700' },
    { title: 'Deactivated (30d)', value: String(stats?.deactivatedLast30d ?? 0), note: 'Access removed', accent: 'bg-amber-500', tone: 'text-amber-700' },
    { title: 'Role Changes (30d)', value: String(stats?.roleChangesLast30d ?? 0), note: 'Role assignments', accent: 'bg-violet-500', tone: 'text-violet-700' },
  ];

  if (!domainId) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-white px-4 py-12 text-center text-sm text-muted-foreground">
        Select a domain above to view its SSO audit logs.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight">SSO Audit Log</h2>
            {domainName && (
              <Badge variant="outline" className="rounded-md border-border/70 bg-muted/20 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                {domainName}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Identity events and access changes</p>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Auto-refresh every 30 seconds
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.title} className="relative overflow-hidden rounded-xl border-border/70 shadow-sm">
            <span className={`absolute inset-y-0 left-0 w-[3px] ${metric.accent}`} />
            <CardContent className="px-3.5 py-3">
              <p className="text-[9px] font-semibold text-muted-foreground">{metric.title}</p>
              <p className={`mt-1 text-[22px] font-bold leading-none tracking-tight tabular-nums ${metric.tone}`}>{metric.value}</p>
              <p className="mt-1.5 text-[9px] text-muted-foreground">{metric.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-border/70 shadow-sm">
        <CardContent className="p-3.5 sm:p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
              <Search className="h-3 w-3" />
            </span>
            Filter events
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[1.25fr_1.4fr_.85fr_.85fr_auto_auto_auto] xl:items-end">
            <label className="block">
              <span className="mb-1 block text-[9px] font-semibold text-muted-foreground">Event type</span>
              <Select value={filterAction || '__all__'} onValueChange={(v) => { setFilterAction(v === '__all__' ? '' : v); setPage(1); }}>
                <SelectTrigger aria-label="Filter by event type" className="h-9 w-full rounded-lg text-[10px]"><SelectValue placeholder="All SSO Events" /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(o => (
                    <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-semibold text-muted-foreground">Email</span>
              <Input aria-label="Filter by email" placeholder="Filter by email…" value={filterEmail}
                onChange={(e) => { setFilterEmail(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-lg text-[10px]" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-semibold text-muted-foreground">From</span>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-2.5 top-3 h-3 w-3 text-muted-foreground" />
                <Input aria-label="Start date" type="date" value={filterFrom}
                  onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg pl-7 pr-1 text-[10px]" />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-semibold text-muted-foreground">To</span>
              <span className="relative block">
                <CalendarDays className="pointer-events-none absolute left-2.5 top-3 h-3 w-3 text-muted-foreground" />
                <Input aria-label="End date" type="date" value={filterTo}
                  onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-lg pl-7 pr-1 text-[10px]" />
              </span>
            </label>

            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-1.5 rounded-lg px-3 text-[10px]">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={handleExport} className="h-9 gap-1.5 rounded-lg px-3 text-[10px]">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-[10px]" onClick={() => {
                setFilterAction(''); setFilterEmail(''); setFilterFrom(''); setFilterTo(''); setPage(1);
              }}>Clear filters</Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-[9px] text-muted-foreground">
            <span>
              {data && `Showing ${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, data.total)} of ${data.total.toLocaleString()} events`}
            </span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />Live data refreshes automatically</span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border/70 shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[990px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-10 w-40 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Timestamp</TableHead>
                <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Email</TableHead>
                <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Event</TableHead>
                <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Role / Change</TableHead>
                <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Triggered By</TableHead>
                <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Status</TableHead>
                <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              ) : !data?.logs.length ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No SSO events found{hasFilters ? ' — try clearing filters' : ''}
                </TableCell></TableRow>
              ) : data.logs.map((log) => {
                const meta = ACTION_META[log.action];
                const reason = getFailureReason(log);
                const triggeredBy = getTriggeredBy(log);
                return (
                  <TableRow key={log.id} className="border-b border-border/50 text-[10px] last:border-0 hover:bg-muted/20">
                    <TableCell className="whitespace-nowrap px-3.5 py-3.5 font-mono text-[9px] tabular-nums text-muted-foreground">{fmtDate(log.created_at)}</TableCell>
                    <TableCell className="max-w-[180px] truncate px-3.5 py-3.5 font-semibold">{getEmail(log)}</TableCell>
                    <TableCell className="px-3.5 py-3.5">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        {meta?.icon ?? <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />}
                        <span className={`font-semibold ${meta?.color ?? ''}`}>{meta?.label ?? log.action}</span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3.5 py-3.5 font-mono text-[9px] text-muted-foreground">{getRoleChange(log)}</TableCell>
                    <TableCell className="px-3.5 py-3.5">
                      {triggeredBy !== '—' ? (
                        <Badge variant="outline" className="rounded-full border-border/70 bg-muted/20 px-2 py-0.5 text-[9px] font-normal">{triggeredBy}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="px-3.5 py-3.5">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="rounded-full px-2 py-0.5 text-[9px] capitalize">
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate px-3.5 py-3.5 text-muted-foreground">
                      {reason ? <span className="font-mono text-[9px] text-red-600">{reason}</span> : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-muted/10 px-3.5 py-2.5 text-[9px] text-muted-foreground">
            <span>Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data?.total ?? 0)} of {(data?.total ?? 0).toLocaleString()} events</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 gap-1 rounded-md px-2.5 text-[9px]" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <span className="px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 gap-1 rounded-md px-2.5 text-[9px]" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
}
