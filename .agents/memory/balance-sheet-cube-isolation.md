---
name: Balance Sheet cube isolation
description: Durable boundary for Balance Sheet board data and reporting
---

Balance Sheet analysis is a separate cube schema and point-in-time account-balance table. It must not reuse the KPI or planning fact path, including as a statement-type filter.

**Why:** The Balance Sheet has different period semantics, reconciliation rules, and account-level movements than KPI planning data; mixing paths can silently produce plausible but incorrect reports.

**How to apply:** Keep ingestion, deterministic calculations, source selection, rendering, and PowerPoint export on the dedicated Balance Sheet path while leaving KPI Metrics on its existing services and tables.