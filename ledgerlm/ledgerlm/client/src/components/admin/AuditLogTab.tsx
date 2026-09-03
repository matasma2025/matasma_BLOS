import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, RefreshCw, ShieldCheck, LogIn, Trash2, Upload, Database, Users } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AuditLog {
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

interface AuditStats {
  breakdown: { action: string; status: string; cnt: string }[];
  total: number;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGIN_FAILED', label: 'Login Failed' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'SSO_LOGIN', label: 'SSO Login' },
  { value: 'FILE_UPLOAD', label: 'File Upload' },
  { value: 'FILE_DELETE', label: 'File Delete' },
  { value: 'ADMIN_CUBE_CREATE', label: 'Cube Created' },
  { value: 'ADMIN_CUBE_DELETE', label: 'Cube Deleted' },
  { value: 'ADMIN_USER_INVITE', label: 'User Invited' },
  { value: 'ADMIN_USER_REMOVE', label: 'User Removed' },
  { value: 'ADMIN_DOMAIN_CREATE', label: 'Domain Created' },
  { value: 'ADMIN_DOMAIN_UPDATE', label: 'Domain Updated' },
  { value: 'ADMIN_DOMAIN_DELETE', label: 'Domain Deleted' },
  { value: 'BACKUP_TRIGGERED', label: 'Backup' },
  { value: 'RETENTION_PURGE', label: 'Retention Purge' },
  { value: 'DATA_EXPORT', label: 'Data Export' },
];

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login Failed',
  LOGOUT: 'Logout',
  SSO_LOGIN: 'SSO Login',
  FILE_UPLOAD: 'File Upload',
  FILE_DELETE: 'File Delete',
  ADMIN_CUBE_CREATE: 'Cube Created',
  ADMIN_CUBE_DELETE: 'Cube Deleted',
  ADMIN_USER_INVITE: 'User Invited',
  ADMIN_USER_REMOVE: 'User Removed',
  ADMIN_DOMAIN_CREATE: 'Domain Created',
  ADMIN_DOMAIN_UPDATE: 'Domain Updated',
  ADMIN_DOMAIN_DELETE: 'Domain Deleted',
  BACKUP_TRIGGERED: 'Backup',
  RETENTION_PURGE: 'Retention Purge',
  DATA_EXPORT: 'Data Export',
};

const HIGH_SEVERITY_ACTIONS = new Set([
  'LOGIN_FAILED', 'ADMIN_DOMAIN_DELETE', 'ADMIN_USER_REMOVE',
  'FILE_DELETE', 'ADMIN_CUBE_DELETE', 'RETENTION_PURGE',
]);

const ACTION_ICONS: Record<string, JSX.Element> = {
  LOGIN:               <LogIn className="h-3.5 w-3.5 text-blue-500" />,
  LOGIN_FAILED:        <LogIn className="h-3.5 w-3.5 text-red-500" />,
  SSO_LOGIN:           <LogIn className="h-3.5 w-3.5 text-purple-500" />,
  LOGOUT:              <LogIn className="h-3.5 w-3.5 text-gray-400" />,
  FILE_UPLOAD:         <Upload className="h-3.5 w-3.5 text-green-500" />,
  FILE_DELETE:         <Trash2 className="h-3.5 w-3.5 text-orange-500" />,
  ADMIN_CUBE_CREATE:   <Database className="h-3.5 w-3.5 text-blue-500" />,
  ADMIN_CUBE_DELETE:   <Database className="h-3.5 w-3.5 text-red-500" />,
  ADMIN_USER_INVITE:   <Users className="h-3.5 w-3.5 text-green-500" />,
  ADMIN_USER_REMOVE:   <Users className="h-3.5 w-3.5 text-red-500" />,
  ADMIN_DOMAIN_CREATE: <ShieldCheck className="h-3.5 w-3.5 text-green-500" />,
  ADMIN_DOMAIN_UPDATE: <ShieldCheck className="h-3.5 w-3.5 text-yellow-500" />,
  ADMIN_DOMAIN_DELETE: <ShieldCheck className="h-3.5 w-3.5 text-red-500" />,
  BACKUP_TRIGGERED:    <Download className="h-3.5 w-3.5 text-blue-500" />,
  RETENTION_PURGE:     <Trash2 className="h-3.5 w-3.5 text-orange-500" />,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function AuditLogTab() {
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const params = new URLSearchParams();
  if (filterAction) params.set('action', filterAction);
  if (filterStatus) params.set('status', filterStatus);
  if (filterUser)   params.set('userId', filterUser);
  if (filterFrom)   params.set('from', filterFrom);
  if (filterTo)     params.set('to', filterTo);
  params.set('page', String(page));
  params.set('limit', String(LIMIT));

  const { data, isLoading, refetch } = useQuery<{ logs: AuditLog[]; total: number; page: number }>({
    queryKey: ['/api/super-admin/audit-logs', params.toString()],
    queryFn: () => apiRequest('GET', `/api/super-admin/audit-logs?${params}`),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ['/api/super-admin/audit-logs/stats'],
    refetchInterval: 60_000,
  });

  const handleExport = () => {
    const exportParams = new URLSearchParams();
    if (filterAction) exportParams.set('action', filterAction);
    if (filterFrom)   exportParams.set('from', filterFrom);
    if (filterTo)     exportParams.set('to', filterTo);
    window.open(`/api/super-admin/audit-logs/export?${exportParams}`, '_blank');
  };

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

  // Stats summary
  const loginCount  = stats?.breakdown.filter(b => b.action === 'LOGIN' && b.status === 'success').reduce((a, b) => a + Number(b.cnt), 0) ?? 0;
  const failCount   = stats?.breakdown.filter(b => b.status === 'failed').reduce((a, b) => a + Number(b.cnt), 0) ?? 0;
  const deleteCount = stats?.breakdown.filter(b => b.action.includes('DELETE') || b.action === 'FILE_DELETE').reduce((a, b) => a + Number(b.cnt), 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Events (All Time)</p>
            <p className="text-2xl font-bold">{(stats?.total ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Logins (30 days)</p>
            <p className="text-2xl font-bold text-blue-600">{loginCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Failed Actions (30 days)</p>
            <p className="text-2xl font-bold text-red-600">{failCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Deletions (30 days)</p>
            <p className="text-2xl font-bold text-orange-600">{deleteCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value || '__all__'} onSelect={() => setFilterAction(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by user email…"
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
          className="w-52 h-8 text-xs"
        />

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
        {(filterAction || filterStatus || filterUser || filterFrom || filterTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
            setFilterAction(''); setFilterStatus(''); setFilterUser(''); setFilterFrom(''); setFilterTo(''); setPage(1);
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
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Resource</TableHead>
              <TableHead className="text-xs">IP Address</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Loading audit logs…</TableCell></TableRow>
            ) : !data?.logs.length ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No audit events found</TableCell></TableRow>
            ) : data.logs.map((log) => {
              const isSeverity = log.status === 'failed' || HIGH_SEVERITY_ACTIONS.has(log.action);
              return (
              <TableRow key={log.id} className={`text-xs ${isSeverity ? 'bg-red-50/60 border-l-2 border-l-red-300' : ''}`}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{fmtDate(log.created_at)}</TableCell>
                <TableCell className="max-w-[160px] truncate">{log.user_id || <span className="text-muted-foreground italic">system</span>}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {ACTION_ICONS[log.action] ?? <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />}
                    <span>{ACTION_LABELS[log.action] ?? log.action}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.resource ? `${log.resource}${log.resource_id ? ` · ${log.resource_id.slice(0, 8)}…` : ''}` : '—'}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{log.ip_address || '—'}</TableCell>
                <TableCell>
                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs py-0">
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {log.details ? (
                    <span title={JSON.stringify(log.details, null, 2)}>
                      {Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(' · ')}
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
          <span>Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, data?.total ?? 0)} of {data?.total.toLocaleString()} events</span>
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
