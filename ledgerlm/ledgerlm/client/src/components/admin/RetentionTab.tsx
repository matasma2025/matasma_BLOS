import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PlayCircle, RefreshCw, Clock, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RetentionPolicy {
  id: string;
  tableName: string;
  label: string;
  retainDays: number;
  enabled: boolean;
  lastRun: string | null;
  lastDeleted: number;
  updatedAt: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RetentionTab() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState<number>(90);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: policies = [], isLoading, refetch } = useQuery<RetentionPolicy[]>({
    queryKey: ['/api/super-admin/retention-policies'],
    refetchInterval: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { retainDays?: number; enabled?: boolean } }) =>
      apiRequest('PATCH', `/api/super-admin/retention-policies/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/retention-policies'] });
      setEditingId(null);
      toast({ title: 'Policy updated' });
    },
    onError: (e: any) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/super-admin/retention-policies/run', {}),
    onSuccess: () => {
      toast({ title: 'Retention engine started', description: 'Enabled policies are now running. Results will appear in the Audit Log.' });
      setTimeout(() => refetch(), 3000);
    },
    onError: (e: any) => toast({ title: 'Failed to run', description: e.message, variant: 'destructive' }),
  });

  const enabledCount = policies.filter(p => p.enabled).length;

  return (
    <div className="space-y-5">
      {/* Summary + run button */}
      <Card className="border-orange-200 bg-orange-50/40">
        <CardContent className="pt-4 pb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Data Retention Policies</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabledCount} of {policies.length} policies active.
              Active policies run automatically every night at 02:00 UTC and delete records older than the configured period.
              All deletions are recorded in the Audit Log.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setConfirmOpen(true)} disabled={runMutation.isPending || enabledCount === 0}>
              <PlayCircle className="h-3.5 w-3.5" />
              {runMutation.isPending ? 'Running…' : 'Run Now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2.5 text-xs text-yellow-800">
        ⚠ Enabling a retention policy will permanently delete records beyond the retention period.
        This action cannot be undone. Ensure your database backup is current before enabling.
      </div>

      {/* Policies Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">Data Type</TableHead>
              <TableHead className="text-xs">DB Table</TableHead>
              <TableHead className="text-xs">Retain Period</TableHead>
              <TableHead className="text-xs">Last Run</TableHead>
              <TableHead className="text-xs">Last Deleted</TableHead>
              <TableHead className="text-xs">Enabled</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Loading policies…</TableCell></TableRow>
            ) : policies.map((policy) => (
              <TableRow key={policy.id} className="text-xs">
                <TableCell className="font-medium">{policy.label}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{policy.tableName}</TableCell>
                <TableCell>
                  {editingId === policy.id ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={1}
                        max={3650}
                        value={editDays}
                        onChange={(e) => setEditDays(Number(e.target.value))}
                        className="w-20 h-7 text-xs"
                      />
                      <span className="text-muted-foreground">days</span>
                      <Button size="sm" className="h-6 text-xs px-2" onClick={() => updateMutation.mutate({ id: policy.id, patch: { retainDays: editDays } })}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-xs hover:underline cursor-pointer"
                      onClick={() => { setEditingId(policy.id); setEditDays(policy.retainDays); }}
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {policy.retainDays} days
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDate(policy.lastRun)}</TableCell>
                <TableCell>
                  {policy.lastDeleted > 0 ? (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Trash2 className="h-3.5 w-3.5" />
                      {policy.lastDeleted.toLocaleString()} rows
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      None
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`policy-${policy.id}`}
                      checked={policy.enabled}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: policy.id, patch: { enabled: checked } })}
                      disabled={updateMutation.isPending}
                    />
                    <Label htmlFor={`policy-${policy.id}`} className="text-xs cursor-pointer">
                      {policy.enabled ? (
                        <Badge variant="default" className="text-xs bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Off</Badge>
                      )}
                    </Label>
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => { setEditingId(policy.id); setEditDays(policy.retainDays); }}
                  >
                    Edit days
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        All retention purges are recorded in the <strong>Audit Log</strong> tab with the number of rows deleted per table.
        Automated purges run at 02:00 UTC. You can also trigger a manual run above.
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Retention Run
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              This will permanently delete records beyond the retention period for{' '}
              <strong>{enabledCount}</strong> active {enabledCount === 1 ? 'policy' : 'policies'}:
            </p>
            <ul className="space-y-1.5 pl-1">
              {policies.filter(p => p.enabled).map(p => (
                <li key={p.id} className="text-xs flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <span><strong>{p.label}</strong> — records older than {p.retainDays} days</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-red-600 font-medium">
              ⚠ This action cannot be undone. Ensure you have a recent backup before proceeding.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { setConfirmOpen(false); runMutation.mutate(); }}
              disabled={runMutation.isPending}
            >
              <PlayCircle className="h-4 w-4 mr-1.5" />
              {runMutation.isPending ? 'Running…' : 'Delete & run policies'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
