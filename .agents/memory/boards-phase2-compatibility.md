---
name: Boards Phase 2 compatibility boundary
description: Durable correctness and compatibility constraints for later native Boards phases.
---

Native Board analysis runs must pass through governed queue/execution snapshots, queue-time and execution-time source authorization, an allowlisted scope plan, and bounded server-side queries. The legacy renderer remains the compatibility output path during Phase 2.

Phase 2 intentionally supports only additive Amount (USD) variance with sum/currency semantics. Multiple measures, non-USD measures, snapshot/non-additive measures, and incompatible aggregation or value types must fail explicitly until the deterministic engine can model them correctly.

**Why:** Silently adapting unsupported selections produced mislabeled or materially incorrect financial analysis. Contributor limits could also truncate totals unless overflow fails before results are calculated.

**How to apply:** In Phase 3, replace these explicit rejections only when the deterministic engine carries per-measure aggregation, units, filters, evidence, and complete totals end to end. Do not bypass the governed run path or restore implicit dimension/period defaults at execution.