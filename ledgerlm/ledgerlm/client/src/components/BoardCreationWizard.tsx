import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Database, Loader2, Upload } from 'lucide-react';
import { extractPptxReportTemplate } from '@/lib/pptxTemplate';

interface BoardCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  isFromTemplate: boolean;
  templateName?: string;
  templateSlug: string;
  formData: any;
  setFormData: Dispatch<SetStateAction<any>>;
  cubes: Array<{ id: string; name: string }>;
  selectedCube?: { id: string; name: string };
  cubeVersions: string[];
  saveMutation: { mutate: (data: any) => void; isPending: boolean };
  resetForm: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COMPARISONS = [
  ['previous-period', 'Previous period'],
  ['same-period-last-year', 'Same period last year'],
  ['opening-position', 'Opening position'],
  ['specific-period', 'A specific period…'],
];

export function BoardCreationWizard({
  open,
  onOpenChange,
  isEditing,
  isFromTemplate,
  templateName,
  templateSlug,
  formData,
  setFormData,
  cubes,
  selectedCube,
  cubeVersions,
  saveMutation,
  resetForm,
}: BoardCreationWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateImporting, setTemplateImporting] = useState(false);
  const [templateSourceLabel, setTemplateSourceLabel] = useState<string | null>(null);
  const isKpi = templateSlug === 'kpi-metrics';
  const isBalanceSheet = templateSlug === 'balance-sheet-tracker';
  const isEntityPnl = templateSlug === 'entity-pnl';
  const hasLegacyVarianceConfig = isEditing
    && templateSlug === 'variance-analysis'
    && !!formData.columnMapping?.actuals
    && !!formData.columnMapping?.budget;
  const isStandaloneTemplate = !hasLegacyVarianceConfig;

  useEffect(() => {
    if (open) {
      setStep(1);
      setTemplateError(null);
      setTemplateImporting(false);
      setTemplateSourceLabel(null);
    }
  }, [open]);

  const update = (patch: Record<string, unknown>) => setFormData((current: any) => ({ ...current, ...patch }));
  const updateScope = (patch: Record<string, unknown>) =>
    setFormData((current: any) => ({ ...current, scope: { ...current.scope, ...patch } }));
  const updateSchedule = (patch: Record<string, unknown>) =>
    setFormData((current: any) => ({ ...current, schedule: { ...current.schedule, ...patch } }));

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(1);
      if (!isEditing) resetForm();
    }
    onOpenChange(nextOpen);
  };

  const submit = () => {
    if (!formData.title.trim()) {
      return;
    }
    saveMutation.mutate(formData);
  };

  const loadTextTemplate = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const supportedExtensions = new Set(['.txt', '.md', '.csv', '.pptx']);
    if (!supportedExtensions.has(extension)) {
      setTemplateError('Upload a .pptx, .txt, .md, or .csv template.');
      event.target.value = '';
      return;
    }
    setTemplateError(null);
    setTemplateSourceLabel(null);
    setTemplateImporting(true);
    if (extension === '.pptx') {
      try {
        const imported = await extractPptxReportTemplate(file);
        update({ reportTemplate: imported.template });
        setTemplateSourceLabel(`PowerPoint template loaded · ${imported.slideCount} slides`);
      } catch (error) {
        setTemplateError(error instanceof Error ? error.message : 'The PowerPoint template could not be read.');
      } finally {
        setTemplateImporting(false);
        event.target.value = '';
      }
      return;
    }
    if (file.size > 20_000) {
      setTemplateError('Text templates must be 20 KB or smaller.');
      setTemplateImporting(false);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      if (content.length > 5_000) {
        setTemplateError('Template content must be 5,000 characters or fewer.');
        setTemplateImporting(false);
        return;
      }
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(content)) {
        setTemplateError('This file contains binary data. Upload a plain text, Markdown, or CSV template.');
        setTemplateImporting(false);
        return;
      }
      update({ reportTemplate: content });
      setTemplateSourceLabel('Text template loaded');
      setTemplateImporting(false);
    };
    reader.onerror = () => {
      setTemplateError('The template file could not be read. Try a PowerPoint, plain text, Markdown, or CSV file.');
      setTemplateImporting(false);
    };
    reader.readAsText(file);
  };

  const stepTitle = step === 1 ? 'Context' : step === 2 ? 'Analysis Scope' : 'Schedule Analysis';
  const stepDescription = step === 1
    ? 'Name, description, prompt'
    : step === 2
      ? 'Sources and governed scope'
      : 'Frequency and report output';

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0" data-testid="dialog-board-creation-wizard">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 p-1.5"><Database className="w-4 h-4 text-primary" /></span>
            {isEditing ? 'Edit Board' : 'Create Board'}
            {isFromTemplate && <Badge variant="outline" className="text-[10px] uppercase">{templateName}</Badge>}
          </DialogTitle>
          <DialogDescription>Customise the board settings and analysis prompts, then start analysing.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <nav className="w-56 shrink-0 border-r bg-muted/20 p-4 space-y-2" aria-label="Board setup steps">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Setup · Step {step} of 3</p>
            {[
              ['1', 'Context', 'Name, Description, Prompt'],
              ['2', 'Analysis Scope', 'Sources and governed scope'],
              ['3', 'Schedule Analysis', 'Frequency and report output'],
            ].map(([number, title, description], index) => {
              const itemStep = (index + 1) as 1 | 2 | 3;
              const complete = step > itemStep;
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => itemStep <= step && setStep(itemStep)}
                  className={`w-full text-left rounded-lg border p-3 flex gap-3 transition-colors ${step === itemStep ? 'border-primary bg-background shadow-sm' : 'border-transparent hover:bg-background/70'}`}
                >
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 ${complete ? 'bg-primary text-primary-foreground border-primary' : step === itemStep ? 'border-primary text-primary' : 'text-muted-foreground'}`}>
                    {complete ? <Check className="w-3.5 h-3.5" /> : number}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {step === 1 && (
              <div className="space-y-5 max-w-3xl">
                <div className="space-y-1.5">
                  <Label htmlFor="wizard-board-name">Board name</Label>
                  <Input id="wizard-board-name" value={formData.title} onChange={(event) => update({ title: event.target.value })} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><Label htmlFor="wizard-board-description">Description</Label><span className="text-[11px] text-muted-foreground">Shown on the board card</span></div>
                  <Textarea id="wizard-board-description" rows={3} value={formData.description || ''} onChange={(event) => update({ description: event.target.value })} maxLength={2000} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><Label htmlFor="wizard-prompt">Analysis context / system prompt</Label><span className="text-[11px] text-muted-foreground">5 directives max</span></div>
                  <Textarea id="wizard-prompt" rows={8} value={formData.analysisPrompts || ''} onChange={(event) => update({ analysisPrompts: event.target.value })} className="font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label>Compare against</Label><span className="text-[11px] text-muted-foreground">Every movement and % change is measured against this period</span></div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {COMPARISONS.map(([value, label]) => (
                      <button key={value} type="button" onClick={() => update({ comparisonBasis: value })} className={`rounded-md border px-3 py-2 text-xs text-left transition-colors ${formData.comparisonBasis === value ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ['enterprise', 'Enterprise Data', 'Access company-wide financial documents'],
                    ['vault', 'Vault Documents', 'Personal uploaded documents'],
                  ].map(([key, label, description]) => (
                    <div key={key} className="rounded-lg border p-4 flex items-center justify-between">
                      <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground mt-1">{description}</p></div>
                      <Switch checked={!!formData.dataSources[key]} onCheckedChange={(checked) => update({ dataSources: { ...formData.dataSources, [key]: checked } })} />
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">{isKpi ? 'Governed KPI Metrics selection' : isBalanceSheet ? 'Governed Balance Sheet selection' : isEntityPnl ? 'Governed Entity P&L selection' : 'Governed analysis selection'}</h3>
                    <p className="text-xs text-muted-foreground mt-1">This Board runs governed calculations using authorized source data. Raw source data is never copied into the Board.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Enterprise cube</Label>
                    <select value={formData.cubeId} onChange={(event) => update({ cubeId: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                      <option value="">No cube selected</option>
                      {cubes.map((cube) => <option key={cube.id} value={cube.id}>{cube.name}</option>)}
                    </select>
                    {selectedCube && <p className="text-[11px] text-muted-foreground">Authorized source: {selectedCube.name}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Entity {isKpi || isEntityPnl ? '(optional)' : ''}</Label>
                      <Input value={formData.scope.entity} onChange={(event) => updateScope({ entity: event.target.value })} placeholder="All entities" />
                    </div>
                    {isStandaloneTemplate && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data version <span className="font-normal text-muted-foreground">(optional)</span></Label>
                        <select value={formData.scope.version} onChange={(event) => updateScope({ version: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                          <option value="">Use the available source data</option>
                          {cubeVersions.map((version) => <option key={version} value={version}>{version}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Year</Label>
                      <select value={formData.scope.year} onChange={(event) => updateScope({ year: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                        {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((year) => <option key={year}>{year}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Month</Label>
                      <select value={formData.scope.month} onChange={(event) => updateScope({ month: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                        {MONTHS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Forecast scenario</Label>
                      <select value={formData.scope.forecastScenario} onChange={(event) => updateScope({ forecastScenario: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                        {['YTD Forecast', 'CF02', 'CF05', 'CF09', 'CF11'].map((scenario) => <option key={scenario}>{scenario}</option>)}
                      </select>
                    </div>
                  </div>
                  {formData.cubeId && !isStandaloneTemplate && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
                      <VersionSelectInline label="Actuals version" value={formData.columnMapping.actuals} versions={cubeVersions} onChange={(value) => update({ columnMapping: { ...formData.columnMapping, actuals: value } })} />
                      <VersionSelectInline label="Budget version" value={formData.columnMapping.budget} versions={cubeVersions} onChange={(value) => update({ columnMapping: { ...formData.columnMapping, budget: value } })} />
                      <VersionSelectInline label="Forecast version" value={formData.columnMapping.forecast} versions={cubeVersions} onChange={(value) => update({ columnMapping: { ...formData.columnMapping, forecast: value } })} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wizard-report-template">Report template <span className="font-normal text-muted-foreground">optional</span></Label>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
                      <Upload className="w-3.5 h-3.5" /> {templateImporting ? 'Loading template…' : 'Upload template file'}
                      <input type="file" accept=".pptx,.txt,.md,.csv" className="sr-only" onChange={loadTextTemplate} disabled={templateImporting} />
                    </label>
                  </div>
                   <Textarea id="wizard-report-template" rows={9} maxLength={5000} value={formData.reportTemplate || ''} onChange={(event) => update({ reportTemplate: event.target.value })} placeholder={'Define how the analysis should be captured — sections, tables, order, tone. e.g.\n\n1. Executive Summary (3 bullets)\n2. Variance Table: Period | Actual | Budget | Var | Var %\n3. Top 3 adverse variances with likely drivers\n4. Recommended actions'} className="font-mono text-xs" />
                    {templateError ? <p className="text-xs text-destructive" role="alert" data-testid="text-board-template-error">{templateError}</p> : templateSourceLabel ? <p className="text-xs text-primary" role="status">{templateSourceLabel}. Slide text and placeholders were imported; the original PowerPoint styling is not stored in this text template.</p> : <p className="text-xs text-muted-foreground">The generated report follows this structure. PowerPoint, text, Markdown, and CSV templates are supported in this flow.</p>}
                </div>
                <div className="rounded-lg border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3"><CalendarDays className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">Scheduled Run</p><p className="text-xs text-muted-foreground">Automatically run the analysis and file the report under Reports.</p></div></div>
                  <Switch checked={formData.schedule.enabled} onCheckedChange={(enabled) => updateSchedule({ enabled })} />
                </div>
                {formData.schedule.enabled && (
                  <div className="rounded-lg border bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Frequency</Label><select value={formData.schedule.frequency} onChange={(event) => updateSchedule({ frequency: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">{[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom interval']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    <div className="space-y-1.5"><Label className="text-xs">Timezone</Label><Input value={formData.schedule.timezone} onChange={(event) => updateSchedule({ timezone: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Start at</Label><Input type="datetime-local" value={formData.schedule.startAt} onChange={(event) => updateSchedule({ startAt: event.target.value })} /></div>
                    {formData.schedule.frequency === 'custom' && <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label className="text-xs">Every</Label><Input type="number" min={1} max={10000} value={formData.schedule.interval} onChange={(event) => updateSchedule({ interval: Number(event.target.value) })} /></div><div className="space-y-1.5"><Label className="text-xs">Unit</Label><select value={formData.schedule.intervalUnit} onChange={(event) => updateSchedule({ intervalUnit: event.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">{['minutes', 'hours', 'days', 'weeks', 'months'].map((unit) => <option key={unit}>{unit}</option>)}</select></div></div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3 flex-row justify-between">
          <div className="text-xs text-muted-foreground">Step {step} of 3 · {stepTitle}</div>
          <div className="flex gap-2">
            {step > 1 && <Button type="button" variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)}><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>}
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={saveMutation.isPending}>{step === 3 ? 'Discard' : 'Cancel'}</Button>
            {step < 3 && <Button type="button" variant="outline" onClick={submit} disabled={saveMutation.isPending || !formData.title.trim()}>{saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save changes'}</Button>}
            {step < 3 ? <Button type="button" onClick={() => setStep((step + 1) as 1 | 2 | 3)} disabled={step === 1 && !formData.title.trim()}>Next<ChevronRight className="w-4 h-4 ml-1" /></Button> : <Button type="button" onClick={submit} disabled={saveMutation.isPending || !formData.title.trim()}>{saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : isEditing ? 'Save changes' : 'Submit'}</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionSelectInline({ label, value, versions, onChange }: { label: string; value: string; versions: string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-xs">
        <option value="">Select version</option>
        {versions.map((version) => <option key={version} value={version}>{version}</option>)}
      </select>
    </div>
  );
}