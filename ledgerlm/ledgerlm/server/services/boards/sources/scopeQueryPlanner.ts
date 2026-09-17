import { BOARD_SOURCE_LIMITS } from "./sourceLimits";
import {
  ENTERPRISE_DIMENSIONS,
  ENTERPRISE_MEASURES,
  type EnterpriseDimensionName,
  type EnterpriseMeasureColumn,
} from "./sourceSchemaService";

export interface BoardScopeFilter {
  dimension: EnterpriseDimensionName;
  dbColumn: string;
  values: string[];
}

export interface BoardScopeQueryPlan {
  metricColumn: EnterpriseMeasureColumn;
  dimensions: EnterpriseDimensionName[];
  filters: BoardScopeFilter[];
  year: number;
  months: number[];
  comparison?: { year: number; months: number[]; label?: string };
  maxGroups: number;
}

interface ScopeConfigLike {
  scopeMode?: unknown;
  keyColumns?: unknown;
  excludedColumns?: unknown;
  scopeConfig?: unknown;
}

interface RequestedScope {
  year?: number;
  months?: number[];
  dimensions?: string[];
  keyColumns?: unknown[];
  scopeMode?: string;
  excludedColumns?: string[];
  comparison?: { year: number; months: number[]; label?: string };
}

function normalizeMonths(months: unknown, label: string): number[] {
  if (!Array.isArray(months)) throw new Error(`${label} months must be an array`);
  const normalized = Array.from(new Set(months.map(Number))).sort((a, b) => a - b);
  if (normalized.length === 0 || normalized.length > BOARD_SOURCE_LIMITS.maxPeriods
    || normalized.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error(`${label} months are outside the supported range`);
  }
  return normalized;
}

function normalizeYear(year: unknown, label: string): number {
  const normalized = Number(year);
  if (!Number.isInteger(normalized) || normalized < 1900 || normalized > 2200) {
    throw new Error(`${label} year is outside the supported range`);
  }
  return normalized;
}

function parseKeyColumns(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

export function createEnterpriseScopePlan(params: {
  config: ScopeConfigLike | null | undefined;
  request: RequestedScope;
  defaultDimensions?: string[];
}): BoardScopeQueryPlan {
  const scopeConfig = params.config?.scopeConfig && typeof params.config.scopeConfig === "object"
    ? params.config.scopeConfig as Record<string, unknown>
    : {};
  const requestedScopeMode = params.request.scopeMode ?? scopeConfig.mode ?? params.config?.scopeMode ?? "all";
  const scopeMode = requestedScopeMode === "exclude" ? "all-except" : String(requestedScopeMode);
  if (!["all", "selected", "all-except"].includes(scopeMode)) {
    throw new Error("Unsupported Board scope mode");
  }

  const keyColumns = parseKeyColumns(params.request.keyColumns ?? scopeConfig.keyColumns ?? params.config?.keyColumns);
  if (keyColumns.length > BOARD_SOURCE_LIMITS.maxMeasures) {
    throw new Error(`A Board can select at most ${BOARD_SOURCE_LIMITS.maxMeasures} measures`);
  }
  const selectedMeasures = keyColumns
    .map((item) => String(item.column ?? item.sourceColumn ?? ""))
    .filter((column): column is EnterpriseMeasureColumn => column in ENTERPRISE_MEASURES);
  const requestedButUnsupported = keyColumns
    .map((item) => String(item.column ?? item.sourceColumn ?? ""))
    .filter((column) => column && !(column in ENTERPRISE_MEASURES));
  if (requestedButUnsupported.length > 0) {
    throw new Error(`Unsupported Enterprise measure: ${requestedButUnsupported[0]}`);
  }
  if (selectedMeasures.length > 1) {
    throw new Error("Multiple selected measures require the Phase 3 deterministic engine; select one measure for the current variance engine");
  }
  if (selectedMeasures.some((column) => column !== "amount_usd")) {
    throw new Error("The Phase 2 variance renderer supports only Amount (USD); other measures require the Phase 3 deterministic engine");
  }
  const incompatibleAggregation = keyColumns.find((item) =>
    item.aggregation !== undefined && item.aggregation !== "sum");
  if (incompatibleAggregation) {
    throw new Error("The Phase 2 Amount (USD) variance measure supports only sum aggregation");
  }
  const incompatibleValueType = keyColumns.find((item) =>
    item.valueType !== undefined && item.valueType !== "currency");
  if (incompatibleValueType) {
    throw new Error("The Phase 2 Amount (USD) variance measure must use currency value type");
  }
  if (scopeMode === "selected" && selectedMeasures.length === 0) {
    throw new Error("Selected-column scope requires at least one supported Enterprise measure");
  }

  const excluded = new Set(
    (params.request.excludedColumns
      ?? (Array.isArray(scopeConfig.excludedColumns) ? scopeConfig.excludedColumns : params.config?.excludedColumns as unknown[] ?? []))
      .map(String),
  );
  const metricColumn = selectedMeasures.find((column) => !excluded.has(column))
    ?? (excluded.has("amount_usd") ? undefined : "amount_usd");
  if (!metricColumn) throw new Error("Board scope excludes every supported primary measure");

  const requestedDimensions = params.request.dimensions?.length
    ? params.request.dimensions
    : params.defaultDimensions ?? ["Entity", "Sector", "Cost Category"];
  const unsupportedDimensions = requestedDimensions.filter((dimension) => !(dimension in ENTERPRISE_DIMENSIONS));
  if (unsupportedDimensions.length > 0) {
    throw new Error(`Unsupported Enterprise dimension: ${unsupportedDimensions[0]}`);
  }
  const dimensions = Array.from(new Set(requestedDimensions))
    .filter((dimension): dimension is EnterpriseDimensionName => dimension in ENTERPRISE_DIMENSIONS)
    .filter((dimension) => !excluded.has(dimension) && !excluded.has(ENTERPRISE_DIMENSIONS[dimension]));
  if (dimensions.length === 0) {
    throw new Error("Board scope excludes every selected dimension; select at least one permitted dimension");
  }
  if (dimensions.length > BOARD_SOURCE_LIMITS.maxDimensions) {
    throw new Error(`A Board can group by at most ${BOARD_SOURCE_LIMITS.maxDimensions} dimensions`);
  }

  const keyColumnFilters = keyColumns
    .filter((item) => item.dimension && Array.isArray(item.dimensionValues) && item.dimensionValues.length > 0)
    .map((item) => ({ column: item.dimension, values: item.dimensionValues }));
  const rawFilters = [
    ...(Array.isArray(scopeConfig.filters) ? scopeConfig.filters : []),
    ...keyColumnFilters,
  ];
  if (rawFilters.length > BOARD_SOURCE_LIMITS.maxFilters) {
    throw new Error(`A Board can use at most ${BOARD_SOURCE_LIMITS.maxFilters} dimension filters`);
  }
  const filters = rawFilters.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid Board dimension filter");
    const item = value as Record<string, unknown>;
    const dimension = String(item.column ?? item.dimension ?? "") as EnterpriseDimensionName;
    if (!(dimension in ENTERPRISE_DIMENSIONS)) throw new Error(`Unsupported Enterprise dimension: ${dimension}`);
    const values = Array.isArray(item.values)
      ? Array.from(new Set(item.values.map(String).map((entry) => entry.trim()).filter(Boolean)))
      : [];
    if (values.length === 0 || values.length > BOARD_SOURCE_LIMITS.maxValuesPerFilter) {
      throw new Error(`Dimension filters require 1-${BOARD_SOURCE_LIMITS.maxValuesPerFilter} values`);
    }
    return { dimension, dbColumn: ENTERPRISE_DIMENSIONS[dimension], values };
  });

  const year = normalizeYear(params.request.year, "Primary");
  const months = normalizeMonths(params.request.months, "Primary");
  const comparison = params.request.comparison ? {
    year: normalizeYear(params.request.comparison.year, "Comparison"),
    months: normalizeMonths(params.request.comparison.months, "Comparison"),
    label: params.request.comparison.label?.slice(0, 200),
  } : undefined;

  return {
    metricColumn,
    dimensions,
    filters,
    year,
    months,
    comparison,
    maxGroups: BOARD_SOURCE_LIMITS.maxGroups,
  };
}
