export const ENTERPRISE_DIMENSIONS = {
  Entity: "region_entity",
  Sector: "sector",
  "Cost Category": "cost_category",
  "Resource Type": "resource_type",
  Location: "onsite_offshore",
  "Project GB": "project_gb",
  "Planning GB": "planning_gb",
  "Salary Level": "salary_level",
  "Cost Center": "cost_center",
  "Service Area": "service_area",
  "Project Type": "project_type",
  Customer: "customer",
} as const;

export const ENTERPRISE_MEASURES = {
  amount_usd: { label: "Amount (USD)", aggregation: "sum" },
  amount_inr: { label: "Amount (INR)", aggregation: "sum" },
  capacity: { label: "Capacity", aggregation: "sum" },
  billed_capacity: { label: "Billed Capacity", aggregation: "sum" },
  headcount: { label: "Headcount", aggregation: "last" },
  total_hours: { label: "Total Hours", aggregation: "sum" },
  billable_hours: { label: "Billable Hours", aggregation: "sum" },
} as const;

export type EnterpriseDimensionName = keyof typeof ENTERPRISE_DIMENSIONS;
export type EnterpriseMeasureColumn = keyof typeof ENTERPRISE_MEASURES;

export interface BoardSourceSchema {
  dimensions: Array<{ name: EnterpriseDimensionName; dbColumn: string }>;
  measures: Array<{
    column: EnterpriseMeasureColumn;
    label: string;
    aggregation: "sum" | "last";
  }>;
}

export function getEnterpriseBoardSourceSchema(): BoardSourceSchema {
  return {
    dimensions: Object.entries(ENTERPRISE_DIMENSIONS).map(([name, dbColumn]) => ({
      name: name as EnterpriseDimensionName,
      dbColumn,
    })),
    measures: Object.entries(ENTERPRISE_MEASURES).map(([column, definition]) => ({
      column: column as EnterpriseMeasureColumn,
      ...definition,
    })),
  };
}
