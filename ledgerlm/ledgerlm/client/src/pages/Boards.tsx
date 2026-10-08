import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  FilePlus2,
  Folder,
  Trash2,
  Edit,
  MessageCircle,
  Building2,
  BarChart3,
  Scale,
  Landmark,
} from "lucide-react";
import { useLocation } from "wouter";
import { type BoardTemplate, type Board } from "@shared/schema";
import { BoardEditorDialog } from "@/components/BoardEditorDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuthUser } from "@/lib/auth";
import { KioskChatDialog } from "@/components/KioskChatDialog";

const TEMPLATE_ICONS: Record<string, typeof BarChart3> = {
  "kpi-metrics": BarChart3,
  "balance-sheet-tracker": Scale,
  "entity-pnl": Landmark,
};

interface DomainInfo {
  domain?: { id: string; name: string };
  isSuperAdmin?: boolean;
}

export default function Boards() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const currentUser = useAuthUser();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    BoardTemplate | undefined
  >();
  const [selectedBoard, setSelectedBoard] = useState<Board | undefined>();
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  const { data: domainInfo } = useQuery<DomainInfo>({
    queryKey: ["/api/domain-admin/my-domain"],
    enabled: !!currentUser,
  });

  const isBoschDomain = domainInfo?.domain?.name?.toLowerCase().includes('bosch') || 
                        currentUser?.username?.toLowerCase().includes('@bosch.com');

  const { data: templates = [], isLoading: templatesLoading } = useQuery<
    BoardTemplate[]
  >({
    queryKey: ["/api/board-templates"],
  });

  const { data: boards = [], isLoading: boardsLoading } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  // Presentation only: keep the full catalog and all existing boards intact.
  const boschTemplates = [
    "kpi-metrics",
    "balance-sheet-tracker",
    "entity-pnl",
  ].flatMap((slug) => templates.filter((template) => template.slug === slug));

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      return apiRequest("DELETE", `/api/boards/${boardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({
        title: "Board deleted",
        description: "The board has been successfully deleted",
      });
      setBoardToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete board",
        variant: "destructive",
      });
    },
  });

  const handleUseTemplate = (template: BoardTemplate) => {
    setSelectedTemplate(template);
    setSelectedBoard(undefined);
    setIsEditorOpen(true);
  };

  const handleCreateNewBoard = () => {
    setSelectedTemplate(undefined);
    setSelectedBoard(undefined);
    setIsEditorOpen(true);
  };

  const handleEditBoard = (board: Board) => {
    setSelectedBoard(board);
    setSelectedTemplate(undefined);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = (open: boolean) => {
    setIsEditorOpen(open);
    if (!open) {
      setSelectedTemplate(undefined);
      setSelectedBoard(undefined);
    }
  };

  const handleDeleteBoard = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setBoardToDelete(board);
  };

  const confirmDeleteBoard = () => {
    if (boardToDelete) {
      deleteBoardMutation.mutate(boardToDelete.id);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
          <div className="px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
            <h1
              className="text-xl font-semibold text-foreground"
              data-testid="text-vault-title"
            >
              Boards
            </h1>
            <Button
              onClick={handleCreateNewBoard}
              className="flex-shrink-0"
              data-testid="button-create-new-board"
            >
              Create New Board
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8 space-y-8">
            <div className="space-y-4">
              <h2
                className="text-xl font-semibold text-foreground"
                data-testid="text-templates-title"
              >
                Browse Templates
              </h2>

              {templatesLoading ? (
                <div
                  className="text-center py-12 text-muted-foreground"
                  data-testid="text-loading-templates"
                >
                  Loading templates...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {boschTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="p-6 flex flex-col gap-5 hover-elevate border-t-4 border-t-primary"
                      data-testid={`card-template-${template.slug}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                          {(() => {
                            const Icon = TEMPLATE_ICONS[template.slug] ?? FilePlus2;
                            return <Icon className="w-5 h-5 text-primary" />;
                          })()}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs font-bold tracking-widest text-primary border-primary/40 bg-primary/10"
                          data-testid={`badge-bosch-${template.slug}`}
                        >
                          BOSCH
                        </Badge>
                      </div>
                      <div className="space-y-2 flex-1">
                        <h3
                          className="text-base font-semibold text-foreground"
                          data-testid={`text-template-title-${template.slug}`}
                        >
                          {template.name}
                        </h3>
                        <p
                          className="text-sm leading-relaxed text-muted-foreground line-clamp-3"
                          data-testid={`text-template-description-${template.slug}`}
                        >
                          {template.description}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="w-full rounded-md border border-primary/30 px-3 py-2 text-sm text-primary hover:bg-primary/10 font-medium flex items-center justify-center gap-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        data-testid={`button-use-template-${template.slug}`}
                      >
                        Use Template
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {boards.length > 0 && (
              <div className="space-y-4">
                <h2
                  className="text-xl font-semibold text-foreground"
                  data-testid="text-my-boards-title"
                >
                  My Boards
                </h2>

                {boardsLoading ? (
                  <div
                    className="text-center py-12 text-muted-foreground"
                    data-testid="text-loading-boards"
                  >
                    Loading your boards...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {boards.map((board) => (
                      <Card
                        key={board.id}
                        className="p-6 flex flex-col gap-4 hover-elevate"
                        data-testid={`card-board-${board.id}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Folder className="w-5 h-5 text-primary" />
                        </div>
                        <div className="space-y-2">
                          <h3
                            className="text-base font-semibold text-foreground line-clamp-2"
                            data-testid={`text-board-title-${board.id}`}
                          >
                            {board.title}
                          </h3>
                          <p
                            className="text-sm leading-relaxed text-muted-foreground line-clamp-2"
                            data-testid={`text-board-description-${board.id}`}
                          >
                            {board.description || "No description"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => navigate(`/board/${board.id}`)}
                            className="flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm text-primary hover:bg-primary/10 font-medium flex items-center justify-center gap-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            data-testid={`button-open-board-${board.id}`}
                          >
                            Open Board
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditBoard(board);
                            }}
                            className="h-8 w-8 flex-shrink-0"
                            aria-label={`Edit ${board.title}`}
                            data-testid={`button-edit-board-${board.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteBoard(board, e)}
                            className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive"
                            aria-label={`Delete ${board.title}`}
                            data-testid={`button-delete-board-${board.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <BoardEditorDialog
        open={isEditorOpen}
        onOpenChange={handleCloseEditor}
        template={selectedTemplate}
        board={selectedBoard}
      />

      <AlertDialog
        open={!!boardToDelete}
        onOpenChange={(open) => !open && setBoardToDelete(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-board">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-dialog-title">
              Delete Board?
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-dialog-description">
              Are you sure you want to delete "{boardToDelete?.title}"? This
              action cannot be undone and all analysis threads in this board
              will remain but won't be linked to any board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBoard}
              disabled={deleteBoardMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteBoardMutation.isPending ? "Deleting..." : "Delete Board"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isBoschDomain && domainInfo?.domain?.id && (
        <KioskChatDialog
          open={isKioskOpen}
          onOpenChange={setIsKioskOpen}
          domainId={domainInfo.domain.id}
        />
      )}
    </div>
  );
}
