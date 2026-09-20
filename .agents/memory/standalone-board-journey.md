---
name: Standalone Board journey
description: Compatibility boundary between the new source/scope Board flow and legacy variance Boards
---

New Board templates should use an authorized source plus period/scope selection without requiring Actuals and Budget mappings. Preserve the legacy variance adapter only for existing Variance Analysis Boards that already contain both mappings.

**Why:** The standalone reference journey is not the old LedgerLM variance workflow, and making Budget mandatory blocks KPI, Entity P&L, Balance Sheet, and related templates.

**How to apply:** Keep the active Board detail/run UI generic and template-aware. Use legacy BvA shapes only when compatibility data is explicitly present; never make them a prerequisite for new Board creation or standalone runs.