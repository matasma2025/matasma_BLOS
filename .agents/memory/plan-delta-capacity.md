---
name: Plan Delta capacity
description: The KPI planning workbook stores absolute capacity adjustments in Delta rather than Cost value.
---

The Plan/Actual workbook's `Delta` column is the authoritative absolute adjustment for Total Capacity rows. When a cube contains both a blank-GB total Delta and GB-specific Deltas, use only the blank-GB row in the top-line total; apply GB-specific Deltas only to their corresponding breakdowns. Prefer Delta for Actual/Actuals rows and fall back to Cost value only for older imports that predate Delta ingestion.

**Why:** Cost value is empty for relevant Actual capacity rows, so dropping Delta silently omits the plan adjustment. Summing the total and GB-specific Delta rows together double-counts the workbook's rollup and detail adjustments.

**How to apply:** Preserve Delta through ingestion and use the Delta-first fallback. Filter top-line capacity queries to the blank-GB rollup, while breakdown queries use only their matching GB/page rows. Do not substitute Value % for Delta.