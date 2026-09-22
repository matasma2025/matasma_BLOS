import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, FileText, Loader2, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface BoardSource {
  id: string;
  name: string;
  sourceType: "enterprise" | "vault";
  schemaType?: string;
}

interface BoardConfig {
  sourceType?: "enterprise" | "vault";
  sourceConfig?: { sourceType?: "enterprise" | "vault"; cubeId?: string; documentId?: string } | null;
  templateKey?: string;
}

export function BoardSourceSelector({ boardId }: { boardId: string }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState("");
  const { data: sources = [], isLoading: sourcesLoading } = useQuery<BoardSource[]>({
    queryKey: ["/api/boards", boardId, "source-options"],
    queryFn: () => apiRequest("GET", `/api/boards/${boardId}/source-options`) as Promise<BoardSource[]>,
    enabled: !!boardId,
  });
  const { data: config } = useQuery<BoardConfig>({
    queryKey: ["/api/boards", boardId, "analysis-config"],
    queryFn: () => apiRequest("GET", `/api/boards/${boardId}/analysis-config`) as Promise<BoardConfig>,
    enabled: !!boardId,
  });
  const visibleSources = useMemo(
    () => config?.templateKey === "balance-sheet-tracker"
      ? sources.filter((source) => source.sourceType === "enterprise" && source.schemaType === "balance_sheet")
      : sources,
    [config?.templateKey, sources],
  );

  const currentKey = useMemo(() => {
    const source = config?.sourceConfig;
    if (!source) return "";
    const id = source.sourceType === "enterprise" ? source.cubeId : source.documentId;
    return id ? `${source.sourceType}:${id}` : "";
  }, [config]);

  useEffect(() => {
    if (!selected && currentKey) setSelected(currentKey);
  }, [currentKey, selected]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const [sourceType, id] = selected.split(":");
      if (!sourceType || !id || (sourceType !== "enterprise" && sourceType !== "vault")) {
        throw new Error("Select an authorized source first");
      }
      return apiRequest("POST", `/api/boards/${boardId}/source-selection`, {
        sourceType,
        ...(sourceType === "enterprise" ? { cubeId: id } : { documentId: id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "analysis-config"] });
      toast({ title: "Source saved", description: "This Board will use the selected authorized source." });
    },
    onError: (error: Error) => toast({ title: "Source not saved", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3" data-testid="card-board-source-selector">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Analysis source</h2>
            <Badge variant="outline" className="text-[10px]">Authorized only</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Source access is checked against your LedgerLM account and domain membership.
          </p>
        </div>
      </div>
      {sourcesLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading authorized sources…
        </div>
       ) : visibleSources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {config?.templateKey === "balance-sheet-tracker"
            ? "No dedicated Balance Sheet cubes are available to this account."
            : "No Enterprise Data cubes or Vault documents are available to this account."}
        </p>
      ) : (
        <div className="flex gap-2 items-center">
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
            data-testid="select-board-source"
          >
            <option value="">Select a source</option>
            {visibleSources.map((source) => (
              <option key={`${source.sourceType}:${source.id}`} value={`${source.sourceType}:${source.id}`}>
                {source.sourceType === "enterprise" ? "Enterprise Data" : "Vault"} · {source.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!selected || saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      )}
      {selected && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {selected.startsWith("enterprise:") ? <Database className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          Raw source data stays server-side; reports contain bounded results and evidence metadata.
        </div>
      )}
    </div>
  );
}