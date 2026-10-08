import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiRequestWithAdminStepUp } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { entityPnlCubePlanUploadSchema, type EntityPnlCubePlanSummary } from "@shared/entityPnlCubePlan";

export function EntityPnlCubePlanDialog({ cube, onClose }: { cube: { id: string; name: string }; onClose: () => void }) {
  const [entity, setEntity] = useState("BGSW");
  const [file, setFile] = useState<File | null>(null);
  const [rates, setRates] = useState("");
  const [periodBasis, setPeriodBasis] = useState<"mtd" | "ytd" | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<EntityPnlCubePlanSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const base = `/api/domain-admin/cubes/${encodeURIComponent(cube.id)}/entity-pnl-plan`;
  const existing = useQuery<{ plan: EntityPnlCubePlanSummary | null }>({
    queryKey: [base, entity.trim()],
    queryFn: () => apiRequest("GET", `${base}?entity=${encodeURIComponent(entity.trim())}`),
    enabled: !!entity.trim(), staleTime: 0, retry: false,
  });

  function changed() { setPreview(null); setError(""); }
  async function submit(action: "preview" | "import") {
    setBusy(true); setError("");
    try {
      if (!file) throw new Error("Select a .xlsx workbook.");
      if (!periodBasis || !confirmed) throw new Error("Select and confirm the monthly MTD or cumulative YTD source basis, in mINR.");
      if (action === "import" && !preview) throw new Error("Preview the workbook first.");
      const options = entityPnlCubePlanUploadSchema.parse({
        entity, confirmedBasis: `mINR-${periodBasis}`, usdExchangeRates: rates.trim() ? JSON.parse(rates) : {},
        ...(action === "import" && preview ? { expectedRevision: preview.revision, previewHash: preview.previewHash } : {}),
      });
      const body = new FormData();
      body.append("file", file);
      body.append("options", JSON.stringify(options));
      const send = () => apiRequest<EntityPnlCubePlanSummary>("POST", `${base}/${action}`, body, true);
      const result = action === "import" ? await apiRequestWithAdminStepUp(send) : await send();
      if (action === "preview") setPreview(result);
      else {
        setPreview(null);
        await queryClient.invalidateQueries({ queryKey: [base] });
        toast({ title: "Entity P&L plan imported", description: `${result.entity} · revision ${result.revision}. Generate a new Entity P&L report; existing reports are unchanged.` });
      }
    } catch (err) {
      setError((err as Error).message || "Unable to process workbook.");
      if (action === "import") setPreview(null);
    } finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Entity P&amp;L financial plan</DialogTitle>
        <DialogDescription>{cube.name} · Separate cube-linked planning. Actuals, operational plans and other boards remain unchanged.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="entity-pnl-plan-entity">Entity</Label>
          <Input id="entity-pnl-plan-entity" value={entity} disabled={busy} onChange={(event) => { setEntity(event.target.value); changed(); }} />
        </div>
        {existing.isLoading && <p className="text-sm text-muted-foreground">Loading current plan…</p>}
        {existing.isError && <p role="alert" className="text-sm text-destructive">Unable to load current planning data. {(existing.error as Error).message}</p>}
        {existing.data && <p className="rounded-md border p-3 text-sm" data-testid="entity-pnl-plan-current">
          {existing.data.plan
            ? `Current: ${existing.data.plan.sourceName} · ${existing.data.plan.entity} · ${existing.data.plan.periodBasis === "mtd" ? "monthly MTD" : "cumulative YTD"} · revision ${existing.data.plan.revision} · ${existing.data.plan.scenarios.map((s) => s.scenario).join(", ")}`
            : "No cube-linked financial plan for this entity."}
        </p>}
        <div>
          <Label htmlFor="entity-pnl-plan-file">Workbook (.xlsx, at most 10 MB)</Label>
          <Input id="entity-pnl-plan-file" type="file" accept=".xlsx" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); changed(); }} />
          <p className="mt-1 text-xs text-muted-foreground">Requires the “Plan Entity P&amp;L” worksheet. All source months are retained. BP and entirely blank CF scenarios are not imported.</p>
        </div>
        <div>
          <Label htmlFor="entity-pnl-plan-rates">Approved INR per USD rates by scenario (optional JSON)</Label>
          <Textarea id="entity-pnl-plan-rates" value={rates} disabled={busy} placeholder={'Example only: {"CF05 2026": 86.96}'} onChange={(event) => { setRates(event.target.value); changed(); }} />
          <p className="mt-1 text-xs text-muted-foreground">Leave blank for INR-only financial forecasts. No exchange rate is assumed. Capacity remains unconverted.</p>
        </div>
        <div>
          <Label htmlFor="entity-pnl-plan-period">Financial source period basis</Label>
          <select id="entity-pnl-plan-period" value={periodBasis} disabled={busy} className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            onChange={(event) => { setPeriodBasis(event.target.value as "mtd" | "ytd" | ""); setConfirmed(false); changed(); }}>
            <option value="">Select the workbook's source basis</option>
            <option value="mtd">Monthly MTD — sum months for YTD</option>
            <option value="ytd">Cumulative YTD — use the selected month's value</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">MTD July YTD adds January–July. YTD July uses July alone. This choice does not change Actuals.</p>
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="entity-pnl-plan-basis" checked={confirmed} disabled={busy || !periodBasis} onCheckedChange={(value) => { setConfirmed(value === true); changed(); }} />
          <Label htmlFor="entity-pnl-plan-basis">I confirm financial values are in million INR (mINR), {periodBasis === "mtd" ? "monthly MTD (not cumulative)" : periodBasis === "ytd" ? "cumulative YTD" : "with the selected source basis"}. End Capacity is a monthly snapshot.</Label>
        </div>
        {preview && <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="entity-pnl-plan-preview">
          <p className="font-semibold">{preview.sourceName} · {preview.entity} · {preview.periodBasis === "mtd" ? "monthly MTD" : "cumulative YTD"} · {preview.records} scenario records</p>
          <p>{preview.revision ? `Replaces only this entity’s current Entity P&L plan, revision ${preview.revision}.` : "Creates this entity’s Entity P&L plan."} Board-local financial forecasts for this entity will be superseded; the two sources are never added together.</p>
          {preview.scenarios.map((scenario) => <p key={scenario.scenario}>{scenario.scenario}: {scenario.populated} populated / {scenario.missing} missing · months {scenario.months.join(", ")}</p>)}
          <ul className="list-disc pl-5 text-muted-foreground">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
          <Button variant="outline" disabled={busy || !file || !confirmed || !periodBasis} onClick={() => submit("preview")} data-testid="entity-pnl-plan-preview-button">{busy ? "Processing…" : "Validate & preview"}</Button>
          <Button disabled={busy || !preview} onClick={() => submit("import")} data-testid="entity-pnl-plan-import-button">Import for Entity P&amp;L only</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
