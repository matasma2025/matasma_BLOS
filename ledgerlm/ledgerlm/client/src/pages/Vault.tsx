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
  FileText,
  Trash2,
  Download,
  MoreVertical,
  File,
  FileSpreadsheet,
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
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";
import type { Document } from "@shared/schema";
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
          "x-user-id": user?.id || "",
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
              "x-user-id": user?.id || "",
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
          "x-user-id": user?.id || "",
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
          "x-user-id": user?.id || "",
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

      const chatTitle =
        documentIds.length > 2
          ? `Analysis: ${selectedDocNames} and ${documentIds.length - 2} more`
          : `Analysis: ${selectedDocNames}`;

      const chatResponse = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "x-user-id": user?.id || "",
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
        throw new Error("Failed to create chat");
      }

      const chat = await chatResponse.json();

      for (const docId of documentIds) {
        const associateResponse = await fetch(
          `/api/chats/${chat.id}/documents`,
          {
            method: "POST",
            headers: {
              "x-user-id": user?.id || "",
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create analysis session",
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
        headers: {
          "x-user-id": user?.id || "",
        },
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

  const handleView = (doc: Document) => {
    // Open the file in a new browser tab — PDFs render inline, others prompt download
    window.open(`/api/documents/${doc.id}/download`, "_blank", "noopener,noreferrer");
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
    switch (ext) {
      case "pdf":
        return (
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-red-500" />
          </div>
        );
      case "xls":
      case "xlsx":
      case "csv":
        return (
          <div className="w-8 h-8 rounded-lg bg-green-600/10 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
          </div>
        );
      case "doc":
      case "docx":
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <File className="w-4 h-4 text-muted-foreground" />
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
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <h1
              className="text-xl font-semibold text-foreground"
              data-testid="text-vault-title"
            >
              Vault
            </h1>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="icon" data-testid="button-help">
                <HelpCircle className="w-5 h-5 text-primary" />
              </Button>
              <Button
                variant="outline"
                className="gap-2 bg-white"
                size="sm"
                data-testid="button-data-sources"
              >
                Data Sources
                <Badge variant="secondary" className="ml-1">
                  3
                </Badge>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-4">

            {/* ── Stat strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4 flex items-center gap-3" data-testid="card-total-documents">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-1">Documents</p>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {statsLoading ? "—" : stats.totalDocuments}
                  </p>
                </div>
              </Card>
              <Card className="p-4 flex items-center gap-3" data-testid="card-vector-indexed">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-1">Indexed</p>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {statsLoading ? "—" : stats.vectorIndexed}
                  </p>
                </div>
              </Card>
              <Card className="p-4 flex items-center gap-3" data-testid="card-current-sessions">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-1">Active Sessions</p>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {statsLoading ? "—" : stats.currentSessions}
                  </p>
                </div>
              </Card>
              <Card className="p-4 flex items-center gap-3" data-testid="card-total-sessions">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-1">Total Sessions</p>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {statsLoading ? "—" : stats.totalSessions}
                  </p>
                </div>
              </Card>
            </div>

            {/* ── Upload zone ── */}
            <Card
              className={`border-2 border-dashed transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">Uploading…</p>
                    <p className="text-xs text-muted-foreground">Please wait</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">Drop files here or{" "}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-primary hover:underline"
                          data-testid="button-browse-files"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-muted-foreground">PDF, Word, Excel, CSV, TXT — up to 100 MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConnectDrive(true)}
                    className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 flex-shrink-0"
                    data-testid="button-connect-drive"
                  >
                    <LinkIcon className="w-3 h-3 inline mr-1" />
                    Connect Drive
                  </button>
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

            <div className="space-y-3 bg-white -mx-6 lg:-mx-8 px-6 lg:px-8 py-5 -mb-6">
              <div className="flex items-center justify-between">
                <h2
                  className="text-base font-semibold text-foreground"
                  data-testid="text-all-files"
                >
                  All Files ({filteredDocuments.length})
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search for document by name or type"
                      className="pl-10 w-80 h-9 bg-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-documents"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white"
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
              <Card className="overflow-hidden bg-white backdrop-blur-sm flex-shrink-0">
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full">
                      <thead className="bg-primary/5">
                        <tr className="border-b bg-primary/5">
                          <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground w-12">
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
                            className="text-left px-4 py-3 font-medium text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
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
                            className="text-left px-4 py-3 font-medium text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
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
                          <th className="text-left px-4 py-3 font-medium text-sm text-muted-foreground">
                            Status
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
                              colSpan={6}
                              className="text-center py-12 text-muted-foreground text-sm"
                            >
                              Loading documents...
                            </td>
                          </tr>
                        ) : filteredDocuments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
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
                              className="border-b last:border-b-0 hover:bg-muted/40 transition-colors group"
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
                                className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap"
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
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={() => createAnalysisMutation.mutate([doc.id])}
                                    title="Start New Analysis"
                                    data-testid={`button-analysis-${doc.id}`}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={() => handleView(doc)}
                                    title="View File"
                                    data-testid={`button-view-${doc.id}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={() => handleDownload(doc)}
                                    title="Download File"
                                    data-testid={`button-download-inline-${doc.id}`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
            </div>
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
