# LedgerLM Boards Replacement and Migration Plan

## Status

This document is an implementation plan only. It does not represent completed
code.

The migration replaces the current LedgerLM Boards experience with the
standalone Boards interaction model while preserving LedgerLM authentication,
authorization, PostgreSQL persistence, Enterprise Data/Vault access, domain AI
configuration, and existing Board API compatibility.

## Decisions already made

- Preserve existing Boards data and migrate it where possible.
- Add standalone templates alongside governed Entity P&L and KPI templates.
- Support authorized Enterprise Data and Vault sources in the first release.
- Keep boards personal to their creator.
- Keep existing Board URLs and APIs compatible.
- Run analyses manually in the first release.
- Use the same domain-admin AI configuration path as LedgerLM chat.
- Do not use browser `localStorage` or IndexedDB for persistent Board state.
- Do not copy raw Enterprise Data into the browser.
- Do not delete existing data as part of startup migration.

## Source mapping

| Board/template family | First-release source |
|---|---|
| Entity P&L | Authorized Enterprise Data cube |
| KPI Metrics | Authorized Enterprise Data KPI cube |
| Balance Sheet Analysis | Authorized Vault document by default; Enterprise Data adapter when a compatible balance-sheet cube exists |
| Variance Analysis | Authorized Enterprise Data cube or Vault tabular document |
| Trend Analysis | Authorized Enterprise Data cube or Vault tabular document |
| Audit Preparation | Authorized Enterprise Data or Vault document |
| Cashflow Monitoring | Authorized Enterprise Data or Vault tabular document |
| Company Research | Authorized Vault documents; Enterprise Data when applicable |
| Custom KPI Board | Authorized Enterprise Data or Vault tabular document |
| Financial Ratios Dashboard | Authorized Enterprise Data or Vault tabular document |
| Investor Updates | Authorized Enterprise Data or Vault tabular document |
| Quarterly P&L Review | Authorized Enterprise Data or Vault tabular document |

The UI must show the source type and source name for every run. A template must
not silently switch to a different source type when its selected source is not
available.

---

# 1. Current implementation inventory

## 1.1 Existing database objects

Current Board-related objects in `shared/schema.ts`:

- `board_templates`
- `boards`
- `board_threads`
- `board_documents`
- `board_data_sources`
- `cube_board_reports`

Relevant existing relationships:

- `boards.user_id` identifies the personal owner.
- `boards.template_id` points to `board_templates`.
- `board_threads` links a Board to an existing LedgerLM `chat`.
- `board_documents` links a Board to a user-owned document.
- `board_data_sources` stores source configuration.
- `cube_board_reports` stores the current variance-analysis report shape.

## 1.2 Existing server files

| File | Current responsibility | Migration use |
|---|---|---|
| `server/routes.ts` | Board routes, chat routes, report routes, source routes | Keep route paths; delegate to services |
| `server/storage.ts` | Board, template, thread, document, and source CRUD | Add typed methods for new tables |
| `server/services/boardAnalysisService.ts` | Current cube variance analysis | Preserve as legacy adapter; extract reusable pieces |
| `server/openai.ts` | Domain-aware AI generation and prompt safety | Reuse for all Boards AI calls |
| `server/seed.ts` | Initial Board template seeding | Add standalone templates idempotently |
| `server/publicDtos.ts` | Public Board DTO conversion | Add new public DTOs; never expose secrets |
| `server/security/ownership.ts` | Ownership checks | Reuse in every Board route |
| `server/migrations/create-board-reports.ts` | Current report-table startup migration | Keep and make future migrations idempotent/concurrency-safe |
| `server/index.ts` | Startup migrations and route registration | Register migrations in safe order |

## 1.3 Existing client files

| File | Current responsibility | Migration use |
|---|---|---|
| `client/src/pages/Boards.tsx` | Current Board gallery | Replace with standalone-style catalogue |
| `client/src/pages/BoardDetail.tsx` | Current report/thread detail page | Replace with generic report detail view |
| `client/src/components/BoardCreateWizard.tsx` | Legacy create flow | Replace or adapt to new Board modal |
| `client/src/components/BoardTemplateGrid.tsx` | Current template cards | Reuse only if visual structure remains appropriate |
| `client/src/components/BoardEditorDialog.tsx` | Legacy Board edit flow | Adapt to source/scope/template configuration |
| `client/src/components/BoardAnalysisEditor.tsx` | Current variance-only run editor | Replace with generic analysis configuration |
| `client/src/components/BoardReport.tsx` | Current variance report rendering | Keep as legacy renderer; add generic renderer |
| `client/src/lib/queryClient.ts` | API/CSRF request helper | Keep; all new API calls use it |
| `client/src/lib/deviceProof.ts` | Signed API proof | Keep; do not bypass with direct fetches |
| `client/src/lib/apiFiles.ts` | Signed file fetch/download helper | Use for protected exports and previews |

## 1.4 Standalone source files to port conceptually

The ZIP is a source reference, not a drop-in application:

- `lib/types.ts`
  - report result types
  - scope types
  - key-column types
  - schedule types
  - balance-sheet types
- `lib/templates.ts`
  - standalone template definitions
- `lib/metrics.ts`
  - deterministic metric, variance, trend, chart, and balance-sheet logic
- `lib/promptData.ts`
  - bounded prompt projection
- `lib/balanceSheetRollup.ts`
  - balance-sheet classification and rollup
- `lib/runAnalysis.ts`
  - orchestration behavior and progress stages
- `lib/exportReport.ts`
  - export layout reference only
- `components/board/ResultSections.tsx`
  - result rendering reference
- `components/board/ResultCharts.tsx`
  - chart rendering reference
- `components/board/AnalysisProgress.tsx`
  - progress/cancel interaction reference

Do not port:

- `lib/store.ts` persistence behavior
- browser IndexedDB dataset storage
- browser-local report/thread nesting
- client-side calls that send raw enterprise data
- client-side provider credentials

---

# 2. Target architecture

## 2.1 Request flow

```text
Browser
  |
  | signed API request + CSRF + session cookie
  v
Express Board route
  |
  +--> authenticate session and device proof
  +--> load Board and verify personal ownership
  +--> resolve source authorization
  +--> resolve domain AI configuration
  +--> start analysis run
  v
Board analysis orchestrator
  |
  +--> fetch authorized Enterprise Data/Vault data
  +--> apply server-side scope
  +--> compute deterministic metrics
  +--> build bounded model context
  +--> call streamFinancialAnalysis(...)
  +--> validate structured result
  +--> persist report and run state
  v
PostgreSQL
  |
  +--> board_analysis_configs
  +--> board_analysis_runs
  +--> board_reports
  +--> existing boards/chats/documents/sources
```

## 2.2 Ownership model

For every request:

1. Read `req.session.userId`.
2. Reject unauthenticated requests with `401`.
3. Load the Board by route parameter.
4. Require `board.userId === req.session.userId`.
5. Resolve source access for the same user.
6. Resolve domain AI configuration from the current authenticated user.
7. Never trust `userId`, `domainId`, `cubeId`, or source ownership from the
   request body.

The request body may select a period, template options, dimensions, and
presentation settings, but the server must derive the Board owner and
authorized source set.

## 2.3 Domain AI configuration

The existing chat path and current Board analysis path independently resolve
domain AI settings from `domains`. This migration should centralize that lookup.

New service:

```ts
// server/services/domainAiConfigService.ts
export async function resolveDomainAiConfigForUser(
  userId: string,
): Promise<DomainAiConfig | undefined>;
```

Responsibilities:

- find the current user’s active domain membership
- load `ai_provider`
- load `ai_auth_method`
- load `ai_endpoint`
- decrypt `ai_api_key` only when required
- load `ai_chat_model`
- load `ai_chat_api_version`
- load `ai_system_prompt`
- support keyless Entra ID/private-endpoint configuration
- return no credentials to the client

Refactor both:

- `/api/chats/:chatId/messages/stream`
- `/api/boards/:id/run-analysis`

to call this service.

The new Board analysis service must call:

```ts
streamFinancialAnalysis({
  query,
  multiSourceContext,
  domainAiConfig,
  signal,
});
```

It must not create a second provider client or read AI environment variables
directly from Board routes.

---

# 3. Database migration design

## 3.1 New table: `board_analysis_configs`

Purpose: store the durable configuration needed to reproduce a Board analysis.

Proposed Drizzle definition in `shared/schema.ts`:

```ts
export const boardAnalysisConfigs = pgTable("board_analysis_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id")
    .notNull()
    .unique()
    .references(() => boards.id, { onDelete: "cascade" }),
  templateKey: varchar("template_key", { length: 100 }).notNull(),
  systemPrompt: text("system_prompt"),
  analysisPrompt: text("analysis_prompt"),
  sourceType: varchar("source_type", { length: 30 }).notNull(),
  sourceConfig: jsonb("source_config").notNull().default({}),
  scopeMode: varchar("scope_mode", { length: 20 }).notNull().default("all"),
  keyColumns: jsonb("key_columns").notNull().default([]),
  excludedColumns: jsonb("excluded_columns").notNull().default([]),
  timeGranularity: varchar("time_granularity", { length: 20 })
    .notNull()
    .default("auto"),
  comparisonBasis: jsonb("comparison_basis").notNull().default({}),
  settingsVersion: integer("settings_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  boardIdx: index("board_analysis_configs_board_idx").on(table.boardId),
  templateIdx: index("board_analysis_configs_template_idx").on(table.templateKey),
}));
```

`sourceConfig` must contain identifiers and non-secret selection metadata only.
It must not contain API keys, decrypted provider configuration, raw source
rows, or credentials.

Example `sourceConfig`:

```json
{
  "cubeId": "authorized-cube-id",
  "cubeName": "FY2026 Planning Cube",
  "documentId": null,
  "documentName": null,
  "version": "CF05 2026",
  "entity": "BGSW"
}
```

## 3.2 New table: `board_analysis_runs`

Purpose: represent an active or completed manual analysis and support
cancellation/progress.

```ts
export const boardAnalysisRuns = pgTable("board_analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  requestedBy: varchar("requested_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  trigger: varchar("trigger", { length: 20 }).notNull().default("manual"),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  progressPercent: integer("progress_percent").notNull().default(0),
  progressStage: text("progress_stage"),
  cancelRequested: integer("cancel_requested").notNull().default(0),
  templateKey: varchar("template_key", { length: 100 }).notNull(),
  requestConfig: jsonb("request_config").notNull(),
  sourceSnapshot: jsonb("source_snapshot").notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  boardIdx: index("board_analysis_runs_board_idx").on(table.boardId),
  requesterIdx: index("board_analysis_runs_requester_idx").on(table.requestedBy),
  statusIdx: index("board_analysis_runs_status_idx").on(table.status),
  createdAtIdx: index("board_analysis_runs_created_at_idx").on(table.createdAt),
}));
```

The run stores a configuration/source snapshot so a later Board edit cannot
change the interpretation of an already completed report.

## 3.3 New table: `board_reports`

Purpose: store the generic structured report returned by the standalone-style
analysis engine.

```ts
export const boardReports = pgTable("board_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  runId: varchar("run_id")
    .notNull()
    .unique()
    .references(() => boardAnalysisRuns.id, { onDelete: "cascade" }),
  templateKey: varchar("template_key", { length: 100 }).notNull(),
  title: text("title").notNull(),
  periodLabel: text("period_label"),
  result: jsonb("result").notNull(),
  deterministicMetrics: jsonb("deterministic_metrics"),
  sourceSnapshot: jsonb("source_snapshot").notNull(),
  configSnapshot: jsonb("config_snapshot").notNull(),
  rawModelOutput: text("raw_model_output"),
  status: varchar("status", { length: 20 }).notNull().default("complete"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  boardIdx: index("board_reports_board_idx").on(table.boardId),
  templateIdx: index("board_reports_template_idx").on(table.templateKey),
  createdAtIdx: index("board_reports_created_at_idx").on(table.createdAt),
}));
```

`result` follows the standalone `AnalysisResult` shape:

```ts
interface BoardAnalysisResult {
  summary: string;
  kpis: Array<{
    label: string;
    value: string;
    change?: string;
    direction?: "up" | "down" | "flat";
  }>;
  charts: BoardChartSpec[];
  insights: string[];
  commentary: BoardCommentaryItem[];
  risks: string[];
  tables: BoardTableSpec[];
  actions: BoardActionItem[];
  balanceSheet?: BalanceSheetReport | null;
  entityPnl?: EntityPnlReport | null;
  kpiReport?: GovernedKpiReport | null;
}
```

## 3.4 Existing table compatibility

Do not delete `cube_board_reports`.

Compatibility options:

1. Keep existing rows in `cube_board_reports`.
2. Add an adapter in `server/services/boardReportCompatibilityService.ts`.
3. Return legacy rows from existing endpoints when they have no generic report.
4. Backfill generic `board_reports` rows only when the source fields can be
   mapped without inventing data.
5. Preserve `varianceData`, `rawAnalysis`, `columnMapping`, and comparison
   fields during backfill.

Proposed adapter functions:

```ts
export function legacyCubeReportToBoardReport(
  report: CubeBoardReport,
): PublicBoardReport;

export function genericBoardReportToLegacyShape(
  report: BoardReport,
): LegacyCompatibleReport | null;
```

## 3.5 Existing Board settings compatibility

Legacy Boards currently store configuration in `boards.settings`.

Add a pure mapper:

```ts
export function legacyBoardSettingsToAnalysisConfig(
  board: Board,
): InsertBoardAnalysisConfig;
```

Mapping:

| Legacy setting | New config |
|---|---|
| `settings.cubeId` | `sourceConfig.cubeId` |
| `settings.columnMapping` | `keyColumns` or variance-specific mapping |
| `settings.defaultDimensions` | `keyColumns` dimensions |
| `settings.analysisPrompts` | `systemPrompt` |
| `settings.userPromptTemplate` | `analysisPrompt` |
| absent value | template default |

The mapper must be deterministic and must not overwrite an explicitly migrated
configuration.

## 3.6 Migration file sequence

Create separate migration files:

```text
server/migrations/create-board-analysis-configs.ts
server/migrations/create-board-analysis-runs.ts
server/migrations/create-board-reports.ts
server/migrations/add-board-thread-report-link.ts
server/migrations/backfill-board-analysis-configs.ts
server/migrations/backfill-board-reports.ts
```

Each migration must:

- execute one DDL statement per `db.execute` call
- use `CREATE TABLE IF NOT EXISTS`
- use `CREATE INDEX IF NOT EXISTS`
- avoid `DELETE`, `DROP`, or destructive alteration
- be safe to retry after a partial startup
- tolerate concurrent startup where possible
- log a clear completion marker
- leave existing undeclared database objects untouched

Startup order in `server/index.ts`:

```ts
await createBoardReportsTable();
await createBoardAnalysisConfigsTable();
await createBoardAnalysisRunsTable();
await addBoardThreadReportLink();
await backfillBoardAnalysisConfigs();
await backfillBoardReports();
```

Backfills must be idempotent using `INSERT ... WHERE NOT EXISTS` or a unique
conflict-safe insert.

---

# 4. Shared types and validation

## 4.1 New shared types

Add to `shared/schema.ts` or a dedicated `shared/boardTypes.ts`:

```ts
export type BoardSourceType = "enterprise" | "vault";
export type BoardScopeMode = "all" | "selected" | "exclude";
export type BoardTimeGranularity = "auto" | "monthly" | "quarterly" | "yearly";
export type BoardRunStatus =
  | "queued"
  | "running"
  | "complete"
  | "cancel_requested"
  | "cancelled"
  | "error";
```

Use shared interfaces for:

- `BoardKeyColumn`
- `BoardComparisonBasis`
- `BoardSourceSelection`
- `BoardAnalysisRequest`
- `BoardAnalysisProgress`
- `BoardAnalysisResult`
- `BoardReportSummary`

## 4.2 Request validators

Add to `shared/inputValidators.ts`:

```ts
export const boardSourceSelectionSchema = z.object({
  sourceType: z.enum(["enterprise", "vault"]),
  cubeId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  version: z.string().max(200).optional(),
  entity: z.string().max(200).optional(),
}).strict();

export const boardKeyColumnSchema = z.object({
  column: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  dimension: z.string().max(200).nullable().optional(),
  dimensionValues: z.array(z.string().max(200)).max(200).optional(),
}).strict();

export const boardAnalysisRequestSchema = z.object({
  year: z.number().int().min(1900).max(2200).optional(),
  months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
  period: z.string().max(100).optional(),
  keyColumns: z.array(boardKeyColumnSchema).max(50).optional(),
  scopeMode: z.enum(["all", "selected", "exclude"]).optional(),
  excludedColumns: z.array(z.string().max(200)).max(200).optional(),
  comparisonBasis: z.object({
    mode: z.enum(["previous", "opening", "year-ago", "specific"]),
    periods: z.array(z.string().max(100)).max(20),
  }).optional(),
  extraContext: z.string().max(10_000).optional(),
}).strict();
```

Never accept `userId`, `ownerId`, `domainId`, provider credentials, raw
Enterprise Data rows, or arbitrary SQL from the browser.

---

# 5. Template catalogue migration

## 5.1 Template definition

Create:

```text
server/services/boardTemplateCatalog.ts
```

Functions:

```ts
export interface BoardTemplateDefinition {
  slug: string;
  name: string;
  description: string;
  tier: "standard" | "custom";
  sourceTypes: BoardSourceType[];
  defaultConfig: BoardTemplateDefaultConfig;
}

export function getBoardTemplateDefinitions(): BoardTemplateDefinition[];
export function getBoardTemplateDefinition(
  slug: string,
): BoardTemplateDefinition | undefined;
export function getDefaultBoardConfig(
  slug: string,
): BoardTemplateDefaultConfig;
```

Use stable slugs:

```text
audit-preparation
balance-sheet-tracker
cashflow-monitoring
company-research
custom-kpi-board
financial-ratios-dashboard
investor-updates
quarterly-pnl-review
variance-analysis
trend-analysis
entity-pnl
kpi-metrics
```

Do not create duplicate rows when the seed runs more than once.

## 5.2 Seed behavior

Update `server/seed.ts`:

```ts
async function seedBoardTemplates(): Promise<void>;
```

For each definition:

1. Find by stable `slug`.
2. Insert when absent.
3. Update only safe descriptive/default-config fields when the existing row is
   a known LedgerLM-managed template.
4. Never overwrite user-created/custom templates without an explicit ownership
   rule.
5. Never delete templates no longer present in the ZIP.

## 5.3 Template compatibility

Existing template IDs remain valid. New Board creation should use `slug` as the
stable selection key, while preserving the existing `templateId` foreign key.

Add:

```ts
export async function resolveBoardTemplateForBoard(
  board: Board,
): Promise<BoardTemplateDefinition | null>;
```

Resolution order:

1. existing `board_templates.slug`
2. legacy `analysisTemplate`
3. known default based on current Board settings
4. `null` with an explicit migration warning

---

# 6. Source authorization and retrieval

## 6.1 Source service

Create:

```text
server/services/boardSourceService.ts
```

Functions:

```ts
export async function listAuthorizedBoardSources(
  userId: string,
): Promise<AuthorizedBoardSource[]>;

export async function getAuthorizedBoardSource(
  userId: string,
  selection: BoardSourceSelection,
): Promise<AuthorizedBoardSource>;

export async function assertBoardSourceAccess(
  userId: string,
  selection: BoardSourceSelection,
): Promise<void>;

export async function loadBoardSourceData(
  userId: string,
  selection: BoardSourceSelection,
  request: BoardAnalysisRequest,
): Promise<BoardSourceData>;
```

## 6.2 Enterprise Data path

Enterprise source loading must:

1. verify the cube exists
2. verify the current user has access to the cube
3. apply domain/company restrictions
4. apply selected version/entity/period restrictions
5. select only allowed columns
6. return bounded records or aggregated data
7. include source evidence and row counts

The browser receives metadata only:

```ts
{
  id,
  name,
  sourceType: "enterprise",
  columns,
  versions,
  allowedSelections
}
```

The browser does not receive the full cube dataset.

## 6.3 Vault path

Vault source loading must:

1. verify the document belongs to the current user or is authorized through the
   existing domain/company Vault rules
2. use existing document parsing/chunking behavior
3. preserve document name and version evidence
4. parse tabular content server-side for structured templates
5. pass only bounded relevant rows/columns to deterministic metrics and AI
6. reject unsupported file types with an actionable error

Do not implement browser IndexedDB upload persistence for this release.

## 6.4 Source-selection endpoints

Add:

```text
GET /api/boards/sources
GET /api/boards/:id/source-options
POST /api/boards/:id/source-selection
```

All routes must use the same Board session/device-proof checks and must not
return source content unless the request explicitly requires an authorized
server-side analysis operation.

---

# 7. Deterministic analysis engine

## 7.1 File layout

Split the standalone metrics implementation into focused server files:

```text
server/services/boards/metrics/types.ts
server/services/boards/metrics/periods.ts
server/services/boards/metrics/genericMetrics.ts
server/services/boards/metrics/varianceMetrics.ts
server/services/boards/metrics/trendMetrics.ts
server/services/boards/metrics/dimensionMetrics.ts
server/services/boards/metrics/balanceSheetMetrics.ts
server/services/boards/metrics/chartMetrics.ts
server/services/boards/metrics/index.ts
```

Do not move the entire 2,000+ line standalone file into one server module.

## 7.2 Common metric functions

```ts
export function addCompositePeriod(
  rows: BoardDataRow[],
): BoardDataRow[];

export function applyTimeGranularity(
  rows: BoardDataRow[],
  granularity: BoardTimeGranularity,
): BoardDataRow[];

export function applyPointInTimeGranularity(
  rows: BoardDataRow[],
  granularity: BoardTimeGranularity,
): BoardDataRow[];

export function computeMetricsBlock(
  source: BoardSourceData,
  keyColumns: BoardKeyColumn[],
): DeterministicMetricBlock;

export function computeDimensionBlock(
  source: BoardSourceData,
  keyColumns: BoardKeyColumn[],
): DeterministicDimensionBlock;
```

Rules:

- numeric calculations occur server-side
- division-by-zero produces `null`/`N/A`, not an invented value
- source row counts are retained
- period labels are explicit
- partial source data is disclosed
- metrics used by the model are persisted in `deterministicMetrics`

## 7.3 Variance functions

```ts
export function computeVarianceBlock(
  source: BoardSourceData,
  keyColumns: BoardKeyColumn[],
  thresholdPercent: number,
): DeterministicVarianceBlock;

export function classifyVariance(
  primary: number,
  comparison: number,
  measureType: "revenue" | "cost" | "unknown",
): "favorable" | "adverse" | "neutral";
```

The result must record which favorable/adverse convention was used.

## 7.4 Trend functions

```ts
export function computeTrendBlock(
  source: BoardSourceData,
  keyColumns: BoardKeyColumn[],
): DeterministicTrendBlock;

export function detectTrendInflections(
  series: BoardTimeSeries,
): TrendInflection[];
```

Do not extrapolate beyond the last source period unless a future feature
explicitly adds forecasting.

## 7.5 Balance-sheet functions

```ts
export function classifyBalanceSheetRows(
  rows: BoardDataRow[],
  config: BalanceSheetConfig,
): ClassifiedBalanceSheet;

export function computeBalanceSheetReport(
  classified: ClassifiedBalanceSheet,
  comparison: BoardComparisonBasis,
): BalanceSheetReport;

export function validateBalanceSheetBalances(
  report: BalanceSheetReport,
): BalanceValidationResult;
```

Balance-sheet rules:

- never sum point-in-time balances across periods
- report unbalanced periods before interpreting ratios
- preserve unmapped rows
- never invent an FX rate
- never attribute a movement to a business cause absent from the data

## 7.6 Chart functions

```ts
export function computeDeterministicCharts(
  metrics: DeterministicMetricBlock,
  templateKey: string,
): BoardChartSpec[];
```

Charts derived from deterministic metrics should not depend on model-generated
numbers.

---

# 8. Analysis orchestration

## 8.1 Service files

Create:

```text
server/services/boards/boardAnalysisOrchestrator.ts
server/services/boards/boardAnalysisProgress.ts
server/services/boards/boardReportService.ts
server/services/boards/boardRunCancellation.ts
```

## 8.2 Public orchestration functions

```ts
export async function createBoardAnalysisRun(params: {
  boardId: string;
  userId: string;
  request: BoardAnalysisRequest;
}): Promise<BoardAnalysisRun>;

export async function executeBoardAnalysis(
  runId: string,
  signal?: AbortSignal,
): Promise<BoardReport>;

export async function requestBoardAnalysisCancellation(
  runId: string,
  userId: string,
): Promise<BoardAnalysisRun>;

export async function getBoardAnalysisRunForUser(
  runId: string,
  userId: string,
): Promise<BoardAnalysisRun | undefined>;

export async function listBoardReportsForUser(
  boardId: string,
  userId: string,
  filters?: BoardReportFilters,
): Promise<PublicBoardReport[]>;
```

## 8.3 Execution stages

`executeBoardAnalysis` should update the run through these stages:

1. `Authorizing source`
2. `Loading source metadata`
3. `Applying analysis scope`
4. `Computing deterministic metrics`
5. `Preparing bounded model context`
6. `Generating report narrative`
7. `Validating structured result`
8. `Persisting report`
9. `Creating report thread`
10. `Complete`

Each stage must:

- update `progressPercent`
- update `progressStage`
- check `cancelRequested`
- stop before persistence when cancellation is requested

## 8.4 Cancellation behavior

Manual cancellation must:

1. verify the requester owns the Board/run
2. set `cancel_requested = 1`
3. abort the in-process provider request when the run is local to the process
4. mark the run `cancelled`
5. not create a `board_reports` row
6. not create a report thread
7. leave previous reports unchanged

Because a deployment may have multiple server processes, the database flag is
the source of truth. In-process `AbortController` is an optimization.

## 8.5 Structured result validation

Create:

```text
server/services/boards/boardResultSchema.ts
```

Functions:

```ts
export function parseBoardAnalysisResult(
  value: unknown,
): BoardAnalysisResult;

export function repairBoardAnalysisResult(
  raw: string,
  context: BoardResultRepairContext,
): Promise<BoardAnalysisResult>;
```

Validation requirements:

- bounded array sizes
- bounded string lengths
- chart series point limits
- table row/column limits
- no arbitrary HTML
- no model-generated source identifiers accepted as authorization
- deterministic metrics remain authoritative

Reuse the existing `SafeMarkdown` rendering protections on the client.

---

# 9. API migration

## 9.1 Shared route helper

Create:

```text
server/security/boardAccess.ts
```

Functions:

```ts
export async function requireOwnedBoard(
  req: Request,
  boardId: string,
): Promise<{ userId: string; board: Board }>;

export async function requireOwnedReport(
  req: Request,
  boardId: string,
  reportId: string,
): Promise<{ userId: string; board: Board; report: BoardReport }>;
```

The helper should throw or return typed HTTP errors for:

- missing session
- missing Board
- Board owned by another user
- report not linked to the Board

Every Board route should use this helper instead of duplicating ownership code.

## 9.2 Existing routes to preserve

Keep these paths:

```text
GET    /api/boards
GET    /api/boards/:id
POST   /api/boards
PUT    /api/boards/:id
DELETE /api/boards/:id

GET    /api/board-templates
POST   /api/board-templates
PUT    /api/board-templates/:id
DELETE /api/board-templates/:id

GET    /api/boards/:id/reports
POST   /api/boards/:id/run-analysis
DELETE /api/boards/:id/reports/:reportId
POST   /api/boards/:id/reports/:reportId/follow-up

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

## 9.3 New routes

```text
GET    /api/boards/:id/analysis-config
PUT    /api/boards/:id/analysis-config

GET    /api/boards/:id/source-options
POST   /api/boards/:id/source-selection

POST   /api/boards/:id/analysis-runs
GET    /api/boards/:id/analysis-runs/:runId
POST   /api/boards/:id/analysis-runs/:runId/cancel
GET    /api/boards/:id/analysis-runs/:runId/events

GET    /api/boards/:id/reports/search
GET    /api/boards/:id/reports/:reportId

GET    /api/boards/:id/reports/:reportId/export/pdf
GET    /api/boards/:id/reports/:reportId/export/pptx
GET    /api/boards/:id/reports/:reportId/export/csv

POST   /api/boards/:id/reports/:reportId/threads
```

The existing `POST /api/boards/:id/run-analysis` route should initially be an
adapter:

```ts
app.post("/api/boards/:id/run-analysis", async (req, res) => {
  const { userId, board } = await requireOwnedBoard(req, req.params.id);
  const request = legacyRunAnalysisBodyToBoardAnalysisRequest(req.body, board);
  const run = await createBoardAnalysisRun({ boardId: board.id, userId, request });
  const report = await executeBoardAnalysis(run.id);
  res.status(201).json(toLegacyCompatibleReport(report));
});
```

After the new client uses the run/event routes, the adapter remains for old
clients and existing bookmarks.

## 9.4 Follow-up chat behavior

Keep report follow-up routes, but change context construction:

```ts
export function buildReportFollowUpContext(
  board: Board,
  report: BoardReport,
  intent: FollowUpIntent,
): string;
```

The context must use:

- persisted deterministic metrics
- persisted report result
- source snapshot
- report period/configuration

It must not re-fetch unauthorized data or trust a report ID without verifying
the Board relationship.

---

# 10. Client migration

## 10.1 Client API hooks

Create:

```text
client/src/features/boards/api.ts
client/src/features/boards/hooks.ts
client/src/features/boards/types.ts
```

Functions/hooks:

```ts
export function fetchBoardTemplates(): Promise<BoardTemplate[]>;
export function fetchBoards(): Promise<PublicBoard[]>;
export function fetchBoard(id: string): Promise<PublicBoard>;
export function fetchBoardAnalysisConfig(id: string): Promise<BoardAnalysisConfig>;
export function updateBoardAnalysisConfig(
  id: string,
  payload: BoardAnalysisConfigInput,
): Promise<BoardAnalysisConfig>;
export function startBoardAnalysis(
  id: string,
  payload: BoardAnalysisRequest,
): Promise<BoardAnalysisRun>;
export function cancelBoardAnalysis(
  boardId: string,
  runId: string,
): Promise<BoardAnalysisRun>;
export function fetchBoardReports(
  id: string,
  filters?: BoardReportFilters,
): Promise<PublicBoardReport[]>;
```

All functions must call `apiRequest` or the signed file helper. Do not call
`fetch` directly for protected Board data.

## 10.2 Page replacement

Replace:

```text
client/src/pages/Boards.tsx
client/src/pages/BoardDetail.tsx
```

with:

```text
client/src/features/boards/pages/BoardsPage.tsx
client/src/features/boards/pages/BoardDetailPage.tsx
```

Keep route paths in the existing router:

```text
/boards
/board/:id
```

The replacement pages must:

- preserve loading/error/empty states
- preserve existing Board IDs in navigation
- never render a Board before `/api/auth/me` has validated the session
- handle `401` by invalidating the current user query
- show source authorization errors distinctly from analysis errors

## 10.3 Components

Create or adapt:

```text
client/src/features/boards/components/BoardGallery.tsx
client/src/features/boards/components/BoardTemplateCard.tsx
client/src/features/boards/components/BoardModal.tsx
client/src/features/boards/components/BoardSourceSelector.tsx
client/src/features/boards/components/BoardScopeEditor.tsx
client/src/features/boards/components/BoardPeriodEditor.tsx
client/src/features/boards/components/BoardAnalysisProgress.tsx
client/src/features/boards/components/BoardReportCatalogue.tsx
client/src/features/boards/components/BoardReportView.tsx
client/src/features/boards/components/BoardResultSections.tsx
client/src/features/boards/components/BoardResultCharts.tsx
client/src/features/boards/components/BoardThreadList.tsx
```

Adapt existing components only when doing so does not preserve variance-only
assumptions.

## 10.4 Report rendering

The generic report renderer must support:

- summary
- KPI cards
- chart blocks
- insight lists
- commentary items
- risk items
- action items
- tables
- balance-sheet-specific integrity and movement sections
- governed Entity P&L result
- governed KPI result

Charts must render only validated chart specifications. Do not execute model
HTML or arbitrary JavaScript.

## 10.5 Progress and cancellation

The client should:

1. create a run
2. subscribe to run progress
3. update the progress component
4. send cancellation on user request
5. stop polling/subscription after terminal status
6. refresh reports only after `complete`

If server-sent events are not available through the project proxy, use bounded
polling:

```text
GET /api/boards/:id/analysis-runs/:runId
```

with exponential backoff and a maximum poll duration.

---

# 11. Export migration

## 11.1 Export boundary

Exports must be generated from persisted report data, not from browser access to
Enterprise Data.

Create:

```text
server/services/boards/boardExportService.ts
```

Functions:

```ts
export async function createBoardPdf(
  report: BoardReport,
): Promise<Buffer>;

export async function createBoardPptx(
  report: BoardReport,
): Promise<Buffer>;

export function createBoardCsv(
  report: BoardReport,
): Buffer;
```

## 11.2 Dependency review

The current LedgerLM package includes `jspdf`, `exceljs`, and document/export
dependencies but does not currently include the standalone ZIP’s PPTX-specific
dependency.

Before implementation:

1. verify whether an existing server export library can produce the required
   PPTX output
2. if not, add the smallest maintained dependency through the package
   management workflow
3. keep export generation server-side
4. add export size and timeout limits
5. do not add the entire standalone dependency set without need

## 11.3 Export authorization

Every export route must:

1. require the authenticated user
2. require signed API proof
3. verify Board ownership
4. verify report belongs to the Board
5. return a signed/downloadable response through the existing file helper

---

# 12. Migration execution order

## Phase 0 — Baseline and safety

Files:

```text
server/index.ts
server/migrations/create-board-reports.ts
server/security/ownership.ts
server/routes.ts
```

Steps:

1. Capture current Board/template/report row counts in a read-only diagnostic.
2. Confirm existing report migration does not delete data.
3. Remove any destructive legacy migration behavior that is unrelated to this
   feature before running production migration.
4. Add a Board migration feature flag if rollout needs to be gradual.
5. Add tests for current Board route ownership before changing handlers.
6. Confirm existing signed API proof covers all new `/api/boards` routes.

Exit criteria:

- baseline counts recorded
- no destructive migration statements
- current Board tests pass

## Phase 1 — Shared domain AI resolver

Files:

```text
server/services/domainAiConfigService.ts
server/openai.ts
server/routes.ts
```

Steps:

1. Extract domain config lookup from chat routes.
2. Preserve encrypted-key decryption boundary.
3. Preserve Entra ID/private endpoint behavior.
4. Update chat to call the shared resolver.
5. Update current Board variance analysis to call the shared resolver.
6. Add tests for API-key, Entra ID, private endpoint, missing config, and
   unknown-domain cases.

Exit criteria:

- chat behavior unchanged
- Board AI uses the same resolved config
- no provider credential reaches the client

## Phase 2 — Schema and idempotent migrations

Files:

```text
shared/schema.ts
server/migrations/create-board-analysis-configs.ts
server/migrations/create-board-analysis-runs.ts
server/migrations/create-board-reports.ts
server/migrations/add-board-thread-report-link.ts
server/index.ts
server/storage.ts
```

Steps:

1. Add Drizzle table definitions.
2. Add insert/select/update types.
3. Add one-statement-per-execute migrations.
4. Add indexes.
5. Add storage methods.
6. Run dry-run migration validation.
7. Run migrations against development database.
8. Verify tables/indexes with read-only SQL.
9. Run migrations a second time to verify idempotency.

Exit criteria:

- second run produces no duplicate relation/index error
- no existing rows deleted
- schema types compile

## Phase 3 — Template catalogue

Files:

```text
server/services/boardTemplateCatalog.ts
server/seed.ts
shared/inputValidators.ts
server/routes.ts
```

Steps:

1. Add stable template definitions.
2. Add source-type metadata.
3. Add default Board configuration per template.
4. Seed missing templates by slug.
5. Preserve existing IDs and custom templates.
6. Return tier/source metadata in the public template DTO.
7. Add template catalog tests.

Exit criteria:

- all approved templates appear once
- existing template references still resolve
- rerunning seed produces no duplicates

## Phase 4 — Legacy Board migration

Files:

```text
server/migrations/backfill-board-analysis-configs.ts
server/migrations/backfill-board-reports.ts
server/services/boardMigrationService.ts
server/services/boardReportCompatibilityService.ts
```

Steps:

1. Find Boards without `board_analysis_configs`.
2. Resolve template slug.
3. Convert `boards.settings`.
4. Insert config only when absent.
5. Convert compatible `cube_board_reports` rows.
6. Preserve legacy report rows.
7. Mark unmappable reports as legacy-only rather than fabricating a result.
8. Write migration diagnostics for skipped records.
9. Make the backfill rerunnable.

Exit criteria:

- every existing Board has either a new config or an explicit migration warning
- no existing report disappears
- old `/api/boards/:id/reports` still returns old reports

## Phase 5 — Source authorization

Files:

```text
server/services/boardSourceService.ts
server/routes.ts
server/publicDtos.ts
```

Steps:

1. Implement authorized Enterprise Data listing.
2. Implement authorized Vault source listing.
3. Add cube/document selection validation.
4. Add source snapshot creation.
5. Add source options route.
6. Add tests for same-user, wrong-user, wrong-domain, and missing-source cases.
7. Confirm source content never appears in source-list metadata responses.

Exit criteria:

- a user can select only authorized sources
- Board source configuration persists across reload/device
- unauthorized source IDs return `403` or `404` without data leakage

## Phase 6 — Deterministic metrics

Files:

```text
server/services/boards/metrics/*
server/services/boardAnalysisService.ts
```

Steps:

1. Port period normalization.
2. Port scope projection.
3. Port generic metric blocks.
4. Port dimension breakdowns.
5. Port variance blocks.
6. Port trend blocks.
7. Port balance-sheet rollups.
8. Port deterministic chart specifications.
9. Compare output against standalone fixture data.
10. Keep current `runBoardAnalysis` behavior through an adapter.

Exit criteria:

- fixture totals match the standalone implementation
- balance checks behave identically
- no model-generated arithmetic is used as source data

## Phase 7 — Generic analysis orchestration

Files:

```text
server/services/boards/boardAnalysisOrchestrator.ts
server/services/boards/boardResultSchema.ts
server/services/boards/boardRunCancellation.ts
server/routes.ts
```

Steps:

1. Validate analysis request.
2. Create queued run.
3. Authorize source.
4. Load server-side data.
5. Compute deterministic metrics.
6. Build bounded prompt context.
7. Resolve domain AI configuration.
8. Call `streamFinancialAnalysis`.
9. Validate the structured result.
10. Run one bounded repair attempt if needed.
11. Persist completed report.
12. Link a report thread.
13. Mark run complete.
14. Mark errors without creating a false successful report.
15. Implement cancellation checks between stages.

Exit criteria:

- manual analysis creates a durable report
- cancellation creates no partial report
- model failures are visible and retryable
- existing variance endpoint still works

## Phase 8 — Client replacement

Files:

```text
client/src/features/boards/*
client/src/pages/Boards.tsx
client/src/pages/BoardDetail.tsx
client/src/components/BoardEditorDialog.tsx
client/src/components/BoardAnalysisEditor.tsx
client/src/components/BoardReport.tsx
```

Steps:

1. Add API hooks.
2. Add template gallery.
3. Add create/edit modal.
4. Add source selector.
5. Add scope/key-column editor.
6. Add period/comparison editor.
7. Add run progress/cancel UI.
8. Add report catalogue/search.
9. Add generic result renderer.
10. Add charts/tables/KPI/balance-sheet sections.
11. Add threads/chat links.
12. Keep existing routes and Board IDs.
13. Add loading, empty, permission, and error states.

Exit criteria:

- existing Board URLs open the new detail page
- existing Boards are visible after reload
- no browser storage is required
- standard and governed templates both create valid configurations

## Phase 9 — Exports

Files:

```text
server/services/boards/boardExportService.ts
server/routes.ts
client/src/lib/apiFiles.ts
client/src/features/boards/components/*
```

Steps:

1. Implement CSV from persisted deterministic data.
2. Implement PDF from persisted result.
3. Implement PPTX after dependency review.
4. Add authorized download endpoints.
5. Add signed fetch-to-Blob client actions.
6. Test exports from reports belonging to another user.

Exit criteria:

- exports work after a full page reload
- exports do not require browser source data
- unauthorized report exports are rejected

## Phase 10 — Remove old UI only after compatibility validation

Do not delete old server tables or routes.

Steps:

1. Run both old compatibility APIs and new APIs against migrated records.
2. Compare report counts and titles.
3. Verify old route response shapes for existing clients.
4. Remove only unused client components after no imports remain.
5. Keep compatibility adapters until a later explicit deprecation decision.

---

# 13. Testing plan

## 13.1 Unit tests

Create:

```text
tests/boards/templateCatalog.test.ts
tests/boards/boardMigration.test.ts
tests/boards/sourceAuthorization.test.ts
tests/boards/metrics.test.ts
tests/boards/varianceMetrics.test.ts
tests/boards/trendMetrics.test.ts
tests/boards/balanceSheetMetrics.test.ts
tests/boards/resultSchema.test.ts
tests/boards/domainAiConfig.test.ts
```

Cover:

- deterministic migration mapping
- idempotent mapping
- source access decisions
- zero denominators
- missing periods
- duplicate dimensions
- variance favorable/adverse classification
- balance-sheet unbalanced periods
- unmapped rows
- chart size limits
- invalid model output
- domain AI configuration resolution

## 13.2 API security tests

Create:

```text
tests/security/boardsAuthorization.test.ts
tests/security/boardsDeviceProof.test.ts
tests/security/boardsExports.test.ts
```

Cover:

- no session
- copied cookie without device proof
- valid signed request
- wrong Board owner
- wrong report-to-Board relationship
- wrong source owner
- wrong domain/company source
- path/method/signature mismatch
- replayed request proof
- direct export request without proof

## 13.3 Integration tests

Create:

```text
tests/boards/boardPersistence.integration.test.ts
tests/boards/boardAnalysis.integration.test.ts
tests/boards/boardCancellation.integration.test.ts
tests/boards/legacyCompatibility.integration.test.ts
```

Cover:

- create Board
- edit configuration
- reload Board
- create report
- reload report on a second session/device
- create follow-up thread
- cancel active run
- preserve old variance report
- rerun migration

## 13.4 Manual verification

For a test user:

1. Create a general-purpose Board.
2. Select an Enterprise Data source.
3. Run a manual analysis.
4. Cancel a second analysis.
5. Open the completed report after reload.
6. Open the Board using a second browser session for the same user.
7. Confirm another user receives `403` for the Board.
8. Generate PDF/CSV/PPTX where enabled.
9. Create Entity P&L, KPI, and Balance Sheet Boards.
10. Confirm each uses the intended source type.

---

# 14. Operational and migration safeguards

- Never run destructive Board migrations automatically.
- Never delete `device_trust` or unrelated security data during this feature.
- Never log decrypted AI keys.
- Never log raw Enterprise Data rows.
- Never accept provider configuration from the browser.
- Never trust source ownership from the request body.
- Do not expose raw Vault documents through Board metadata endpoints.
- Keep database migration statements separate for Neon compatibility.
- Add timeouts and payload limits to analysis runs.
- Cap report result sizes before persistence.
- Record run failure reasons without persisting secrets or raw credentials.
- Keep migration logs free of source contents and AI prompts containing sensitive
  data.

---

# 15. Definition of done

The migration is complete when:

1. All approved templates are available.
2. Existing Boards remain accessible by their existing URLs.
3. Existing reports remain visible.
4. New reports persist in PostgreSQL.
5. Board data reloads across browsers/devices.
6. Enterprise Data and Vault source access is server-authorized.
7. Entity P&L and KPI use Enterprise Data.
8. Balance Sheet uses Vault by default and supports a compatible Enterprise Data
   adapter.
9. General-purpose Boards use the same domain AI configuration as chat.
10. Manual analysis supports visible progress and cancellation.
11. Structured reports render KPIs, charts, insights, risks, commentary, tables,
    actions, and governed sections.
12. Exports are authenticated and server-generated.
13. Existing Board routes remain compatible.
14. Security tests cover copied-cookie impersonation and report/source isolation.
15. Database migrations are rerunnable and non-destructive.
16. Build, security tests, Board tests, and migration checks pass.

# 16. Implementation order summary

```text
1. Baseline/security regression tests
2. Shared domain AI resolver
3. New schema and idempotent migrations
4. Template catalogue and seed changes
5. Legacy Board/config/report backfill
6. Enterprise Data/Vault source authorization
7. Deterministic server metrics
8. Generic analysis orchestration and cancellation
9. Compatibility API adapters
10. New client Boards gallery/detail experience
11. Server-side exports
12. Full verification and rollout
```