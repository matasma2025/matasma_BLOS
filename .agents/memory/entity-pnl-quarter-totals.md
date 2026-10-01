---
name: Entity P&L quarter totals
description: Calendar-quarter comparison semantics for the Entity P&L board and how they differ from capacity measures.
---

Entity P&L QoQ selections are limited to March, June, September, and December. Financial quarter values use cumulative snapshots: Q1 is March; Q2 is June minus March; Q3 is September minus June; Q4 is December minus September. Q1 compares with prior-year Q4. YoY remains YTD and other boards are not affected.

Capacity is a stock measure, not a cumulative financial flow: end capacity uses the selected quarter-end snapshot, while averages remain YTD averages. Do not subtract quarter-end headcount snapshots to create a capacity “quarter total.”

**Why:** Financial snapshots are cumulative within each calendar year, but capacity snapshots represent headcount at a point in time. Applying the financial difference formula to capacity would misstate it.

**How to apply:** Keep these semantics scoped to the Entity P&L board. When changing its QoQ calculations or labels, preserve the YTD YoY path and the point-in-time/YTD capacity measures.