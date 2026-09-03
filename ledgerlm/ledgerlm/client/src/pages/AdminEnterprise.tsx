import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload, Trash2, RefreshCw, Building2, FileText, CheckCircle2, XCircle, Clock,
  Globe, Settings, Plug, Archive, Download, Network, Search, ChevronDown, ChevronRight,
  Database, Plus, History, AlertTriangle, BarChart3, Filter, Layers,
} from "lucide-react";
import { AdminConnectorsDialog } from "@/components/AdminConnectorsDialog";
import { HierarchyConfigDialog } from "@/components/HierarchyConfigDialog";
import { CubeManagement } from "@/components/CubeManagement";
import { IngestionStatusPanel } from "@/components/IngestionStatusPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfHeaders } from "@/lib/queryClient";
import { getAuthUser } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Interfaces (unchanged) ───────────────────────────────────────────────────

interface Domain {
  id: string;
  name: string;
  adminEmail: string;
  defaultOtp?: string | null;
  userCount?: number;
}

interface DomainInfo {
  isSuperAdmin: boolean;
  domain?: Domain;
  domains?: Domain[];
}

interface EnterpriseDocument {
  id: string;
  companyId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  source: string;
  uploadedAt: string;
  processingStatus: string;
  errorMessage?: string | null;
  chunkCount: number;
  cubeId?: string | null;
}

interface ConnectorType {
  type: string;
  displayName: string;
  description: string;
  configSchema: Array<{ key: string; label: string; type: string; required: boolean }>;
}

interface ConnectorTypesResponse {
  available: ConnectorType[];
}

interface ConfiguredConnector {
  id: string;
  domainId: string;
  connectorType: string;
  displayName: string;
  enabled: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface AutomationLog {
  id: string;
  companyId: string;
  status: string;
  triggerType: string;
  triggeredBy?: string;
  filesDownloaded: number;
  filesProcessed: number;
  filesFailed: number;
  newVersionsCreated: number;
  archivedVersions: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

interface AutomationLogsResponse {
  logs: AutomationLog[];
}

interface DocumentVersion {
  id: string;
  fileName: string;
  version: number;
  filePath: string;
  fileSize: string;
  fileType: string;
  source: string;
  isActive: boolean;
  uploadedAt: string;
  uploadedBy: string;
  previousVersionId?: string;
  metadata?: any;
  cubeId?: string | null;
}

interface DocumentVersionsResponse {
  versions: DocumentVersion[];
}

interface Cube {
  id: string;
  domainId: string;
  name: string;
  description: string | null;
  sourceType: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFileIcon(name: string, size = "w-4 h-4") {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf")  return <FileText className={`${size} text-red-500`} />;
  if (["xls", "xlsx"].includes(ext || "")) return <FileText className={`${size} text-green-600`} />;
  if (ext === "csv")  return <FileText className={`${size} text-blue-500`} />;
  if (["doc", "docx"].includes(ext || "")) return <FileText className={`${size} text-blue-700`} />;
  return <FileText className={`${size} text-muted-foreground`} />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDuration(startedAt: string, completedAt?: string) {
  if (!completedAt) return "Running…";
  const secs = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function getStatusBadgeDoc(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500/10 text-green-600 border border-green-500/20 gap-1"><CheckCircle2 className="w-3 h-3" />Processed</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Failed</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 gap-1"><RefreshCw className="w-3 h-3 animate-spin" />Processing</Badge>;
    default:
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
  }
}

function getSourceBadge(source: string) {
  switch (source) {
    case "manual":
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Manual</Badge>;
    case "anaplan_auto":
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Anaplan Auto</Badge>;
    case "anaplan_manual":
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">Anaplan Manual</Badge>;
    default:
      return <Badge variant="secondary">{source}</Badge>;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminEnterprise() {
  const { toast } = useToast();

  // ── Existing state (unchanged) ──
  const [activeTab, setActiveTab]                   = useState<string>("upload");
  const [uploadingFiles, setUploadingFiles]         = useState<File[]>([]);
  const [selectedDomainId, setSelectedDomainId]     = useState<string>("");
  const [selectedCubeId, setSelectedCubeId]         = useState<string>("");
  const [isConnectorsDialogOpen, setIsConnectorsDialogOpen] = useState(false);
  const [isHierarchyDialogOpen, setIsHierarchyDialogOpen]   = useState(false);
  const [selectedConnectorFilter, setSelectedConnectorFilter] = useState<string>("all");
  const [selectedViewCubeId, setSelectedViewCubeId] = useState<string>("all");
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<string>>(new Set());
  const [activeIngestionJobId, setActiveIngestionJobId] = useState<string | null>(null);

  // ── New UX state ──
  const [isDragOver, setIsDragOver]             = useState(false);
  const [docSearch, setDocSearch]               = useState("");
  const [docStatusFilter, setDocStatusFilter]   = useState<string>("all");
  const [docSourceFilter, setDocSourceFilter]   = useState<string>("all");
  const [selectedDocIds, setSelectedDocIds]     = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs]         = useState<Set<string>>(new Set());
  const [expandedFileGroups, setExpandedFileGroups] = useState<Set<string>>(new Set());

  const currentUser = getAuthUser();

  // ── Queries (unchanged) ──
  const { data: domainInfo, isLoading: domainLoading } = useQuery<DomainInfo>({
    queryKey: ["/api/domain-admin/my-domain"],
    enabled: !!currentUser,
  });

  const isSuperAdmin  = domainInfo?.isSuperAdmin || false;
  const activeDomainId = isSuperAdmin ? selectedDomainId : domainInfo?.domain?.id;
  const activeDomain  = isSuperAdmin
    ? domainInfo?.domains?.find(d => d.id === selectedDomainId)
    : domainInfo?.domain;

  const { data: documents, isLoading: documentsLoading } = useQuery<EnterpriseDocument[]>({
    queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId],
    queryFn: async () => {
      const url = isSuperAdmin
        ? `/api/domain-admin/enterprise-documents?domainId=${activeDomainId}`
        : `/api/domain-admin/enterprise-documents`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!activeDomainId,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs === undefined) return false;
      return docs.some(d => d.processingStatus === "processing") ? 3000 : false;
    },
  });

  const { data: connectorTypes } = useQuery<ConnectorTypesResponse>({
    queryKey: ["/api/domain-admin/connector-types"],
    enabled: !!activeDomainId,
  });

  const { data: configuredConnectors } = useQuery<ConfiguredConnector[]>({
    queryKey: ["/api/domain-admin/connectors", activeDomainId],
    queryFn: async () => {
      const url = isSuperAdmin
        ? `/api/domain-admin/connectors?domainId=${activeDomainId}`
        : `/api/domain-admin/connectors`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch connectors");
      return res.json();
    },
    enabled: !!activeDomainId,
  });

  const { data: cubes = [] } = useQuery<Cube[]>({
    queryKey: ["/api/domain-admin/cubes", activeDomainId],
    queryFn: async () => {
      const url = isSuperAdmin
        ? `/api/domain-admin/cubes?domainId=${activeDomainId}`
        : `/api/domain-admin/cubes`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeDomainId,
  });

  const { data: automationLogs } = useQuery<AutomationLogsResponse>({
    queryKey: ["/api/domain-admin/anaplan/logs", activeDomainId],
    queryFn: async () => {
      const url = isSuperAdmin
        ? `/api/domain-admin/anaplan/logs?domainId=${activeDomainId}`
        : `/api/domain-admin/anaplan/logs`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!activeDomainId,
  });

  const { data: documentVersions, isLoading: versionsLoading } = useQuery<DocumentVersionsResponse>({
    queryKey: ["/api/domain-admin/enterprise-documents/versions", activeDomainId],
    queryFn: async () => {
      const url = isSuperAdmin
        ? `/api/domain-admin/enterprise-documents/versions?domainId=${activeDomainId}`
        : `/api/domain-admin/enterprise-documents/versions`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
    enabled: !!activeDomainId,
  });

  // ── Derived filters ──
  const filteredDocuments = documents?.filter(doc => {
    if (selectedViewCubeId !== "all" && doc.cubeId !== selectedViewCubeId) return false;
    if (docStatusFilter !== "all" && doc.processingStatus !== docStatusFilter) return false;
    if (docSourceFilter !== "all" && doc.source !== docSourceFilter) return false;
    if (docSearch && !doc.fileName.toLowerCase().includes(docSearch.toLowerCase())) return false;
    return true;
  });

  const filteredVersions = documentVersions?.versions?.filter(v => {
    if (selectedViewCubeId === "all") return true;
    return v.cubeId === selectedViewCubeId;
  });

  const totalCubeDocumentCount = documents?.filter(d => d.cubeId === selectedViewCubeId).length || 0;

  // ── Mutations (unchanged) ──
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!activeDomainId) throw new Error("No domain selected");
      if (!currentUser)    throw new Error("Not authenticated");
      if (!selectedCubeId) throw new Error("Please select a cube to upload documents to");

      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      if (isSuperAdmin) formData.append("domainId", activeDomainId);
      formData.append("cubeId", selectedCubeId);

      const response = await fetch(`/api/domain-admin/enterprise-documents`, {
        method: "POST",
        headers: { ...getCsrfHeaders() },
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId] });
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents/versions", activeDomainId] });
      setUploadingFiles([]);
      if (data?.job_id) {
        setActiveIngestionJobId(data.job_id);
        toast({ title: "Ingestion started", description: "Loading data into cube — track progress below" });
      } else {
        toast({ title: "Success", description: "Documents uploaded successfully" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!currentUser) throw new Error("Not authenticated");
      const res = await fetch(`/api/domain-admin/enterprise-documents/${documentId}/process`, {
        method: "POST",
        headers: { "x-user-id": currentUser.id, ...getCsrfHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId] });
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents/versions", activeDomainId] });
      if (data?.job_id) {
        setActiveIngestionJobId(data.job_id);
        toast({ title: "Ingestion started", description: "Loading data into cube — track progress below" });
      } else {
        toast({ title: "Processing started", description: "Document is being processed" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!currentUser) throw new Error("Not authenticated");
      return fetch(`/api/domain-admin/enterprise-documents/${documentId}`, {
        method: "DELETE",
        headers: { "x-user-id": currentUser.id, ...getCsrfHeaders() },
        credentials: "include",
      }).then(res => res.ok ? res.json() : Promise.reject(res.statusText));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId] });
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents/versions", activeDomainId] });
      toast({ title: "Deleted", description: "Document deleted successfully" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      if (!currentUser) throw new Error("Not authenticated");
      const results = await Promise.all(
        documentIds.map(id =>
          fetch(`/api/domain-admin/enterprise-documents/${id}`, {
            method: "DELETE",
            headers: { ...getCsrfHeaders() },
            credentials: "include",
          }).then(res => ({ id, ok: res.ok }))
        )
      );
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) throw new Error(`Failed to delete ${failed.length} document(s)`);
      return results;
    },
    onSuccess: (_, deletedIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId] });
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents/versions", activeDomainId] });
      setSelectedVersionIds(new Set());
      setSelectedDocIds(new Set());
      toast({ title: "Deleted", description: `${deletedIds.length} document(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteAllCubeDocsMutation = useMutation({
    mutationFn: async (cubeId: string) => {
      if (!currentUser) throw new Error("Not authenticated");
      const response = await fetch(`/api/domain-admin/cubes/${cubeId}/documents`, {
        method: "DELETE",
        headers: { ...getCsrfHeaders() },
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Delete failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId] });
      queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents/versions", activeDomainId] });
      toast({ title: "Deleted", description: `${data.deletedCount} document(s) deleted successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // ── Handlers (unchanged + new) ──
  const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB — Enterprise limit

  const validateAndStageFiles = (files: File[]) => {
    const oversized = files.filter(f => f.size > MAX_UPLOAD_BYTES);
    oversized.forEach(f => {
      toast({
        title: "File too large",
        description: `"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed size is 500 MB.`,
        variant: "destructive",
      });
    });
    const valid = files.filter(f => f.size <= MAX_UPLOAD_BYTES);
    if (valid.length > 0) setUploadingFiles(prev => [...prev, ...valid]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) validateAndStageFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (selectedCubeId) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!selectedCubeId) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) validateAndStageFiles(files);
  };

  const handleUpload = () => {
    if (uploadingFiles.length > 0 && activeDomainId) {
      uploadMutation.mutate(uploadingFiles);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVersionSelect = (versionId: string, checked: boolean) => {
    setSelectedVersionIds(prev => {
      const next = new Set(prev);
      checked ? next.add(versionId) : next.delete(versionId);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredVersions) {
      setSelectedVersionIds(new Set(filteredVersions.map(v => v.id)));
    } else {
      setSelectedVersionIds(new Set());
    }
  };

  const handleDocSelect = (docId: string, checked: boolean) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      checked ? next.add(docId) : next.delete(docId);
      return next;
    });
  };

  const handleSelectAllDocs = (checked: boolean) => {
    if (checked && filteredDocuments) {
      setSelectedDocIds(new Set(filteredDocuments.map(d => d.id)));
    } else {
      setSelectedDocIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedVersionIds.size > 0) bulkDeleteMutation.mutate(Array.from(selectedVersionIds));
  };

  const handleBulkDeleteDocs = () => {
    if (selectedDocIds.size > 0) bulkDeleteMutation.mutate(Array.from(selectedDocIds));
  };

  const handleDownload = async (version: DocumentVersion) => {
    try {
      const response = await fetch(`/api/domain-admin/enterprise-documents/${version.id}/download`, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = version.fileName;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "Download failed", description: "Unable to download file", variant: "destructive" });
    }
  };

  const toggleLogExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleFileGroup = (name: string) => {
    setExpandedFileGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // ── Stats ──
  const totalDocs    = documents?.length || 0;
  const activeCubes  = cubes.length;
  const activeConnectors = configuredConnectors?.filter(c => c.enabled).length || 0;
  const lastSyncAt   = automationLogs?.logs?.[0]?.completedAt;
  const lastSyncStr  = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";

  const syncLogs    = automationLogs?.logs || [];
  const syncSuccess = syncLogs.filter(l => l.status === "success").length;
  const syncRate    = syncLogs.length > 0 ? Math.round((syncSuccess / syncLogs.length) * 100) : 0;

  // ── Grouped versions ──
  const groupedVersions: Record<string, DocumentVersion[]> = {};
  filteredVersions?.forEach(v => {
    if (!groupedVersions[v.fileName]) groupedVersions[v.fileName] = [];
    groupedVersions[v.fileName].push(v);
  });

  // ── Tabs ──
  const tabs = [
    { id: "upload",        label: "Upload",        icon: Upload,   count: null },
    { id: "documents",     label: "Documents",     icon: FileText, count: documents?.length ?? null },
    { id: "connectors",    label: "Connectors",    icon: Plug,     count: configuredConnectors?.length ?? null },
    { id: "sync-logs",     label: "Sync Logs",     icon: History,  count: syncLogs.length || null },
    { id: "file-versions", label: "File Versions", icon: Archive,  count: documentVersions?.versions?.length ?? null },
    { id: "data-cubes",    label: "Data Cubes",    icon: Database, count: cubes.length || null },
  ];

  // ── Loading / no-access screens (unchanged) ──
  if (domainLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-primary/10">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!domainInfo || (!isSuperAdmin && !domainInfo.domain)) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-primary/10">
        <div className="flex-1 overflow-auto p-6">
          <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
            <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
              <h1 className="text-xl font-semibold text-foreground">Enterprise Data</h1>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-destructive opacity-50" />
                  <p className="text-lg font-medium text-foreground mb-2">No Domain Access</p>
                  <p className="text-sm text-muted-foreground">You need to be a domain admin to manage enterprise documents.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6 text-foreground" />
              <h1 className="text-xl font-semibold text-foreground">Enterprise Data</h1>
              {activeDomain && (
                <Badge variant="outline" className="bg-white/50 text-xs">{activeDomain.name}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeDomainId && (
                <Button
                  variant="outline" size="sm" className="bg-white/80"
                  onClick={() => setIsHierarchyDialogOpen(true)}
                  data-testid="button-open-hierarchies"
                >
                  <Network className="w-4 h-4 mr-2" />Hierarchies
                </Button>
              )}
              {isSuperAdmin && domainInfo.domains && domainInfo.domains.length > 0 && (
                <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
                  <SelectTrigger className="w-[200px] bg-white" data-testid="select-domain">
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domainInfo.domains.map(domain => (
                      <SelectItem key={domain.id} value={domain.id} data-testid={`select-domain-${domain.id}`}>
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* ── Stats bar ──────────────────────────────────────────────────── */}
          {activeDomainId && (
            <div className="grid grid-cols-4 gap-0 border-b border-border flex-shrink-0">
              {[
                { icon: <FileText className="w-4 h-4 text-blue-500" />,   label: "Total Documents",    value: totalDocs,        color: "text-blue-600"  },
                { icon: <Database className="w-4 h-4 text-teal-500" />,   label: "Active Cubes",       value: activeCubes,      color: "text-teal-600"  },
                { icon: <Plug className="w-4 h-4 text-green-500" />,      label: "Active Connectors",  value: activeConnectors, color: "text-green-600" },
                { icon: <History className="w-4 h-4 text-purple-500" />,  label: "Last Sync",          value: lastSyncStr,      color: "text-purple-600", isText: true },
              ].map(({ icon, label, value, color, isText }) => (
                <div key={label} className="flex items-center gap-3 px-6 py-3 border-r border-border last:border-r-0 bg-muted/20">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-border/50">
                    {icon}
                  </div>
                  <div>
                    <p className={`${isText ? "text-sm font-semibold" : "text-xl font-bold"} ${color} leading-tight`}>{value}</p>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab bar ────────────────────────────────────────────────────── */}
          {activeDomainId && (
            <div className="border-b border-border flex-shrink-0 px-6 lg:px-8">
              <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Enterprise Data sections">
                {tabs.map(({ id, label, icon: Icon, count }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                      ${activeTab === id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {count !== null && count > 0 && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                        activeTab === id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* ── Content ────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">

            {/* No domain selected */}
            {!activeDomainId && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-10 h-10 text-muted-foreground opacity-60" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">Select a Domain</p>
                  <p className="text-sm text-muted-foreground">Choose a domain from the dropdown above to manage its enterprise documents.</p>
                </CardContent>
              </Card>
            )}

            {/* ══ UPLOAD TAB ═══════════════════════════════════════════════ */}
            {activeDomainId && activeTab === "upload" && (
              <div className="max-w-2xl space-y-6">

                {/* Step 1 – Pick a cube */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                      ${selectedCubeId ? "bg-primary border-primary text-white" : "bg-white border-border text-muted-foreground"}`}>
                      {selectedCubeId ? <CheckCircle2 className="w-4 h-4" /> : "1"}
                    </div>
                    <div className="w-px flex-1 bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-semibold text-sm text-foreground mb-0.5">Select Target Cube</p>
                    <p className="text-xs text-muted-foreground mb-3">Documents are stored in the selected cube and only accessible to users with cube access.</p>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="w-full sm:w-64">
                        <Select value={selectedCubeId} onValueChange={setSelectedCubeId}>
                          <SelectTrigger data-testid="select-upload-cube">
                            <SelectValue placeholder="Choose a cube…" />
                          </SelectTrigger>
                          <SelectContent>
                            {cubes.length === 0 ? (
                              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                No cubes available. Create one in Data Cubes.
                              </div>
                            ) : cubes.map(cube => (
                              <SelectItem key={cube.id} value={cube.id}>{cube.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button onClick={() => setActiveTab("data-cubes")} className="text-sm text-primary hover:underline flex items-center gap-1">
                        Go to Data Cubes <span aria-hidden>›</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 – Drop files */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                      ${uploadingFiles.length > 0 ? "bg-primary border-primary text-white" : "bg-white border-border text-muted-foreground"}`}>
                      {uploadingFiles.length > 0 ? <CheckCircle2 className="w-4 h-4" /> : "2"}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground mb-0.5">Upload Files</p>
                    <p className="text-xs text-muted-foreground mb-3">PDF, Word, Excel, CSV, TXT — up to 500 MB per file</p>

                    {/* Hidden file input */}
                    <input
                      type="file" multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="enterprise-file-upload"
                      data-testid="input-file-upload"
                      disabled={!selectedCubeId}
                    />

                    {/* Drop zone */}
                    <label
                      htmlFor="enterprise-file-upload"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed py-12 px-6 text-center transition-all
                        ${!selectedCubeId
                          ? "border-border/40 opacity-50 cursor-not-allowed"
                          : isDragOver
                            ? "border-primary bg-primary/8 scale-[1.01] cursor-copy"
                            : "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragOver ? "bg-primary/20" : "bg-muted/60"}`}>
                        <Upload className={`w-6 h-6 transition-colors ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isDragOver ? "Drop files here" : "Drag & drop or browse files"}
                        </p>
                        {!selectedCubeId && (
                          <p className="text-xs text-muted-foreground mt-0.5">Select a cube first</p>
                        )}
                      </div>
                      {!isDragOver && (
                        <span className={`inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md border border-border bg-white shadow-sm
                          ${selectedCubeId ? "text-foreground hover:bg-muted/40" : "text-muted-foreground"}`}>
                          <FileText className="w-4 h-4" />Browse Files
                        </span>
                      )}
                    </label>

                    {/* File queue */}
                    {uploadingFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {uploadingFiles.length} file{uploadingFiles.length !== 1 ? "s" : ""} queued
                        </p>
                        {uploadingFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2.5 text-sm p-2.5 bg-muted/40 rounded-lg border border-border/50">
                            {getFileIcon(file.name)}
                            <span className="flex-1 truncate font-medium">{file.name}</span>
                            <span className="text-muted-foreground text-xs flex-shrink-0">{formatFileSize(file.size)}</span>
                            <button
                              onClick={() => handleRemoveFile(index)}
                              className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                              title="Remove file"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <Button
                          onClick={handleUpload}
                          disabled={uploadMutation.isPending || !selectedCubeId}
                          data-testid="button-upload"
                          className="w-full mt-1"
                        >
                          {uploadMutation.isPending
                            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                            : <><Upload className="w-4 h-4 mr-2" />Upload {uploadingFiles.length} file{uploadingFiles.length !== 1 ? "s" : ""}</>
                          }
                        </Button>
                      </div>
                    )}

                    {/* Ingestion progress — shown immediately below the file list */}
                    {activeIngestionJobId && (
                      <div className="mt-4">
                        <IngestionStatusPanel
                          jobId={activeIngestionJobId}
                          onComplete={() => {
                            setActiveIngestionJobId(null);
                            queryClient.invalidateQueries({ queryKey: ["/api/domain-admin/enterprise-documents", activeDomainId] });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ DOCUMENTS TAB ════════════════════════════════════════════ */}
            {activeDomainId && activeTab === "documents" && (
              <div className="space-y-4">

                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={docSearch}
                      onChange={e => setDocSearch(e.target.value)}
                      placeholder="Search files…"
                      className="pl-8 h-8 text-sm"
                    />
                  </div>

                  {/* Cube filter */}
                  <Select value={selectedViewCubeId} onValueChange={setSelectedViewCubeId}>
                    <SelectTrigger className="w-[180px] h-8 text-sm" data-testid="select-view-cube">
                      <SelectValue placeholder="All Cubes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="select-view-cube-all">All Cubes</SelectItem>
                      {cubes.map(cube => (
                        <SelectItem key={cube.id} value={cube.id} data-testid={`select-view-cube-${cube.id}`}>{cube.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Status pills */}
                  <div className="flex items-center gap-1">
                    {["all", "pending", "processing", "completed", "failed"].map(s => (
                      <button
                        key={s}
                        onClick={() => setDocStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          docStatusFilter === s
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Source pills */}
                  <div className="flex items-center gap-1">
                    {[
                      { value: "all",           label: "All Sources" },
                      { value: "manual",        label: "Manual" },
                      { value: "anaplan_auto",  label: "Anaplan Auto" },
                      { value: "anaplan_manual",label: "Anaplan Manual" },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setDocSourceFilter(value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          docSourceFilter === value
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {selectedViewCubeId !== "all" && totalCubeDocumentCount > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive h-8" disabled={deleteAllCubeDocsMutation.isPending} data-testid="button-delete-all-cube-docs">
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete All ({totalCubeDocumentCount})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete all documents in this cube?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all {totalCubeDocumentCount} document(s) in
                              "{cubes.find(c => c.id === selectedViewCubeId)?.name}". This includes all versions, chunks, and embeddings. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete-all">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteAllCubeDocsMutation.mutate(selectedViewCubeId)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-confirm-delete-all"
                            >
                              Delete All Documents
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Bulk action bar */}
                {selectedDocIds.size > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <span className="text-sm font-medium text-primary">{selectedDocIds.size} selected</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={bulkDeleteMutation.isPending} data-testid="button-bulk-delete-docs">
                          <Trash2 className="w-3.5 h-3.5 mr-1" />Delete Selected
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {selectedDocIds.size} document(s)?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDeleteDocs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <button onClick={() => setSelectedDocIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto">Clear</button>
                  </div>
                )}

                <Card>
                  <CardContent className="p-0">
                    {documentsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !filteredDocuments || filteredDocuments.length === 0 ? (
                      <div className="text-center py-14">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-blue-400" />
                        </div>
                        <p className="font-medium text-foreground mb-1">No documents found</p>
                        <p className="text-sm text-muted-foreground">
                          {docSearch || docStatusFilter !== "all" || docSourceFilter !== "all"
                            ? "Try clearing your filters"
                            : "Switch to the Upload tab to add documents"}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-10">
                              <Checkbox
                                checked={filteredDocuments.length > 0 && selectedDocIds.size === filteredDocuments.length}
                                onCheckedChange={handleSelectAllDocs}
                              />
                            </TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Cube</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDocuments.map(doc => (
                            <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}
                              className={`${selectedDocIds.has(doc.id) ? "bg-primary/5" : ""}
                                ${doc.processingStatus === "failed"     ? "border-l-2 border-l-destructive/50"
                                : doc.processingStatus === "completed"  ? "border-l-2 border-l-green-400/50"
                                : doc.processingStatus === "processing" ? "border-l-2 border-l-blue-400/50"
                                : "border-l-2 border-l-amber-400/50"}`}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedDocIds.has(doc.id)}
                                  onCheckedChange={(c) => handleDocSelect(doc.id, !!c)}
                                />
                              </TableCell>
                              <TableCell className="font-medium max-w-[220px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  {getFileIcon(doc.fileName)}
                                  <span className="truncate" title={doc.fileName}>{doc.fileName}</span>
                                </div>
                              </TableCell>
                              <TableCell>{getSourceBadge(doc.source)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.fileSize)}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {getStatusBadgeDoc(doc.processingStatus)}
                                  {doc.processingStatus === "completed" && doc.chunkCount > 0 && (
                                    <span className="text-[10px] text-muted-foreground">{doc.chunkCount} rows</span>
                                  )}
                                  {doc.errorMessage && (
                                    <span className="text-[10px] text-destructive flex items-center gap-0.5" title={doc.errorMessage}>
                                      <AlertTriangle className="w-3 h-3" />{doc.errorMessage.slice(0, 40)}{doc.errorMessage.length > 40 ? "…" : ""}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {doc.cubeId
                                  ? <Badge variant="outline" className="text-xs">{cubes.find(c => c.id === doc.cubeId)?.name || "—"}</Badge>
                                  : <span className="text-muted-foreground text-xs">—</span>
                                }
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {doc.processingStatus === "pending" && (
                                    <Button size="icon" variant="ghost" onClick={() => processMutation.mutate(doc.id)} disabled={processMutation.isPending} title="Reprocess" data-testid={`button-process-${doc.id}`}>
                                      <RefreshCw className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(doc.id)} disabled={deleteMutation.isPending} title="Delete" data-testid={`button-delete-${doc.id}`}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
                {filteredDocuments && filteredDocuments.length > 0 && (
                  <p className="text-xs text-muted-foreground text-right">{filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""}</p>
                )}
              </div>
            )}

            {/* ══ CONNECTORS TAB ════════════════════════════════════════════ */}
            {activeDomainId && activeTab === "connectors" && (
              <div className="space-y-6">

                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Data Source Connectors</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Configure and monitor data sources for {activeDomain?.name}</p>
                  </div>
                  <Button variant="outline" onClick={() => setIsConnectorsDialogOpen(true)} data-testid="button-configure-connectors">
                    <Settings className="w-4 h-4 mr-2" />Manage Connectors
                  </Button>
                </div>

                {/* Configured connectors */}
                {configuredConnectors && configuredConnectors.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Configured</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {configuredConnectors.map(connector => {
                        const lastLog = automationLogs?.logs?.find(l => l.status !== undefined);
                        return (
                          <Card key={connector.id} className={`relative overflow-hidden transition-shadow hover:shadow-md ${connector.enabled ? "border-green-200" : "border-border"}`} data-testid={`badge-connector-${connector.connectorType}`}>
                            <div className={`absolute top-0 left-0 right-0 h-1 ${connector.enabled ? "bg-green-400" : "bg-muted"}`} />
                            <CardContent className="p-4 pt-5">
                              <div className="flex items-start justify-between mb-3">
                                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                                  <Plug className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="relative flex h-2 w-2">
                                    {connector.enabled && (
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${connector.enabled ? "bg-green-500" : "bg-slate-400"}`} />
                                  </span>
                                  <span className={`text-xs font-medium ${connector.enabled ? "text-green-600" : "text-muted-foreground"}`}>
                                    {connector.enabled ? "Active" : "Disabled"}
                                  </span>
                                </div>
                              </div>
                              <p className="font-semibold text-sm text-foreground">{connector.displayName}</p>
                              <p className="text-xs text-muted-foreground capitalize mt-0.5">{connector.connectorType.replace(/_/g, " ")}</p>
                              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setIsConnectorsDialogOpen(true)}>
                                  <Settings className="w-3 h-3 mr-1" />Configure
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                      <Plug className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="font-medium text-foreground mb-1">No connectors configured</p>
                    <p className="text-sm text-muted-foreground mb-4">Click <strong>Manage Connectors</strong> to add a data source.</p>
                    <Button variant="outline" onClick={() => setIsConnectorsDialogOpen(true)}>
                      <Settings className="w-4 h-4 mr-2" />Manage Connectors
                    </Button>
                  </div>
                )}

                {/* Available connector types */}
                {connectorTypes?.available && connectorTypes.available.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Available to Configure</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {connectorTypes.available
                        .filter(ct => !configuredConnectors?.some(c => c.connectorType === ct.type))
                        .map(ct => (
                          <div key={ct.type} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-border">
                              <Plug className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{ct.displayName}</p>
                              <p className="text-xs text-muted-foreground truncate">{ct.description}</p>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setIsConnectorsDialogOpen(true)}>
                              <Plus className="w-3 h-3 mr-1" />Add
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground border-t pt-4">
                  Data sources configured here will appear in users' Data Sources panel with the display names you set.
                  Users can toggle sources ON/OFF but cannot see or modify the connection credentials.
                </p>
              </div>
            )}

            {/* ══ SYNC LOGS TAB ═════════════════════════════════════════════ */}
            {activeDomainId && activeTab === "sync-logs" && (
              <div className="space-y-5">

                {/* Stats strip */}
                {syncLogs.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Total Runs",    value: syncLogs.length,  color: "text-foreground" },
                      { label: "Successful",    value: syncSuccess,      color: "text-green-600" },
                      { label: "Success Rate",  value: `${syncRate}%`,   color: syncRate >= 80 ? "text-green-600" : syncRate >= 50 ? "text-yellow-600" : "text-destructive" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-muted/30 rounded-xl p-4 text-center border border-border">
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="w-4 h-4" />Automation History
                    </CardTitle>
                    <CardDescription>Sync runs for {activeDomain?.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {syncLogs.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
                          <Clock className="w-7 h-7 text-purple-400" />
                        </div>
                        <p className="font-medium text-foreground mb-1">No automation runs yet</p>
                        <p className="text-sm text-muted-foreground">Configure and enable a connector to see sync history</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-8" />
                            <TableHead>Connector</TableHead>
                            <TableHead>Run Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Files</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Trigger</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncLogs.map(log => (
                            <>
                              <TableRow
                                key={log.id}
                                data-testid={`row-log-${log.id}`}
                                className="cursor-pointer hover:bg-muted/20"
                                onClick={() => toggleLogExpand(log.id)}
                              >
                                <TableCell>
                                  {expandedLogs.has(log.id)
                                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  }
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Anaplan</Badge>
                                </TableCell>
                                <TableCell className="text-sm">{new Date(log.startedAt).toLocaleString()}</TableCell>
                                <TableCell>
                                  {log.status === "success" ? (
                                    <Badge className="bg-green-500/10 text-green-600 border border-green-500/20 gap-1"><CheckCircle2 className="w-3 h-3" />Success</Badge>
                                  ) : log.status === "partial_success" ? (
                                    <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 gap-1"><Clock className="w-3 h-3" />Partial</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Failed</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm">
                                    <span className="text-green-600 font-medium">{log.filesProcessed}</span>
                                    {log.filesFailed > 0 && <span className="text-destructive ml-1">/ {log.filesFailed} failed</span>}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{formatDuration(log.startedAt, log.completedAt)}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">{log.triggerType === "scheduled" ? "Scheduled" : "Manual"}</Badge>
                                </TableCell>
                              </TableRow>
                              {expandedLogs.has(log.id) && (
                                <TableRow key={`${log.id}-expand`} className="bg-muted/10 hover:bg-muted/10">
                                  <TableCell colSpan={7} className="py-3 pl-10">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                      {[
                                        { label: "Downloaded",       value: log.filesDownloaded },
                                        { label: "Processed",        value: log.filesProcessed },
                                        { label: "Failed",           value: log.filesFailed },
                                        { label: "New Versions",     value: log.newVersionsCreated },
                                      ].map(({ label, value }) => (
                                        <div key={label}>
                                          <p className="text-muted-foreground">{label}</p>
                                          <p className="font-semibold text-foreground">{value}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {log.errorMessage && (
                                      <div className="mt-2 p-2 bg-destructive/5 rounded border border-destructive/20 text-xs text-destructive">
                                        <AlertTriangle className="inline w-3 h-3 mr-1" />{log.errorMessage}
                                      </div>
                                    )}
                                    {log.triggeredBy && (
                                      <p className="mt-2 text-xs text-muted-foreground">Triggered by: <span className="font-medium">{log.triggeredBy}</span></p>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══ FILE VERSIONS TAB ════════════════════════════════════════ */}
            {activeDomainId && activeTab === "file-versions" && (
              <div className="space-y-4">

                {/* Toolbar */}
                <div className="flex items-center gap-3">
                  <Select value={selectedViewCubeId} onValueChange={setSelectedViewCubeId}>
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                      <SelectValue placeholder="All Cubes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cubes</SelectItem>
                      {cubes.map(cube => (
                        <SelectItem key={cube.id} value={cube.id}>{cube.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedVersionIds.size > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg">
                      <span className="text-sm font-medium text-primary">{selectedVersionIds.size} selected</span>
                      <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending} data-testid="button-bulk-delete">
                        <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                      </Button>
                      <button onClick={() => setSelectedVersionIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                    </div>
                  )}
                </div>

                {versionsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !filteredVersions || filteredVersions.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
                      <Archive className="w-7 h-7 text-purple-400" />
                    </div>
                    <p className="font-medium text-foreground mb-1">
                      {selectedViewCubeId === "all" ? "No document versions yet" : `No versions in ${cubes.find(c => c.id === selectedViewCubeId)?.name || "this cube"}`}
                    </p>
                    <p className="text-sm text-muted-foreground">Sync data from connectors to see version history</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Column header */}
                    <div className="grid grid-cols-[auto,1fr,auto] items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                      <span>File</span><span /><span className="text-right">Versions</span>
                    </div>

                    {Object.entries(groupedVersions).map(([fileName, versions]) => {
                      const isOpen = expandedFileGroups.has(fileName);
                      const activeVersion = versions.find(v => v.isActive);
                      const allIds = versions.map(v => v.id);
                      const allSelected = allIds.every(id => selectedVersionIds.has(id));

                      return (
                        <Card key={fileName} className="overflow-hidden">
                          {/* Group header row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleFileGroup(fileName)}
                          >
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(c) => {
                                setSelectedVersionIds(prev => {
                                  const next = new Set(prev);
                                  c ? allIds.forEach(id => next.add(id)) : allIds.forEach(id => next.delete(id));
                                  return next;
                                });
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                            {getFileIcon(fileName, "w-4 h-4")}
                            <span className="flex-1 font-medium text-sm text-foreground truncate" title={fileName}>{fileName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {activeVersion && getSourceBadge(activeVersion.source)}
                              <Badge variant="outline" className="text-xs">{versions.length} version{versions.length !== 1 ? "s" : ""}</Badge>
                              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {/* Expanded versions */}
                          {isOpen && (
                            <div className="border-t bg-muted/10">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/20">
                                    <TableHead className="w-10" />
                                    <TableHead>Version</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {versions
                                    .sort((a, b) => b.version - a.version)
                                    .map(version => (
                                      <TableRow key={version.id} data-testid={`row-version-${version.id}`}>
                                        <TableCell>
                                          <Checkbox
                                            checked={selectedVersionIds.has(version.id)}
                                            onCheckedChange={(c) => handleVersionSelect(version.id, !!c)}
                                            data-testid={`checkbox-version-${version.id}`}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={version.isActive ? "default" : "outline"} className={version.isActive ? "bg-primary/15 text-primary border-primary/30" : ""}>
                                            v{version.version}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {version.isActive ? (
                                            <Badge className="bg-green-500/10 text-green-600 border border-green-500/20 gap-1 text-xs">
                                              <CheckCircle2 className="w-3 h-3" />Active
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="gap-1 text-xs">
                                              <Archive className="w-3 h-3" />Archived
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatFileSize(parseInt(version.fileSize))}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{version.uploadedBy}</TableCell>
                                        <TableCell className="text-sm">{new Date(version.uploadedAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => handleDownload(version)} title="Download" data-testid={`button-download-${version.id}`}>
                                              <Download className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(version.id)} disabled={deleteMutation.isPending} title="Delete version" data-testid={`button-delete-version-${version.id}`}>
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ DATA CUBES TAB ════════════════════════════════════════════ */}
            {activeDomainId && activeTab === "data-cubes" && (
              <CubeManagement
                domainId={activeDomainId}
                domainName={activeDomain?.name}
                isSuperAdmin={isSuperAdmin}
              />
            )}

          </div>
        </div>
      </div>

      {/* Dialogs — unchanged */}
      {activeDomainId && (
        <AdminConnectorsDialog
          isOpen={isConnectorsDialogOpen}
          onClose={() => setIsConnectorsDialogOpen(false)}
          domainId={activeDomainId}
          domainName={activeDomain?.name}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      {activeDomainId && (
        <HierarchyConfigDialog
          open={isHierarchyDialogOpen}
          onOpenChange={setIsHierarchyDialogOpen}
          domainId={activeDomainId}
          domainName={activeDomain?.name || "Domain"}
        />
      )}
    </div>
  );
}
