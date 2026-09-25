---
name: KPI source normalization
description: Query rules for recovering Anaplan KPI values across export labels, periods, and calculation bases.
---

Anaplan plan exports can store World Wide totals on a `World wide` page while regional totals use `Entity`; query predicates must allow both forms. Aggregate count expressions also need zero-safe fallback logic because SQL `COUNT(*)` returns 0, not NULL.

**Why:** The KPI report had forecast rows in the database, but case-sensitive text predicates and a `COALESCE` around a zero count caused valid revenue and capacity forecasts to be treated as unavailable.

**How to apply:** Normalize comparison literals before filtering, keep page-label variants explicit for governed scopes, and use `NULLIF(count, 0)` when falling back from actual to forecast row counts.

For forecast capacity, select the requested scenario's `cost_value`; do not let Actual plan rows override it. The Worldwide comparison basis includes onsite capacity, while regional entity totals and detail exclude onsite.

**Why:** Screenshot references reconcile to the scenario forecast only when regional onsite capacity is removed; applying Worldwide's all-location basis to entity views overstates regional capacity.

**How to apply:** Keep scenario selection separate from Actual-plan adjustments, and preserve the Worldwide-versus-entity onsite distinction in both total and breakdown queries.

Keep monthly `Billing Utilization` data distinct from YTD `Billing Utilization Summary` data. The authoritative utilization workbook uses `Billing Utilization Summary`, the standard internal capacity denominator (allocated + not allocated + M/S + VKM - nonlinear), and payable-capacity fields for external utilization.

**Why:** A supplied workbook can establish the formula and filters while its reference values still disagree with the selected cube under that exact SQL; this is a source-data mismatch, not evidence that the formula should be retuned.

**How to apply:** Verify the selected cube was ingested from the same source export and uses the same period population before changing utilization SQL or adding screenshot-backed assertions. Never coerce formula/filter choices to match a target when the underlying rows are unverified.