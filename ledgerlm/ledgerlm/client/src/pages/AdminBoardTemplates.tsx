import { useEffect, useState, type ChangeEvent, type ComponentType } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, apiRequestWithAdminStepUp, queryClient } from '@/lib/queryClient';
import { extractPptxReportTemplate } from '@/lib/pptxTemplate';
import * as Icons from 'lucide-react';

// Bridge the legacy workspace's React/Lucide declaration versions.
const { FileText, Upload, Loader2, Shield, LayoutTemplate, Trash2, RefreshCw } = Icons as unknown as
  Record<'FileText' | 'Upload' | 'Loader2' | 'Shield' | 'LayoutTemplate' | 'Trash2' | 'RefreshCw', ComponentType<{ className?: string }>>;

const LIST_KEY = ['/api/domain-admin/board-templates', 'master-catalog'];
const MAX_CHARS = 5000;
const MAX_PPTX = 5 * 1024 * 1024;
const BALANCE_SHEET = 'balance-sheet-tracker';

interface TemplateMeta {
  templateSlug: string; name: string; templateKey?: string | null; hasPptx: boolean;
  fileName?: string | null; revision?: number | string | null; updatedAt?: string | null;
}
interface ListResponse { templates: TemplateMeta[]; lockedDomain: string }
interface DetailResponse extends TemplateMeta { reportTemplate: string; expectedHash: string }
interface Draft {
  text: string; hash: string; baseText?: string; pptxBase64?: string; fileName?: string;
  clearPptx: boolean; notice?: string;
}

const statusOf = (e: unknown) => (e as { status?: number } | null)?.status;
const msgOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : 'Never');

export default function AdminBoardTemplates() {
  const { toast } = useToast();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const list = useQuery<ListResponse>({
    queryKey: LIST_KEY,
    queryFn: () => apiRequest('GET', '/api/domain-admin/board-templates') as Promise<ListResponse>,
    retry: false,
    staleTime: 0, refetchInterval: 30_000,
  });
  const templates = list.data?.templates ?? [];

  useEffect(() => {
    if (!selectedSlug && templates.length) setSelectedSlug(templates[0].templateSlug);
  }, [templates, selectedSlug]);

  const detail = useQuery<DetailResponse>({
    queryKey: [...LIST_KEY, selectedSlug],
    queryFn: () => apiRequest('GET', `/api/domain-admin/board-templates/${selectedSlug}`) as Promise<DetailResponse>,
    enabled: !!selectedSlug,
    retry: false,
    staleTime: 0, refetchInterval: 30_000,
  });

  // Never overwrite unsaved master-template edits on refetch.
  useEffect(() => {
    const d = detail.data;
    if (!d) return;
    setDrafts((cur) => {
      const old = cur[d.templateSlug];
      if (old && (old.text !== old.baseText || old.pptxBase64 || old.clearPptx)) return cur;
      return { ...cur, [d.templateSlug]: { text: d.reportTemplate, baseText: d.reportTemplate, hash: d.expectedHash, clearPptx: false } };
    });
  }, [detail.data]);

  const draft = selectedSlug ? drafts[selectedSlug] : undefined;
  const patch = (p: Partial<Draft>) => selectedSlug && setDrafts((c) => ({ ...c, [selectedSlug]: { ...c[selectedSlug], ...p } }));

  const save = useMutation({
    mutationFn: async () => {
      const d = detail.data!; const dr = draft!;
      const body: Record<string, unknown> = { reportTemplate: dr.text, expectedHash: dr.hash };
      if (dr.pptxBase64) { body.reportTemplatePptxBase64 = dr.pptxBase64; body.fileName = dr.fileName; }
      else if (dr.clearPptx) body.clearPptx = true;
      return apiRequestWithAdminStepUp(() => apiRequest('PUT', `/api/domain-admin/board-templates/${d.templateSlug}`, body) as Promise<DetailResponse>);
    },
    onSuccess: (saved) => {
      setDrafts((c) => ({ ...c, [saved.templateSlug]: { text: saved.reportTemplate, baseText: saved.reportTemplate, hash: saved.expectedHash, clearPptx: false } }));
      queryClient.setQueryData([...LIST_KEY, saved.templateSlug], saved);
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin'] });
      queryClient.invalidateQueries({ queryKey: ['/api/board-templates'] });
      toast({ title: 'Master template saved', description: `${saved.name} updated for newly created Bosch Boards. Existing Boards are unchanged.` });
    },
    onError: (e) => toast({ title: 'Save failed', description: msgOf(e), variant: 'destructive' }),
  });

  const onFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file || !selectedSlug) return;
    setFileError(null);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.pptx', '.txt', '.md', '.csv'].includes(ext)) return setFileError('Upload a .pptx, .txt, .md, or .csv template.');
    setImporting(true);
    try {
      if (ext === '.pptx') {
        if (file.size > MAX_PPTX) throw new Error('PowerPoint templates must be 5 MB or smaller.');
        const imp = await extractPptxReportTemplate(file);
        patch({ text: imp.template, pptxBase64: imp.bytesBase64, fileName: file.name, clearPptx: false,
          notice: `PowerPoint loaded, ${imp.slideCount} slides. The original file is preserved on save.` });
      } else {
        if (file.size > 20_000) throw new Error('Text templates must be 20 KB or smaller.');
        const content = await file.text();
        if (content.length > MAX_CHARS) throw new Error('Template content must be 5,000 characters or fewer.');
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(content)) throw new Error('This file contains binary data. Upload plain text, Markdown, or CSV.');
        patch({ text: content, pptxBase64: undefined, fileName: undefined, clearPptx: true,
          notice: 'Text template loaded. Any stored PowerPoint will be removed on save.' });
      }
    } catch (e) { setFileError(msgOf(e)); } finally { setImporting(false); }
  };

  const unsupported = statusOf(list.error) === 403 || statusOf(detail.error) === 403;
  const selected = templates.find((b) => b.templateSlug === selectedSlug);
  const isBalance = (detail.data?.templateKey ?? selected?.templateKey) === BALANCE_SHEET;
  const dirty = !!draft && !!detail.data && (draft.text !== detail.data.reportTemplate || !!draft.pptxBase64 || draft.clearPptx);
  const tooLong = !!draft && draft.text.length > MAX_CHARS;
  const hasPptxNow = !!draft?.pptxBase64 || (!!detail.data?.hasPptx && !draft?.clearPptx);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-primary/40 px-6 py-4 flex-shrink-0 lg:px-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Board Administration</h1>
                <Badge variant="outline" data-testid="badge-template-domain">{list.data?.lockedDomain ?? 'bosch.com'}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage the three master templates. Changes apply to new Boards only.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => list.refetch()}
              disabled={list.isFetching}
              className="shrink-0"
              data-testid="button-refresh-boards"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${list.isFetching ? 'animate-spin' : ''}`} />
              {list.isFetching ? 'Refreshing…' : 'Refresh templates'}
            </Button>
          </header>

          <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-8">
            {unsupported ? (
              <Card className="mx-auto max-w-2xl border-destructive/30" data-testid="state-unsupported-domain">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-destructive" />Unsupported domain</CardTitle>
                  <CardDescription>Master template administration is only available to the Bosch domain. Your domain retains its existing Board template workflow.</CardDescription>
                </CardHeader>
              </Card>
            ) : list.isLoading ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]" data-testid="state-loading">
                <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
                <div className="h-[30rem] rounded-xl bg-muted animate-pulse" />
              </div>
            ) : list.error ? (
              <Card className="mx-auto max-w-2xl border-destructive/30">
                <CardContent className="space-y-3 py-8 text-center">
                  <p role="alert" className="text-sm text-destructive">{msgOf(list.error)}</p>
                  <Button onClick={() => list.refetch()}>Retry</Button>
                </CardContent>
              </Card>
            ) : templates.length === 0 ? (
              <Card className="mx-auto max-w-2xl">
                <CardContent className="py-10 text-center text-sm text-muted-foreground" data-testid="state-empty">
                  <LayoutTemplate className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                  Bosch master templates are not available yet. Refresh after initialization.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-6">
                <aside className="min-w-0" aria-label="Master template selection">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Master templates</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Choose a template to manage</p>
                    </div>
                    <Badge variant="secondary" data-testid="text-template-count">{templates.length}</Badge>
                  </div>
                  <div className="space-y-2" role="listbox" aria-label="Bosch master templates">
                    {templates.map((b) => {
                      const active = b.templateSlug === selectedSlug;
                      return (
                        <button
                          key={b.templateSlug}
                          type="button"
                          role="option"
                          aria-selected={active}
                          disabled={save.isPending}
                          onClick={() => { setSelectedSlug(b.templateSlug); setFileError(null); save.reset(); }}
                          data-testid={`button-template-${b.templateSlug}`}
                          className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' : 'bg-card hover:border-primary/40 hover:bg-muted/50'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{b.name}</span>
                            {drafts[b.templateSlug] && b.templateSlug !== selectedSlug && (drafts[b.templateSlug].text !== drafts[b.templateSlug].baseText || drafts[b.templateSlug].pptxBase64 || drafts[b.templateSlug].clearPptx) && (
                              <Badge variant="outline" className="shrink-0 text-[10px]">Unsaved</Badge>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground/75">{b.templateKey === BALANCE_SHEET ? 'Built-in layout' : b.hasPptx ? 'PowerPoint' : 'Text'}</span>
                            <span aria-hidden="true">·</span>
                            <span>Rev {b.revision ?? 0}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{fmt(b.updatedAt)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-xl border bg-card px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Master template changes affect newly created Boards. Existing Boards keep their saved template.
                      </p>
                    </div>
                  </div>
                </aside>

                <section className="min-w-0" aria-label="Selected template editor">
                  {detail.isLoading ? (
                    <div className="h-[30rem] rounded-xl bg-muted animate-pulse" data-testid="state-detail-loading" />
                  ) : detail.error ? (
                    <Card className="border-destructive/30">
                      <CardContent className="space-y-3 py-8 text-center">
                        <p role="alert" className="text-sm text-destructive">{msgOf(detail.error)}</p>
                        <Button onClick={() => detail.refetch()}>Retry</Button>
                      </CardContent>
                    </Card>
                  ) : detail.data && isBalance ? (
                    <Card data-testid="panel-balance-sheet">
                      <CardHeader className="border-b p-5 sm:p-6">
                        <CardTitle className="flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" />{detail.data.name}</CardTitle>
                        <CardDescription>Balance Sheet Boards use a fixed built-in report layout.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 p-5 text-sm leading-6 text-muted-foreground sm:p-6">
                        <p>The statement is rendered by LedgerLM with a governed layout of assets, liabilities, and equity, so a custom text or PowerPoint template cannot replace it.</p>
                        <p>No template changes are available for this Board type.</p>
                      </CardContent>
                    </Card>
                  ) : detail.data && draft ? (
                    <Card className="overflow-hidden">
                      <CardHeader className="border-b p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="truncate" data-testid="text-selected-template">{detail.data.name}</CardTitle>
                            <CardDescription className="mt-1">
                              Revision {detail.data.revision ?? 0} <span aria-hidden="true">·</span> Updated {fmt(detail.data.updatedAt)}
                            </CardDescription>
                          </div>
                          {dirty && <Badge variant="outline" className="shrink-0" data-testid="badge-unsaved">Unsaved changes</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5 p-5 sm:p-6">
                        <div className="rounded-xl border bg-background p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="h-4 w-4 text-primary" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template file</p>
                                <p className="mt-1 truncate text-sm font-medium" data-testid="text-pptx-state">
                                  {hasPptxNow ? `PowerPoint · ${draft.fileName ?? detail.data.fileName ?? 'stored template'}` : 'No PowerPoint stored · built-in export layout'}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                              {hasPptxNow && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={save.isPending || importing}
                                  onClick={() => patch({ pptxBase64: undefined, fileName: undefined, clearPptx: true, notice: 'PowerPoint will be removed on save.' })}
                                  data-testid="button-clear-pptx"
                                >
                                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove
                                </Button>
                              )}
                              <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
                                <Upload className="h-3.5 w-3.5" />{importing ? 'Loading…' : 'Upload template'}
                                <input type="file" accept=".pptx,.txt,.md,.csv" className="sr-only" onChange={onFile} disabled={importing || save.isPending} data-testid="input-template-file" />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="admin-template-text">Report template text</Label>
                              <p id="admin-template-help" className="text-xs text-muted-foreground">
                                Keep the template instructions within the 5,000-character limit.
                              </p>
                            </div>
                            <span
                              id="admin-template-count"
                              aria-live="polite"
                              className={`text-xs tabular-nums ${tooLong ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
                            >
                              {draft.text.length} / {MAX_CHARS}
                            </span>
                          </div>
                          <Textarea
                            id="admin-template-text"
                            rows={16}
                            value={draft.text}
                            className="min-h-[360px] resize-y font-mono text-xs leading-5"
                            disabled={save.isPending || importing}
                            aria-describedby="admin-template-help admin-template-count"
                            aria-invalid={tooLong}
                            onChange={(e) => patch({ text: e.target.value })}
                            data-testid="input-template-text"
                          />
                        </div>

                        {fileError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="text-template-error">{fileError}</div>}
                        {!fileError && draft.notice && <div role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary" data-testid="status-template-notice">{draft.notice}</div>}
                        {tooLong && <p role="alert" className="text-sm text-destructive">Template content must be 5,000 characters or fewer.</p>}
                        {save.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="text-save-error">{msgOf(save.error)} Your edits are kept. Use Discard changes to reload the latest template.</p>}

                        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-muted-foreground">Saved changes apply to new Boards only.</p>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!dirty || save.isPending}
                              onClick={() => { setFileError(null); save.reset(); detail.refetch().then((r) => r.data && setDrafts((c) => ({ ...c, [r.data!.templateSlug]: { text: r.data!.reportTemplate, baseText: r.data!.reportTemplate, hash: r.data!.expectedHash, clearPptx: false } }))); }}
                              data-testid="button-discard-template"
                            >
                              Discard changes
                            </Button>
                            <Button
                              type="button"
                              disabled={!dirty || save.isPending || tooLong || importing}
                              onClick={() => save.mutate()}
                              data-testid="button-save-template"
                            >
                              {save.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save template'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
