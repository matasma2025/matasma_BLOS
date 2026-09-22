---
name: Plan Delta capacity
description: The KPI planning workbook stores absolute capacity adjustments in Delta rather than Cost value.
---

The Plan/Actual workbook's `Delta` column is the authoritative absolute adjustment for Total Capacity rows. Capacity KPI aggregation should prefer Delta for Actual/Actuals plan rows and only fall back to Cost value for older imports that predate Delta ingestion.

**Why:** Cost value is empty for the relevant Actual capacity rows in the workbook, so dropping Delta makes the report silently omit the plan adjustment.

**How to apply:** Preserve Delta through plan ingestion and use the Delta-first fallback rule in aggregate and breakdown capacity calculations; do not substitute Value % for Delta.