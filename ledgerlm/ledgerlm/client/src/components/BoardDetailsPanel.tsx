import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, X } from 'lucide-react';
import { BoardSourceSelector } from '@/components/BoardSourceSelector';

interface BoardDetailsPanelProps {
  id: string;
  open: boolean;
  onClose: () => void;
  boardId: string;
  title: string;
  description?: string | null;
  boardSettings: any;
  boardTemplateKey: string;
  hasCube: boolean;
  isStandaloneBoard: boolean;
  isEntityPnlBoard: boolean;
  mapping: any;
}

export function BoardDetailsPanel({
  id, open, onClose, boardId, title, description, boardSettings, boardTemplateKey,
  hasCube, isStandaloneBoard, isEntityPnlBoard, mapping,
}: BoardDetailsPanelProps) {
  return (
    <section
      id={id}
      hidden={!open}
      aria-label={`Board details for ${title}`}
      className="border-b bg-slate-50/60 px-4 sm:px-6 lg:px-8 py-4 flex-shrink-0"
      data-testid="panel-board-details"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold">Board details</h2>
          <p className="text-xs text-muted-foreground">Source, configuration and data sources for {title}.</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onClose} data-testid="button-close-board-details">
          <X className="w-4 h-4" />
          Close
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
        <div className="min-w-0">
          <BoardSourceSelector boardId={boardId} />
        </div>

        {(description || boardSettings?.dataSources) && (
          <div className="space-y-3 min-w-0">
            {description && (
              <div className="space-y-1">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide" data-testid="text-description-label">Description</h2>
                <p className="text-sm" data-testid="text-board-description">{description}</p>
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
        )}

        {isStandaloneBoard && (
          <div className="rounded-xl border border-teal-900/15 bg-teal-50/50 p-4 space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Standalone Board configuration</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">{boardTemplateKey === 'kpi-metrics' ? 'KPI Metrics' : boardTemplateKey === 'entity-pnl' ? 'Entity P&L' : 'Balance Sheet'}</Badge>
              {boardSettings.boardFlow?.scope?.version && <Badge variant="outline" className="text-xs">Version · {boardSettings.boardFlow.scope.version}</Badge>}
              {boardSettings.boardFlow?.scope?.entity && <Badge variant="outline" className="text-xs">Entity · {boardSettings.boardFlow.scope.entity}</Badge>}
              {isEntityPnlBoard && <Badge variant="outline" className="text-xs">{boardSettings.boardFlow?.scope?.pnlComparison === 'yoy' ? 'YoY' : 'QoQ'}</Badge>}
              {isEntityPnlBoard && <Badge variant="outline" className="text-xs">{boardSettings.boardFlow?.scope?.currency ?? 'INR'}</Badge>}
              {isEntityPnlBoard && boardSettings.boardFlow?.scope?.forecastScenario && <Badge variant="outline" className="text-xs">Forecast · {boardSettings.boardFlow.scope.forecastScenario}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Runs use the selected authorized source and configured period. Actuals and Budget mappings are not required.
            </p>
          </div>
        )}

        {!isStandaloneBoard && hasCube && (
          <div className="rounded-xl border border-teal-900/15 bg-teal-50/50 p-4 space-y-2 min-w-0">
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
              Click <strong>Run Analysis</strong> to generate the configured Board report.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
