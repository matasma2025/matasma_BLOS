import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Trash2,
  Download,
  MoreVertical,
  Filter,
  Search,
  Link as LinkIcon,
  Eye,
  Ban,
  Sparkles,
  HelpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  BarChart2,
  MessageSquare,
  Cpu,
  FolderOpen,
} from "lucide-react";
import { queryClient, getCsrfHeaders } from "@/lib/queryClient";
import { fetchApiFile } from "@/lib/apiFiles";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";
import type { Document } from "@shared/schema";
import { generatedChatTitle } from "@shared/inputValidators";
import { ConnectDriveDialog } from "@/components/ConnectDriveDialog";

export default function Vault() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [showConnectDrive, setShowConnectDrive] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const user = getAuthUser();
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          ...getCsrfHeaders(),
        },
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vault/stats"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully. Processing started...",
      });
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (data?.id) {
        try {
          const user = getAuthUser();
          await fetch(`/api/documents/${data.id}/process`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getCsrfHeaders(),
            },
            credentials: "include",
          });
        } catch (error) {
          console.error("Auto-process failed:", error);
        }
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = getAuthUser();
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: {
          ...getCsrfHeaders(),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      const user = getAuthUser();
      const response = await fetch(`/api/documents/${id}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Processing failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Processing Started",
        description: "Document processing has been initiated",
      });
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vault/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start document processing",
        variant: "destructive",
      });
    },
  });

  const createAnalysisMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const user = getAuthUser();

      const selectedDocNames = documents
        .filter((doc) => documentIds.includes(doc.id))
        .map((doc) => doc.name)
        .slice(0, 2)
        .join(", ");

      const chatTitle = generatedChatTitle(
        documentIds.length > 2
          ? `Analysis - ${selectedDocNames} and ${documentIds.length - 2} more`
          : `Analysis - ${selectedDocNames}`,
        "Document Analysis",
        200,
      );

      const chatResponse = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          title: chatTitle,
          preview: `Analysis session with ${documentIds.length} document${documentIds.length > 1 ? "s" : ""}`,
        }),
      });

      if (!chatResponse.ok) {
        const failure = await chatResponse.json().catch(() => null);
        throw new Error(
          typeof failure?.error === "string" && failure.error.trim()
            ? failure.error
            : "Failed to create chat",
        );
      }

      const chat = await chatResponse.json();

      for (const docId of documentIds) {
        const associateResponse = await fetch(
          `/api/chats/${chat.id}/documents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getCsrfHeaders(),
            },
            credentials: "include",
            body: JSON.stringify({ documentId: docId }),
          },
        );

        if (!associateResponse.ok) {
          console.error(`Failed to associate document ${docId}`);
        }
      }

      return chat;
    },
    onSuccess: (chat) => {
      toast({
        title: "Analysis Created",
        description: `Started analysis with ${selectedDocs.size} document${selectedDocs.size > 1 ? "s" : ""}`,
      });
      setSelectedDocs(new Set());
      queryClient.refetchQueries({ queryKey: ["/api/chats"] });
      setLocation(`/chat/${chat.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create analysis session",
        variant: "destructive",
      });
    },
  });

  const getDocumentStatus = (documentId: string) => {
    return useQuery({
      queryKey: ["/api/documents", documentId, "status"],
      refetchInterval: 5000,
      enabled: !!documentId,
    });
  };

  const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB — Vault limit

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "File too large",
        description: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum allowed size is 100 MB.`,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const user = getAuthUser();
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleView = async (doc: Document) => {
    try {
      await fetchApiFile(`/api/documents/${doc.id}/download`, {
        openInNewTab: true,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to open document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: diffDays > 365 ? "numeric" : undefined,
    });
  };

  const formatDateFull = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const formatBadge = (label: string, color: string) => (
      <div
        role="img"
        aria-label={`${label} file`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md shadow-sm ${color}`}
      >
        <span className="text-[8px] font-bold leading-none tracking-tight text-white">
          {label}
        </span>
      </div>
    );

    switch (ext) {
      case "pdf":
        return formatBadge("PDF", "bg-[#d63830]");
      case "xls":
      case "xlsx":
        return formatBadge("XLS", "bg-[#16804a]");
      case "csv":
        return formatBadge("CSV", "bg-[#117d73]");
      case "doc":
      case "docx":
        return formatBadge("DOC", "bg-[#2474c8]");
      case "txt":
        return formatBadge("TXT", "bg-[#64748b]");
      default:
        return (
          <div
            role="img"
            aria-label="Unknown file type"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#64748b] shadow-sm"
          >
            <span className="text-[8px] font-bold leading-none tracking-tight text-white">
              FILE
            </span>
          </div>
        );
    }
  };

  const handleSort = (column: "name" | "date") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const filteredDocuments = documents
    .filter((doc) => doc.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
    });

  const toggleSelectAll = () => {
    if (selectedDocs.size === filteredDocuments.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocuments.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDocs(newSelected);
  };

  const { data: stats = { totalDocuments: 0, vectorIndexed: 0, currentSessions: 0, totalSessions: 0 }, isLoading: statsLoading } = useQuery<{
    totalDocuments: number;
    vectorIndexed: number;
    currentSessions: number;
    totalSessions: number;
  }>({
    queryKey: ['/api/vault/stats'],
  });

  function SessionCount({ documentId }: { documentId: string }) {
    const { data: sessionData, isLoading } = useQuery<{ count: number }>({
      queryKey: ["/api/documents", documentId, "sessions"],
    });

    if (isLoading) {
      return <span className="text-sm text-muted-foreground animate-pulse">·· ·</span>;
    }

    if (!sessionData || sessionData.count === 0) {
      return <span className="text-sm text-muted-foreground">—</span>;
    }

    return <span className="text-sm font-medium text-foreground">{sessionData.count}</span>;
  }

  function ProcessingStatusCell({
    documentId,
    onRetry,
  }: {
    documentId: string;
    onRetry: () => void;
  }) {
    const { toast } = useToast();
    const prevStatusRef = useRef<string | null>(null);

    const { data: statusData } = useQuery<{
      status: string;
      processed_chunks: number;
      total_chunks: number;
    }>({
      queryKey: ["/api/documents", documentId, "status"],
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.status;
        if (!status || status === "processing" || status === "pending") return 3000;
        return false;
      },
    });

    // Toast only on processing → failed transition
    useEffect(() => {
      if (statusData?.status === "failed" && prevStatusRef.current === "processing") {
        toast({
          title: "Processing Failed",
          description: "Document could not be indexed. Click Retry to try again.",
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/vault/stats"] });
      }
      if (statusData?.status) {
        prevStatusRef.current = statusData.status;
      }
    }, [statusData?.status]);

    // Refresh stats on completion
    useEffect(() => {
      if (statusData?.status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["/api/vault/stats"] });
      }
    }, [statusData?.status]);

    if (!statusData) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    if (statusData.status === "processing" || statusData.status === "pending") {
      const total = statusData.total_chunks ?? 0;
      const done = statusData.processed_chunks ?? 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : null;
      return (
        <div className="flex flex-col gap-1 min-w-[120px]" data-testid={`badge-processing-${documentId}`}>
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 w-fit">
            <Loader2 className="w-3 h-3 animate-spin" />
            {pct !== null ? `Indexing… ${done}/${total}` : "Processing…"}
          </div>
          {total > 0 && (
            <div className="h-1 w-24 rounded-full bg-yellow-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      );
    }

    if (statusData.status === "failed") {
      return (
        <div className="flex items-center gap-2" data-testid={`badge-failed-${documentId}`}>
          <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200">
            <XCircle className="w-3 h-3" />
            Failed
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
            onClick={onRetry}
            data-testid={`button-retry-${documentId}`}
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      );
    }

    if (statusData.status === "completed") {
      const chunks = statusData.processed_chunks ?? statusData.total_chunks ?? 0;
      return (
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
          data-testid={`badge-processed-${documentId}`}
        >
          <CheckCircle2 className="w-3 h-3" />
          Indexed · {chunks} chunks
        </div>
      );
    }

    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#edf4f3]">
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <div className="min-h-full bg-white rounded-2xl border border-[#dce7e8] overflow-hidden flex flex-col">
          <div className="px-5 lg:px-7 py-3.5 flex items-center justify-between gap-3 bg-[#d6e8e9] flex-shrink-0">
            <h1
              className="text-xl font-semibold text-foreground"
              data-testid="text-vault-title"
            >
              Vault
            </h1>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="text-[#286e72] hover:bg-white/60"
                data-testid="button-help"
              >
                <HelpCircle className="w-5 h-5 text-primary" />
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-[#c4d9db] bg-white text-[#31484a] hover:bg-[#f3f8f8]"
                size="sm"
                data-testid="button-data-sources"
              >
                Data Sources
                <Badge variant="secondary" className="ml-1 bg-[#e7f1f2] text-[#466366]">
                  3
                </Badge>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 space-y-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="flex flex-col" aria-labelledby="vault-history-heading">
                <h2
                  id="vault-history-heading"
                  className="mb-3 text-sm font-semibold text-[#263638]"
                >
                  Document History
                </h2>
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <Card className="flex items-center gap-3 rounded-lg border border-[#d9e5e6] bg-white p-4 shadow-none" data-testid="card-total-documents">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <FolderOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-[#687879]">Documents</p>
                      <p className="text-2xl font-bold leading-none text-[#202b2d]">
                        {statsLoading ? "—" : stats.totalDocuments}
                      </p>
                    </div>
                  </Card>
                  <Card className="flex items-center gap-3 rounded-lg border border-[#d9e5e6] bg-white p-4 shadow-none" data-testid="card-vector-indexed">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <Cpu className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-[#687879]">Indexed</p>
                      <p className="text-2xl font-bold leading-none text-[#202b2d]">
                        {statsLoading ? "—" : stats.vectorIndexed}
                      </p>
                    </div>
                  </Card>
                  <Card className="flex items-center gap-3 rounded-lg border border-[#d9e5e6] bg-white p-4 shadow-none" data-testid="card-current-sessions">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                      <MessageSquare className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-[#687879]">Active Sessions</p>
                      <p className="text-2xl font-bold leading-none text-[#202b2d]">
                        {statsLoading ? "—" : stats.currentSessions}
                      </p>
                    </div>
                  </Card>
                  <Card className="flex items-center gap-3 rounded-lg border border-[#d9e5e6] bg-white p-4 shadow-none" data-testid="card-total-sessions">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <BarChart2 className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-[#687879]">Total Sessions</p>
                      <p className="text-2xl font-bold leading-none text-[#202b2d]">
                        {statsLoading ? "—" : stats.totalSessions}
                      </p>
                    </div>
                  </Card>
                </div>
              </section>

              <section className="flex flex-col" aria-labelledby="vault-upload-heading">
                <h2
                  id="vault-upload-heading"
                  className="mb-3 text-sm font-semibold text-[#263638]"
                >
                  File Upload
                </h2>
                <Card
                  className={`min-h-[220px] flex-1 rounded-xl border-2 border-dashed transition-colors ${
                    dragActive
                      ? "border-[#398b8e] bg-[#eaf5f5]"
                      : "border-[#d2e1e3] bg-[#f2f8f8]"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploading ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-5 py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e0eeee]">
                        <Loader2 className="h-5 w-5 animate-spin text-[#398b8e]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#263638]">Uploading…</p>
                        <p className="text-xs text-[#687879]">Please wait</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-5 py-5 text-center">
                      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#e0eeee]">
                        <Upload className="h-5 w-5 text-[#398b8e]" />
                      </div>
                      <p className="text-sm font-semibold text-[#263638]">
                        Drop files here or{" "}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="font-medium text-[#398b8e] underline underline-offset-2 hover:text-[#286e72]"
                          data-testid="button-browse-files"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-[#687879]">
                        PDF, Word, Excel, CSV, TXT — up to 100 MB
                      </p>
                      <span className="my-1 text-xs text-[#879596]">or</span>
                      <Button
                        type="button"
                        className="h-9 gap-2 bg-[#398b8e] px-4 text-xs font-medium text-white hover:bg-[#32777b]"
                        onClick={() => setShowConnectDrive(true)}
                        data-testid="button-connect-drive"
                      >
                        Connect Drive
                        <LinkIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    data-testid="input-file-upload"
                  />
                </Card>
              </section>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#d8e5e6] bg-white" aria-label="All files">
              <div className="flex flex-col gap-3 border-b border-[#c9dcde] bg-[#cfe3e5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h2
                  className="text-sm font-semibold text-[#263638]"
                  data-testid="text-all-files"
                >
                  All Files ({filteredDocuments.length})
                </h2>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div className="relative min-w-0 flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718183]" />
                    <Input
                      type="search"
                      placeholder="Search for document by name or type"
                      className="h-9 w-full border-[#d2e0e2] bg-white pl-10 text-[13px] sm:w-72"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-documents"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-[#c4d9db] bg-white text-[#35484a] hover:bg-[#f2f8f8]"
                    data-testid="button-filter"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>

              {/* <Card className="overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground w-12">
                          <Checkbox
                            checked={
                              selectedDocs.size === filteredDocuments.length &&
                              filteredDocuments.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Document Name
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Upload Date
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Sessions
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-12 text-muted-foreground text-sm"
                          >
                            Loading documents...
                          </td>
                        </tr>
                      ) : filteredDocuments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-12 text-muted-foreground text-sm"
                          >
                            {searchQuery
                              ? "No documents found"
                              : "No documents yet. Upload your first document to get started."}
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => (
                          <tr
                            key={doc.id}
                            className="border-b last:border-b-0 hover-elevate transition-colors"
                            data-testid={`row-document-${doc.id}`}
                          >
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={selectedDocs.has(doc.id)}
                                onCheckedChange={() => toggleSelect(doc.id)}
                                data-testid={`checkbox-${doc.id}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {getFileIcon(doc.name)}
                                <div className="min-w-0">
                                  <p
                                    className="font-medium text-sm text-foreground truncate"
                                    data-testid={`text-document-name-${doc.id}`}
                                  >
                                    {doc.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.fileSize)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 text-sm text-foreground"
                              data-testid={`text-upload-date-${doc.id}`}
                            >
                              {formatDate(doc.uploadedAt)}
                            </td>
                            <td
                              className="px-4 py-3"
                              data-testid={`text-sessions-${doc.id}`}
                            >
                              <SessionCount documentId={doc.id} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      data-testid={`button-menu-${doc.id}`}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => createAnalysisMutation.mutate([doc.id])}
                                      data-testid={`menu-start-analysis-${doc.id}`}
                                    >
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Start New Analysis
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleView(doc)}
                                      data-testid={`menu-view-file-${doc.id}`}
                                    >
                                      <Eye className="w-4 h-4 mr-2" />
                                      View File
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDownload(doc)}
                                      data-testid={`menu-download-${doc.id}`}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Download File
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        deleteMutation.mutate(doc.id)
                                      }
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`menu-delete-${doc.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete File
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card> */}
              <Card className="flex-shrink-0 overflow-hidden border-0 bg-white shadow-none">
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full min-w-[920px]">
                      <thead className="bg-[#e0edef]">
                        <tr className="border-b border-[#d3e1e3] bg-[#e0edef]">
                          <th className="w-12 px-4 py-3 text-left text-[13px] font-semibold text-[#45595b]">
                            <Checkbox
                              checked={
                                selectedDocs.size ===
                                  filteredDocuments.length &&
                                filteredDocuments.length > 0
                              }
                              onCheckedChange={toggleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </th>
                          <th
                            className="cursor-pointer px-4 py-3 text-left text-[13px] font-semibold text-[#45595b] transition-colors hover:text-[#1e5558]"
                            onClick={() => handleSort("name")}
                            data-testid="header-document-name"
                          >
                            <div className="flex items-center gap-2">
                              Document Name
                              {sortBy === "name" ? (
                                sortOrder === "asc" ? (
                                  <ArrowUp className="w-4 h-4" />
                                ) : (
                                  <ArrowDown className="w-4 h-4" />
                                )
                              ) : (
                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                              )}
                            </div>
                          </th>
                          <th
                            className="cursor-pointer px-4 py-3 text-left text-[13px] font-semibold text-[#45595b] transition-colors hover:text-[#1e5558]"
                            onClick={() => handleSort("date")}
                            data-testid="header-upload-date"
                          >
                            <div className="flex items-center gap-2">
                              Upload Date
                              {sortBy === "date" ? (
                                sortOrder === "asc" ? (
                                  <ArrowUp className="w-4 h-4" />
                                ) : (
                                  <ArrowDown className="w-4 h-4" />
                                )
                              ) : (
                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#45595b]">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#45595b]">
                            Sessions
                          </th>
                          <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#45595b]">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {isLoading ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-12 text-center text-sm text-[#687879]"
                            >
                              Loading documents...
                            </td>
                          </tr>
                        ) : filteredDocuments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-12 text-center text-sm text-[#687879]"
                            >
                              {searchQuery
                                ? "No documents found"
                                : "No documents yet. Upload your first document to get started."}
                            </td>
                          </tr>
                        ) : (
                          filteredDocuments.map((doc) => (
                            <tr
                              key={doc.id}
                              className="group border-b border-[#e2ebec] odd:bg-white even:bg-[#eff7f8] transition-colors hover:bg-[#e5f1f2] last:border-b-0"
                              data-testid={`row-document-${doc.id}`}
                            >
                              <td className="px-4 py-3">
                                <Checkbox
                                  checked={selectedDocs.has(doc.id)}
                                  onCheckedChange={() => toggleSelect(doc.id)}
                                  data-testid={`checkbox-${doc.id}`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {getFileIcon(doc.name)}
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className="truncate text-sm font-medium text-[#263638]"
                                      data-testid={`text-document-name-${doc.id}`}
                                    >
                                      {doc.name}
                                    </p>
                                    <p className="text-xs text-[#718183]">
                                      {formatFileSize(doc.fileSize)}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td
                                className="whitespace-nowrap px-4 py-3 text-sm text-[#526668]"
                                data-testid={`text-upload-date-${doc.id}`}
                                title={formatDateFull(doc.uploadedAt)}
                              >
                                {formatDate(doc.uploadedAt)}
                              </td>
                              <td className="px-4 py-3" data-testid={`text-status-${doc.id}`}>
                                <ProcessingStatusCell
                                  documentId={doc.id}
                                  onRetry={() => processMutation.mutate(doc.id)}
                                />
                              </td>
                              <td
                                className="px-4 py-3"
                                data-testid={`text-sessions-${doc.id}`}
                              >
                                <SessionCount documentId={doc.id} />
                              </td>
                              <td className="px-4 py-3">
                                {/* Inline hover actions + overflow menu */}
                                <div className="flex items-center gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 transition-opacity text-[#718183] group-hover:opacity-100 hover:text-[#286e72]"
                                    onClick={() => createAnalysisMutation.mutate([doc.id])}
                                    title="Start New Analysis"
                                    data-testid={`button-analysis-${doc.id}`}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 transition-opacity text-[#718183] group-hover:opacity-100 hover:text-[#286e72]"
                                    onClick={() => handleView(doc)}
                                    title="View File"
                                    data-testid={`button-view-${doc.id}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 transition-opacity text-[#718183] group-hover:opacity-100 hover:text-[#286e72]"
                                    onClick={() => handleDownload(doc)}
                                    title="Download File"
                                    data-testid={`button-download-inline-${doc.id}`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 transition-opacity text-[#718183] group-hover:opacity-100 hover:text-destructive"
                                    onClick={() => deleteMutation.mutate(doc.id)}
                                    title="Delete File"
                                    data-testid={`button-delete-inline-${doc.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>

              {selectedDocs.size > 0 && (
                <div className="flex justify-center mt-4">
                  <Button
                    size="default"
                    className="gap-2"
                    onClick={() =>
                      createAnalysisMutation.mutate(Array.from(selectedDocs))
                    }
                    disabled={createAnalysisMutation.isPending}
                    data-testid="button-create-analysis-bulk"
                  >
                    {createAnalysisMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {createAnalysisMutation.isPending
                      ? "Creating..."
                      : `Create New Analysis (${selectedDocs.size} selected)`}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <ConnectDriveDialog
        open={showConnectDrive}
        onOpenChange={setShowConnectDrive}
      />
    </div>
  );
}
