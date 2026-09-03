import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, MessageSquare, FolderPlus,
  Sparkles, Database, BarChart3, FileText,
} from 'lucide-react';
import { type Board, type Chat, type CubeBoardReport } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BoardEditorDialog } from '@/components/BoardEditorDialog';
import { BoardAnalysisEditor } from '@/components/BoardAnalysisEditor';
import { BoardReport } from '@/components/BoardReport';

type TabId = 'reports' | 'threads';

export default function BoardDetail() {
  const { id: boardId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAnalysisEditorOpen, setIsAnalysisEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('reports');
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const { data: board, isLoading: boardLoading } = useQuery<Board>({
    queryKey: ['/api/boards', boardId],
    enabled: !!boardId,
  });

  const { data: boardThreads = [], isLoading: threadsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/boards', boardId, 'threads'],
    enabled: !!boardId,
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<CubeBoardReport[]>({
    queryKey: ['/api/boards', boardId, 'reports'],
    enabled: !!boardId,
    queryFn: () => apiRequest('GET', `/api/boards/${boardId}/reports`) as Promise<CubeBoardReport[]>,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!board) throw new Error('Board not found');
      const boardSettings = board.settings as any;
      const chatResponse = await apiRequest('POST', '/api/chats', {
        title: `${board.title} — Analysis`,
        templateMessage: boardSettings?.analysisPrompts || `Let's analyse using ${board.title}`,
      }) as Chat;
      await apiRequest('POST', `/api/boards/${board.id}/threads`, { chatId: chatResponse.id });
      return chatResponse;
    },
    onSuccess: (data: Chat) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', boardId, 'threads'] });
      navigate(`/chat/${data.id}`);
    },
    onError: () =>
      toast({ title: 'Error', description: 'Failed to create analysis chat', variant: 'destructive' }),
  });

  const handleReportGenerated = (report: CubeBoardReport) => {
    setActiveTab('reports');
    setOpenReportId(report.id);
  };

  if (boardLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading board…</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-muted-foreground" data-testid="text-board-not-found">Board not found</div>
        <Button onClick={() => navigate('/boards')} data-testid="button-back-not-found">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Boards
        </Button>
      </div>
    );
  }

  const boardSettings = board.settings as any ?? {};
  const hasCube = !!boardSettings.cubeId;
  const mapping = boardSettings.columnMapping ?? {};

  return (
    <div className="h-full flex-1 bg-muted/20 p-4 lg:p-6 overflow-hidden">
      <div className="h-full bg-white rounded-2xl overflow-auto flex flex-col">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 bg-primary/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/boards')} data-testid="button-back-boards">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-board-title">
              {board.title}
            </h1>
            {hasCube && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Database className="w-3 h-3" />
                Cube linked
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)} data-testid="button-edit-board">
              Edit Board
            </Button>
            {hasCube ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsAnalysisEditorOpen(true)}
                data-testid="button-run-analysis"
              >
                <Sparkles className="w-4 h-4" />
                Run Analysis
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => createChatMutation.mutate()}
                disabled={createChatMutation.isPending}
                data-testid="button-new-analysis"
              >
                {createChatMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                ) : (
                  <><MessageSquare className="w-4 h-4 mr-2" />New Analysis</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6 space-y-6">
          {/* Meta section */}
          <div className="space-y-4">
            {board.description && (
              <div className="space-y-1">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide" data-testid="text-description-label">Description</h2>
                <p className="text-sm" data-testid="text-board-description">{board.description}</p>
              </div>
            )}

            {/* Cube / column-mapping summary */}
            {hasCube && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Smart Analysis — Column Mapping</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapping.actuals && (
                    <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">actuals → {mapping.actuals}</Badge>
                  )}
                  {mapping.budget && (
                    <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">budget → {mapping.budget}</Badge>
                  )}
                  {mapping.forecast && (
                    <Badge className="text-xs bg-purple-100 text-purple-800 hover:bg-purple-100">forecast → {mapping.forecast}</Badge>
                  )}
                  {(mapping.rollingForecasts ?? []).map((rf: string) => (
                    <Badge key={rf} variant="outline" className="text-xs">{rf}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click <strong>Run Analysis</strong> to generate an AI-powered BvA variance report.
                </p>
              </div>
            )}

            {boardSettings?.dataSources && (
              <div className="flex flex-wrap gap-2" data-testid="container-data-sources">
                {boardSettings.dataSources.enterprise && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-enterprise">Enterprise Data</Badge>
                )}
                {boardSettings.dataSources.vault && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-vault">Vault Documents</Badge>
                )}
                {boardSettings.dataSources.webApis && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-web">Web APIs</Badge>
                )}
                {boardSettings.dataSources.financialApis && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-datasource-financial">Financial APIs</Badge>
                )}
              </div>
            )}
          </div>

          {/* ── Tabs ───────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex border-b gap-1">
              {([
                { id: 'reports' as TabId,  label: 'Reports',          icon: BarChart3,    count: reports.length },
                { id: 'threads' as TabId,  label: 'Analysis Threads', icon: MessageSquare, count: boardThreads.length },
              ] as { id: TabId; label: string; icon: any; count: number }[]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Reports tab */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                {reportsLoading ? (
                  <div className="text-center py-10 text-muted-foreground">Loading reports…</div>
                ) : reports.length === 0 ? (
                  <Card className="p-12 text-center border-dashed">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                      {hasCube
                        ? 'Click "Run Analysis" to generate an AI-powered Budget vs Actual variance report from your cube data.'
                        : 'Edit this board and connect a data cube to enable Smart Analysis reports.'}
                    </p>
                    {hasCube ? (
                      <Button onClick={() => setIsAnalysisEditorOpen(true)} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Run First Analysis
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                        <Database className="w-4 h-4 mr-2" />
                        Connect Cube
                      </Button>
                    )}
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        onClick={() => setOpenReportId(openReportId === report.id ? null : report.id)}
                        className="cursor-pointer"
                      >
                        <BoardReport
                          report={{ ...report, id: report.id } as CubeBoardReport}
                          boardId={boardId!}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Threads tab */}
            {activeTab === 'threads' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => createChatMutation.mutate()} disabled={createChatMutation.isPending}>
                    {createChatMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                    ) : (
                      <><MessageSquare className="w-4 h-4 mr-2" />New Chat</>
                    )}
                  </Button>
                </div>

                {threadsLoading ? (
                  <div className="text-center py-10 text-muted-foreground" data-testid="text-loading-threads">
                    Loading analysis threads…
                  </div>
                ) : boardThreads.length === 0 ? (
                  <Card className="p-12 text-center" data-testid="card-empty-threads">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <FolderPlus className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">No analysis threads yet</h3>
                    <p className="text-sm text-muted-foreground mb-4" data-testid="text-empty-description">
                      Start a conversation-based analysis with this board's configuration
                    </p>
                    <Button onClick={() => createChatMutation.mutate()} disabled={createChatMutation.isPending} data-testid="button-start-first-analysis">
                      {createChatMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                      ) : (
                        <><MessageSquare className="w-4 h-4 mr-2" />Start Analysis</>
                      )}
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {boardThreads.map((chat) => (
                      <Card
                        key={chat.id}
                        className="p-5 space-y-3 hover:shadow-md cursor-pointer transition-shadow"
                        onClick={() => navigate(`/chat/${chat.id}`)}
                        data-testid={`card-thread-${chat.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate" data-testid={`text-thread-title-${chat.id}`}>{chat.title}</h3>
                            <p className="text-xs text-muted-foreground" data-testid={`text-thread-date-${chat.id}`}>
                              {new Date(chat.createdAt).toLocaleDateString()} at{' '}
                              {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
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

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <BoardEditorDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        board={board}
      />

      {isAnalysisEditorOpen && (
        <BoardAnalysisEditor
          open={isAnalysisEditorOpen}
          onOpenChange={setIsAnalysisEditorOpen}
          board={board}
          onReportGenerated={handleReportGenerated}
        />
      )}
    </div>
  );
}
