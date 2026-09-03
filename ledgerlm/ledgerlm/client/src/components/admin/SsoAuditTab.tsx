import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, RefreshCw, LogIn, UserPlus, UserX, ShieldCheck, ShieldAlert, ArrowRightLeft } from 'lucide-react';
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
  SSO_LOGIN: {
    icon: <LogIn className="h-3.5 w-3.5 text-blue-500" />,
    label: 'Login',
    color: 'text-blue-600',
  },
  SSO_LOGIN_FAILED: {
    icon: <ShieldAlert className="h-3.5 w-3.5 text-red-500" />,
    label: 'Login Failed',
    color: 'text-red-600',
  },
  SSO_USER_PROVISIONED: {
    icon: <UserPlus className="h-3.5 w-3.5 text-green-500" />,
    label: 'Provisioned',
    color: 'text-green-600',
  },
  SSO_USER_DEACTIVATED: {
    icon: <UserX className="h-3.5 w-3.5 text-orange-500" />,
    label: 'Deactivated',
    color: 'text-orange-600',
  },
  SSO_ROLE_SYNCED: {
    icon: <ArrowRightLeft className="h-3.5 w-3.5 text-purple-500" />,
    label: 'Role Synced',
    color: 'text-purple-600',
  },
  SSO_ROLE_UPDATED: {
    icon: <ArrowRightLeft className="h-3.5 w-3.5 text-purple-400" />,
    label: 'Role Updated',
    color: 'text-purple-500',
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getRoleChange(log: SsoAuditLog): string {
  const d = log.details;
  if (!d) return '—';
  if (d.oldRole && d.newRole) return `${d.oldRole} → ${d.newRole}`;
  if (d.role) return String(d.role);
  return '—';
}

function getEmail(log: SsoAuditLog): string {
  return String(log.details?.email ?? log.user_id ?? '—');
}

function getDomain(log: SsoAuditLog): string {
  return String(log.details?.domain ?? log.resource ?? '—');
}

function getTriggeredBy(log: SsoAuditLog): string {
  const t = log.details?.triggeredBy;
  if (t === 'background_sync') return 'Sync Job';
  if (t === 'login') return 'Login';
  return '—';
}

function getFailureReason(log: SsoAuditLog): string {
  return String(log.details?.reason ?? '');
}

interface ManagedDomain { id: string; name: string; }

export default function SsoAuditTab() {
  const [filterAction, setFilterAction] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Domain dropdown — load all managed domains for the super-admin filter
  const { data: managedDomains = [] } = useQuery<ManagedDomain[]>({
    queryKey: ['/api/super-admin/domains'],
    select: (rows: any[]) => rows.map((r: any) => ({ id: r.id, name: r.name })),
  });

  const params = new URLSearchParams();
  if (filterAction) params.set('action', filterAction);
  if (filterEmail)  params.set('email', filterEmail);
  if (filterDomain) params.set('domain', filterDomain);
  if (filterFrom)   params.set('from', filterFrom);
  if (filterTo)     params.set('to', filterTo);
  params.set('page', String(page));
  params.set('limit', String(LIMIT));

  const { data, isLoading, refetch } = useQuery<{ logs: SsoAuditLog[]; total: number; page: number }>({
    queryKey: ['/api/super-admin/sso-audit-logs', params.toString()],
    queryFn: () => apiRequest('GET', `/api/super-admin/sso-audit-logs?${params}`),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<SsoAuditStats>({
    queryKey: ['/api/super-admin/sso-audit-logs/stats'],
    refetchInterval: 60_000,
  });

  const handleExport = () => {
    const exportParams = new URLSearchParams();
    if (filterAction) exportParams.set('action', filterAction);
    if (filterEmail)  exportParams.set('email', filterEmail);
    if (filterDomain) exportParams.set('domain', filterDomain);
    if (filterFrom)   exportParams.set('from', filterFrom);
    if (filterTo)     exportParams.set('to', filterTo);
    window.open(`/api/super-admin/sso-audit-logs/export?${exportParams}`, '_blank');
  };

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);
  const hasFilters = !!(filterAction || filterEmail || filterDomain || filterFrom || filterTo);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total SSO Events</p>
            <p className="text-2xl font-bold">{(stats?.totalEvents ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Logins (30d)</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.loginsLast30d ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Provisioned (30d)</p>
            <p className="text-2xl font-bold text-green-600">{stats?.provisionedLast30d ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Deactivated (30d)</p>
            <p className="text-2xl font-bold text-orange-600">{stats?.deactivatedLast30d ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Role Changes (30d)</p>
            <p className="text-2xl font-bold text-purple-600">{stats?.roleChangesLast30d ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={filterAction || '__all__'} onValueChange={(v) => { setFilterAction(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-48 h-8 text-xs">
            <SelectValue placeholder="All SSO Events" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map(o => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by email…"
          value={filterEmail}
          onChange={(e) => { setFilterEmail(e.target.value); setPage(1); }}
          className="w-52 h-8 text-xs"
        />

        <Select value={filterDomain || '__all__'} onValueChange={(v) => { setFilterDomain(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Domains" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Domains</SelectItem>
            {managedDomains.map(d => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            setFilterAction(''); setFilterEmail(''); setFilterDomain(''); setFilterFrom(''); setFilterTo(''); setPage(1);
          }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-40">Timestamp</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Domain</TableHead>
              <TableHead className="text-xs">Event</TableHead>
              <TableHead className="text-xs">Role / Change</TableHead>
              <TableHead className="text-xs">Triggered By</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                  Loading SSO audit logs…
                </TableCell>
              </TableRow>
            ) : !data?.logs.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                  No SSO events found
                  {hasFilters && ' — try clearing filters'}
                </TableCell>
              </TableRow>
            ) : data.logs.map((log) => {
              const meta = ACTION_META[log.action];
              const reason = getFailureReason(log);
              return (
                <TableRow key={log.id} className="text-xs hover:bg-muted/20">
                  <TableCell className="font-mono text-xs whitespace-nowrap">{fmtDate(log.created_at)}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium">{getEmail(log)}</TableCell>
                  <TableCell className="text-muted-foreground">{getDomain(log)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {meta?.icon ?? <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />}
                      <span className={`font-medium ${meta?.color ?? ''}`}>{meta?.label ?? log.action}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{getRoleChange(log)}</TableCell>
                  <TableCell>
                    {getTriggeredBy(log) !== '—' ? (
                      <Badge variant="outline" className="text-xs py-0 font-normal">
                        {getTriggeredBy(log)}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.status === 'success' ? 'default' : 'destructive'}
                      className="text-xs py-0"
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {reason ? (
                      <span className="text-red-500 font-mono">{reason}</span>
                    ) : log.details ? (
                      <span title={JSON.stringify(log.details, null, 2)}>
                        {Object.entries(log.details)
                          .filter(([k]) => !['email', 'domain', 'triggeredBy'].includes(k))
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${String(v).slice(0, 25)}`)
                          .join(' · ') || '—'}
                      </span>
                    ) : '—'}
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
          <span>
            Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data?.total ?? 0)} of {(data?.total ?? 0).toLocaleString()} events
          </span>
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
