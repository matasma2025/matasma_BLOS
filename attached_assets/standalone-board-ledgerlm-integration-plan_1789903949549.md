# Standalone Board → Native LedgerLM Integration Plan

## Objective

Replace the existing native LedgerLM Board implementation with the richer
Standalone Board functionality, while keeping the Board inside LedgerLM's
authenticated React/Vite application.

The target architecture is:

```text
Native LedgerLM React/Vite frontend
        |
        v
LedgerLM Express API
        |
        +-- Board persistence
        +-- Generic analysis
        +-- KPI Metrics service
        +-- Entity P&L service
        +-- Chat and threads
        +-- Export jobs
        +-- Server-side schedules
        |
        v
Existing authorized PostgreSQL and enterprise data services
```

The final product should not depend on a Board iframe, a duplicate Next.js
Board route, browser-only Board persistence, or a separate security boundary.

---

## Current implementations

### Existing LedgerLM Board

The current native Board is a React/Vite and Express implementation:

- `ledgerlm/ledgerlm/client/src/pages/Boards.tsx`
- `ledgerlm/ledgerlm/client/src/pages/BoardDetail.tsx`
- `ledgerlm/ledgerlm/client/src/components/BoardEditorDialog.tsx`
- `ledgerlm/ledgerlm/client/src/components/BoardAnalysisEditor.tsx`
- `ledgerlm/ledgerlm/client/src/components/BoardReport.tsx`
- `ledgerlm/ledgerlm/server/routes.ts`
- `ledgerlm/ledgerlm/server/services/boardAnalysisService.ts`
- `ledgerlm/ledgerlm/server/storage.ts`
- `ledgerlm/ledgerlm/shared/schema.ts`

It already has server-side Board, template, thread, report, document, and data
source APIs.

### Standalone Board

The Standalone implementation is a Next.js application:

- `ledgerlm/boards-standalone/app/boards/page.tsx`
- `ledgerlm/boards-standalone/app/boards/[id]/page.tsx`
- `ledgerlm/boards-standalone/components/board/*`
- `ledgerlm/boards-standalone/lib/store.ts`
- `ledgerlm/boards-standalone/lib/runAnalysis.ts`
- `ledgerlm/boards-standalone/app/api/analyze/route.ts`
- `ledgerlm/boards-standalone/app/api/chat/route.ts`
- `ledgerlm/boards-standalone/app/api/export/route.ts`

It has the richer user experience:

- Multi-step Board configuration
- General Board analysis
- KPI Metrics reports
- Entity P&L reports
- Analysis progress and cancellation
- Report search and history
- Analysis threads and chat
- PPTX and PDF exports
- Template-driven exports
- Scheduled-run configuration
- KPI and Entity P&L-specific settings

---

# 1. Frontend route migration

## `boards-standalone/app/boards/page.tsx`

### Current functionality

- Displays Board templates.
- Creates a Board.
- Opens the Board configuration modal.
- Lists saved Boards.
- Opens a Board.
- Uploads a data source.
- Saves Board state locally.

Important functions:

```text
BoardsPage()
openCreate()
handleSubmit()
handleUpload()
```

### Target

Adapt the functionality into:

```text
ledgerlm/ledgerlm/client/src/pages/Boards.tsx
```

The native page should use React Query and LedgerLM APIs instead of the
Standalone browser store.

Required APIs:

```text
GET    /api/boards
GET    /api/board-templates
POST   /api/boards
PUT    /api/boards/:id
DELETE /api/boards/:id
```

### Final behavior

The native `/boards` page should support:

- Template cards
- Create Board
- Edit Board
- Delete Board
- Open Board
- Data source upload
- Loading and empty states
- Server-persisted Board state
- Company and domain authorization

---

## `boards-standalone/app/boards/[id]/page.tsx`

### Current functionality

This is the main Standalone Board workspace. It provides:

- Board loading
- Board editing
- Connected cube/source display
- KPI Metrics configuration
- Entity P&L configuration
- General analysis configuration
- Run Analysis
- Stop Analysis
- Progress reporting
- Error and cancellation handling
- Report history
- Report search
- Report expansion
- PPTX export
- PDF export
- Analysis threads
- Chat
- Scheduled-run indicators
- Ad-hoc and Scheduled trigger labels

Important functions:

```text
BoardDetailPage()
reportSearchText()
update()
newThread()
runAnalysis()
stopAnalysis()
runExport()
requestExport()
sendChat()
```

### Target

Adapt the page into:

```text
ledgerlm/ledgerlm/client/src/pages/BoardDetail.tsx
```

Recommended component split:

```text
ledgerlm/ledgerlm/client/src/components/board/BoardWorkspace.tsx
ledgerlm/ledgerlm/client/src/components/board/BoardReports.tsx
ledgerlm/ledgerlm/client/src/components/board/BoardThreads.tsx
ledgerlm/ledgerlm/client/src/components/board/BoardRunStatus.tsx
ledgerlm/ledgerlm/client/src/components/board/BoardExportStatus.tsx
```

The existing native page is currently smaller and separates reports, threads,
the editor, and the analysis editor. The Standalone detail experience should
become the authoritative Board workspace.

---

# 2. Board configuration migration

## `boards-standalone/components/board/BoardModal.tsx`

### Current functionality

The Standalone modal is a multi-step configuration wizard for:

- Board name
- Board description
- Template selection
- Data source selection
- Cube selection
- Uploaded source selection
- All/selected/excluded column scope
- Key columns
- Dimensions
- Dimension values
- Time granularity
- Comparison basis
- User prompt
- Report template
- PowerPoint template upload
- PowerPoint template anatomy
- Schedule configuration
- Forecast/version selection
- Entity P&L settings
- KPI Metrics settings

Important functions:

```text
BoardModal()
looksLikePeriodLabel()
TypeaheadPicker()
TemplateAnatomyView()
handleTemplateFile()
toggleVersion()
addKeyColumn()
addAllKeyColumns()
removeKeyColumn()
buildSchedule()
goNext()
submit()
```

### Target

Replace or substantially extend:

```text
ledgerlm/ledgerlm/client/src/components/BoardEditorDialog.tsx
ledgerlm/ledgerlm/client/src/components/BoardAnalysisEditor.tsx
```

Recommended native flow:

```text
BoardEditorDialog
  ├── Basic settings
  ├── Template settings
  ├── Cube and data source settings
  ├── Column scope settings
  ├── KPI Metrics settings
  ├── Entity P&L settings
  ├── Schedule settings
  └── PowerPoint template settings
```

Required supporting APIs:

```text
GET    /api/cubes/accessible
GET    /api/cubes/:cubeId/versions
GET    /api/kpi-reports/cubes
GET    /api/kpi-reports/cubes/:cubeId/options
GET    /api/v2/entity-pnl/cubes/:cubeId/entities
POST   /api/boards
PUT    /api/boards/:id
```

### Schema review

Confirm that the following fields can be stored in the existing Board settings:

```text
scopeMode
keyColumns
excludedColumns
timeGranularity
comparisonBasis
reportTemplate
schedule
entityPnl
kpiReport
```

If any fields are not supported, add structured validation or database fields
before replacing the old Board implementation.

---

# 3. Report and result components

## `boards-standalone/components/board/AnalysisProgress.tsx`

### Functionality

- Progress percentage
- Current analysis stage
- Progress bar
- Stop button
- Completion state
- Error state

### Target

Adapt into:

```text
ledgerlm/ledgerlm/client/src/components/board/AnalysisProgress.tsx
```

It should support progress for:

- General Board analysis
- KPI Metrics analysis
- Entity P&L analysis
- Export jobs

---

## `boards-standalone/components/board/ResultSections.tsx`

### Functionality

- KPI cards
- Narrative sections
- Risks
- Insights
- Tables
- Entity P&L output
- KPI green-scope presentation
- Utilization comparisons
- Capacity output
- Actual-versus-Forecast output

### Target

Adapt into:

```text
ledgerlm/ledgerlm/client/src/components/board/ResultSections.tsx
```

The existing native report component is:

```text
ledgerlm/ledgerlm/client/src/components/BoardReport.tsx
```

The richer Standalone renderer should become the primary report renderer.

Existing native functionality such as report deletion and follow-up analysis
must not be lost during the replacement.

---

## `boards-standalone/components/board/ResultCharts.tsx`

### Functionality

- Line charts
- Bar charts
- Area charts
- Donut charts
- Responsive layout
- Legends and labels
- Chart rendering inside reports
- Chart references for PDF export

### Target

Adapt into:

```text
ledgerlm/ledgerlm/client/src/components/board/ResultCharts.tsx
```

---

# 4. State and persistence migration

## `boards-standalone/lib/store.ts`

### Current functionality

- Stores Boards in browser storage.
- Stores uploaded datasets in IndexedDB.
- Reads and writes Boards.
- Deletes Boards.
- Tracks hidden sample data.
- Dispatches local update events.
- Loads datasets before resolving a Board.
- Detaches deleted sources from Boards.

Important functions:

```text
getBoards()
getBoard()
saveBoard()
deleteBoard()
ensureDatasetsLoaded()
getUploadedSources()
saveUploadedSource()
deleteUploadedSource()
hideSampleSource()
restoreSampleSources()
```

### Target

Do not keep the browser store as the production source of truth.

Replace it with:

```text
React Query
LedgerLM server/storage.ts
LedgerLM PostgreSQL tables
```

This ensures the same Board is available across:

- Browsers
- Devices
- Sessions
- Company users
- Domain-authorized users

### Existing LedgerLM storage

`ledgerlm/ledgerlm/server/storage.ts` already contains:

```text
getBoards()
getBoard()
createBoard()
updateBoard()
deleteBoard()

createBoardTemplate()
updateBoardTemplate()
deleteBoardTemplate()

getBoardThreads()
addBoardThread()
removeBoardThread()

getBoardDocuments()
getBoardDataSources()
createBoardDataSource()
updateBoardDataSource()
deleteBoardDataSource()
```

---

## `boards-standalone/lib/types.ts`

### Current models

```text
BoardTemplate
DataSource
DataCube
ScopeMode
KeyColumn
PptTheme
BoardDataSources
ChatMessage
AnalysisThread
TimeGranularity
ComparisonBasis
BoardSchedule
Kpi
ChartSeries
ChartSpec
TableSpec
ActionItem
CommentaryItem
EntityPnlSettings
KpiReportSettings
EntityPnlReport
GovernedKpiReport
AnalysisResult
Report
Board
```

### Target

Split these into:

```text
ledgerlm/ledgerlm/shared/schema.ts
ledgerlm/ledgerlm/shared/board-types.ts
ledgerlm/ledgerlm/client/src/types/
```

Create explicit conversion functions:

```text
standaloneBoardToLedgerBoard()
ledgerBoardToStandaloneViewModel()
standaloneReportToLedgerReport()
ledgerReportToStandaloneViewModel()
```

This prevents fields from silently disappearing when the Standalone data model
is mapped to the existing LedgerLM database model.

---

# 5. Analysis execution

## `boards-standalone/lib/runAnalysis.ts`

### Current branches

`runBoardAnalysis()` has three separate execution paths.

### KPI Metrics branch

Calls:

```text
POST /api/kpi-reports/run
```

Sends:

```text
cubeId
year
month
entity
forecastScenario
```

Receives a governed KPI report, converts it to the Board report format, and
saves it locally.

The calculation should continue to use:

```text
ledgerlm/ledgerlm/server/services/kpiReportService.ts
```

Only report persistence and frontend handling need to be moved.

### Entity P&L branch

Calls:

```text
POST /api/v2/entity-pnl/report-data
```

Sends:

```text
cube_id
entity
as_of
comparison
currency
cf_version
```

The existing governed Entity P&L calculation should remain server-side.

### General Board branch

Calls:

```text
POST /api/analyze
```

Functionality:

- Loads a Board.
- Loads the connected cube.
- Applies selected or excluded columns.
- Validates payload size.
- Sends the analysis request.
- Reads newline-delimited progress events.
- Receives the final report.
- Saves the report and thread.

Important functions:

```text
assertPayloadIsSendable()
readAnalysisStream()
runBoardAnalysis()
```

### Target structure

Split into:

```text
ledgerlm/ledgerlm/client/src/lib/boardAnalysisClient.ts
ledgerlm/ledgerlm/server/services/genericBoardAnalysisService.ts
```

The client should only manage:

- Request initiation
- Progress rendering
- Cancellation
- Result display

The server should own:

- Cube access
- User authorization
- Scope filtering
- Prompt context
- AI calls
- Output validation
- Report persistence
- Audit logging

---

# 6. Generic analysis API

## `boards-standalone/app/api/analyze/route.ts`

### Current functionality

- Validates analysis requests.
- Builds analysis context.
- Builds overview prompts.
- Builds chart prompts.
- Builds narrative prompts.
- Calls the model.
- Parses JSON.
- Validates model output with Zod.
- Streams progress.
- Handles failures and aborts.

Important functions:

```text
buildContext()
buildOverviewPrompt()
buildChartsPrompt()
buildNarrativePrompt()
extractJson()
generateSection()
runAnalysis()
failureOf()
throwIfAborted()
POST()
```

### Target

Move the implementation into:

```text
ledgerlm/ledgerlm/server/services/genericBoardAnalysisService.ts
```

Expose it through a protected LedgerLM Express route.

The server must verify:

- Authenticated user
- Board ownership or access
- Cube access
- Company/domain boundaries
- Valid requested columns
- Payload limits
- Prompt/data safety
- Schema-valid model output
- Audit requirements

The existing `boardAnalysisService.ts` focuses on governed cube variance
analysis. It must be compared with the Standalone generic analysis route so
that two different report engines do not remain active accidentally.

---

# 7. Chat and analysis threads

## `boards-standalone/app/api/chat/route.ts`

### Current functionality

- Accepts Board name.
- Accepts system prompt.
- Accepts cube context.
- Accepts thread messages.
- Calls the model.
- Returns an assistant reply.

### Target

Use LedgerLM's existing chat and thread persistence.

Existing chat routes include:

```text
GET    /api/chats
GET    /api/chats/:id
POST   /api/chats
PATCH  /api/chats/:id
DELETE /api/chats/:id
GET    /api/chats/:chatId/messages
POST   /api/chats/:chatId/messages
```

Existing Board thread routes include:

```text
GET    /api/boards/:id/threads
POST   /api/boards/:id/threads
DELETE /api/boards/:id/threads/:chatId
```

The final Board chat flow must:

- Check Board access.
- Check thread ownership.
- Load authorized context server-side.
- Store user and assistant messages.
- Apply CSRF protection.
- Apply rate limits.
- Preserve audit requirements.

---

# 8. Export migration

## `boards-standalone/lib/exportClient.ts`

### Functionality

- Starts export jobs.
- Polls export status.
- Displays progress.
- Downloads completed files.
- Supports PPTX and PDF.
- Creates report filenames.

Important function:

```text
exportReportInBackground()
```

---

## `boards-standalone/lib/exportJobs.ts`

### Functionality

- Creates jobs.
- Tracks job state.
- Tracks percentage and stage.
- Expires old jobs.
- Runs export work asynchronously.
- Stores temporary output.

Important functions:

```text
getExportJob()
startExportJob()
processExportJob()
cleanupExpiredJobs()
```

### Target

Move this into:

```text
ledgerlm/ledgerlm/server/services/boardExportService.ts
ledgerlm/ledgerlm/server/services/exportJobService.ts
```

Every job must be tied to:

```text
userId
boardId
reportId
company/domain access
```

---

## `boards-standalone/app/api/export/route.ts`

### Current endpoints

```text
POST /api/export
GET  /api/export?jobId=...
GET  /api/export?jobId=...&download=1
```

### Target endpoints

Use protected LedgerLM routes such as:

```text
POST /api/boards/:boardId/reports/:reportId/export
GET  /api/exports/:jobId
GET  /api/exports/:jobId/download
```

### Reusable export files

```text
ledgerlm/boards-standalone/lib/exportReport.ts
ledgerlm/boards-standalone/lib/serverPptxTemplateWorker.ts
ledgerlm/boards-standalone/lib/exportJobs.ts
```

Preserve:

- Generic report PPTX
- KPI Metrics PPTX
- Entity P&L PPTX
- Bosch template-based export
- PDF report
- Native charts
- Template anatomy
- KPI narrative formatting
- Capacity formatting
- Export progress

---

# 9. Existing LedgerLM frontend files

## `ledgerlm/ledgerlm/client/src/pages/Boards.tsx`

Currently:

- Lists server Boards.
- Lists server templates.
- Creates and deletes Boards.
- Opens `BoardEditorDialog`.
- Includes native LedgerLM styling.
- Includes Bosch kiosk behavior.

Migration:

- Keep the native route.
- Keep authentication and React Query.
- Keep company/domain behavior.
- Replace the Board list and configuration experience with the Standalone
  behavior.

---

## `ledgerlm/ledgerlm/client/src/pages/BoardDetail.tsx`

Currently:

- Loads a Board.
- Loads threads.
- Loads reports.
- Creates chats.
- Displays `BoardReport`.
- Opens `BoardAnalysisEditor`.

Migration:

- Keep the native route.
- Replace the page body with the full Standalone Board workspace.
- Preserve native server-backed loading and mutations.

---

## `ledgerlm/ledgerlm/client/src/components/BoardEditorDialog.tsx`

Migration:

- Replace or expand with the Standalone multi-step wizard.
- Do not keep two separate Board configuration experiences.

---

## `ledgerlm/ledgerlm/client/src/components/BoardAnalysisEditor.tsx`

Currently:

- Selects periods.
- Selects dimensions.
- Shows data preview.
- Sets analysis prompt.
- Runs native analysis.

Migration:

- Merge useful preview and prompt behavior into the Standalone-style flow.
- Avoid having separate native and Standalone analysis editors.

---

## `ledgerlm/ledgerlm/client/src/components/BoardReport.tsx`

Currently:

- Displays native Board reports.
- Deletes reports.
- Starts follow-up analysis.
- Supports CSV and print behavior.

Migration:

- Extend it to render the full Standalone report model, or replace it with
  adapted `ResultSections` and `ResultCharts`.
- Preserve delete, follow-up, CSV, and print functionality.

---

# 10. Existing LedgerLM backend files

## `ledgerlm/ledgerlm/server/routes.ts`

Existing Board routes include:

```text
GET    /api/boards
GET    /api/boards/:id
POST   /api/boards
PUT    /api/boards/:id
DELETE /api/boards/:id

GET    /api/cubes/:cubeId/versions
GET    /api/boards/:id/preview-data
POST   /api/boards/:id/run-analysis

GET    /api/boards/:id/reports
DELETE /api/boards/:id/reports/:reportId
POST   /api/boards/:id/reports/:reportId/follow-up

GET    /api/board-templates
POST   /api/board-templates
PUT    /api/board-templates/:id
DELETE /api/board-templates/:id

GET    /api/boards/:id/threads
POST   /api/boards/:id/threads
DELETE /api/boards/:id/threads/:chatId

GET    /api/boards/:id/documents
POST   /api/boards/:id/documents
DELETE /api/boards/:id/documents/:documentId

GET    /api/boards/:id/data-sources
POST   /api/boards/:id/data-sources
PATCH  /api/boards/:id/data-sources/:sourceId
DELETE /api/boards/:id/data-sources/:sourceId
POST   /api/boards/:id/data-sources/reorder
```

Keep the existing routes where possible. Add only missing Standalone
functionality.

All mutating routes must continue to use:

- Authentication
- CSRF validation
- Board access checks
- Cube authorization
- Company/domain authorization
- Audit logging where required

---

## `ledgerlm/ledgerlm/server/services/boardAnalysisService.ts`

Current functionality:

```text
fetchFactData()
previewBoardData()
computeVariance()
buildVarianceTable()
buildComparisonTable()
resolveTemplate()
formatPeriod()
runBoardAnalysis()
getCubeVersions()
```

Migration:

- Compare this service with the Standalone generic analysis route.
- Extract shared calculation and prompt logic.
- Keep one authoritative report engine for each Board type.

Recommended split:

```text
server/services/boardAnalysisService.ts
server/services/genericBoardAnalysisService.ts
server/services/kpiReportService.ts
server/services/entityPnlService.ts
```

---

## `ledgerlm/ledgerlm/server/storage.ts`

Use this as the only Board persistence layer after migration.

Relevant methods:

```text
getBoards()
getBoard()
createBoard()
updateBoard()
deleteBoard()

createBoardTemplate()
updateBoardTemplate()
deleteBoardTemplate()

getBoardThreads()
addBoardThread()
removeBoardThread()

getBoardDocuments()
getBoardDataSources()
createBoardDataSource()
updateBoardDataSource()
deleteBoardDataSource()
```

---

## `ledgerlm/ledgerlm/shared/schema.ts`

Existing relevant tables include:

```text
board_templates
boards
board_threads
board_documents
board_data_sources
cube_board_reports
chats
messages
documents
cubes
cube_user_access
```

Audit whether the Board settings structure supports:

```text
scopeMode
keyColumns
excludedColumns
timeGranularity
comparisonBasis
reportTemplate
schedule
entityPnl
kpiReport
```

Any missing settings must be added with validated schema support before
cutover.

---

# 11. Authentication and security

## Keep LedgerLM authentication

Relevant files:

```text
ledgerlm/ledgerlm/client/src/App.tsx
ledgerlm/ledgerlm/client/src/lib/auth.ts
ledgerlm/ledgerlm/client/src/lib/queryClient.ts
ledgerlm/ledgerlm/server/routes.ts
```

The native app already:

- Validates the server session.
- Refreshes the CSRF token.
- Clears stale auth state.
- Uses protected routes.

Native Board requests should use LedgerLM's request layer:

```text
apiRequest()
queryClient
fetchCsrfToken()
```

Do not weaken CSRF requirements during the migration.

---

## Files that become unnecessary for the native Board

After successful cutover, Board functionality should no longer require:

```text
ledgerlm/boards-standalone/lib/apiPath.ts
ledgerlm/boards-standalone/proxy.ts
ledgerlm/ledgerlm/client/src/pages/StandaloneEmbed.tsx
```

The iframe/proxy security boundary can be removed only after equivalent native
LedgerLM authorization is in place.

---

# 12. Routing and iframe removal

## `ledgerlm/ledgerlm/client/src/App.tsx`

Current routes include:

```text
/boards
/board/:id
/integrations/standalone-boards
/integrations/standalone-enterprise-data
```

The app also mounts:

```text
<PersistentStandaloneFrames />
```

After the Board is native:

- Keep `/boards`.
- Keep `/board/:id`.
- Remove `/integrations/standalone-boards`.
- Remove Board iframe mounting.
- Remove duplicate Standalone Board navigation.
- Keep the Enterprise Data iframe only if Enterprise Data has not yet been
  migrated.

---

# 13. Reusable Standalone business logic

These files contain useful business logic and should be reviewed before
deletion:

```text
ledgerlm/boards-standalone/lib/templates.ts
ledgerlm/boards-standalone/lib/cubes.ts
ledgerlm/boards-standalone/lib/metrics.ts
ledgerlm/boards-standalone/lib/promptData.ts
ledgerlm/boards-standalone/lib/parseUpload.ts
ledgerlm/boards-standalone/lib/balanceSheetRollup.ts
ledgerlm/boards-standalone/lib/kpiNarrative.ts
```

The KPI calculation source of truth should remain:

```text
ledgerlm/ledgerlm/server/services/kpiReportService.ts
```

The browser should not independently recalculate governed KPI values.

---

# 14. Files to remove after cutover

Only delete these after the native implementation is verified:

```text
ledgerlm/boards-standalone/app/boards/page.tsx
ledgerlm/boards-standalone/app/boards/[id]/page.tsx
ledgerlm/boards-standalone/components/board/BoardModal.tsx
ledgerlm/boards-standalone/components/board/ResultSections.tsx
ledgerlm/boards-standalone/components/board/ResultCharts.tsx
ledgerlm/boards-standalone/components/board/AnalysisProgress.tsx
ledgerlm/boards-standalone/lib/apiPath.ts
ledgerlm/boards-standalone/lib/store.ts
ledgerlm/boards-standalone/lib/runAnalysis.ts
ledgerlm/boards-standalone/app/api/analyze/route.ts
ledgerlm/boards-standalone/app/api/chat/route.ts
ledgerlm/boards-standalone/app/api/export/route.ts
ledgerlm/boards-standalone/lib/exportClient.ts
ledgerlm/boards-standalone/lib/exportJobs.ts
ledgerlm/ledgerlm/client/src/pages/StandaloneEmbed.tsx
```

The entire `boards-standalone` artifact should only be removed if its other
pages are also being migrated.

---

# 15. Pages outside the Board scope

These Standalone pages are separate from the Board migration:

```text
ledgerlm/boards-standalone/app/enterprise-data/page.tsx
ledgerlm/boards-standalone/app/market-intelligence/page.tsx
ledgerlm/boards-standalone/app/vault/page.tsx
ledgerlm/boards-standalone/app/user-management/page.tsx
ledgerlm/boards-standalone/app/agentic-workflow/page.tsx
```

If those pages must also become native LedgerLM pages, add approximately
3–5 working days depending on API and persistence requirements.

---

# 16. Recommended implementation order

## Phase 1 — Contract audit

Review:

```text
shared/schema.ts
shared/types.ts
server/storage.ts
server/routes.ts
boards-standalone/lib/types.ts
```

Confirm that every Standalone Board field has a LedgerLM persistence target.

## Phase 2 — Native Board list

Replace the current `Boards.tsx` experience with the Standalone Board list and
template flow.

## Phase 3 — Native configuration

Merge `BoardModal.tsx`, `BoardEditorDialog.tsx`, and
`BoardAnalysisEditor.tsx` into one configuration experience.

## Phase 4 — Native analysis

Merge:

```text
runAnalysis.ts
app/api/analyze/route.ts
server/services/boardAnalysisService.ts
```

into one protected server-side analysis flow.

## Phase 5 — Native report workspace

Merge:

```text
BoardDetail.tsx
ResultSections.tsx
ResultCharts.tsx
AnalysisProgress.tsx
```

into the native Board detail route.

## Phase 6 — Persistence and chat

Move local reports, threads, and chat writes to LedgerLM storage and routes.

## Phase 7 — Export consolidation

Move export jobs, PPTX generation, PDF generation, and download authorization
behind LedgerLM export endpoints.

## Phase 8 — Scheduler migration

Move scheduled execution from browser-based `ScheduleRunner.tsx` to the
server-side scheduler.

## Phase 9 — Cutover

1. Switch `/boards` to the integrated Board list.
2. Switch `/board/:id` to the integrated Board detail page.
3. Remove the Board iframe.
4. Validate existing LedgerLM Boards.
5. Import Standalone browser data if required.
6. Verify reports, chat, schedules, and exports.
7. Keep a rollback checkpoint.
8. Delete the duplicate implementation.

---

# 17. Effort estimate

| Work area | Main files | Estimate |
|---|---|---:|
| Board list conversion | `Boards.tsx`, Standalone boards page | 1–2 days |
| Board detail conversion | `BoardDetail.tsx`, Standalone detail page | 2–3 days |
| Configuration wizard | `BoardModal.tsx`, editor dialogs | 2–3 days |
| Analysis consolidation | `runAnalysis.ts`, analyze route, analysis service | 2–3 days |
| Persistence migration | `store.ts`, `storage.ts`, `schema.ts` | 2–3 days |
| Chat and thread integration | chat routes, thread routes, detail page | 1–2 days |
| Export integration | export files and LedgerLM endpoints | 1–2 days |
| Scheduler integration | `ScheduleRunner.tsx`, server scheduler | 1–2 days |
| Security and authorization | routes, CSRF, ownership, cube access | 1–2 days |
| Regression and cutover | all Board routes and exports | 2–3 days |

## Total estimate

For the full native Board migration:

```text
8–14 working days
```

For production-grade migration with browser-data import, schedule migration,
security review, and full regression testing:

```text
2–3 weeks
```

The main effort is not copying the Standalone UI. The main effort is
consolidating persistence, analysis APIs, exports, schedules, and authorization
without losing existing Board data or weakening LedgerLM security.

---

# 18. Already-created KPI Reports and governed logic

This section records the KPI Reports functionality that has already been
created and must be preserved when the Standalone Board is moved into native
LedgerLM.

## KPI service

### File

```text
ledgerlm/ledgerlm/server/services/kpiReportService.ts
```

### Main public functions

```text
validateKpiReportRequest()
getKpiReportOptions()
runKpiReport()
saveKpiReport()
listSavedKpiReports()
```

### Main internal functions

```text
runKpiMetricSnapshot()
runGreenBreakdowns()
buildBusinessMetricsNarrative()
narrativeLine()
previousMonth()
greenValue()
displayKpiValue()
comparisonUnit()
```

### Supported KPI metrics

```text
revenue
internal_utilization
external_utilization
capacity
```

Displayed labels:

```text
Budget / Revenue
Internal Utilization
External Utilization
Capacity
```

Supported units:

```text
mUSD
percent
capacity / HC
```

## KPI request validation

`validateKpiReportRequest()` validates:

- Cube ID
- Reporting year
- Reporting month
- Optional entity
- Forecast scenario

Accepted forecast scenarios:

```text
YTD Forecast
CF02
CF05
CF09
CF11
```

`safeScenario()` prevents unsupported scenario strings from reaching the
database query.

## Authorized KPI cube selection

The KPI routes do not expose every cube to every user.

`resolveKpiScope()` and `requireKpiCubeAccess()` enforce:

- Authenticated user access
- Domain/company scope
- Cube-level access
- KPI schema type

Only authorized KPI cubes are returned to the browser.

## KPI options

`getKpiReportOptions()` loads:

- Available years
- Available entities
- Available CF scenarios
- Whether actual data is available

The default scenario is:

```text
YTD Forecast
```

## Actual revenue logic

Actual revenue is read from:

```text
cube_fact_data
```

The query uses:

- Selected cube
- Reporting year
- Reporting month
- Unversioned actual rows
- Entity scope
- Revenue Summary cost category
- Entity-specific include/exclude rules
- Revenue Hardware exclusions where required

The actual amount is converted to mUSD.

World Wide, BGSW, BGSV, and NE-MX use the workbook-specific entity and
inclusion rules already defined in:

```text
actualEntityPredicate()
actualBudgetIncludePredicate()
actualRevenueHardwarePredicate()
```

## Actual utilization logic

Internal and External Utilization are Actual-only metrics.

They do not use a Forecast source.

For workbook-aligned entity scopes, the source rows are filtered by:

```text
Billing Utilization Summary
```

and the appropriate resource type:

```text
internal
external
```

The workbook-specific filters include:

```text
MS
SX / MM
non-FIXEDPRICE
```

### Internal Utilization

The calculation is based on:

```text
billed capacity
÷
allocated capacity
+ not allocated capacity
+ MS capacity
+ VKM capacity
- non-linear capacity
```

### External Utilization

The calculation is based on:

```text
billed capacity
÷
payable allocated capacity
+ payable not allocated capacity
+ payable MS capacity
+ payable VKM capacity
- payable non-linear capacity
```

For non-workbook data, the legacy calculation uses:

```text
billed capacity ÷ allocated capacity
```

### Utilization comparison rule

For a current period such as July 2026:

```text
Current:       YTD 07.26 Actual
Prior year:    YTD 07.25 Actual
Previous month:YTD 06.26 Actual
```

The comparison is implemented in `runKpiReport()` by running historical
snapshots for:

```text
request.year - 1, same month
previousMonth(request.year, request.month)
```

No utilization Forecast value is populated.

This rule applies to:

```text
World Wide
BGSW / India
BGSV / Vietnam
NE-MX / Mexico
```

## Capacity logic

Capacity has separate Actual and Forecast paths.

### Actual capacity sources

Actual capacity uses:

```text
cube_fact_data
cube_plan_data
```

Fact data uses the workbook-specific capacity filters, including:

- GB Wise END Capacity
- Internal and External resource types
- Offshore/Onsite rules
- Corporate exclusions
- INDIRECT exclusions
- Selected entity
- Selected reporting month

Workbook-based entities also read Actual/Actual or Actuals/Actual plan rows
with:

```text
Particulars: Total Capacity
Sub Category: End
```

### Forecast capacity source

The preferred capacity source is:

```text
Plan type: Actual or Actuals
Page: World Wide for World Wide, Entity View for other entities
Particulars: Total Capacity
Sub Category: End
```

When those rows are missing, the controlled fallback uses:

```text
Selected forecast scenario
Page: World Wide for World Wide, Entity for other entities
Particulars: Total Capacity
Sub Category: End
```

This fallback was added because BGSV and NE-MX contain populated forecast
capacity rows under the Entity page while their Actuals/Entity View rows are
absent.

The primary Actuals/Entity View rows remain preferred whenever numeric rows
exist.

## Forecast revenue logic

Forecast revenue uses:

```text
MBR workbook plan rows
Budget (mUSD)
Sub Category: Total
```

Page mapping:

```text
World Wide entity → World Wide page
BGSW/BGSV/NE-MX   → Entity page
```

The requested forecast scenario is applied to the plan type.

## Entity scope mapping

The Business Metrics panel contains four governed scopes:

```text
World Wide (Global) → World Wide
India              → BGSW
Vietnam            → BGSV
Mexico             → NE-MX
```

The scope definitions are in:

```text
BUSINESS_METRICS_SCOPES
```

Entity normalization is handled by:

```text
normalizedEntity()
isWorldWideEntity()
forecastEntityPredicate()
actualEntityPredicate()
actualPlanEntityPredicate()
```

Supported aliases include:

```text
World Wide
Worldwide
WORLWIDE
Mexico
NE-MX
```

## Green breakdown logic

`runGreenBreakdowns()` provides:

```text
MS
MM
SDS
MS-External
Integrated Service
```

The breakdown classification is based on workbook fields such as:

```text
new_service_area
split_itrams_sds
project_gb
gb
page
```

For utilization presentation, only these breakdowns are shown:

```text
MS
MM
```

SDS, MS-External, and Integrated Service remain available for other report
metrics where applicable, but are excluded from the Internal and External
Utilization narrative.

## Governed report structure

`runKpiReport()` returns:

```text
periodLabel
entityLabel
forecastScenario
actualSourceLabel
forecastSourceLabel
metrics
warnings
scopeBadges
greenScope
narrative
```

The `greenScope` contains:

```text
version: green-v1
period
entities
sections
totals
breakdowns
historical comparisons
```

The report keeps source-row counts:

```text
actualSourceRows
forecastSourceRows
```

Missing governed rows are represented as null values rather than fabricated
zeroes.

## KPI report routes

### File

```text
ledgerlm/ledgerlm/server/routes.ts
```

### Routes

```text
GET  /api/kpi-reports/cubes
GET  /api/kpi-reports/cubes/:cubeId/options
POST /api/kpi-reports/run
GET  /api/kpi-reports/saved
POST /api/kpi-reports/saved
```

### Route behavior

`GET /api/kpi-reports/cubes`

- Resolves the authenticated KPI scope.
- Loads accessible cubes.
- Keeps only cubes with `schemaType === "kpi"`.

`GET /api/kpi-reports/cubes/:cubeId/options`

- Validates cube access.
- Returns years, entities, scenarios, and actual availability.

`POST /api/kpi-reports/run`

- Validates the request.
- Validates cube access.
- Re-runs the governed KPI calculation on the server.
- Returns the calculated report.

`GET /api/kpi-reports/saved`

- Loads saved reports for the current user.
- Filters saved reports by accessible cube IDs.

`POST /api/kpi-reports/saved`

- Validates the title.
- Validates the report request.
- Re-runs the report server-side.
- Does not trust a browser-supplied report snapshot.
- Saves the server-generated report.

## Standalone KPI Board adapter

### File

```text
ledgerlm/boards-standalone/lib/runAnalysis.ts
```

### Important functions

```text
formatGovernedKpiValue()
formatGovernedKpiVariance()
kpiBoardResult()
runBoardAnalysis()
```

When a Board contains `kpiReport.cubeId`, `runBoardAnalysis()`:

1. Requests a LedgerLM CSRF token.
2. Calls `/api/kpi-reports/run`.
3. Sends cube, period, entity, and scenario selections.
4. Converts the governed report into the generic Board `AnalysisResult`.
5. Creates a Board report.
6. Creates an analysis thread.
7. Stores the result in the current Board flow.

During native integration, the calculation call should remain server-backed,
but local report storage should be replaced with LedgerLM report persistence.

## KPI narrative formatting

### File

```text
ledgerlm/boards-standalone/lib/kpiNarrative.ts
```

### Important functions

```text
governedPeriodCode()
governedValue()
comparisonSentence()
actualHistorySentence()
buildGovernedSectionNarrative()
```

For utilization, `actualHistorySentence()` produces the required format:

```text
YTD 07.26  current Actual
YTD 07.25: prior-year Actual
YTD 06.26: previous-month Actual
```

The narrative filters utilization breakdowns to:

```text
MS
MM
```

Utilization no longer produces:

```text
governed Forecast unavailable
Actual versus Forecast
Forecast variance
```

Revenue and capacity continue to use the Actual-versus-Forecast narrative
where both governed values exist.

## KPI result rendering

### File

```text
ledgerlm/boards-standalone/components/board/ResultSections.tsx
```

### Important functions

```text
KpiTile()
KpiBusinessMetricsPanel()
greenValue()
```

The component renders:

- Four-entity green scope
- World Wide badge
- BGSW/India badge
- BGSV/Vietnam badge
- NE-MX/Mexico badge
- KPI sections
- Historical utilization narrative
- Revenue and capacity comparisons
- Missing governed values as em dashes

## Governed KPI types

### File

```text
ledgerlm/boards-standalone/lib/types.ts
```

Important interfaces:

```text
GovernedKpiMetric
GovernedKpiScope
GovernedKpiNarrativeSection
GovernedKpiValue
GovernedKpiGreenSection
GovernedKpiGreenEntity
GovernedKpiReport
KpiReportSettings
```

These types should be moved or shared with the native LedgerLM Board instead
of being duplicated.

---

# 19. Created KPI PowerPoint template scripts

## General KPI template

### File

```text
ledgerlm/boards-standalone/scripts/create-kpi-metrics-template.mjs
```

### Functionality

Creates an editable Business Metrics KPI PowerPoint template with:

- KPI title
- Governed source labels
- KPI sections
- Internal Utilization section
- External Utilization section
- Capacity section
- Editable text regions
- Bosch-style colors and layout

Output:

```text
attached_assets/kpi_business_metrics_template.pptx
```

Important script sections:

```text
text()
badges
sections
```

## Four-entity KPI template

### File

```text
ledgerlm/boards-standalone/scripts/create-kpi-four-entity-template.mjs
```

### Functionality

Creates the four-entity editable KPI template for:

```text
World Wide
BGSW / India
BGSV / Vietnam
NE-MX / Mexico
```

The template includes:

- Entity badges
- Entity flags/icons
- World Wide section
- India section
- Vietnam section
- Mexico section
- Business Metrics headings
- Internal Utilization
- External Utilization
- Capacity
- Governed section labels
- Placeholder regions for generated values

Important script functions:

```text
addText()
addFlagIcon()
addScopeBadge()
addSection()
addSlide()
```

Output:

```text
attached_assets/kpi_business_metrics_four_entity_template.pptx
```

## Export integration requirements

When the Standalone Board is moved into native LedgerLM, these templates and
their layout assumptions must remain compatible with:

```text
ledgerlm/boards-standalone/lib/exportReport.ts
ledgerlm/boards-standalone/lib/serverPptxTemplateWorker.ts
```

The KPI export must preserve:

- Four-entity layout
- Entity order
- KPI section order
- Utilization Actual-only wording
- MS/MM breakdown wording
- Revenue Forecast wording
- Capacity Forecast wording
- Editable PowerPoint text regions
- Bosch template styling

---

# 20. Existing Entity P&L logic

Entity P&L is already implemented as a governed, read-only reporting path. It
is not just a planned feature. The migration must preserve this calculation
and move its report persistence and presentation into native LedgerLM.

## Entity P&L configuration

### File

```text
ledgerlm/boards-standalone/components/board/BoardModal.tsx
```

The Board stores:

```text
cubeId
cubeName
entity
asOf
comparison
currency
cfVersion
```

The supported comparison modes are:

```text
qoq → quarter-over-quarter MTD comparison
yoy → year-over-year YTD comparison
```

The optional `cfVersion` is shown as a separate forecast or CF scenario. It
must not be combined with Actual values.

## Entity P&L API and authorization

### Client call

```text
POST /api/v2/entity-pnl/report-data
```

The request contains:

```text
cube_id
entity
as_of
comparison
currency
cf_version
```

The client first obtains a LedgerLM CSRF token and sends the request with the
authenticated session. The Node proxy must authorize the selected cube and
user before forwarding the read-only request to the Python service.

### Entity lookup

```text
GET /api/v2/entity-pnl/cubes/:cubeId/entities
```

This returns selectable entity names without exposing fact rows to the
browser.

## Entity P&L calculation

### Server implementation

```text
ledgerlm/ledgerlm/python_backend/api/routes/entity_pnl.py
```

The service reads only the authorized cube's `cube_fact_data` rows. It
calculates deterministic presentation data for:

```text
Revenue
Employee Benefits
Outsourcing Cost
Consultancy Charges
CI Charges & Other Revenue
Facilities Cost
Other Expenses
Total Expenses
EBIT
EBIT%
End Capacity On-roll
End Capacity Outsourcing
Total End
Avg Capacity Overall
Avg Capacity Outsourcing
Total Average
```

Revenue is taken from governed Revenue Summary rows. Total Expenses includes
the complete governed Cost Summary population, while the visible expense lines
are a presentation subset. EBIT is:

```text
Revenue - Total Expenses
```

EBIT% is:

```text
EBIT / Revenue × 100
```

## Period and scenario rules

For YoY:

```text
Current period:       selected year and month YTD
Comparison period:    same month in the prior year YTD
Year-end reference:   prior-year December
```

For QoQ:

```text
Current period:       selected month MTD
Comparison period:    three months earlier MTD
Quarter-end reference: the preceding quarter-end snapshots
```

The service queries cumulative snapshots and derives MTD values from
consecutive YTD snapshots where required. Actual and CF scenarios are queried
separately and never combined.

## Capacity rules

Capacity is a point-in-time measure, not a flow to sum across months.

The service separates:

```text
Internal / On-roll
Outsourcing / External
```

It calculates both month-end capacity and average capacity from the relevant
month-end snapshots. `INDIRECT` and unknown resource categories are excluded
from the on-roll and outsourcing presentation rather than silently assigned
to a category.

## Entity P&L Board result and export

### Result model

```text
ledgerlm/boards-standalone/lib/types.ts
```

The result is stored as:

```text
AnalysisResult.entityPnl
```

The Board creates a report and analysis thread after a successful run. During
native migration, these must be written through LedgerLM server persistence,
not the Standalone browser store.

### PowerPoint output

```text
ledgerlm/boards-standalone/lib/exportReport.ts
ledgerlm/boards-standalone/scripts/create-entity-pnl-template.mjs
```

The Entity P&L export uses a fixed Bosch-style layout with:

- Revenue and expense lines
- Total Expenses
- EBIT and EBIT%
- Capacity lines
- Current and comparison periods
- Optional CF scenario
- Commentary and evidence
- Separate editable text regions

The migration must retain this dedicated renderer. Entity P&L should not be
flattened into the generic KPI or generic Board export.

---

# 21. Existing Balance Sheet logic

Balance Sheet logic also exists, but it currently belongs to the generic
Standalone analysis path rather than the governed Entity P&L API. It reads
uploaded balance-sheet data, classifies line items deterministically, checks
whether the statement ties, and produces dedicated exports.

## Balance Sheet input and source preparation

### Files

```text
ledgerlm/boards-standalone/lib/parseUpload.ts
ledgerlm/boards-standalone/lib/metrics.ts
```

The upload parser supports CSV and Excel workbooks. For Excel files, it:

- Reads non-empty sheets as data sources.
- Normalizes dates and cell values.
- Detects when assets and liabilities/equity are split across two sheets.
- Combines those halves into one balance-sheet source.
- Renames the section field to a shared `Section` column.
- Keeps the original halves from being selected independently when they form
  one complete statement.

This is important because a balance check cannot be performed on an Assets
sheet without the corresponding Liabilities and Equity sheet.

## Balance Sheet analysis route

### File

```text
ledgerlm/boards-standalone/app/api/analyze/route.ts
```

The Balance Sheet branch is selected by:

```text
templateId === "balance-sheet-tracker"
```

It uses point-in-time period handling. When the Board changes time
granularity, the engine retains the closing position for each bucket rather
than summing monthly balance-sheet snapshots.

The route computes deterministic blocks before calling the model:

```text
computeBalanceSheetBlock()
computeBalanceSheetCharts()
computeBalanceSheetReport()
```

The model receives the computed figures as context for narrative generation,
but the model does not author the authoritative totals, roll-ups, balance
checks, or chart values.

## Balance Sheet roll-up logic

### File

```text
ledgerlm/boards-standalone/lib/balanceSheetRollup.ts
```

Line items are matched by caption and category, not by spreadsheet row
position. The default management-report groups include:

```text
Assets
  Cash & cash equivalents
  Trade receivables & unbilled
  Other current assets
  Investments
  Right-of-use assets
  Fixed assets
  Other non-current assets

Liabilities
  Trade payables
  Lease liabilities
  Provisions
  Other liabilities
  Non-current liabilities & provisions

Equity
  Equity & reserves
```

The roll-up:

- Uses detail rows rather than subtotal rows to avoid double counting.
- Respects current and non-current classification.
- Allows only explicit cross-term exceptions such as unbilled revenue and
  deferred income.
- Keeps source captions for auditability.
- Reports unrecognized lines as `unmapped`.
- Does not silently put unrecognized lines into an Other bucket.

## Units and currency

Balance-sheet figures are presented in mINR. The engine:

- Honors an explicitly stated source unit.
- Converts INR or INR-thousands to mINR when stated.
- Infers scale only when no unit is stated.
- Records whether the unit was stated or detected.
- Never guesses an FX rate.

An optional USD/INR rate is accepted only when the Board prompt provides a
plausible explicit rate such as:

```text
USD to INR = 88.5
1 USD = 88.5 INR
USD/INR 88.5
```

## Balance check and result model

### Types

```text
ledgerlm/boards-standalone/lib/types.ts
```

The computed result is stored as:

```text
AnalysisResult.balanceSheet
```

It contains:

```text
periods
comparisonPeriod
comparisonPeriods
lines
totals.assets
totals.liabilities
totals.equity
balances
units
fxRate
unmapped
```

For each period, the engine checks:

```text
Assets = Liabilities + Equity
```

The tie status is retained per period and must be shown to the user. A failed
balance check must never be hidden by the narrative or export.

## Balance Sheet rendering and exports

Balance Sheet output is currently rendered through the generic report
structures, while the export path has dedicated Balance Sheet presentation:

```text
ledgerlm/boards-standalone/lib/exportReport.ts
```

The dedicated export provides:

- Separate Assets and Funding slides.
- Position tables and charts.
- Headline totals.
- Balance-check status.
- Units and optional FX rate.
- Commentary assigned to the relevant side.
- Explicit unmapped-line disclosure.
- Comparison periods.

The same Balance Sheet result is also supported by PDF and template-driven
export paths. Native migration must preserve the deterministic report block,
the tie check, the unmapped-line disclosure, and the dedicated export layout.

## Migration status distinction

The current implementation status is:

```text
Entity P&L:
  Governed cube-backed service, native LedgerLM proxy path, Board settings,
  report result, and dedicated PPTX renderer exist.

Balance Sheet:
  Generic Standalone analysis route, uploaded-source parsing, deterministic
  roll-up, balance checks, result type, and dedicated export exist.
```

Neither path should be reimplemented in the browser during native migration.
Entity P&L should continue through the authorized server service. Balance Sheet
should move its parsing, deterministic roll-up, unit handling, and balance
check to a protected LedgerLM server service before the Standalone route is
removed.

