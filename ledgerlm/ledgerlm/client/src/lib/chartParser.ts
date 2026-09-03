export interface ChartSpec {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<Record<string, string | number>>;
  config: {
    xKey?: string;
    yKey?: string;
    xLabel?: string;
    yLabel?: string;
    color?: string;
    entities?: string[];
    periods?: string[];
    periodMode?: 'grouped-bar' | 'line';
    monthData?: Record<string, Array<Record<string, string | number>>>;
  };
}

export interface ParsedContent {
  textContent: string;
  charts: ChartSpec[];
}

const ALLOWED_CHART_TYPES = new Set<string>(['bar', 'line', 'pie']);
const MAX_STRING_LEN = 200;
const MAX_DATA_POINTS = 500;
const MAX_DATA_KEYS = 50;

/** Clamp a string to a safe display length */
function safeStr(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, MAX_STRING_LEN);
}

/** Validate and sanitise a parsed chart spec. Returns null if fundamentally invalid. */
function validateChartSpec(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // type — must be one of the three allowed values
  if (!ALLOWED_CHART_TYPES.has(obj.type as string)) return null;

  // data — must be a non-empty array, capped at MAX_DATA_POINTS
  if (!Array.isArray(obj.data) || obj.data.length === 0) return null;
  const rawData = (obj.data as unknown[]).slice(0, MAX_DATA_POINTS);

  // Validate each data row — values must be string or finite number
  const cleanData: Array<Record<string, string | number>> = [];
  for (const row of rawData) {
    if (!row || typeof row !== 'object') continue;
    const cleanRow: Record<string, string | number> = {};
    let keyCount = 0;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (keyCount++ >= MAX_DATA_KEYS) break;
      const safeKey = String(k).slice(0, 60);
      if (typeof v === 'string') {
        cleanRow[safeKey] = v.slice(0, MAX_STRING_LEN);
      } else if (typeof v === 'number' && isFinite(v)) {
        cleanRow[safeKey] = v;
      }
      // skip null, undefined, objects, arrays, NaN, Infinity
    }
    if (Object.keys(cleanRow).length > 0) cleanData.push(cleanRow);
  }
  if (cleanData.length === 0) return null;

  // config — optional object; pull only known safe fields
  const rawConfig = (obj.config && typeof obj.config === 'object') ? obj.config as Record<string, unknown> : {};
  const config: ChartSpec['config'] = {
    xKey:       safeStr(rawConfig.xKey)  || undefined,
    yKey:       safeStr(rawConfig.yKey)  || undefined,
    xLabel:     safeStr(rawConfig.xLabel) || undefined,
    yLabel:     safeStr(rawConfig.yLabel) || undefined,
    color:      safeStr(rawConfig.color) || undefined,
    periodMode: (rawConfig.periodMode === 'grouped-bar' || rawConfig.periodMode === 'line')
                  ? rawConfig.periodMode : undefined,
  };

  // entities / periods — arrays of strings, each capped
  if (Array.isArray(rawConfig.entities)) {
    config.entities = (rawConfig.entities as unknown[])
      .slice(0, 100)
      .map((e) => String(e).slice(0, MAX_STRING_LEN));
  }
  if (Array.isArray(rawConfig.periods)) {
    config.periods = (rawConfig.periods as unknown[])
      .slice(0, 100)
      .map((p) => String(p).slice(0, MAX_STRING_LEN));
  }

  // monthData — nested record of arrays; apply same row validation
  if (rawConfig.monthData && typeof rawConfig.monthData === 'object') {
    const cleanMonthData: Record<string, Array<Record<string, string | number>>> = {};
    for (const [month, rows] of Object.entries(rawConfig.monthData as Record<string, unknown>)) {
      if (!Array.isArray(rows)) continue;
      const safeMonth = month.slice(0, 60);
      cleanMonthData[safeMonth] = (rows as unknown[]).slice(0, MAX_DATA_POINTS).map((row) => {
        const cleanRow: Record<string, string | number> = {};
        if (row && typeof row === 'object') {
          for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
            const safeKey = String(k).slice(0, 60);
            if (typeof v === 'string') cleanRow[safeKey] = v.slice(0, MAX_STRING_LEN);
            else if (typeof v === 'number' && isFinite(v)) cleanRow[safeKey] = v;
          }
        }
        return cleanRow;
      }).filter((r) => Object.keys(r).length > 0);
    }
    config.monthData = cleanMonthData;
  }

  return {
    type:  obj.type as ChartSpec['type'],
    title: safeStr(obj.title),
    data:  cleanData,
    config,
  };
}

export function parseCharts(content: string): ParsedContent {
  const chartRegex = /```chart\s*\n([\s\S]*?)\n```/g;
  const charts: ChartSpec[] = [];
  let textContent = content;
  
  let match;
  while ((match = chartRegex.exec(content)) !== null) {
    try {
      const chartJson = match[1].trim();
      const raw = JSON.parse(chartJson);
      const chartSpec = validateChartSpec(raw);
      if (chartSpec) charts.push(chartSpec);
    } catch (error) {
      console.error('Failed to parse chart specification:', error);
    }
  }
  
  textContent = textContent.replace(chartRegex, '');
  
  return {
    textContent: textContent.trim(),
    charts,
  };
}
