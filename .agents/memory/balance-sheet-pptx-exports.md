---
name: Balance Sheet PPTX exports
description: Durable design rules for standalone Balance Sheet PowerPoint generation and period comparisons
---

Standalone Balance Sheet exports should be generated dynamically from the dedicated Balance Sheet report contract rather than by replacing tokens in an uploaded generic template. The deck is two slides: Assets and Liabilities/Equity, with deterministic latest-earlier-period narratives, old-balance pointers, category comparison charts, units, and source metadata.

**Why:** A placeholder template cannot reliably represent dynamic category-level chart data and narrative content, while the Balance Sheet comparison period may be the latest earlier loaded period rather than the previous calendar month.

**How to apply:** Keep Balance Sheet source data isolated from KPI/planning facts, normalize presentation values and units before export, include equity/reserves on the liabilities slide, and validate both slide count and embedded chart structure in export regressions.

For dense clustered category charts, keep the bars unlabeled and place exact current/prior/change values in an aligned comparison table.

**Why:** Side-by-side values above neighboring bars collide when categories are close, and label-position workarounds do not solve limited slide space.

**How to apply:** Build both the chart and table from the same normalized category data; use the chart for shape and the table for precise values, then keep narrative callouts short and inside the slide bounds.