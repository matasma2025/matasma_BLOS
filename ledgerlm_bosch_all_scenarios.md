# LedgerLM — Complete Test Question Bank for Bosch UAT
**Data in Bosch environment:** Jan 2025 – Dec 2025 (full year) + Jan 2026 – Mar 2026  
**Format:** Paste table into Excel → Data → From Text/CSV → Tab delimited

---

## How to paste into Excel
1. Open this file in any text editor  
2. Select the table below (starting from the header row)  
3. Paste into Excel cell A1 — columns will auto-split on the tab characters  

---

| S.No | Section | Sub-Category | Question | Date Period | Metric / Expected Intent |
|------|---------|-------------|----------|------------|--------------------------|
| **— SECTION 1: REVENUE —** | | | | | |
| 1 | Revenue | Auto Date | Show me revenue | Latest available | Revenue (auto-defaults to latest year) |
| 2 | Revenue | Full Year | Show me revenue for 2025 | Jan–Dec 2025 | Revenue YTD full year |
| 3 | Revenue | Full Year | Show me revenue for 2026 | Jan–Mar 2026 | Revenue YTD partial year |
| 4 | Revenue | By Month | Show me revenue by month for 2025 | Jan–Dec 2025 | Revenue per month (12 rows) |
| 5 | Revenue | By Month | Show me revenue by month for 2026 | Jan–Mar 2026 | Revenue per month (3 rows) |
| 6 | Revenue | Specific Month | Show me revenue for January 2025 | Jan 2025 | Revenue single month |
| 7 | Revenue | Specific Month | Show me revenue for March 2025 | Mar 2025 | Revenue single month |
| 8 | Revenue | Specific Month | Show me revenue for June 2025 | Jun 2025 | Revenue single month |
| 9 | Revenue | Specific Month | Show me revenue for September 2025 | Sep 2025 | Revenue single month |
| 10 | Revenue | Specific Month | Show me revenue for December 2025 | Dec 2025 | Revenue single month |
| 11 | Revenue | Specific Month | Show me revenue for January 2026 | Jan 2026 | Revenue single month |
| 12 | Revenue | Specific Month | Show me revenue for February 2026 | Feb 2026 | Revenue single month |
| 13 | Revenue | Specific Month | Show me revenue for March 2026 | Mar 2026 | Revenue single month |
| 14 | Revenue | Month Range | Show me revenue from January to March 2025 | Jan–Mar 2025 | Revenue Q1 2025 |
| 15 | Revenue | Month Range | Show me revenue from April to June 2025 | Apr–Jun 2025 | Revenue Q2 2025 |
| 16 | Revenue | Month Range | Show me revenue from July to September 2025 | Jul–Sep 2025 | Revenue Q3 2025 |
| 17 | Revenue | Month Range | Show me revenue from October to December 2025 | Oct–Dec 2025 | Revenue Q4 2025 |
| 18 | Revenue | Month Range | Show me revenue from January to March 2026 | Jan–Mar 2026 | Revenue Q1 2026 |
| 19 | Revenue | Month Range | Show me revenue from January to June 2025 | Jan–Jun 2025 | Revenue H1 2025 |
| 20 | Revenue | Month Range | Show me revenue from July to December 2025 | Jul–Dec 2025 | Revenue H2 2025 |
| 21 | Revenue | Quarter | Show me revenue for Q1 2025 | Jan–Mar 2025 | Revenue quarterly |
| 22 | Revenue | Quarter | Show me revenue for Q2 2025 | Apr–Jun 2025 | Revenue quarterly |
| 23 | Revenue | Quarter | Show me revenue for Q3 2025 | Jul–Sep 2025 | Revenue quarterly |
| 24 | Revenue | Quarter | Show me revenue for Q4 2025 | Oct–Dec 2025 | Revenue quarterly |
| 25 | Revenue | Quarter | Show me revenue for Q1 2026 | Jan–Mar 2026 | Revenue quarterly |
| 26 | Revenue | By Planning GB | Show me revenue by planning GB for 2025 | Jan–Dec 2025 | Revenue grouped by planning GB |
| 27 | Revenue | By Planning GB | Show me revenue by planning GB for Q1 2026 | Jan–Mar 2026 | Revenue grouped by planning GB |
| 28 | Revenue | By Project GB | Show me revenue by project GB for 2025 | Jan–Dec 2025 | Revenue grouped by project GB |
| 29 | Revenue | By Project GB | Show me revenue by project GB for Q1 2026 | Jan–Mar 2026 | Revenue grouped by project GB |
| 30 | Revenue | Onsite / Offshore | Show me onsite and offshore revenue for 2025 | Jan–Dec 2025 | Revenue split by location type |
| 31 | Revenue | Onsite / Offshore | Show me onsite and offshore revenue for Q1 2026 | Jan–Mar 2026 | Revenue split by location type |
| 32 | Revenue | By SDS | Show me revenue by SDS for 2025 | Jan–Dec 2025 | Revenue grouped by SDS dimension |
| 33 | Revenue | By SDS | Show me revenue by SDS for Q1 2026 | Jan–Mar 2026 | Revenue grouped by SDS dimension |
| 34 | Revenue | By Org Level | Show me revenue by organization level for 2025 | Jan–Dec 2025 | Revenue by org level dimension |
| 35 | Revenue | Fixed Price / T&M | Show me fixed price and T&M revenue for 2025 | Jan–Dec 2025 | Revenue by revenue type |
| 36 | Revenue | Fixed Price / T&M | Show me fixed price and T&M revenue for Q1 2026 | Jan–Mar 2026 | Revenue by revenue type |
| 37 | Revenue | By Month + Planning GB | Show me revenue by month and planning GB for 2025 | Jan–Dec 2025 | Revenue with month + planning GB group-by |
| 38 | Revenue | MoM | Show me month on month revenue for 2025 | Jan–Dec 2025 | Revenue MoM with growth % (LAG window) |
| 39 | Revenue | MoM | Show me month on month revenue from January to March 2026 | Jan–Mar 2026 | Revenue MoM with growth % |
| 40 | Revenue | MoM | Show me month on month revenue for Q2 2025 | Apr–Jun 2025 | Revenue MoM Q2 2025 |
| 41 | Revenue | MoM | Show me month on month revenue for Q4 2025 | Oct–Dec 2025 | Revenue MoM Q4 2025 |
| 42 | Revenue | MoM | Revenue MoM by planning GB for 2025 | Jan–Dec 2025 | Revenue MoM grouped by planning GB |
| 43 | Revenue | Avg Monthly | Show me average monthly revenue for 2025 | Jan–Dec 2025 | Revenue ÷ 12 months |
| 44 | Revenue | Avg Monthly | Show me average monthly revenue for Q1 2026 | Jan–Mar 2026 | Revenue ÷ 3 months |
| 45 | Revenue | Last N Months | Show me revenue for the last 3 months | Last 3 months from latest | Revenue last 3 months |
| 46 | Revenue | Last N Months | Show me revenue for the last 6 months | Last 6 months from latest | Revenue last 6 months |
| 47 | Revenue | Last N Months | Show me revenue for the last 12 months | Last 12 months from latest | Revenue last 12 months |
| 48 | Revenue | YoY Comparison | Show me revenue 2025 vs 2026 | 2025 vs 2026 | Year-over-year comparison |
| 49 | Revenue | YoY Comparison | Show me revenue January 2025 versus January 2026 | Jan 2025 vs Jan 2026 | Month vs same month prior year |
| 50 | Revenue | YoY Comparison | Show me revenue February 2025 versus February 2026 | Feb 2025 vs Feb 2026 | Month vs same month prior year |
| 51 | Revenue | YoY Comparison | Show me revenue March 2025 versus March 2026 | Mar 2025 vs Mar 2026 | Month vs same month prior year |
| 52 | Revenue | YoY Comparison | Compare revenue Q1 2025 versus Q1 2026 | Q1 2025 vs Q1 2026 | Quarterly YoY |
| **— SECTION 2: GB P&L —** | | | | | |
| 53 | GB P&L | Auto Date | Show me GB P&L | Latest available | GB P&L cost breakdown (auto-date) |
| 54 | GB P&L | Full Year | Show me GB P&L for 2025 | Jan–Dec 2025 | GB P&L full year |
| 55 | GB P&L | Full Year | Show me GB P&L for 2026 | Jan–Mar 2026 | GB P&L partial year |
| 56 | GB P&L | By Month | Show me GB P&L by month for 2025 | Jan–Dec 2025 | GB P&L per month |
| 57 | GB P&L | By Month | Show me GB P&L by month for 2026 | Jan–Mar 2026 | GB P&L per month |
| 58 | GB P&L | Specific Month | Show me GB P&L for January 2025 | Jan 2025 | GB P&L single month |
| 59 | GB P&L | Specific Month | Show me GB P&L for June 2025 | Jun 2025 | GB P&L single month |
| 60 | GB P&L | Specific Month | Show me GB P&L for December 2025 | Dec 2025 | GB P&L single month |
| 61 | GB P&L | Specific Month | Show me GB P&L for January 2026 | Jan 2026 | GB P&L single month |
| 62 | GB P&L | Specific Month | Show me GB P&L for March 2026 | Mar 2026 | GB P&L single month |
| 63 | GB P&L | Month Range | Show me GB P&L from January to March 2025 | Jan–Mar 2025 | GB P&L Q1 2025 |
| 64 | GB P&L | Month Range | Show me GB P&L from April to June 2025 | Apr–Jun 2025 | GB P&L Q2 2025 |
| 65 | GB P&L | Month Range | Show me GB P&L from July to September 2025 | Jul–Sep 2025 | GB P&L Q3 2025 |
| 66 | GB P&L | Month Range | Show me GB P&L from October to December 2025 | Oct–Dec 2025 | GB P&L Q4 2025 |
| 67 | GB P&L | Month Range | Show me GB P&L from January to March 2026 | Jan–Mar 2026 | GB P&L Q1 2026 |
| 68 | GB P&L | Month Range | Show me GB P&L from January to June 2025 | Jan–Jun 2025 | GB P&L H1 2025 |
| 69 | GB P&L | Month Range | Show me GB P&L from July to December 2025 | Jul–Dec 2025 | GB P&L H2 2025 |
| 70 | GB P&L | Quarter | Show me GB P&L for Q1 2025 | Jan–Mar 2025 | GB P&L quarterly |
| 71 | GB P&L | Quarter | Show me GB P&L for Q2 2025 | Apr–Jun 2025 | GB P&L quarterly |
| 72 | GB P&L | Quarter | Show me GB P&L for Q3 2025 | Jul–Sep 2025 | GB P&L quarterly |
| 73 | GB P&L | Quarter | Show me GB P&L for Q4 2025 | Oct–Dec 2025 | GB P&L quarterly |
| 74 | GB P&L | Quarter | Show me GB P&L for Q1 2026 | Jan–Mar 2026 | GB P&L quarterly |
| 75 | GB P&L | By Planning GB | Show me GB P&L by planning GB for 2025 | Jan–Dec 2025 | GB P&L grouped by planning GB |
| 76 | GB P&L | By Planning GB | Show me GB P&L by planning GB for Q1 2026 | Jan–Mar 2026 | GB P&L grouped by planning GB |
| 77 | GB P&L | By Project GB | Show me GB P&L by project GB for 2025 | Jan–Dec 2025 | GB P&L grouped by project GB |
| 78 | GB P&L | MoM | Show me month on month GB P&L for 2025 | Jan–Dec 2025 | GB P&L MoM with growth % |
| 79 | GB P&L | MoM | Show me month on month GB P&L from January to March 2026 | Jan–Mar 2026 | GB P&L MoM Q1 2026 |
| 80 | GB P&L | MoM | GB P&L MoM for Q3 2025 | Jul–Sep 2025 | GB P&L MoM Q3 2025 |
| 81 | GB P&L | Avg Monthly | Show me average monthly GB P&L for 2025 | Jan–Dec 2025 | GB P&L ÷ 12 months |
| 82 | GB P&L | Avg Monthly | Show me average monthly GB P&L for Q1 2026 | Jan–Mar 2026 | GB P&L ÷ 3 months |
| 83 | GB P&L | YoY Comparison | Show me GB P&L 2025 versus 2026 | 2025 vs 2026 | GB P&L year comparison |
| 84 | GB P&L | YoY Comparison | Compare GB P&L January 2025 versus January 2026 | Jan 2025 vs Jan 2026 | GB P&L month comparison |
| **— SECTION 3: ENTITY P&L —** | | | | | |
| 85 | Entity P&L | Auto Date | Show me entity P&L | Latest available | Entity P&L all categories (auto-date) |
| 86 | Entity P&L | Full Year | Show me entity P&L for 2025 | Jan–Dec 2025 | Entity P&L full year |
| 87 | Entity P&L | Full Year | Show me entity P&L for 2026 | Jan–Mar 2026 | Entity P&L partial year |
| 88 | Entity P&L | By Month | Show me entity P&L by month for 2025 | Jan–Dec 2025 | Entity P&L per month |
| 89 | Entity P&L | By Month | Show me entity P&L by month for 2026 | Jan–Mar 2026 | Entity P&L per month |
| 90 | Entity P&L | Specific Month | Show me entity P&L for January 2025 | Jan 2025 | Entity P&L single month |
| 91 | Entity P&L | Specific Month | Show me entity P&L for June 2025 | Jun 2025 | Entity P&L single month |
| 92 | Entity P&L | Specific Month | Show me entity P&L for December 2025 | Dec 2025 | Entity P&L single month |
| 93 | Entity P&L | Specific Month | Show me entity P&L for March 2026 | Mar 2026 | Entity P&L single month |
| 94 | Entity P&L | Month Range | Show me entity P&L from January to March 2025 | Jan–Mar 2025 | Entity P&L Q1 2025 |
| 95 | Entity P&L | Month Range | Show me entity P&L from April to June 2025 | Apr–Jun 2025 | Entity P&L Q2 2025 |
| 96 | Entity P&L | Month Range | Show me entity P&L from July to September 2025 | Jul–Sep 2025 | Entity P&L Q3 2025 |
| 97 | Entity P&L | Month Range | Show me entity P&L from October to December 2025 | Oct–Dec 2025 | Entity P&L Q4 2025 |
| 98 | Entity P&L | Month Range | Show me entity P&L from January to March 2026 | Jan–Mar 2026 | Entity P&L Q1 2026 |
| 99 | Entity P&L | Quarter | Show me entity P&L for Q1 2025 | Jan–Mar 2025 | Entity P&L quarterly |
| 100 | Entity P&L | Quarter | Show me entity P&L for Q2 2025 | Apr–Jun 2025 | Entity P&L quarterly |
| 101 | Entity P&L | Quarter | Show me entity P&L for Q3 2025 | Jul–Sep 2025 | Entity P&L quarterly |
| 102 | Entity P&L | Quarter | Show me entity P&L for Q4 2025 | Oct–Dec 2025 | Entity P&L quarterly |
| 103 | Entity P&L | Quarter | Show me entity P&L for Q1 2026 | Jan–Mar 2026 | Entity P&L quarterly |
| 104 | Entity P&L | Category – Revenue | Show me entity P&L revenue for 2025 | Jan–Dec 2025 | Entity P&L → Revenue category |
| 105 | Entity P&L | Category – Employee Benefit | Show me entity P&L employee benefit for 2025 | Jan–Dec 2025 | Entity P&L → Employee Benefit |
| 106 | Entity P&L | Category – Outsourcing Cost | Show me entity P&L outsourcing cost for 2025 | Jan–Dec 2025 | Entity P&L → Outsourcing cost |
| 107 | Entity P&L | Category – Travel Expenses | Show me entity P&L travel expenses for 2025 | Jan–Dec 2025 | Entity P&L → Travel expenses |
| 108 | Entity P&L | Category – Facility Cost | Show me entity P&L facility cost for 2025 | Jan–Dec 2025 | Entity P&L → Facility Cost |
| 109 | Entity P&L | Category – Welfare Cost | Show me entity P&L welfare cost for 2025 | Jan–Dec 2025 | Entity P&L → Welfare Cost |
| 110 | Entity P&L | Category – Depreciation | Show me entity P&L depreciation for 2025 | Jan–Dec 2025 | Entity P&L → Depreciation |
| 111 | Entity P&L | Category – Material Cost | Show me entity P&L material cost for 2025 | Jan–Dec 2025 | Entity P&L → Material cost |
| 112 | Entity P&L | Category – Other Expenses | Show me entity P&L other expenses for 2025 | Jan–Dec 2025 | Entity P&L → Other Expenses |
| 113 | Entity P&L | Category – Consultancy | Show me entity P&L consultancy charges for 2025 | Jan–Dec 2025 | Entity P&L → Consultancy Charges |
| 114 | Entity P&L | Category – Revenue Hardware | Show me entity P&L revenue hardware for 2025 | Jan–Dec 2025 | Entity P&L → Revenue Hardware |
| 115 | Entity P&L | Category – Revenue Software | Show me entity P&L revenue software for 2025 | Jan–Dec 2025 | Entity P&L → Revenue Software |
| 116 | Entity P&L | MoM | Show me month on month entity P&L for 2025 | Jan–Dec 2025 | Entity P&L MoM with growth % |
| 117 | Entity P&L | MoM | Show me month on month entity P&L from January to March 2026 | Jan–Mar 2026 | Entity P&L MoM Q1 2026 |
| 118 | Entity P&L | MoM | Show me month by month entity P&L for Q2 2025 | Apr–Jun 2025 | Entity P&L MoM Q2 2025 |
| 119 | Entity P&L | Avg Monthly | Show me average monthly entity P&L for 2025 | Jan–Dec 2025 | Entity P&L ÷ 12 months |
| 120 | Entity P&L | YoY Comparison | Show me entity P&L 2025 vs 2026 | 2025 vs 2026 | Entity P&L year comparison |
| 121 | Entity P&L | YoY Comparison | Compare entity P&L January 2025 versus January 2026 | Jan 2025 vs Jan 2026 | Entity P&L month YoY |
| **— SECTION 4: HEADCOUNT —** | | | | | |
| 122 | Headcount | Auto Date | Show me headcount | Latest available | Headcount (auto-date) |
| 123 | Headcount | Full Year | Show me headcount for 2025 | Jan–Dec 2025 | Headcount full year |
| 124 | Headcount | Full Year | Show me headcount for 2026 | Jan–Mar 2026 | Headcount partial year |
| 125 | Headcount | By Month | Show me headcount by month for 2025 | Jan–Dec 2025 | Headcount per month |
| 126 | Headcount | By Month | Show me headcount by month for 2026 | Jan–Mar 2026 | Headcount per month |
| 127 | Headcount | Specific Month | Show me headcount for January 2025 | Jan 2025 | Headcount single month |
| 128 | Headcount | Specific Month | Show me headcount for June 2025 | Jun 2025 | Headcount single month |
| 129 | Headcount | Specific Month | Show me headcount for December 2025 | Dec 2025 | Headcount single month |
| 130 | Headcount | Specific Month | Show me headcount for March 2026 | Mar 2026 | Headcount single month |
| 131 | Headcount | Quarter | Show me headcount for Q1 2025 | Jan–Mar 2025 | Headcount quarterly |
| 132 | Headcount | Quarter | Show me headcount for Q4 2025 | Oct–Dec 2025 | Headcount quarterly |
| 133 | Headcount | Quarter | Show me headcount for Q1 2026 | Jan–Mar 2026 | Headcount quarterly |
| 134 | Headcount | MoM | Show me month on month headcount for 2025 | Jan–Dec 2025 | Headcount MoM with growth % |
| 135 | Headcount | MoM | Show me month on month headcount from January to March 2026 | Jan–Mar 2026 | Headcount MoM Q1 2026 |
| 136 | Headcount | YoY Comparison | Compare headcount 2025 and 2026 | 2025 vs 2026 | Headcount year comparison |
| 137 | Headcount | YoY Comparison | Show me headcount January 2025 versus January 2026 | Jan 2025 vs Jan 2026 | Headcount month YoY |
| **— SECTION 5: BILLING UTILIZATION —** | | | | | |
| 138 | Billing Utilization | Auto Date | Show me billing utilization | Latest available | Billing Util % (auto-date) |
| 139 | Billing Utilization | Full Year | Show me billing utilization for 2025 | Jan–Dec 2025 | Billing Util % full year |
| 140 | Billing Utilization | Full Year | Show me billing utilization for 2026 | Jan–Mar 2026 | Billing Util % partial year |
| 141 | Billing Utilization | By Month | Show me billing utilization by month for 2025 | Jan–Dec 2025 | Billing Util % per month |
| 142 | Billing Utilization | Quarter | Show me billing utilization for Q1 2025 | Jan–Mar 2025 | Billing Util % quarterly |
| 143 | Billing Utilization | Quarter | Show me billing utilization for Q3 2025 | Jul–Sep 2025 | Billing Util % quarterly |
| 144 | Billing Utilization | Quarter | Show me billing utilization for Q1 2026 | Jan–Mar 2026 | Billing Util % quarterly |
| 145 | Billing Utilization | MoM | Show me month on month billing utilization for 2025 | Jan–Dec 2025 | Billing Util MoM trend |
| 146 | Billing Utilization | YoY | Compare billing utilization 2025 vs 2026 | 2025 vs 2026 | Billing Util YoY |
| 147 | SX Internal Utilization | Full Year | Show me SX internal utilization for 2025 | Jan–Dec 2025 | SX Internal Util % (SX + Internal resource) |
| 148 | SX Internal Utilization | Quarter | Show me SX internal utilization for Q1 2026 | Jan–Mar 2026 | SX Internal Util % quarterly |
| 149 | MS Internal Utilization | Full Year | Show me MS internal utilization for 2025 | Jan–Dec 2025 | MS Internal Util % (MS + Internal resource) |
| 150 | MS Internal Utilization | Quarter | Show me MS internal utilization for Q1 2026 | Jan–Mar 2026 | MS Internal Util % quarterly |
| 151 | SX Outsourcing Utilization | Full Year | Show me SX outsourcing utilization for 2025 | Jan–Dec 2025 | SX Outsourcing Util % (SX + External resource) |
| 152 | SX Outsourcing Utilization | Quarter | Show me SX outsourcing utilization for Q1 2026 | Jan–Mar 2026 | SX Outsourcing Util % quarterly |
| 153 | MS Outsourcing Utilization | Full Year | Show me MS outsourcing utilization for 2025 | Jan–Dec 2025 | MS Outsourcing Util % (MS + External resource) |
| 154 | MS Outsourcing Utilization | Quarter | Show me MS outsourcing utilization for Q1 2026 | Jan–Mar 2026 | MS Outsourcing Util % quarterly |
| **— SECTION 6: CAPACITY —** | | | | | |
| 155 | Total Capacity (Avg) | Full Year | Show me average total capacity for 2025 | Jan–Dec 2025 | Total Capacity Average (internal + external) |
| 156 | Total Capacity (Avg) | By Month | Show me average total capacity by month for 2025 | Jan–Dec 2025 | Total Capacity Avg per month |
| 157 | Total Capacity (Avg) | Quarter | Show me average total capacity for Q1 2026 | Jan–Mar 2026 | Total Capacity Avg quarterly |
| 158 | Total Capacity (End) | Full Year | Show me end of month total capacity for 2025 | Jan–Dec 2025 | Total Capacity End (headcount at month-end) |
| 159 | Total Capacity (End) | Quarter | Show me end of month total capacity for Q4 2025 | Oct–Dec 2025 | Total Capacity End quarterly |
| 160 | Offshore Capacity (Avg) | Full Year | Show me average offshore capacity for 2025 | Jan–Dec 2025 | Offshore Capacity Average |
| 161 | Offshore Capacity (Avg) | By Month | Show me average offshore capacity by month for 2025 | Jan–Dec 2025 | Offshore Capacity Avg per month |
| 162 | Offshore Capacity (Avg) | Quarter | Show me average offshore capacity for Q1 2026 | Jan–Mar 2026 | Offshore Capacity Avg quarterly |
| 163 | Offshore Capacity (End) | Full Year | Show me end of month offshore capacity for 2025 | Jan–Dec 2025 | Offshore Capacity End |
| 164 | Outsourcing Capacity (Avg) | Full Year | Show me average outsourcing capacity for 2025 | Jan–Dec 2025 | Outsourcing Capacity Average |
| 165 | Outsourcing Capacity (Avg) | Quarter | Show me average outsourcing capacity for Q1 2026 | Jan–Mar 2026 | Outsourcing Capacity Avg quarterly |
| 166 | Outsourcing Capacity (End) | Full Year | Show me end of month outsourcing capacity for 2025 | Jan–Dec 2025 | Outsourcing Capacity End |
| 167 | Available Capacity | Full Year | Show me available capacity for 2025 | Jan–Dec 2025 | Available Capacity (Allocated + Not Allocated + MS + VKM - Non-linear) |
| 168 | Available Capacity | By Month | Show me available capacity by month for 2025 | Jan–Dec 2025 | Available Capacity per month |
| 169 | Available Capacity | Quarter | Show me available capacity for Q1 2026 | Jan–Mar 2026 | Available Capacity quarterly |
| 170 | Internal Capacity Mix | Full Year | Show me internal capacity mix for 2025 | Jan–Dec 2025 | Internal % of total capacity |
| 171 | Internal Capacity Mix | Quarter | Show me internal capacity mix for Q1 2026 | Jan–Mar 2026 | Internal capacity mix quarterly |
| 172 | External Capacity Mix | Full Year | Show me external capacity mix for 2025 | Jan–Dec 2025 | External/outsourcing % of total capacity |
| 173 | External Capacity Mix | Quarter | Show me external capacity mix for Q1 2026 | Jan–Mar 2026 | External capacity mix quarterly |
| 174 | Capacity | MoM | Show me month on month total capacity for 2025 | Jan–Dec 2025 | Total Capacity MoM trend |
| 175 | Capacity | YoY | Compare total capacity 2025 vs 2026 | 2025 vs 2026 | Capacity YoY comparison |
| **— SECTION 7: BUDGET —** | | | | | |
| 176 | Budget WW | Full Year | Show me total WW budget for 2025 | Jan–Dec 2025 | Budget (mUSD) worldwide total |
| 177 | Budget WW | By Month | Show me total WW budget by month for 2025 | Jan–Dec 2025 | Budget WW per month |
| 178 | Budget WW | Quarter | Show me total WW budget for Q1 2026 | Jan–Mar 2026 | Budget WW quarterly |
| 179 | Budget Offshore | Full Year | Show me offshore budget for 2025 | Jan–Dec 2025 | Offshore Budget (mUSD) |
| 180 | Budget Offshore | Quarter | Show me offshore budget for Q1 2026 | Jan–Mar 2026 | Offshore Budget quarterly |
| 181 | Budget Outsourcing | Full Year | Show me outsourcing budget for 2025 | Jan–Dec 2025 | Outsourcing Budget (mUSD) |
| 182 | Budget Outsourcing | Quarter | Show me outsourcing budget for Q1 2026 | Jan–Mar 2026 | Outsourcing Budget quarterly |
| 183 | Budget per Capacity | Full Year | Show me budget per capacity for 2025 | Jan–Dec 2025 | Budget / Avg Capacity (USD) |
| 184 | Budget per Capacity | By Entity | Show me budget per capacity by entity for 2025 | Jan–Dec 2025 | Budget per Avg Capacity by region entity |
| 185 | Budget per Capacity | Quarter | Show me budget per capacity for Q1 2026 | Jan–Mar 2026 | Budget / Avg Capacity quarterly |
| 186 | Budget per Capacity | YoY | Compare budget per capacity 2025 vs 2026 | 2025 vs 2026 | Budget per Capacity YoY |
| **— SECTION 8: EBIT —** | | | | | |
| 187 | EBIT | Auto Date | Show me EBIT | Latest available | EBIT = Revenue − (Direct + Indirect Cost) |
| 188 | EBIT | Full Year | Show me EBIT for 2025 | Jan–Dec 2025 | EBIT full year |
| 189 | EBIT | Full Year | Show me EBIT for 2026 | Jan–Mar 2026 | EBIT partial year |
| 190 | EBIT | By Month | Show me EBIT by month for 2025 | Jan–Dec 2025 | EBIT per month |
| 191 | EBIT | Specific Month | Show me EBIT for January 2025 | Jan 2025 | EBIT single month |
| 192 | EBIT | Specific Month | Show me EBIT for March 2026 | Mar 2026 | EBIT single month |
| 193 | EBIT | Quarter | Show me EBIT for Q1 2025 | Jan–Mar 2025 | EBIT Q1 2025 |
| 194 | EBIT | Quarter | Show me EBIT for Q4 2025 | Oct–Dec 2025 | EBIT Q4 2025 |
| 195 | EBIT | Quarter | Show me EBIT for Q1 2026 | Jan–Mar 2026 | EBIT Q1 2026 |
| 196 | EBIT | MoM | Show me month on month EBIT for 2025 | Jan–Dec 2025 | EBIT MoM trend |
| 197 | EBIT | YoY Comparison | Show me EBIT 2025 versus 2026 | 2025 vs 2026 | EBIT YoY comparison |
| 198 | EBIT | YoY Comparison | Show me EBIT January 2025 versus January 2026 | Jan 2025 vs Jan 2026 | EBIT month YoY |
| **— SECTION 9: GROSS MARGIN —** | | | | | |
| 199 | Gross Margin | Auto Date | Show me gross margin | Latest available | Gross Margin = Revenue − Direct − Indirect Cost |
| 200 | Gross Margin | Full Year | Show me gross margin for 2025 | Jan–Dec 2025 | Gross Margin full year |
| 201 | Gross Margin | Full Year | Show me gross margin for 2026 | Jan–Mar 2026 | Gross Margin partial year |
| 202 | Gross Margin | By Month | Show me gross margin by month for 2025 | Jan–Dec 2025 | Gross Margin per month |
| 203 | Gross Margin | Quarter | Show me gross margin for Q1 2025 | Jan–Mar 2025 | Gross Margin Q1 2025 |
| 204 | Gross Margin | Quarter | Show me gross margin for Q2 2025 | Apr–Jun 2025 | Gross Margin Q2 2025 |
| 205 | Gross Margin | Quarter | Show me gross margin for Q1 2026 | Jan–Mar 2026 | Gross Margin Q1 2026 |
| 206 | Gross Margin | MoM | Show me month on month gross margin for 2025 | Jan–Dec 2025 | Gross Margin MoM trend |
| 207 | Gross Margin | YoY Comparison | Show me gross margin 2025 versus 2026 | 2025 vs 2026 | Gross Margin YoY |
| **— SECTION 10: COST METRICS —** | | | | | |
| 208 | Direct Cost | Auto Date | Show me direct cost | Latest available | Direct Cost (auto-date) |
| 209 | Direct Cost | Full Year | Show me direct cost for 2025 | Jan–Dec 2025 | Direct Cost = Resource + Travel + Other Direct |
| 210 | Direct Cost | Full Year | Show me direct cost for 2026 | Jan–Mar 2026 | Direct Cost partial year |
| 211 | Direct Cost | By Month | Show me direct cost by month for 2025 | Jan–Dec 2025 | Direct Cost per month |
| 212 | Direct Cost | Quarter | Show me direct cost for Q1 2025 | Jan–Mar 2025 | Direct Cost quarterly |
| 213 | Direct Cost | Quarter | Show me direct cost for Q1 2026 | Jan–Mar 2026 | Direct Cost quarterly |
| 214 | Direct Cost | MoM | Show me month on month direct cost for 2025 | Jan–Dec 2025 | Direct Cost MoM trend |
| 215 | Direct Cost | YoY | Compare direct cost 2025 vs 2026 | 2025 vs 2026 | Direct Cost YoY |
| 216 | Resource Cost | Auto Date | Show me resource cost | Latest available | Resource Cost (auto-date) |
| 217 | Resource Cost | Full Year | Show me resource cost for 2025 | Jan–Dec 2025 | Resource Cost full year |
| 218 | Resource Cost | Full Year | Show me resource cost for 2026 | Jan–Mar 2026 | Resource Cost partial year |
| 219 | Resource Cost | By Month | Show me resource cost by month for 2025 | Jan–Dec 2025 | Resource Cost per month |
| 220 | Resource Cost | Month Range | Show me resource cost from January to March 2026 | Jan–Mar 2026 | Resource Cost Q1 2026 |
| 221 | Resource Cost | Quarter | Show me resource cost for Q3 2025 | Jul–Sep 2025 | Resource Cost Q3 2025 |
| 222 | Resource Cost | MoM | Show me month on month resource cost for 2025 | Jan–Dec 2025 | Resource Cost MoM |
| 223 | Resource Cost | Avg Monthly | Show me average monthly resource cost for 2025 | Jan–Dec 2025 | Resource Cost ÷ 12 months |
| 224 | Travel Cost | Auto Date | Show me travel cost | Latest available | Travel Cost (auto-date) |
| 225 | Travel Cost | Full Year | Show me travel cost for 2025 | Jan–Dec 2025 | Travel Cost full year |
| 226 | Travel Cost | Full Year | Show me travel cost for 2026 | Jan–Mar 2026 | Travel Cost partial year |
| 227 | Travel Cost | By Month | Show me travel cost by month for 2025 | Jan–Dec 2025 | Travel Cost per month |
| 228 | Travel Cost | Quarter | Show me travel cost for Q1 2026 | Jan–Mar 2026 | Travel Cost quarterly |
| 229 | Travel Cost | MoM | Show me month on month travel cost for 2025 | Jan–Dec 2025 | Travel Cost MoM trend |
| 230 | Other Direct Cost | Full Year | Show me other direct cost for 2025 | Jan–Dec 2025 | Other Direct Cost full year |
| 231 | Other Direct Cost | Quarter | Show me other direct cost for Q1 2026 | Jan–Mar 2026 | Other Direct Cost quarterly |
| 232 | Indirect Cost | Auto Date | Show me indirect cost | Latest available | Indirect Cost = Corporate Cost (auto-date) |
| 233 | Indirect Cost | Full Year | Show me indirect cost for 2025 | Jan–Dec 2025 | Indirect Cost full year |
| 234 | Indirect Cost | Full Year | Show me indirect cost for 2026 | Jan–Mar 2026 | Indirect Cost partial year |
| 235 | Indirect Cost | By Month | Show me indirect cost by month for 2025 | Jan–Dec 2025 | Indirect Cost per month |
| 236 | Indirect Cost | Quarter | Show me indirect cost for Q1 2026 | Jan–Mar 2026 | Indirect Cost quarterly |
| 237 | Indirect Cost | MoM | Show me month on month indirect cost for 2025 | Jan–Dec 2025 | Indirect Cost MoM trend |
| 238 | Indirect Cost | YoY | Compare indirect cost 2025 vs 2026 | 2025 vs 2026 | Indirect Cost YoY |
| **— SECTION 11: ATTRITION —** | | | | | |
| 239 | Attrition | Auto Date | Show me attrition | Latest available | Attrition % annualized (auto-date) |
| 240 | Attrition | Full Year | Show me attrition for 2025 | Jan–Dec 2025 | Attrition % full year |
| 241 | Attrition | Full Year | Show me attrition for 2026 | Jan–Mar 2026 | Attrition % partial year |
| 242 | Attrition | By Month | Show me attrition by month for 2025 | Jan–Dec 2025 | Attrition % per month |
| 243 | Attrition | Specific Month | Show me attrition for December 2025 | Dec 2025 | Attrition % single month |
| 244 | Attrition | Quarter | Show me attrition for Q1 2025 | Jan–Mar 2025 | Attrition % quarterly |
| 245 | Attrition | Quarter | Show me attrition for Q4 2025 | Oct–Dec 2025 | Attrition % quarterly |
| 246 | Attrition | Quarter | Show me attrition for Q1 2026 | Jan–Mar 2026 | Attrition % quarterly |
| 247 | Attrition | MoM | Show me month on month attrition for 2025 | Jan–Dec 2025 | Attrition MoM trend |
| 248 | Attrition | YoY | Compare attrition 2025 vs 2026 | 2025 vs 2026 | Attrition YoY |
| **— SECTION 12: PRICE MIX —** | | | | | |
| 249 | Price Mix | Auto Date | Show me price mix | Latest available | Price Mix Ratio (auto-date) |
| 250 | Price Mix | Full Year | Show me price mix for 2025 | Jan–Dec 2025 | Price Mix Ratio full year |
| 251 | Price Mix | Full Year | Show me price mix for 2026 | Jan–Mar 2026 | Price Mix Ratio partial year |
| 252 | Price Mix | By Month | Show me price mix by month for 2025 | Jan–Dec 2025 | Price Mix per month |
| 253 | Price Mix | Quarter | Show me price mix for Q1 2025 | Jan–Mar 2025 | Price Mix Q1 2025 |
| 254 | Price Mix | Quarter | Show me price mix for Q1 2026 | Jan–Mar 2026 | Price Mix Q1 2026 |
| 255 | Price Mix | MoM | Show me month on month price mix for 2025 | Jan–Dec 2025 | Price Mix MoM trend |
| 256 | Price Mix | YoY | Compare price mix 2025 vs 2026 | 2025 vs 2026 | Price Mix YoY |
| **— SECTION 13: PYRAMID MIX —** | | | | | |
| 257 | Pyramid Mix | Auto Date | Show me pyramid mix | Latest available | Pyramid Mix % (junior SL48-51 of offshore internal) |
| 258 | Pyramid Mix | Full Year | Show me pyramid mix for 2025 | Jan–Dec 2025 | Pyramid Mix full year |
| 259 | Pyramid Mix | Full Year | Show me pyramid mix for 2026 | Jan–Mar 2026 | Pyramid Mix partial year |
| 260 | Pyramid Mix | By Month | Show me pyramid mix by month for 2025 | Jan–Dec 2025 | Pyramid Mix per month |
| 261 | Pyramid Mix | Quarter | Show me pyramid mix for Q1 2025 | Jan–Mar 2025 | Pyramid Mix quarterly |
| 262 | Pyramid Mix | Quarter | Show me pyramid mix for Q1 2026 | Jan–Mar 2026 | Pyramid Mix quarterly |
| 263 | Pyramid by Salary Level | Full Year | Show me pyramid mix by salary level for 2025 | Jan–Dec 2025 | Pyramid Mix grouped by SL category (48-51, 52-53, 54-55, 56+) |
| 264 | Pyramid by Salary Level | Quarter | Show me pyramid breakdown by salary level for Q1 2026 | Jan–Mar 2026 | Pyramid by SL quarterly |
| 265 | Pyramid Individual Levels | Full Year | Show me pyramid mix individual salary levels for 2025 | Jan–Dec 2025 | Each SL (48,49,50,51) shown separately with % |
| 266 | Pyramid | MoM | Show me month on month pyramid mix for 2025 | Jan–Dec 2025 | Pyramid Mix MoM trend |
| 267 | Pyramid | YoY | Compare pyramid mix 2025 vs 2026 | 2025 vs 2026 | Pyramid Mix YoY |
| **— SECTION 14: INVESTMENT —** | | | | | |
| 268 | Investment | Auto Date | Show me investment data | Latest available | Investment aggregation (cube_investment_data) |
| 269 | Investment | Full Year | Show me investment for 2025 | Jan–Dec 2025 | Investment full year |
| 270 | Investment | Full Year | Show me investment for 2026 | Jan–Mar 2026 | Investment partial year |
| 271 | Investment | By Month | Show me investment by month for 2025 | Jan–Dec 2025 | Investment per month |
| 272 | Investment | Quarter | Show me investment for Q1 2025 | Jan–Mar 2025 | Investment Q1 2025 |
| 273 | Investment | Quarter | Show me investment for Q4 2025 | Oct–Dec 2025 | Investment Q4 2025 |
| 274 | Investment | Quarter | Show me investment for Q1 2026 | Jan–Mar 2026 | Investment Q1 2026 |
| 275 | Investment | Category | Show me internal investment for 2025 | Jan–Dec 2025 | Investment → Internal Investment category |
| 276 | Investment | Category | Show me SDS investment for 2025 | Jan–Dec 2025 | Investment → SDS-Investment category |
| 277 | Investment | Category | Show me corporate investment for 2025 | Jan–Dec 2025 | Investment → Corp-Investment category |
| 278 | Investment | MoM | Show me month on month investment for 2025 | Jan–Dec 2025 | Investment MoM trend |
| 279 | Investment | YoY | Compare investment 2025 vs 2026 | 2025 vs 2026 | Investment YoY |
| **— SECTION 15: ENTITY-SPECIFIC QUERIES —** | | | | | |
| 280 | Entity Filter – BGSW | Revenue | Show me revenue for BGSW in 2025 | Jan–Dec 2025 | Revenue — BGSW (India) only |
| 281 | Entity Filter – BGSW | Revenue | Show me revenue for BGSW from January to March 2026 | Jan–Mar 2026 | Revenue — BGSW Q1 2026 |
| 282 | Entity Filter – BGSW | Revenue MoM | Show me month on month revenue for BGSW in 2025 | Jan–Dec 2025 | Revenue MoM — BGSW |
| 283 | Entity Filter – BGSW | Entity P&L | Show me entity P&L for BGSW in 2025 | Jan–Dec 2025 | Entity P&L — BGSW only |
| 284 | Entity Filter – BGSW | GB P&L | Show me GB P&L for BGSW from January to March 2026 | Jan–Mar 2026 | GB P&L — BGSW Q1 2026 |
| 285 | Entity Filter – BGSV | Revenue | Show me revenue for BGSV in 2025 | Jan–Dec 2025 | Revenue — BGSV (Vietnam) only |
| 286 | Entity Filter – BGSV | Revenue | Show me revenue for BGSV from January to March 2026 | Jan–Mar 2026 | Revenue — BGSV Q1 2026 |
| 287 | Entity Filter – BGSV | Entity P&L | Show me entity P&L for BGSV in 2025 | Jan–Dec 2025 | Entity P&L — BGSV only |
| 288 | Entity Filter – BGSJ | Revenue | Show me revenue for BGSJ in 2025 | Jan–Dec 2025 | Revenue — BGSJ (Japan) only |
| 289 | Entity Filter – BGSJ | Entity P&L | Show me entity P&L for BGSJ in 2025 | Jan–Dec 2025 | Entity P&L — BGSJ only |
| 290 | Entity Filter – BGSG | Revenue | Show me revenue for BGSG in 2025 | Jan–Dec 2025 | Revenue — BGSG (Germany) only |
| 291 | Entity Filter – BGSG | Entity P&L | Show me entity P&L for BGSG in 2025 | Jan–Dec 2025 | Entity P&L — BGSG only |
| 292 | Entity Filter – NE-MX | Revenue | Show me revenue for Mexico from January to March 2026 | Jan–Mar 2026 | Revenue — BGSW/NE-MX only |
| 293 | Entity Filter – EBS-PL | Revenue | Show me revenue for Poland in 2025 | Jan–Dec 2025 | Revenue — BGSW/EBS-PL only |
| 294 | Entity Alias – India | Revenue | Show me revenue for India in 2025 | Jan–Dec 2025 | Revenue — alias for BGSW |
| 295 | Entity Alias – Vietnam | Revenue | Show me revenue for Vietnam from January to March 2026 | Jan–Mar 2026 | Revenue — alias for BGSV |
| 296 | Entity Alias – Japan | Revenue | Show me revenue for Japan in 2025 | Jan–Dec 2025 | Revenue — alias for BGSJ |
| 297 | Entity Alias – Germany | Revenue | Show me revenue for Germany in 2025 | Jan–Dec 2025 | Revenue — alias for BGSG |
| 298 | Entity Alias – WW | Revenue | Show me worldwide revenue for 2025 | Jan–Dec 2025 | Revenue — worldwide aggregation |
| 299 | Entity Alias – WW | Revenue | Show me worldwide revenue for Q1 2026 | Jan–Mar 2026 | Revenue — worldwide Q1 2026 |
| **— SECTION 16: CUSTOMER REVENUE —** | | | | | |
| 300 | Customer Revenue | Top N | Show me top 5 customers by revenue for 2025 | Jan–Dec 2025 | Customer Revenue — top 5 ranked |
| 301 | Customer Revenue | Top N | Show me top 10 customers by revenue for 2025 | Jan–Dec 2025 | Customer Revenue — top 10 ranked |
| 302 | Customer Revenue | Top N | Show me top 5 customers by revenue for Q1 2026 | Jan–Mar 2026 | Customer Revenue — top 5 Q1 2026 |
| 303 | Customer Revenue | Least N | Show me least 5 customers by revenue for 2025 | Jan–Dec 2025 | Customer Revenue — bottom 5 ranked |
| 304 | Customer Revenue | By Month | Show me customer revenue by month for 2025 | Jan–Dec 2025 | Customer Revenue per month |
| **— SECTION 17: CROSS-METRIC COMPARISON —** | | | | | |
| 305 | YoY Comparison | Revenue | Show me revenue 2025 vs 2026 | 2025 vs 2026 | Revenue year-over-year |
| 306 | YoY Comparison | GB P&L | Show me GB P&L 2025 versus 2026 | 2025 vs 2026 | GB P&L year-over-year |
| 307 | YoY Comparison | Entity P&L | Show me entity P&L 2025 vs 2026 | 2025 vs 2026 | Entity P&L year-over-year |
| 308 | YoY Comparison | Headcount | Compare headcount 2025 and 2026 | 2025 vs 2026 | Headcount year-over-year |
| 309 | YoY Comparison | EBIT | Show me EBIT 2025 versus 2026 | 2025 vs 2026 | EBIT year-over-year |
| 310 | YoY Comparison | Gross Margin | Compare gross margin 2025 vs 2026 | 2025 vs 2026 | Gross Margin YoY |
| 311 | YoY Comparison | Direct Cost | Compare direct cost 2025 and 2026 | 2025 vs 2026 | Direct Cost YoY |
| 312 | YoY Comparison | Resource Cost | Show me resource cost 2025 versus 2026 | 2025 vs 2026 | Resource Cost YoY |
| 313 | YoY Comparison | Billing Utilization | Compare billing utilization 2025 vs 2026 | 2025 vs 2026 | Billing Util YoY |
| 314 | YoY Comparison | Attrition | Compare attrition 2025 versus 2026 | 2025 vs 2026 | Attrition YoY |
| 315 | YoY Comparison – Month | Revenue | Show me revenue January 2025 versus January 2026 | Jan 2025 vs Jan 2026 | Same-month YoY |
| 316 | YoY Comparison – Month | Revenue | Show me revenue February 2025 versus February 2026 | Feb 2025 vs Feb 2026 | Same-month YoY |
| 317 | YoY Comparison – Month | Revenue | Show me revenue March 2025 versus March 2026 | Mar 2025 vs Mar 2026 | Same-month YoY |
| 318 | YoY Comparison – Quarter | Revenue | Compare revenue Q1 2025 versus Q1 2026 | Q1 2025 vs Q1 2026 | Quarterly YoY |
| 319 | YoY Comparison – Quarter | EBIT | Show me EBIT Q1 2025 versus Q1 2026 | Q1 2025 vs Q1 2026 | EBIT quarterly YoY |
| **— SECTION 18: LAST-N MONTHS —** | | | | | |
| 320 | Last N Months | Revenue | Show me revenue for the last 3 months | Last 3 months | Revenue — rolling 3-month window |
| 321 | Last N Months | Revenue | Show me revenue for the last 6 months | Last 6 months | Revenue — rolling 6-month window |
| 322 | Last N Months | Revenue | Show me revenue for the last 12 months | Last 12 months | Revenue — rolling 12-month window |
| 323 | Last N Months | GB P&L | Show me GB P&L last 3 months | Last 3 months | GB P&L rolling window |
| 324 | Last N Months | GB P&L | Show me GB P&L last 6 months | Last 6 months | GB P&L rolling window |
| 325 | Last N Months | Entity P&L | Show me entity P&L last 6 months | Last 6 months | Entity P&L rolling window |
| 326 | Last N Months | Headcount | Show me headcount last 3 months | Last 3 months | Headcount rolling window |
| 327 | Last N Months | Billing Util | Show me billing utilization last 6 months | Last 6 months | Billing Util rolling window |
| 328 | Last N Months | Attrition | Show me attrition last 3 months | Last 3 months | Attrition rolling window |
| **— SECTION 19: AVERAGE MONTHLY —** | | | | | |
| 329 | Avg Monthly | Revenue | Show me average monthly revenue for 2025 | Jan–Dec 2025 | Revenue ÷ 12 |
| 330 | Avg Monthly | Revenue | Show me average monthly revenue for Q1 2026 | Jan–Mar 2026 | Revenue ÷ 3 |
| 331 | Avg Monthly | GB P&L | Show me average monthly GB P&L for 2025 | Jan–Dec 2025 | GB P&L ÷ 12 |
| 332 | Avg Monthly | Entity P&L | Show me average monthly entity P&L for 2025 | Jan–Dec 2025 | Entity P&L ÷ 12 |
| 333 | Avg Monthly | Headcount | Show me average monthly headcount for 2025 | Jan–Dec 2025 | Headcount ÷ 12 |
| 334 | Avg Monthly | Resource Cost | Show me average monthly resource cost for 2025 | Jan–Dec 2025 | Resource Cost ÷ 12 |
| 335 | Avg Monthly | Direct Cost | Show me average monthly direct cost for 2025 | Jan–Dec 2025 | Direct Cost ÷ 12 |
| 336 | Avg Monthly | EBIT | Show me average monthly EBIT for 2025 | Jan–Dec 2025 | EBIT ÷ 12 |
| 337 | Avg Monthly | Gross Margin | Show me average monthly gross margin for 2025 | Jan–Dec 2025 | Gross Margin ÷ 12 |
| 338 | Avg Monthly | Total Capacity | Show me average monthly total capacity for 2025 | Jan–Dec 2025 | Total Capacity ÷ 12 |
