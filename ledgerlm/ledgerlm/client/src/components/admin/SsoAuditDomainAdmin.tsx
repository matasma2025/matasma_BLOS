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
import { Download, RefreshCw, LogIn, UserPlus, UserX, ShieldAlert, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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
  SSO_LOGIN:            { icon: <LogIn className="h-3.5 w-3.5 text-blue-500" />,     label: 'Login',          color: 'text-blue-600' },
  SSO_LOGIN_FAILED:     { icon: <ShieldAlert className="h-3.5 w-3.5 text-red-500" />, label: 'Login Failed',   color: 'text-red-600' },
  SSO_USER_PROVISIONED: { icon: <UserPlus className="h-3.5 w-3.5 text-green-500" />,  label: 'Provisioned',    color: 'text-green-600' },
  SSO_USER_DEACTIVATED: { icon: <UserX className="h-3.5 w-3.5 text-orange-500" />,    label: 'Deactivated',    color: 'text-orange-600' },
  SSO_ROLE_SYNCED:      { icon: <ArrowRightLeft className="h-3.5 w-3.5 text-purple-500" />, label: 'Role Synced',  color: 'text-purple-600' },
  SSO_ROLE_UPDATED:     { icon: <ArrowRightLeft className="h-3.5 w-3.5 text-purple-400" />, label: 'Role Updated', color: 'text-purple-500' },
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

export default function SsoAuditDomainAdmin({ domainId, isSuperAdmin }: Props) {
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

  const handleExport = () => {
    const ep = buildParams();
    ep.delete('page'); ep.delete('limit');
    window.open(`/api/domain-admin/sso-audit-logs/export?${ep}`, '_blank');
  };

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);
  const hasFilters = !!(filterAction || filterEmail || filterFrom || filterTo);

  if (!domainId) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Select a domain above to view its SSO audit logs.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total SSO Events</p>
          <p className="text-2xl font-bold">{(stats?.totalEvents ?? 0).toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Logins (30d)</p>
          <p className="text-2xl font-bold text-blue-600">{stats?.loginsLast30d ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Provisioned (30d)</p>
          <p className="text-2xl font-bold text-green-600">{stats?.provisionedLast30d ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Deactivated (30d)</p>
          <p className="text-2xl font-bold text-orange-600">{stats?.deactivatedLast30d ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Role Changes (30d)</p>
          <p className="text-2xl font-bold text-purple-600">{stats?.roleChangesLast30d ?? 0}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={filterAction || '__all__'} onValueChange={(v) => { setFilterAction(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All SSO Events" /></SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map(o => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input placeholder="Filter by email…" value={filterEmail}
          onChange={(e) => { setFilterEmail(e.target.value); setPage(1); }}
          className="w-52 h-8 text-xs" />

        <div className="flex items-center gap-1">
          <Input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className="w-36 h-8 text-xs" />
          <span className="text-xs text-muted-foreground">→</span>
          <Input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} className="w-36 h-8 text-xs" />
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} className="h-8 gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
            setFilterAction(''); setFilterEmail(''); setFilterFrom(''); setFilterTo(''); setPage(1);
          }}>Clear filters</Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-40">Timestamp</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Event</TableHead>
              <TableHead className="text-xs">Role / Change</TableHead>
              <TableHead className="text-xs">Triggered By</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Loading…</TableCell></TableRow>
            ) : !data?.logs.length ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                No SSO events found{hasFilters ? ' — try clearing filters' : ''}
              </TableCell></TableRow>
            ) : data.logs.map((log) => {
              const meta = ACTION_META[log.action];
              const reason = getFailureReason(log);
              const triggeredBy = getTriggeredBy(log);
              return (
                <TableRow key={log.id} className="text-xs hover:bg-muted/20">
                  <TableCell className="font-mono text-xs whitespace-nowrap">{fmtDate(log.created_at)}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium">{getEmail(log)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {meta?.icon ?? <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />}
                      <span className={`font-medium ${meta?.color ?? ''}`}>{meta?.label ?? log.action}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{getRoleChange(log)}</TableCell>
                  <TableCell>
                    {triggeredBy !== '—' ? (
                      <Badge variant="outline" className="text-xs py-0 font-normal">{triggeredBy}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs py-0">
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {reason ? <span className="text-red-500 font-mono text-xs">{reason}</span> : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data?.total ?? 0)} of {(data?.total ?? 0).toLocaleString()} events</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
            <span className="flex items-center px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
