---
name: Plan ingestion job status
description: How to interpret ingestion-job status for Plan/Actual workbook uploads.
---

For Plan/Actual workbooks, verify imported periods in `cube_plan_data` rather than treating a `queued` ingestion-job status as proof that the import did not run. The upload path creates a job before dispatch, but the plan ingestion branch does not pass that job ID into its importer or update the job status.

**Why:** The plan workbook can be ingested successfully while its tracking row remains queued, unlike the fact-data path, which updates the job through running and completion states.

**How to apply:** When investigating missing KPI periods, compare workbook periods with `cube_plan_data` for plans and `cube_fact_data` for actuals. Plan rows do not substitute for actual utilization facts.