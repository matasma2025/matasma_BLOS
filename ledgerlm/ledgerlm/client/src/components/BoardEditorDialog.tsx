/**
 * BoardEditorDialog — create or edit a Smart Analysis Board.
 *
 * Phase 1 additions:
 *  - Cube selector (fetches user's accessible cubes)
 *  - Column mapping: Actuals / Budget / Forecast version dropdowns
 *    (fetches available version values from the selected cube)
 *  - Default prompt template stored in settings
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, ChevronDown } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { type BoardTemplate, type Board } from '@shared/schema';

interface Cube { id: string; name: string; description?: string }
interface CubeAccess { cubes: Cube[] }

interface BoardEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: BoardTemplate;
  board?: Board;
}

export function BoardEditorDialog({
  open,
  onOpenChange,
  template,
  board,
}: BoardEditorDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!board;
  const isFromTemplate = !!template && !board;

  // ── Accessible cubes ───────────────────────────────────────────────────────
  const { data: cubeAccess } = useQuery<CubeAccess>({
    queryKey: ['/api/user/accessible-cubes'],
    enabled: open,
  });
  const cubes = cubeAccess?.cubes ?? [];

  // ── Form state ─────────────────────────────────────────────────────────────
  const getInitialFormData = () => {
    const src = board ? (board.settings as any) : template ? (template.defaultConfig as any) : null;
    return {
      title: board?.title ?? template?.name ?? '',
      description: board?.description ?? template?.description ?? '',
      analysisPrompts: src?.analysisPrompts ?? '',
      cubeId: src?.cubeId ?? '',
      columnMapping: {
        actuals:          src?.columnMapping?.actuals          ?? '',
        budget:           src?.columnMapping?.budget           ?? '',
        forecast:         src?.columnMapping?.forecast         ?? '',
        rollingForecasts: src?.columnMapping?.rollingForecasts ?? [] as string[],
      },
      dataSources: {
        enterprise:   src?.dataSources?.enterprise   ?? true,
        vault:        src?.dataSources?.vault        ?? true,
        webApis:      src?.dataSources?.webApis      ?? false,
        financialApis: src?.dataSources?.financialApis ?? false,
      },
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  useEffect(() => {
    if (open) setFormData(getInitialFormData());
  }, [open, template, board]);

  // ── Available versions for selected cube ───────────────────────────────────
  const { data: cubeVersions = [] } = useQuery<string[]>({
    queryKey: ['/api/cubes', formData.cubeId, 'versions'],
    enabled: open && !!formData.cubeId,
    queryFn: () => apiRequest('GET', `/api/cubes/${formData.cubeId}/versions`) as Promise<string[]>,
  });

  const selectedCube = cubes.find((c) => c.id === formData.cubeId);

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        description: data.description,
        templateId: template?.id ?? null,
        settings: {
          analysisPrompts: data.analysisPrompts,
          cubeId: data.cubeId || undefined,
          columnMapping: data.cubeId ? data.columnMapping : undefined,
          dataSources: data.dataSources,
        },
      };
      if (isEditing && board) {
        return apiRequest('PUT', `/api/boards/${board.id}`, payload);
      }
      return apiRequest('POST', `/api/boards`, payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards'] });
      toast({ title: 'Success', description: `Board ${isEditing ? 'updated' : 'created'}` });
      onOpenChange(false);
      resetForm();
      if (!isEditing) setTimeout(() => navigate(`/board/${data.id}`), 300);
      else queryClient.invalidateQueries({ queryKey: ['/api/boards', board?.id] });
    },
    onError: () => {
      toast({ title: 'Error', description: `Failed to ${isEditing ? 'update' : 'create'} board`, variant: 'destructive' });
    },
  });

  const resetForm = () => setFormData({
    title: '', description: '', analysisPrompts: '',
    cubeId: '',
    columnMapping: { actuals: '', budget: '', forecast: '', rollingForecasts: [] },
    dataSources: { enterprise: true, vault: true, webApis: false, financialApis: false },
  });

  const setMapping = (field: string, value: string) =>
    setFormData((f) => ({ ...f, columnMapping: { ...f.columnMapping, [field]: value } }));

  const toggleRolling = (v: string) =>
    setFormData((f) => {
      const cur = f.columnMapping.rollingForecasts ?? [];
      const next = cur.includes(v) ? cur.filter((x: string) => x !== v) : [...cur, v];
      return { ...f, columnMapping: { ...f.columnMapping, rollingForecasts: next } };
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o && !isEditing) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Board' : isFromTemplate ? `Create Board from ${template.name}` : 'Create New Board'}
          </DialogTitle>
          <DialogDescription>
            {isFromTemplate ? 'Customise the board settings and analysis prompts, then start analysing'
              : 'Create a custom board with analysis prompts and data source configuration'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Board Name</Label>
            <Input id="title" value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. BGSW Monthly Variance" required />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this board's purpose..." />
          </div>

          {/* Analysis Prompts */}
          <div className="space-y-1.5">
            <Label htmlFor="prompts">Analysis Context / System Prompt</Label>
            <Textarea id="prompts" rows={5} value={formData.analysisPrompts}
              onChange={(e) => setFormData({ ...formData, analysisPrompts: e.target.value })}
              placeholder="Describe what this board analyses, any special instructions for the AI..."
              className="font-mono text-sm" />
          </div>

          {/* ── Cube & Column Mapping ─────────────────────────────────────── */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Data Cube &amp; Column Mapping</Label>
                <Badge variant="secondary" className="text-xs">Smart Analysis</Badge>
              </div>
            </div>

            {/* Cube selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Select Cube</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVersionDropdown((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                >
                  <span className={formData.cubeId ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedCube ? selectedCube.name : 'No cube selected (optional)'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {showVersionDropdown && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-background border rounded-md shadow-md max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                      onClick={() => { setFormData((f) => ({ ...f, cubeId: '' })); setShowVersionDropdown(false); }}
                    >
                      None
                    </button>
                    {cubes.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${formData.cubeId === c.id ? 'bg-primary/10 font-medium' : ''}`}
                        onClick={() => { setFormData((f) => ({ ...f, cubeId: c.id })); setShowVersionDropdown(false); }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecting a cube enables "Run Analysis" — generates AI variance reports directly from your data.
              </p>
            </div>

            {/* Column mapping — shown only when a cube is selected */}
            {formData.cubeId && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Map logical roles to <strong>Version</strong> values in your data.
                  {cubeVersions.length === 0 && ' (Upload data to see available versions.)'}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Actuals */}
                  <div className="space-y-1">
                    <Label className="text-xs">Actuals Column</Label>
                    <VersionSelect
                      value={formData.columnMapping.actuals}
                      versions={cubeVersions}
                      onChange={(v) => setMapping('actuals', v)}
                      placeholder="e.g. Actual / CF02 2026"
                    />
                    <p className="text-xs text-muted-foreground">plan_type value for "Actuals"</p>
                  </div>
                  {/* Budget */}
                  <div className="space-y-1">
                    <Label className="text-xs">Budget Column</Label>
                    <VersionSelect
                      value={formData.columnMapping.budget}
                      versions={cubeVersions}
                      onChange={(v) => setMapping('budget', v)}
                      placeholder="e.g. TBP 2026"
                    />
                    <p className="text-xs text-muted-foreground">plan_type value for "Budget"</p>
                  </div>
                  {/* Forecast */}
                  <div className="space-y-1">
                    <Label className="text-xs">Forecast Column <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <VersionSelect
                      value={formData.columnMapping.forecast}
                      versions={cubeVersions}
                      onChange={(v) => setMapping('forecast', v)}
                      placeholder="e.g. CF05 2026"
                    />
                    <p className="text-xs text-muted-foreground">plan_type value for "Forecast"</p>
                  </div>
                </div>

                {/* Rolling forecasts */}
                {cubeVersions.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rolling Forecasts to Expose</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {cubeVersions.map((v) => {
                        const checked = (formData.columnMapping.rollingForecasts ?? []).includes(v);
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleRolling(v)}
                            className={`px-2 py-1 rounded text-xs border transition-colors ${
                              checked ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border hover:bg-muted'
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Checked versions will be selectable in board queries.</p>
                  </div>
                )}

                {/* Preview */}
                {(formData.columnMapping.actuals || formData.columnMapping.budget) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Preview:</span>
                    {formData.columnMapping.actuals && (
                      <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                        actuals → {formData.columnMapping.actuals}
                      </Badge>
                    )}
                    {formData.columnMapping.budget && (
                      <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
                        budget → {formData.columnMapping.budget}
                      </Badge>
                    )}
                    {formData.columnMapping.forecast && (
                      <Badge className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-100">
                        forecast → {formData.columnMapping.forecast}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Sources */}
          <div className="space-y-3">
            <Label>Data Sources</Label>
            <div className="space-y-3 rounded-lg border p-4">
              {[
                { key: 'enterprise', label: 'Enterprise Data', desc: 'Access company-wide financial documents' },
                { key: 'vault',      label: 'Vault Documents',  desc: 'Personal uploaded documents' },
                { key: 'webApis',    label: 'Web APIs',         desc: 'Search web for market data and news' },
                { key: 'financialApis', label: 'Financial APIs', desc: 'External financial data sources' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Switch
                    checked={formData.dataSources[key as keyof typeof formData.dataSources] as boolean}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, dataSources: { ...formData.dataSources, [key]: v } })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEditing ? 'Updating…' : 'Creating…'}</>
                : isEditing ? 'Update Board' : 'Create Board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Small version-select helper ───────────────────────────────────────────────
function VersionSelect({
  value, versions, onChange, placeholder,
}: { value: string; versions: string[]; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-1.5 rounded-md border text-sm bg-background hover:bg-muted transition-colors pr-8"
      >
        <option value="">{placeholder}</option>
        {versions.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      {!versions.length && value && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 h-8 text-sm"
        />
      )}
    </div>
  );
}
