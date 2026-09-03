/**
 * Investment / CAPEX / PMO Business Logic Seed Data
 *
 * Based on:
 *  - Investment_Capex_PMO logic document (SQL formulas + business rules)
 *  - Investment_CAPEX_PMO_2025.xls (20-column schema)
 *
 * Run this when setting up a new Investment/CAPEX/PMO cube.
 */

// ── Business Terms ──────────────────────────────────────────────────────────

export const INVESTMENT_BUSINESS_TERMS = [
  {
    termName: "Total Approved Investment",
    termAliases: ["approved budget", "sanctioned amount", "total approved", "yearly approved", "AppYTD"],
    definition: "Total approved investment budget for the fiscal year. Uses MAX(yearly_approved_tusd) per project because the annual budget is repeated on every monthly row.",
    sqlFilter: "type = 'Cost'",
    requiredColumns: ["Yearly Approved_tUSD", "Type"],
    category: "investment",
    priority: 10,
  },
  {
    termName: "Total Utilized / Actual Spend",
    termAliases: ["actual spend", "utilized amount", "total utilized", "actual cost", "spend"],
    definition: "Total actual spend (utilized amount) for investment projects. SUM of Actual_tUSD where Type = 'Cost'.",
    sqlFilter: "type = 'Cost'",
    requiredColumns: ["Actual_tUSD", "Type"],
    category: "investment",
    priority: 10,
  },
  {
    termName: "Investment Balance",
    termAliases: ["remaining budget", "unspent", "balance amount", "available budget"],
    definition: "Remaining balance = Approved – Utilized. Computed as MAX(yearly_approved_tusd) - SUM(actual_tusd).",
    sqlFilter: "type = 'Cost'",
    requiredColumns: ["Yearly Approved_tUSD", "Actual_tUSD", "Type"],
    category: "investment",
    priority: 9,
  },
  {
    termName: "CoE Projects",
    termAliases: ["centre of excellence", "CoE investment", "CoE spending"],
    definition: "Investment for CoE (Centre of Excellence) category projects.",
    sqlFilter: "type = 'Cost' AND category = 'CoE'",
    requiredColumns: ["Type", "Category"],
    category: "investment",
    priority: 8,
  },
  {
    termName: "Project Category Investment",
    termAliases: ["project type investment", "project category spend"],
    definition: "Investment for the 'Project' category (non-CoE projects).",
    sqlFilter: "type = 'Cost' AND category = 'Project'",
    requiredColumns: ["Type", "Category"],
    category: "investment",
    priority: 8,
  },
  {
    termName: "CAPEX Budget",
    termAliases: ["capital expenditure", "capex approved", "capex budget"],
    definition: "Capital Expenditure approved vs actual by department.",
    sqlFilter: "type = 'CAPEX'",
    requiredColumns: ["Type", "Yearly Approved_tUSD", "Actual_tUSD", "Dept"],
    category: "capex",
    priority: 10,
  },
  {
    termName: "CAPEX Actual",
    termAliases: ["capex spent", "capex utilized", "capital spend"],
    definition: "Actual capital expenditure spend. SUM(Actual_tUSD) where Type = 'CAPEX'.",
    sqlFilter: "type = 'CAPEX'",
    requiredColumns: ["Actual_tUSD", "Type"],
    category: "capex",
    priority: 9,
  },
  {
    termName: "CAPEX Balance",
    termAliases: ["capex remaining", "capex unspent"],
    definition: "Remaining CAPEX = Approved – Actual. MAX(yearly_approved) - SUM(actual) by department.",
    sqlFilter: "type = 'CAPEX'",
    requiredColumns: ["Yearly Approved_tUSD", "Actual_tUSD", "Type", "Dept"],
    category: "capex",
    priority: 8,
  },
  {
    termName: "PMO Approved",
    termAliases: ["pmo budget", "pmo sanctioned", "project management budget"],
    definition: "PMO (Project Management Office) approved budget. MAX(yearly_approved_tusd) where Type = 'PMO'.",
    sqlFilter: "type = 'PMO'",
    requiredColumns: ["Type", "Yearly Approved_tUSD"],
    category: "pmo",
    priority: 10,
  },
  {
    termName: "PMO Actual",
    termAliases: ["pmo spend", "pmo utilized", "pmo cost"],
    definition: "Actual PMO spend. SUM(Actual_tUSD) where Type = 'PMO'.",
    sqlFilter: "type = 'PMO'",
    requiredColumns: ["Actual_tUSD", "Type"],
    category: "pmo",
    priority: 10,
  },
  {
    termName: "PMO Balance",
    termAliases: ["pmo remaining", "pmo variance"],
    definition: "PMO balance = Approved – Actual.",
    sqlFilter: "type = 'PMO'",
    requiredColumns: ["Yearly Approved_tUSD", "Actual_tUSD", "Type"],
    category: "pmo",
    priority: 9,
  },
  {
    termName: "Overhead Cost",
    termAliases: ["overheads", "overhead spend"],
    definition: "Overhead grouping costs.",
    sqlFilter: "grouping = 'Overheads'",
    requiredColumns: ["Grouping"],
    category: "cost",
    priority: 7,
  },
  {
    termName: "Personnel Cost",
    termAliases: ["people cost", "manpower cost", "staff cost"],
    definition: "Personnel cost grouping.",
    sqlFilter: "grouping = 'Personnel Cost'",
    requiredColumns: ["Grouping"],
    category: "cost",
    priority: 7,
  },
  {
    termName: "Hardware / Software Cost",
    termAliases: ["ci sw hw", "hardware cost", "software cost", "hw sw cost"],
    definition: "CI, SW and HW Cost grouping.",
    sqlFilter: "grouping = 'CI, SW and HW Cost'",
    requiredColumns: ["Grouping"],
    category: "cost",
    priority: 7,
  },
  {
    termName: "Consulting & Outsourcing",
    termAliases: ["consulting cost", "outsourcing cost"],
    definition: "Consulting and Outsourcing Cost grouping.",
    sqlFilter: "grouping = 'Consulting & Outsourcing Cost'",
    requiredColumns: ["Grouping"],
    category: "cost",
    priority: 6,
  },
  {
    termName: "Total Fund Utilization",
    termAliases: ["fund utilization", "5m fund", "total fund usage"],
    definition: "Overall fund utilization across all investment types — approved vs utilized vs balance.",
    sqlFilter: "type IN ('Cost', 'CAPEX', 'PMO')",
    requiredColumns: ["Type", "Yearly Approved_tUSD", "Actual_tUSD"],
    category: "investment",
    priority: 9,
  },
];

// ── Calculation Rules ────────────────────────────────────────────────────────

export const INVESTMENT_CALCULATION_RULES = [
  {
    calculationName: "Approved YTD (USD)",
    calculationAliases: ["AppYTD_USD", "yearly approved USD", "total approved USD"],
    description: "Total Approved YTD in thousands USD. Uses CASE logic: if Yearly Approved = 0 use Monthly Approved SUM, else use MAX(Yearly Approved).",
    formula: "SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END)",
    formulaType: "sum",
    resultType: "currency_thousands",
    requiredColumns: ["Yearly Approved_tUSD", "Monthly Approved_tUSD"],
    defaultFilters: "type = 'Cost'",
    roundingPrecision: 1,
  },
  {
    calculationName: "Approved YTD (INR)",
    calculationAliases: ["AppYTD_INR", "yearly approved INR"],
    description: "Total Approved YTD in millions INR.",
    formula: "SUM(CASE WHEN yearly_approved_minr = 0 THEN monthly_approved_minr ELSE yearly_approved_minr END)",
    formulaType: "sum",
    resultType: "currency_millions_inr",
    requiredColumns: ["Yearly Approved_mINR", "Monthly Approved_mINR"],
    defaultFilters: "type = 'Cost'",
    roundingPrecision: 1,
  },
  {
    calculationName: "Utilized YTD (USD)",
    calculationAliases: ["Utilzd_YTD_USD", "total utilized USD", "actual spend USD"],
    description: "Total actual (utilized) spend YTD in thousands USD.",
    formula: "SUM(actual_tusd)",
    formulaType: "sum",
    resultType: "currency_thousands",
    requiredColumns: ["Actual_tUSD"],
    defaultFilters: "type = 'Cost'",
    roundingPrecision: 1,
  },
  {
    calculationName: "Utilized YTD (INR)",
    calculationAliases: ["Utilzd_YTD_INR", "total utilized INR"],
    description: "Total actual spend YTD in millions INR.",
    formula: "SUM(actual_minr)",
    formulaType: "sum",
    resultType: "currency_millions_inr",
    requiredColumns: ["Actual_mINR"],
    defaultFilters: "type = 'Cost'",
    roundingPrecision: 1,
  },
  {
    calculationName: "Balance (USD)",
    calculationAliases: ["remaining balance USD", "unspent USD"],
    description: "Balance = Approved YTD – Utilized YTD in thousands USD.",
    formula: "SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END) - SUM(actual_tusd)",
    formulaType: "expression",
    resultType: "currency_thousands",
    requiredColumns: ["Yearly Approved_tUSD", "Actual_tUSD"],
    defaultFilters: "type = 'Cost'",
    roundingPrecision: 1,
  },
  {
    calculationName: "CAPEX Approved vs Actual",
    calculationAliases: ["capex comparison", "capex approved actual"],
    description: "CAPEX approved vs actual by department. MAX(yearly_approved_tusd) and SUM(actual_tusd).",
    formula: "MAX(yearly_approved_tusd) AS approved, SUM(actual_tusd) AS actual",
    formulaType: "comparison",
    resultType: "currency_thousands",
    requiredColumns: ["Yearly Approved_tUSD", "Actual_tUSD", "Dept"],
    defaultFilters: "type = 'CAPEX'",
    roundingPrecision: 2,
  },
  {
    calculationName: "PMO Monthly Approved vs Actual",
    calculationAliases: ["pmo monthly", "pmo month comparison"],
    description: "PMO approved vs actual per month per project.",
    formula: "MAX(yearly_approved_tusd) AS approved, SUM(actual_tusd) AS actual",
    formulaType: "comparison",
    resultType: "currency_thousands",
    requiredColumns: ["Yearly Approved_tUSD", "Actual_tUSD", "Month", "Dept", "Project Name"],
    defaultFilters: "type = 'PMO'",
    roundingPrecision: 2,
  },
];

// ── Filter Rules ────────────────────────────────────────────────────────────

export const INVESTMENT_FILTER_RULES = [
  {
    filterName: "Investment Only",
    filterAliases: ["investment filter", "cost type"],
    description: "Filter to Investment (Cost type) rows only.",
    sqlPredicate: "type = 'Cost'",
    targetColumn: "type",
    isDefault: false,
  },
  {
    filterName: "CAPEX Only",
    filterAliases: ["capex filter", "capital expenditure filter"],
    description: "Filter to CAPEX rows only.",
    sqlPredicate: "type = 'CAPEX'",
    targetColumn: "type",
    isDefault: false,
  },
  {
    filterName: "PMO Only",
    filterAliases: ["pmo filter", "project management filter"],
    description: "Filter to PMO rows only.",
    sqlPredicate: "type = 'PMO'",
    targetColumn: "type",
    isDefault: false,
  },
  {
    filterName: "CoE Category",
    filterAliases: ["coe", "centre of excellence"],
    description: "Filter to CoE category projects.",
    sqlPredicate: "category = 'CoE'",
    targetColumn: "category",
    isDefault: false,
  },
  {
    filterName: "Project Category",
    filterAliases: ["project category", "non-coe projects"],
    description: "Filter to 'Project' category rows.",
    sqlPredicate: "category = 'Project'",
    targetColumn: "category",
    isDefault: false,
  },
  {
    filterName: "Exclude Empty Projects",
    filterAliases: ["valid projects only"],
    description: "Exclude rows with null/empty ProjDisplayId.",
    sqlPredicate: "proj_display_id IS NOT NULL AND proj_display_id != ''",
    targetColumn: "proj_display_id",
    isDefault: true,
  },
];

// ── Query Patterns ───────────────────────────────────────────────────────────

export const INVESTMENT_QUERY_PATTERNS = [
  {
    patternName: "Investment Approved vs Utilized by Project",
    patternDescription: "Show approved vs utilized investment with balance for each project.",
    triggerPhrases: ["approved vs utilized", "approved vs actual investment", "project investment summary", "investment balance by project"],
    sqlTemplate: `SELECT dept, project_name, proj_display_id,
  ROUND(SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END)::numeric, 1) AS approved_ytd_tusd,
  ROUND(SUM(actual_tusd)::numeric, 1) AS utilized_tusd,
  ROUND((SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END) - SUM(actual_tusd))::numeric, 1) AS balance_tusd
FROM cube_investment_data
WHERE cube_id = :cube_id AND fiscal_year = :fiscal_year AND type = 'Cost'
  AND proj_display_id IS NOT NULL AND proj_display_id != ''
GROUP BY dept, project_name, proj_display_id
ORDER BY dept, project_name`,
    templateVariables: ["cube_id", "fiscal_year"],
    exampleQuestion: "What is the approved vs utilized investment for 2025?",
    exampleSql: "SELECT dept, project_name, ... FROM cube_investment_data WHERE type='Cost' AND fiscal_year='2025'",
    category: "investment",
  },
  {
    patternName: "Investment Split by Category",
    patternDescription: "Split of approved and utilized amounts by Category (CoE vs Project).",
    triggerPhrases: ["split by category", "by category", "coe vs project", "category breakdown"],
    sqlTemplate: `SELECT category,
  ROUND(SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END)::numeric, 1) AS approved_tusd,
  ROUND(SUM(actual_tusd)::numeric, 1) AS utilized_tusd,
  ROUND((SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END) - SUM(actual_tusd))::numeric, 1) AS balance_tusd
FROM cube_investment_data
WHERE cube_id = :cube_id AND fiscal_year = :fiscal_year AND type = 'Cost'
GROUP BY category ORDER BY category`,
    templateVariables: ["cube_id", "fiscal_year"],
    exampleQuestion: "Split investment by category for 2025.",
    exampleSql: "SELECT category, SUM(...) FROM cube_investment_data WHERE type='Cost' GROUP BY category",
    category: "investment",
  },
  {
    patternName: "CAPEX Approved vs Actual by Department",
    patternDescription: "CAPEX approved vs actual by department in USD and INR.",
    triggerPhrases: ["capex by department", "capex dept", "capex approved actual", "capex utilization"],
    sqlTemplate: `SELECT dept,
  ROUND(MAX(yearly_approved_tusd)::numeric, 2) AS approved_tusd,
  ROUND(MAX(yearly_approved_minr)::numeric, 2) AS approved_minr,
  ROUND(SUM(actual_tusd)::numeric, 2) AS actual_tusd,
  ROUND(SUM(actual_minr)::numeric, 2) AS actual_minr,
  ROUND((MAX(yearly_approved_tusd) - SUM(actual_tusd))::numeric, 2) AS balance_tusd
FROM cube_investment_data
WHERE cube_id = :cube_id AND fiscal_year = :fiscal_year AND type = 'CAPEX'
GROUP BY dept ORDER BY dept`,
    templateVariables: ["cube_id", "fiscal_year"],
    exampleQuestion: "Show CAPEX approved vs actual by department for 2025.",
    exampleSql: "SELECT dept, MAX(yearly_approved_tusd), SUM(actual_tusd) FROM cube_investment_data WHERE type='CAPEX' GROUP BY dept",
    category: "capex",
  },
  {
    patternName: "PMO Approved vs Actual by Project Month-wise",
    patternDescription: "PMO approved vs actual by project and month.",
    triggerPhrases: ["pmo monthly", "pmo by project", "pmo month wise", "pmo project breakdown"],
    sqlTemplate: `SELECT fiscal_year, month, dept, proj_display_id, project_name, category,
  ROUND(MAX(yearly_approved_tusd)::numeric, 2) AS approved_pmo,
  ROUND(SUM(actual_tusd)::numeric, 2) AS actual_pmo,
  ROUND((MAX(yearly_approved_tusd) - SUM(actual_tusd))::numeric, 2) AS balance_pmo
FROM cube_investment_data
WHERE cube_id = :cube_id AND fiscal_year = :fiscal_year AND type = 'PMO'
GROUP BY fiscal_year, month, dept, proj_display_id, project_name, category
ORDER BY month, dept, project_name`,
    templateVariables: ["cube_id", "fiscal_year"],
    exampleQuestion: "Show PMO approved vs actual by project month-wise for 2025.",
    exampleSql: "SELECT month, dept, project_name, MAX(yearly_approved_tusd), SUM(actual_tusd) FROM cube_investment_data WHERE type='PMO' GROUP BY ...",
    category: "pmo",
  },
  {
    patternName: "Total Fund Utilization",
    patternDescription: "Overall investment fund utilization — approved vs actual vs balance.",
    triggerPhrases: ["total fund", "fund utilization", "overall investment", "how much of fund is used"],
    sqlTemplate: `SELECT
  ROUND(SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END)::numeric, 1) AS total_approved_tusd,
  ROUND(SUM(actual_tusd)::numeric, 1) AS total_utilized_tusd,
  ROUND((SUM(CASE WHEN yearly_approved_tusd = 0 THEN monthly_approved_tusd ELSE yearly_approved_tusd END) - SUM(actual_tusd))::numeric, 1) AS balance_tusd
FROM cube_investment_data
WHERE cube_id = :cube_id AND fiscal_year = :fiscal_year AND type = 'Cost'`,
    templateVariables: ["cube_id", "fiscal_year"],
    exampleQuestion: "What is the total fund utilization for 2025?",
    exampleSql: "SELECT SUM(...) FROM cube_investment_data WHERE type='Cost' AND fiscal_year='2025'",
    category: "investment",
  },
];

// ── Column Values (dimension value lookups) ──────────────────────────────────

export const INVESTMENT_COLUMN_VALUES = [
  { columnName: "type", valueName: "Cost",          valueDescription: "Investment projects spend",          valueAliases: ["investment", "project cost"], usageContext: "investment", relatedValues: ["CAPEX", "PMO"] },
  { columnName: "type", valueName: "CAPEX",         valueDescription: "Capital Expenditure",                 valueAliases: ["capital expenditure", "capex"], usageContext: "capex", relatedValues: ["Cost"] },
  { columnName: "type", valueName: "PMO",           valueDescription: "Project Management Office budget",   valueAliases: ["pmo", "project management"], usageContext: "pmo", relatedValues: ["Cost"] },
  { columnName: "type", valueName: "Bosch Actuals", valueDescription: "Bosch actual cost entries",          valueAliases: ["bosch actual", "actuals"], usageContext: "actuals", relatedValues: [] },
  { columnName: "type", valueName: "Total Funds",   valueDescription: "Total fund envelope rows",           valueAliases: ["total fund", "fund total"], usageContext: "fund", relatedValues: [] },
  { columnName: "category", valueName: "CoE",       valueDescription: "Centre of Excellence projects",      valueAliases: ["centre of excellence", "coe projects"], usageContext: "investment", relatedValues: ["Project"] },
  { columnName: "category", valueName: "Project",   valueDescription: "Regular project category",           valueAliases: ["project category", "non-coe"], usageContext: "investment", relatedValues: ["CoE"] },
  { columnName: "category", valueName: "DNA",       valueDescription: "DNA category",                        valueAliases: [], usageContext: "investment", relatedValues: [] },
  { columnName: "grouping", valueName: "Overheads", valueDescription: "Overhead costs",                     valueAliases: ["overhead", "overheads"], usageContext: "cost", relatedValues: [] },
  { columnName: "grouping", valueName: "Personnel Cost", valueDescription: "People / staff cost",           valueAliases: ["people cost", "manpower"], usageContext: "cost", relatedValues: [] },
  { columnName: "grouping", valueName: "CI, SW and HW Cost", valueDescription: "Hardware and Software",    valueAliases: ["hw sw", "ci hw sw"], usageContext: "cost", relatedValues: [] },
  { columnName: "grouping", valueName: "Consulting & Outsourcing Cost", valueDescription: "Consulting and outsourcing", valueAliases: ["consulting", "outsourcing"], usageContext: "cost", relatedValues: [] },
];
