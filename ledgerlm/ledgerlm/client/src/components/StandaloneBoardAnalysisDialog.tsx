import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, Loader2, Play, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { type Board } from '@shared/schema';

interface StandaloneBoardAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  onRunStarted?: () => void;
}

interface AnalysisConfig {
  sourceType?: 'enterprise' | 'vault';
  sourceConfig?: { sourceType?: 'enterprise' | 'vault'; cubeId?: string; documentId?: string; name?: string } | null;
  scopeMode?: string;
  keyColumns?: Array<{ column: string; label: string; aggregation?: string; valueType?: string }>;
  excludedColumns?: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DIMENSIONS = ['Entity', 'Sector', 'Cost Category', 'Resource Type', 'Location', 'Project GB', 'Planning GB', 'Salary Level'];

function templateLabel(templateKey: string) {
  return ({
    'kpi-metrics': 'KPI Metrics',
    'entity-pnl': 'Entity P&L',
    'balance-sheet-tracker': 'Balance Sheet',
  } as Record<string, string>)[templateKey] ?? 'Board Analysis';
}

export function StandaloneBoardAnalysisDialog({
  open,
  onOpenChange,
  board,
  onRunStarted,
}: StandaloneBoardAnalysisDialogProps) {
  const { toast } = useToast();
  const settings = (board.settings as any) ?? {};
  const flow = settings.boardFlow ?? {};
  const templateKey = settings.templateKey ?? 'custom-kpi-board';
  const label = templateLabel(templateKey);
  const currentYear = new Date().getFullYear();
  const configuredDimensions = Array.isArray(settings.defaultDimensions)
    ? settings.defaultDimensions.map(String)
    : ['Entity', 'Sector', 'Cost Category'];

  const [year, setYear] = useState(Number(flow.scope?.year) || currentYear);
  const [months, setMonths] = useState<number[]>([Number(flow.scope?.month) || new Date().getMonth() + 1]);
  const [dimensions, setDimensions] = useState<string[]>(configuredDimensions);
  const [extraContext, setExtraContext] = useState('');

  const { data: config, isLoading: configLoading } = useQuery<AnalysisConfig>({
    queryKey: ['/api/boards', board.id, 'analysis-config'],
    queryFn: () => apiRequest('GET', `/api/boards/${board.id}/analysis-config`) as Promise<AnalysisConfig>,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setYear(Number(flow.scope?.year) || currentYear);
    setMonths([Number(flow.scope?.month) || new Date().getMonth() + 1]);
    setDimensions(configuredDimensions);
    setExtraContext('');
  }, [open, board.id]);

  const sourceSelection = useMemo(() => {
    const source = config?.sourceConfig;
    if (source?.sourceType === 'vault' && source.documentId) {
      return { sourceType: 'vault' as const, documentId: source.documentId };
    }
    if (source?.sourceType === 'enterprise' && source.cubeId) {
      return { sourceType: 'enterprise' as const, cubeId: source.cubeId };
    }
    if (settings.cubeId) return { sourceType: 'enterprise' as const, cubeId: settings.cubeId };
    return undefined;
  }, [config, settings.cubeId]);

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!sourceSelection) throw new Error('Select an authorized source before starting this analysis.');
      if (!months.length) throw new Error('Select at least one month.');
      if (!dimensions.length) throw new Error('Select at least one grouping dimension.');
      return apiRequest('POST', `/api/boards/${board.id}/analysis-runs`, {
        year,
        months,
        dimensions,
        scopeMode: config?.scopeMode ?? 'all',
        keyColumns: config?.keyColumns,
        excludedColumns: config?.excludedColumns,
        sourceSelection,
        extraContext: extraContext.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', board.id, 'analysis-runs'] });
      toast({ title: 'Analysis started', description: `${label} is being prepared.` });
      onOpenChange(false);
      onRunStarted?.();
    },
    onError: (error: Error) => toast({ title: 'Could not start analysis', description: error.message, variant: 'destructive' }),
  });

  const toggleMonth = (month: number) =>
    setMonths((current) => current.includes(month)
      ? current.filter((value) => value !== month)
      : [...current, month].sort((a, b) => a - b));

  const toggleDimension = (dimension: string) =>
    setDimensions((current) => current.includes(dimension)
      ? current.filter((value) => value !== dimension)
      : [...current, dimension]);

  const sourceLabel = config?.sourceConfig?.name
    ?? (sourceSelection?.sourceType === 'enterprise' ? 'Authorized Enterprise Data' : sourceSelection ? 'Authorized Vault document' : 'No source selected');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="dialog-standalone-board-analysis">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Run {label}
          </DialogTitle>
          <DialogDescription>
            Select the period and scope for this Board. This standalone flow does not require Actuals or Budget mappings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-3 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Analysis source</p>
              <p className="text-sm">{configLoading ? 'Loading authorized source…' : sourceLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">Source access is verified on the server for this Board owner.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2"><CalendarDays className="w-4 h-4 text-muted-foreground" />Analysis period</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10">Year</span>
              <div className="flex gap-1">
                {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
                  <button key={value} type="button" onClick={() => setYear(value)} className={`px-3 py-1 rounded text-sm border ${year === value ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>{value}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MONTHS.map((month, index) => (
                <button key={month} type="button" onClick={() => toggleMonth(index + 1)} className={`px-2.5 py-1.5 rounded text-xs border ${months.includes(index + 1) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>{month}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Selected: {months.length ? months.map((month) => MONTHS[month - 1]).join(', ') : 'none'} {year}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Group results by</Label>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setDimensions(configuredDimensions)}>Reset</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DIMENSIONS.map((dimension) => {
                const selected = dimensions.includes(dimension);
                return (
                  <button key={dimension} type="button" onClick={() => toggleDimension(dimension)} className={`px-2.5 py-1 rounded-full text-xs border ${selected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {selected && <Check className="inline-block w-3 h-3 mr-1" />}{dimension}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional context <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea value={extraContext} onChange={(event) => setExtraContext(event.target.value)} maxLength={10000} rows={3} placeholder="Add instructions for this run, such as an entity or business question." />
          </div>
          <Badge variant="outline" className="text-xs font-normal">Template: {label}</Badge>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={runMutation.isPending}>Cancel</Button>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || configLoading || !sourceSelection || !months.length || !dimensions.length}>
            {runMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting…</> : <><Play className="w-4 h-4 mr-2" />Start analysis</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}