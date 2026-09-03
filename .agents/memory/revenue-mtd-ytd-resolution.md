---
name: Revenue MTD/YTD resolution
description: How MTD vs YTD revenue queries are detected and routed to different cost_category values
---

## Rule
`_resolve_time_aggregation(query)` is called ONCE at the top of `compile_sql` and stores the result in `intent['_time_agg']` ('MTD' or 'YTD', default YTD).

- `time_agg='MTD'` → `cost_category = 'Revenue'`         (single-month individual values)
- `time_agg='YTD'` → `cost_category = 'Revenue Summary'` (cumulative YTD values)

**Why:** The DB stores both row types under different cost_category values. Before this fix, `_build_revenue_sql` hardcoded `'Revenue Summary'` for all revenue queries, returning YTD cumulative even when the user asked for MTD.

**How to apply:**
- Only `_build_revenue_sql` and `_build_customer_revenue_sql` support MTD — they accept `time_agg` param.
- P&L / EBIT / composite builders (`_build_gb_pl_revenue_sql`, `_build_entity_pl_revenue_sql`, `_build_gb_pl_summary_sql`, `_build_entity_pl_ebit_sql`, `_build_consolidated_pl_sql`, all `_build_budget_*_sql`) always use `'Revenue Summary'` — they are always YTD by financial definition and must NOT be changed.
- `_build_revenue_type_sql` (order_reason CASE WHEN split) also always uses `'Revenue Summary'` — left a TODO comment, MTD not yet supported.
- Multi-month comparison queries (e.g. "jan and feb MTD") still pull YTD rows and the AI derives MTD by subtraction — this is correct behavior, not a bug.
- The `time_agg` value propagates: Python result dict → `queryOrchestrator.ts` (`primaryResult.time_agg`) → `SemanticSQLEvidence.timeAgg` → `evidenceBroker.ts` `timeNote`.
