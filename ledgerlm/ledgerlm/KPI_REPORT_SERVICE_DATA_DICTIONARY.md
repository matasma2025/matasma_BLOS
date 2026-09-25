# KPI Report Service: Data Dictionary and Entity Results

## Purpose and snapshot

This document describes the fields, SQL filters, calculations, and returned metrics in `server/services/kpiReportService.ts`.

The captured database results below are for **July 2026** (`year = 2026`, `month = 7`), scenario **YTD Forecast**, cube `c71365af-3938-4e95-83ea-cad0b810f45e`. Values are the service's aggregated database output, rounded for readability. They are not raw row values.

## Entities and source mappings

| Report entity | `cube_fact_data.region_entity` filter | `cube_plan_data.entity` filter | Notes |
|---|---|---|---|
| World Wide | All non-aggregate regions; excludes `WORLD WIDE` and `WORLWIDE` | `WORLD WIDE`, `WORLDWIDE`, or `WORLWIDE` | Actual capacity facts include both `OFFSHORE` and `ONSITE`. |
| India | `BGSW` | `BGSW` | Actual capacity facts include `OFFSHORE` only. |
| Vietnam | `BGSV` | `BGSV` | Actual capacity facts include `OFFSHORE` only. |
| Mexico | `NE-MX` or `BGSW/NE-MX` | `NE-MX` | Actual capacity facts include `OFFSHORE` only. |

An empty entity means all non-Worldwide fact rows for Actuals. The report also supports `YTD Forecast`, `CF02`, `CF05`, `CF09`, and `CF11` scenario selections.

## Source tables and important columns

| Table | Column(s) | Use in the service |
|---|---|---|
| `cube_fact_data` | `cube_id`, `year`, `month`, `version`, `region_entity` | Select the cube, reporting period, unversioned Actual export rows, and entity scope. Actuals require `version IS NULL OR trim(version) = ''`. |
| `cube_fact_data` | `cost_category`, `amount_usd`, `include_exclude`, `sub_cost_category`, `cost_category_class` | Revenue Actuals. Revenue is `SUM(amount_usd) / 1,000,000`. Worldwide keeps rows marked `include`; detailed-workbook entities allow Revenue Hardware rows. |
| `cube_fact_data` | `billed_capacity`, `allocated_capacity`, `not_allocated_capacity`, `ms_capacity`, `vkm_capacity`, `non_linear_capacity` | Internal utilization numerator and denominator. |
| `cube_fact_data` | `resource_type`, `project_type`, `new_service_area` | Utilization filters: Internal/External resource type, not FixedPrice, and for detailed-workbook scopes `new_service_area IN ('MS', 'SX')`. |
| `cube_fact_data` | `payable_allocated_cap`, `payable_not_allocated_cap`, `payable_ms_cap`, `payable_vkm_cap`, `payable_non_linear_cap` | External utilization denominator. |
| `cube_fact_data` | `capacity`, `onsite_offshore`, `service_area`, `new_service_area`, `project_type`, `proj_dept`, `project_gb`, `split_itrams_sds` | Actual Capacity and its breakdown mapping. Corporate service areas are excluded; FixedPrice is excluded for MS/MM; MM excludes three named project departments. |
| `cube_plan_data` | `entity`, `page`, `plan_type`, `year`, `month` | Scope, worksheet/page, period, Actual plan adjustment, or selected forecast scenario. |
| `cube_plan_data` | `particulars`, `sub_category`, `gb` | Distinguishes total capacity, budget, end values, and GB-specific adjustments. |
| `cube_plan_data` | `delta_value`, `cost_value` | Actual-plan adjustments use numeric `delta_value` with `cost_value` fallback. Forecast detail queries parse `cost_value`. |

Numeric plan text is parsed after removing commas; invalid or blank values become `NULL`. The helper `numericCapacityPlanValue()` currently prefers `delta_value` and falls back to `cost_value`.

## Metric definitions and SQL logic

| Metric | Actual query logic | Forecast query logic | Important behavior |
|---|---|---|---|
| Revenue / Budget | `SUM(amount_usd) / 1000000` where `cost_category = 'revenue summary'`; Worldwide also requires `include_exclude = 'include'`. | Selected plan scenario, `particulars = 'budget (mUSD)'`, `sub_category = 'total'`; page is `WORLD WIDE` for Worldwide and `ENTITY` for other entities. | Forecast aggregate currently uses `COALESCE(delta_value, cost_value)` through `numericCapacityPlanValue()`. Detail forecast uses `cost_value`. |
| Internal Utilization | `SUM(billed_capacity) / NULLIF(SUM(allocated_capacity) + SUM(not_allocated_capacity) + SUM(ms_capacity) + SUM(vkm_capacity) - SUM(non_linear_capacity), 0)` | `NULL`; no forecast utilization is produced. | Detailed-workbook overall query is filtered to MS/SX service areas and excludes FixedPrice rows. |
| External Utilization | `SUM(billed_capacity) / NULLIF(SUM(payable_allocated_cap) + SUM(payable_not_allocated_cap) + SUM(payable_ms_cap) + SUM(payable_vkm_cap) - SUM(payable_non_linear_cap), 0)` | `NULL`; no forecast utilization is produced. | Uses payable capacity fields and the same resource/project/service-area scope filters. |
| Capacity total | `SUM(capacity)` from `GB Wise END Capacity` fact rows, plus the Actual-plan top-level adjustment. | Selected plan scenario's `total capacity / end` row. | Actual total plan adjustment is restricted to a blank `gb`. The current forecast aggregate incorrectly gives Actual/Actuals plan rows precedence over the selected scenario. |
| Capacity breakdown | Fact `capacity` is mapped into MS, MM, SDS, MS-External, or Integrated Service; component Actual plan deltas are added by breakdown. | Forecast detail maps `MS View`, `SX View`, `SDS`, `iTraMs`, and `BD`/`GS`/`SO` pages. | Actual Worldwide capacity includes onsite and offshore; entity actual capacity includes offshore only. Current forecast detail sums Offshore, Onsite, and Outsourcing, causing an India basis mismatch. |

### Breakdown mapping

For Actual facts, the classification priority is:

1. `split_itrams_sds = 'SDS'` or `new_service_area = 'SDS'` → **SDS**
2. `split_itrams_sds` is `CONNECTED MOBILITY SOLUTIONS`, `MOBILITY SOLUTIONS EXTERNAL`, or `ITRAMS` → **MS-External**
3. `project_gb` is `BD`, `GS`, or `SO` → **Integrated Service**
4. `new_service_area = 'SX'` → **MM**
5. `new_service_area = 'MS'` → **MS**

Actual plan component deltas map `MS View` → MS, `SX View`/`NE-MM` → MM, GB `SDS` → SDS, and GB `BD`/`GS`/`SO` → Integrated Service. For non-Worldwide scopes, the current GB-specific Actual-delta SQL permits any page (`TRUE`); restricting those rows to `ENTITY VIEW` would prevent duplicate component deltas if the same GB appears on multiple pages.

Forecast breakdowns map `MS View` → MS, `SX View` → MM, `SDS` → SDS, `iTraMs` → MS-External, and `BD`/`GS`/`SO` → Integrated Service. Within each forecast page, a total row is preferred when present; otherwise the query sums detail rows.

## July 2026 database results by entity

Actual and Forecast are shown separately. Utilization values are percentages. A dash is `NULL` in the report result, not zero.

### World Wide

| Metric | SQL/source fields | Actual | Forecast | Reference / note |
|---|---|---:|---:|---|
| Revenue total | `amount_usd`; plan `cost_value`/`delta_value` | 915.90 mUSD | 892.30 mUSD | Matches the displayed 915.9 / 892.3 mUSD. |
| Revenue breakdown: MS / MM / SDS / MS-External / Integrated Service | `amount_usd`; plan Budget rows | 612.28 / 56.10 / 58.93 / 19.08 / 166.67 mUSD | 605.44 / 54.35 / 54.69 / 19.90 / 154.53 mUSD | Current report breakdown values. |
| Internal utilization: overall / MS / MM | `billed_capacity` and internal denominator fields | 94.7% / 94.7% / 94.2% | — | Compared reference: 95.1% / 95.2% / 92.5%. |
| External utilization: overall / MS / MM | `billed_capacity` and payable denominator fields | 100.8% / 100.6% / 102.3% | — | Compared reference: 100.7% / 100.8% / 99.5%. |
| Capacity total | Fact `capacity` + top-level Actual delta; plan capacity | 31,541.62 HC | **115 HC** | Actual matches displayed 31,542 HC. The selected YTD Forecast source row is **31,440.77 HC**; the report's 115 is an Actual-plan-row selection error. |
| Capacity breakdown: MS / MM / SDS / MS-External / Integrated Service | Fact `capacity` + component Actual deltas; scenario `cost_value` details | 20,088.25 / 1,870.54 / 2,158.51 / — / 7,141.50 HC | 20,200.89 / 1,843.11 / 2,071.00 / 221.67 / 7,030.10 HC | Forecast components are returned from the scenario detail query; the total forecast is not consistent with them because of the Actual-row precedence above. |

### India / BGSW

| Metric | SQL/source fields | Actual | Forecast | Reference / note |
|---|---|---:|---:|---|
| Revenue total | `amount_usd`; plan `cost_value`/`delta_value` | 742.51 mUSD | 721.87 mUSD | Rounds to displayed 743 / 722 mUSD. |
| Revenue breakdown: MS / MM / SDS / MS-External / Integrated Service | `amount_usd`; plan Budget rows | 507.00 / 42.33 / 37.75 / 14.38 / 138.24 mUSD | 499.27 / 40.86 / 36.46 / 14.77 / 126.91 mUSD | Current report breakdown values. |
| Internal utilization: overall / MS / MM | `billed_capacity` and internal denominator fields | 94.6% / 94.6% / 93.8% | — | Screenshot reference: 95.1% / 95.2% / 93.5%. |
| External utilization: overall / MS / MM | `billed_capacity` and payable denominator fields | 100.2% / 100.1% / 101.4% | — | Screenshot reference: 100.3% / 100.3% / 100.1%. |
| Capacity total | Fact `capacity` + top-level Actual delta; plan capacity | 26,568.58 HC | **−27 HC** | Actual rounds to the reference 26,569 HC. Reference Forecast is 26,353 HC. |
| Capacity breakdown: MS / MM / SDS / MS-External / Integrated Service | Fact `capacity` + component Actual deltas; scenario `cost_value` details | 16,948.91 / 1,428.32 / 1,947.80 / — / 5,960.73 HC | 17,091.61 / 1,407.81 / 1,850.74 / 219.67 / 5,801.50 HC | Reference: Actual MS/MM/SDS/Integrated = 16,949 / 1,428 / 1,948 / 5,961; Forecast = 17,003 / 1,404 / 1,851 / 5,802. MS/MM forecast excess is onsite: 88.36 + 4.00 HC. |

### Vietnam / BGSV

| Metric | SQL/source fields | Actual | Forecast | Reference / note |
|---|---|---:|---:|---|
| Revenue total | `amount_usd`; plan `cost_value`/`delta_value` | 112.45 mUSD | 111.87 mUSD | Matches the compared 112.4 / 111.9 mUSD. |
| Revenue breakdown: MS / MM / SDS / MS-External / Integrated Service | `amount_usd`; plan Budget rows | 74.76 / 6.75 / 2.32 / — / 28.62 mUSD | 74.89 / 6.88 / 2.48 / 0 / 27.62 mUSD | Current report breakdown values. |
| Internal utilization: overall / MS / MM | `billed_capacity` and internal denominator fields | 95.8% / 95.7% / 96.9% | — | Compared reference: 95.7% / 95.8% / 93.9%. |
| External utilization: overall / MS / MM | `billed_capacity` and payable denominator fields | 103.7% / 103.8% / 103.2% | — | Compared reference: 103.3% / 108.3% / 96.7%. |
| Capacity total | Fact `capacity` + top-level Actual delta; scenario capacity | 4,033.91 HC | 4,126.44 HC | Current report/database result. |
| Capacity breakdown: MS / MM / SDS / MS-External / Integrated Service | Fact `capacity` + component Actual deltas; scenario `cost_value` details | 2,504.17 / 243.81 / 110.93 / — / 1,175.00 HC | 2,536.28 / 273.30 / 88.26 / 0 / 1,228.60 HC | Current report/database result. |

### Mexico / NE-MX

| Metric | SQL/source fields | Actual | Forecast | Reference / note |
|---|---|---:|---:|---|
| Revenue total | `amount_usd`; plan `cost_value`/`delta_value` | 29.89 mUSD | 28.83 mUSD | Matches the compared 29.9 / 28.8 mUSD. |
| Revenue breakdown: MS / MM / SDS / MS-External / Integrated Service | `amount_usd`; plan Budget rows | 21.70 / 7.49 / 0.70 / — / — mUSD | 21.88 / 5.94 / 1.01 / 0 / 0 mUSD | Current report breakdown values. |
| Internal utilization: overall / MS / MM | `billed_capacity` and internal denominator fields | 92.2% / 91.8% / 94.0% | — | Compared reference: 92.2% / 92.0% / 93.3%. |
| External utilization: overall / MS / MM | `billed_capacity` and payable denominator fields | — / — / — | — | No matching external rows in this scope. |
| Capacity total | Fact `capacity` + top-level Actual delta; scenario capacity | 634.75 HC | 627.00 HC | Current report/database result. |
| Capacity breakdown: MS / MM / SDS / MS-External / Integrated Service | Fact `capacity` + component Actual deltas; scenario `cost_value` details | 454.49 / 160.48 / 21.78 / — / — HC | 464.00 / 136.00 / 27.00 / 0 / 0 HC | Current report/database result. |

## Returned data shape

The service exposes these metric definitions:

| `id` | `label` | `unit` |
|---|---|---|
| `revenue` | Budget / Revenue | `mUSD` |
| `internal_utilization` | Internal Utilization | `percent` |
| `external_utilization` | External Utilization | `percent` |
| `capacity` | Capacity | `capacity` |

Each metric result includes:

| Field | Meaning |
|---|---|
| `actual` | Current-period Actual result. |
| `forecast` | Selected-scenario result; null for utilization. |
| `variance` | `actual - forecast`; null if either is absent or the metric is utilization. |
| `variancePercent` | `variance / forecast` when forecast is nonzero. |
| `actualSourceRows` | Count of matching Actual source rows. |
| `forecastSourceRows` | Count of matching forecast rows; zero for utilization. |
| `breakdowns` | MS, MM, SDS, MS-External, Integrated Service values, when available. |
| `comparisons.priorYearActual` | Same month in previous year. |
| `comparisons.previousMonthActual` | Previous calendar month. |

`valueOrNull()` returns null when the query reports zero matching rows. A zero numeric value with matching rows remains zero.

## Confirmed query/data discrepancies

1. **Top-line Forecast uses Actual rows first.** The aggregate forecast SQL applies `COALESCE(Actual-plan sum, selected-scenario sum)`. In July, Worldwide Actual plan rows sum to 115 HC and BGSW Actual plan rows sum to −27 HC, replacing the selected forecast.
2. **India forecast includes onsite.** The entity scenario total is 26,445.33 HC; its onsite component is 92.36 HC. Removing onsite gives 26,352.97 HC, the screenshot's 26,353 HC. The MS/MM detail forecast currently includes onsite too.
3. **Utilization does not match the reference calculation.** The values above reproduce the current service's formula and source rows; the screenshot's alternative formula/population is not encoded in this service.
4. **Historical utilization inputs are absent.** The selected cube has no fact rows for July 2025 or June 2026, so the service returns null for those comparisons.
5. **Revenue matches at the displayed precision.** July 2026 total actual/forecast values align with the screenshot after rounding.

This file documents the current service and the observed July 2026 output. No application SQL or behavior was changed while preparing it.