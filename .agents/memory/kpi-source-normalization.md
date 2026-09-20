---
name: KPI source normalization
description: Query rules for recovering Anaplan KPI forecast and capacity totals across page-label and count-shape variations.
---

Anaplan plan exports can store World Wide totals on a `World wide` page while regional totals use `Entity`; query predicates must allow both forms. Aggregate count expressions also need zero-safe fallback logic because SQL `COUNT(*)` returns 0, not NULL.

**Why:** The KPI report had forecast rows in the database, but case-sensitive text predicates and a `COALESCE` around a zero count caused valid revenue and capacity forecasts to be treated as unavailable.

**How to apply:** Normalize comparison literals before filtering, keep page-label variants explicit for governed scopes, and use `NULLIF(count, 0)` when falling back from actual to forecast row counts.