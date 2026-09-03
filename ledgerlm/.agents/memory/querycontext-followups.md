---
name: queryContext follow-up architecture
description: How parsed query intent flows from Python → Node metadata → frontend follow-ups → skips LLM re-parse on click
---

## The rule
When Python parses a query via `/api/v2/semantic-sql/intent`, the resulting `structured_query` is captured as `queryContext` in the orchestrator result, saved to `message.metadata.queryContext` (jsonb), sent in the SSE `complete` event, read by the frontend, and used to generate follow-up badges. Clicking a follow-up badge sends `queryContext` back in the request body — the backend forwards it to the intent endpoint which skips LLM parsing entirely and uses the pre-parsed context directly.

**Why:** Text-based follow-up matching was unreliable for 4 metrics with collision risk (`pyramid_mix_individual_levels`, `revenue`, `ebit`, `gross_margin`). Sending the exact `structured_query` back is 100% reliable.

**How to apply:**
- `queryOrchestrator.ts`: `query()` accepts `queryContext?`, passes to `querySemanticSQL()` which forwards it in `intentBody.query_context`. Return value includes `queryContext: structuredQuery`.
- `routes.ts` streaming endpoint: reads `req.body.queryContext` → passes to orchestrator → saves `orchestratorResult.queryContext` in `msgMeta`.
- `ChatDetail.tsx`: `sendStreamingMessage(content, queryContext?)` passes context in body. Follow-up render checks `message.metadata?.queryContext` — if present, uses `generateFollowUpsFromContext()` which returns `{label, context}` pairs. On click, calls `handleSuggestedQuestion(label, modifiedContext)`.
- `semantic_sql.py` intent endpoint: `IntentRequest` has `query_context?: Dict`. If set, skips `parse_query_intent()` entirely and returns it directly.
