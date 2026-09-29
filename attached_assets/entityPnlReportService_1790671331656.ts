import { sql } from "drizzle-orm";
import { db } from "../db";

const COST_LINES = [
  ["Employee Benefits", ["employee benefits", "employee benefit"]],
  ["Outsourcing Cost", ["outsourcing cost", "outsourcing costs"]],
  ["Consultancy Charges", ["consultancy charges", "consultancy charge"]],
  [
    "CI Charges & Other Revenue",
    [
      "ci charges & other revenue",
      "ci charges",
      "other revenue sw",
      "revenue software",
    ],
  ],
  ["Facilities Cost", ["facilities cost", "facility cost"]],
  ["Other Expenses", ["other expenses", "other expense"]],
] as const;
const CAPACITY_LINES = [
  "End Capacity On-roll",
  "End Capacity Outsourcing",
  "Total End",
  "Avg Capacity Overall",
  "Avg Capacity Outsourcing",
  "Total Average",
];
const rowsOf = (r: unknown): any[] => (r as { rows?: any[] }).rows ?? [];
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const previous = (
  year: number,
  month: number,
  offset = 1,
): [number, number] => {
  const absolute = year * 12 + month - 1 - offset;
  return [Math.floor(absolute / 12), (absolute % 12) + 1];
};
const label = (year: number, month: number, suffix: string) =>
  `${new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${year} ${suffix}`;
// Python's :,.0f (used by the original service) rounds exact halves to even.
const wholeNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  roundingMode: "halfEven",
});
const amount = (v: number | null | undefined, currency: string) =>
  v == null
    ? "—"
    : `${currency === "USD" ? "$" : "₹"}${wholeNumber.format(v)}`;
const normalized = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .join(" ");

export interface EntityPnlRequest {
  cube_id: string;
  entity?: string;
  as_of: string;
  comparison: "qoq" | "yoy";
  currency?: "USD" | "INR";
  cf_version?: string | null;
}

export function validateEntityPnlRequest(payload: unknown): EntityPnlRequest {
  const p = (payload ?? {}) as Partial<EntityPnlRequest>;
  if (typeof p.cube_id !== "string" || !p.cube_id.trim())
    throw new Error("A cube_id is required.");
  if (typeof p.as_of !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.as_of))
    throw new Error("as_of must be YYYY-MM.");
  if (p.comparison !== "qoq" && p.comparison !== "yoy")
    throw new Error("comparison must be qoq or yoy.");
  if (p.currency !== undefined && p.currency !== "USD" && p.currency !== "INR")
    throw new Error("currency must be USD or INR.");
  if (
    p.entity !== undefined &&
    (typeof p.entity !== "string" || p.entity.length > 200)
  ) {
    throw new Error("entity must be a string of at most 200 characters.");
  }
  if (
    p.cf_version !== undefined &&
    p.cf_version !== null &&
    (typeof p.cf_version !== "string" || p.cf_version.length > 30)
  ) {
    throw new Error("cf_version is invalid.");
  }
  return {
    cube_id: p.cube_id,
    entity: p.entity ?? "",
    as_of: p.as_of,
    comparison: p.comparison,
    currency: p.currency ?? "USD",
    cf_version: p.cf_version ?? null,
  };
}

export async function getEntityPnlEntities(
  cubeId: string,
): Promise<string[]> {
  if (!cubeId || typeof cubeId !== "string")
    throw new Error("A cube_id is required.");
  const result = await db.execute(sql`
    SELECT DISTINCT trim(region_entity) AS entity FROM cube_fact_data
    WHERE cube_id = ${cubeId} AND trim(coalesce(region_entity, '')) <> ''
    ORDER BY 1 LIMIT 500
  `);
  return rowsOf(result)
    .map((r) => String(r.entity))
    .filter(Boolean);
}

type Fact = {
  year: number;
  month: number;
  scenario: string;
  cost_category: string;
  entity_category: string;
  resource_type: string;
  source_sub_category: string;
  amount: unknown;
  capacity: unknown;
};
export async function runEntityPnlReport(input: EntityPnlRequest | unknown) {
  const request = validateEntityPnlRequest(input);
  const [year, month] = request.as_of.split("-").map(Number);
  const cfVersion = request.cf_version?.trim() || null;
  const compare =
    request.comparison === "qoq"
      ? previous(year, month, 3)
      : ([year - 1, month] as [number, number]);
  const selectedPoints: [number, number][] =
    request.comparison === "qoq"
      ? [[year, month], previous(year, month), compare, previous(...compare)]
      : [[year, month], compare];
  const points = new Set<string>(
    [...selectedPoints, [year - 1, 12]].map((p) => p.join("-")),
  );
  for (const [y, m] of [
    [year, month],
    compare,
    [year - 1, 12] as [number, number],
  ])
    for (let i = 1; i <= m; i++) points.add(`${y}-${i}`);
  const pointPredicate = sql.join(
    Array.from(points).map((p) => {
      const [y, m] = p.split("-").map(Number);
      return sql`(year = ${y} AND month = ${m})`;
    }),
    sql` OR `,
  );
  const entityPredicate = request.entity?.trim()
    ? sql`AND lower(trim(coalesce(region_entity, ''))) = lower(trim(${request.entity.trim()}))`
    : sql``;
  const actual = sql`(trim(coalesce(version, 'Actual')) ilike 'actual' OR trim(coalesce(version, '')) ilike 'act')`;
  const scenario = cfVersion
    ? sql`(${actual} OR trim(coalesce(version, '')) = ${cfVersion})`
    : actual;
  const column =
    request.currency === "INR" ? sql.raw("amount_inr") : sql.raw("amount_usd");
  const result = await db.execute(sql`
    SELECT year, month, CASE WHEN ${actual} THEN 'actual' ELSE trim(coalesce(version, '')) END AS scenario,
      trim(coalesce(cost_category, '')) AS cost_category, trim(coalesce(entity_category, '')) AS entity_category,
      trim(coalesce(resource_type, '')) AS resource_type,
      trim(coalesce(row_data ->> 'source_sub_category', '')) AS source_sub_category,
      coalesce(sum(coalesce(${column}, 0)), 0) AS amount, coalesce(sum(coalesce(capacity, 0)), 0) AS capacity
    FROM cube_fact_data WHERE cube_id = ${request.cube_id} ${entityPredicate}
      AND (${pointPredicate}) AND ${scenario}
      AND (trim(coalesce(cost_category, '')) IN ('Revenue Summary', 'Cost Summary') OR trim(coalesce(cost_category, '')) ILIKE '%END Capacity%')
    GROUP BY year, month, scenario, cost_category, entity_category, resource_type, source_sub_category
  `);
  const values = new Map<string, number>(),
    capacities = new Map<string, number>();
  for (const r of rowsOf(result) as Fact[]) {
    const s = String(r.scenario ?? "").trim();
    if (s !== "actual" && s !== (cfVersion ?? "")) continue;
    const key = `${r.year}|${r.month}|${s}|`;
    if (normalized(r.cost_category).includes("end capacity")) {
      const source = normalized(r.source_sub_category),
        resource = normalized(r.resource_type);
      const component =
        ["internal", "on roll", "onroll"].includes(source) ||
        ["internal", "on roll", "onroll"].includes(resource)
          ? "on"
          : ["outsourcing", "external"].includes(source) ||
              ["outsourcing", "external"].includes(resource)
            ? "out"
            : "";
      if (component)
        capacities.set(
          `${key}${component}`,
          (capacities.get(`${key}${component}`) ?? 0) + num(r.capacity),
        );
    } else if (
      r.cost_category === "Revenue Summary" &&
      ["", "revenue"].includes(normalized(r.entity_category))
    ) {
      values.set(
        `${key}Revenue`,
        (values.get(`${key}Revenue`) ?? 0) + num(r.amount),
      );
    } else if (r.cost_category === "Cost Summary") {
      values.set(
        `${key}Total Expenses`,
        (values.get(`${key}Total Expenses`) ?? 0) + Math.abs(num(r.amount)),
      );
      const bucket = COST_LINES.find(([, aliases]) =>
        (aliases as readonly string[]).includes(normalized(r.entity_category)),
      )?.[0];
      if (bucket)
        values.set(
          `${key}${bucket}`,
          (values.get(`${key}${bucket}`) ?? 0) + Math.abs(num(r.amount)),
        );
    }
  }
  const currentLabel = label(
    year,
    month,
    request.comparison === "qoq" ? "MTD" : "YTD",
  );
  const compareLabel = label(
    compare[0],
    compare[1],
    request.comparison === "qoq" ? "MTD" : "YTD",
  );
  const yearEnd = [year - 1, 12] as [number, number],
    yearEndLabel = label(...yearEnd, "YE");
  const columns = [
    currentLabel,
    compareLabel,
    ...(cfVersion
      ? [`${cfVersion} ${request.comparison === "qoq" ? "MTD" : "YTD"}`]
      : []),
    yearEndLabel,
  ];
  const period = (
    point: [number, number],
    s: string,
    line: string,
    qoq = request.comparison === "qoq",
  ) => {
    const v = values.get(`${point[0]}|${point[1]}|${s}|${line}`) ?? 0;
    if (!qoq) return v;
    const prior = previous(...point);
    return v - (values.get(`${prior[0]}|${prior[1]}|${s}|${line}`) ?? 0);
  };
  const lineValue = (
    line: string,
    point: [number, number],
    s = "actual",
    qoq = request.comparison === "qoq",
  ) => period(point, s, line, qoq);
  const raw: Record<string, Record<string, number | null>> = {};
  for (const line of [
    "Revenue",
    ...COST_LINES.map(([x]) => x),
    "Total Expenses",
  ]) {
    raw[line] = {
      [currentLabel]: lineValue(line, [year, month]),
      [compareLabel]: lineValue(line, compare),
      [yearEndLabel]: period(yearEnd, "actual", line, false),
    };
    if (cfVersion)
      raw[line][columns[2]] = lineValue(line, [year, month], cfVersion);
  }
  for (const c of columns) {
    const revenue = raw.Revenue[c] ?? 0,
      expenses = raw["Total Expenses"][c] ?? 0;
    raw.EBIT ??= {};
    raw["EBIT%"] ??= {};
    raw.EBIT[c] = revenue - expenses;
    raw["EBIT%"][c] = revenue ? ((revenue - expenses) / revenue) * 100 : null;
  }
  const cap = (point: [number, number], component: string, s = "actual") => {
    const end =
      capacities.get(`${point[0]}|${point[1]}|${s}|${component}`) ?? 0;
    const nums = Array.from(
      { length: point[1] },
      (_, i) => capacities.get(`${point[0]}|${i + 1}|${s}|${component}`) ?? 0,
    ).filter(Boolean);
    return [
      end,
      nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
    ];
  };
  for (const [point, c, s] of [
    [[year, month], currentLabel, "actual"],
    [compare, compareLabel, "actual"],
    [yearEnd, yearEndLabel, "actual"],
  ] as [[number, number], string, string][]) {
    const on = cap(point, "on", s),
      out = cap(point, "out", s);
    raw["End Capacity On-roll"] ??= {};
    raw["End Capacity Outsourcing"] ??= {};
    raw["Total End"] ??= {};
    raw["Avg Capacity Overall"] ??= {};
    raw["Avg Capacity Outsourcing"] ??= {};
    raw["Total Average"] ??= {};
    raw["End Capacity On-roll"][c] = on[0];
    raw["End Capacity Outsourcing"][c] = out[0];
    raw["Total End"][c] = on[0] + out[0];
    raw["Avg Capacity Overall"][c] = on[1];
    raw["Avg Capacity Outsourcing"][c] = out[1];
    raw["Total Average"][c] = on[1] + out[1];
  }
  if (cfVersion) {
    const on = cap([year, month], "on", cfVersion),
      out = cap([year, month], "out", cfVersion),
      c = columns[2];
    raw["End Capacity On-roll"][c] = on[0];
    raw["End Capacity Outsourcing"][c] = out[0];
    raw["Total End"][c] = on[0] + out[0];
    raw["Avg Capacity Overall"][c] = on[1];
    raw["Avg Capacity Outsourcing"][c] = out[1];
    raw["Total Average"][c] = on[1] + out[1];
  }
  const lines = [
    "Revenue",
    ...COST_LINES.map(([x]) => x),
    "Total Expenses",
    "EBIT",
    "EBIT%",
    ...CAPACITY_LINES,
  ].map((l) => ({
    label: l,
    values: Object.fromEntries(columns.map((c) => [c, raw[l]?.[c] ?? null])),
  }));
  const revenue = raw.Revenue[currentLabel] ?? 0,
    priorRevenue = raw.Revenue[compareLabel] ?? 0,
    ebit = raw.EBIT[currentLabel] ?? 0,
    priorEbit = raw.EBIT[compareLabel] ?? 0,
    entity = request.entity?.trim() || "All entities",
    delta = ebit - priorEbit;
  const resultData = {
    entity,
    asOf: request.as_of,
    comparison: request.comparison,
    currency: request.currency,
    units: request.currency,
    columns,
    lines,
    evidence: [
      `Read-only run from the selected Enterprise cube ${request.entity?.trim() ? `for ${entity}` : "across all entity rows, including blank entity values"}.`,
      `${request.comparison === "qoq" ? "QUARTER-END MTD" : "YTD"} comparison: ${currentLabel} versus ${compareLabel}.`,
      "Total Expenses uses the full governed Cost Summary population; visible expense rows are a presentation subset.",
      "Actual and CF are queried as separate scenarios and are never combined.",
    ],
  };
  return {
    success: true,
    result: {
      summary: `${entity} reported ${amount(revenue, request.currency!)} revenue and ${amount(ebit, request.currency!)} EBIT in ${currentLabel}. EBIT moved ${amount(delta, request.currency!)} from ${compareLabel}.`,
      kpis: [
        {
          label: `Revenue · ${currentLabel}`,
          value: amount(revenue, request.currency!),
          change: `${amount(revenue - priorRevenue, request.currency!)} vs ${compareLabel}`,
          direction: revenue >= priorRevenue ? "up" : "down",
        },
        {
          label: `EBIT · ${currentLabel}`,
          value: amount(ebit, request.currency!),
          change: `${amount(delta, request.currency!)} vs ${compareLabel}`,
          direction: delta >= 0 ? "up" : "down",
        },
        {
          label: `EBIT% · ${currentLabel}`,
          value:
            raw["EBIT%"][currentLabel] == null
              ? "—"
              : `${raw["EBIT%"][currentLabel]!.toFixed(1)}%`,
          direction:
            (raw["EBIT%"][currentLabel] ?? 0) >=
            (raw["EBIT%"][compareLabel] ?? 0)
              ? "up"
              : "down",
        },
        {
          label: "Total End",
          value: wholeNumber.format(raw["Total End"][currentLabel] ?? 0),
          change: `Total average ${wholeNumber.format(raw["Total Average"][currentLabel] ?? 0)} YTD`,
          direction: "flat",
        },
      ],
      charts: [
        {
          title: "Revenue, Expenses and EBIT",
          type: "bar",
          series: ["Revenue", "Total Expenses", "EBIT"].map((l) => ({
            name: l,
            points: columns.slice(0, 2).map((x) => ({ x, y: raw[l][x] ?? 0 })),
          })),
        },
      ],
      insights: [
        `Revenue changed by ${amount(revenue - priorRevenue, request.currency!)} between the two selected ${request.comparison === "qoq" ? "quarter-end MTD" : "YTD"} periods.`,
        `EBIT changed by ${amount(delta, request.currency!)}; the report attributes movement only to governed P&L figures.`,
      ],
      commentary: [
        {
          area: "Revenue and EBIT",
          explanation: `${currentLabel} revenue is ${amount(revenue, request.currency!)} and EBIT is ${amount(ebit, request.currency!)}. Underlying business causes require owner commentary.`,
          recurrence: "",
        },
      ],
      risks: [],
      tables: [
        {
          title: `Entity P&L · ${entity}`,
          columns: ["Line item", ...columns],
          rows: lines.map((l) => [
            l.label,
            ...columns.map((c) =>
              l.values[c] == null
                ? "—"
                : l.label === "EBIT%"
                  ? `${(l.values[c] as number).toFixed(1)}%`
                  : CAPACITY_LINES.includes(l.label)
                    ? wholeNumber.format(l.values[c] as number)
                    : amount(l.values[c] as number, request.currency!),
            ),
          ]),
        },
      ],
      actions: [],
      entityPnl: resultData,
    },
  };
}
