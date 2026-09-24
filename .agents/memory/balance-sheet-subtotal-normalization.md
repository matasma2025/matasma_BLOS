---
name: Balance Sheet subtotal normalization
description: Durable rules for turning detailed Balance Sheet workbooks into reference-style category totals.
---

Retain subtotal rows during workbook ingestion. Use statement subtotals for total assets, liabilities, equity, and reference categories; use leaf rows only for account movement detail.

**Why:** The workbook contains both leaf accounts and overlapping subtotal labels. Dropping subtotals removes major reference lines, while summing alternative subtotal labels such as trade payables and trade payables-and-notes-payable double-counts the same balance.

For the reference Balance Sheet's debt-to-equity metric, define debt as total liabilities, not borrowings-only accounts. This keeps the calculated leverage ratio aligned with the report's comparison.

**Why:** The workbook's reference ratios (0.71 and 0.78) use total liabilities divided by equity, even though the borrowing accounts are zero.

**How to apply:** For mutually exclusive alternatives, select the first available subtotal; for genuinely separate components, sum each named subtotal. Keep the reference category order, derive residual current/noncurrent lines from statement totals, and use total liabilities consistently in current and historical debt-to-equity comparisons.