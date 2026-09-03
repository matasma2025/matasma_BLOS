import { useState } from "react";
import { X, ChevronDown, Database, FileText, Globe, TrendingUp, Info } from "lucide-react";

// ── tiny helpers ────────────────────────────────────────────────
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span>{value}</span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                opt === value ? "font-medium text-blue-600" : "text-gray-700"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

// ── Main component ───────────────────────────────────────────────
export function CreateBoardDialog() {
  const [title, setTitle] = useState("Quarterly P&L Review");
  const [description, setDescription] = useState(
    "Track revenue, expenses, and profit trends for each quarter with clear visual insights."
  );
  const [prompts, setPrompts] = useState(
    "I'll help you analyze your quarterly Profit & Loss statement. I'm configured to:\n- Compare revenue vs previous quarters and identify growth trends\n- Break down expense categories and flag unusual increases\n- Calculate profit margins and key profitability metrics\n- Highlight areas for cost optimization\n\nPlease upload your P&L statement or I can analyze your enterprise data if available."
  );
  const [dataSources, setDataSources] = useState({
    enterprise: true,
    vault: true,
    webApis: false,
    financialApis: true,
  });

  // NEW cube mapping state
  const [cubeMapping, setCubeMapping] = useState({
    actualsColumn: "Actual",
    budgetColumn: "TBP 2025",
    forecastColumn: "YTD Forecast",
    budgetYear: "2025",
    rollingForecasts: { CF02: true, CF05: true, CF09: false, CF11: false },
  });

  const actualsOptions = ["Actual", "Actuals", "ACT", "YTD Actual"];
  const budgetOptions = ["TBP 2025", "TBP 2024", "Budget 2025", "Budget 2024", "Plan 2025"];
  const forecastOptions = ["YTD Forecast", "CF02 2025", "CF05 2025", "CF09 2025", "Latest Forecast"];
  const yearOptions = ["2025", "2024", "2026"];

  return (
    <div className="min-h-screen bg-gray-500/40 flex items-start justify-center pt-8 pb-8 px-4 font-sans">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Create Board from Quarterly P&L Review
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Customize the board settings and analysis prompts, then start analyzing
            </p>
          </div>
          <button className="ml-4 rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto max-h-[78vh] px-6 py-5 space-y-6">

          {/* Board Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Board Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          {/* Analysis Prompts */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Analysis Prompts</label>
            <textarea
              value={prompts}
              onChange={(e) => setPrompts(e.target.value)}
              rows={7}
              className="w-full rounded-md border border-gray-200 px-3 py-2 font-mono text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <p className="text-xs text-gray-400">
              This message will be shown when you start analyzing with this board
            </p>
          </div>

          {/* Data Sources */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Data Sources</label>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {[
                { key: "enterprise", icon: Database, label: "Enterprise Data", desc: "Access company-wide financial documents" },
                { key: "vault",      icon: FileText, label: "Vault Documents",  desc: "Personal uploaded documents" },
                { key: "webApis",    icon: Globe,    label: "Web APIs",          desc: "Search web for market data and news" },
                { key: "financialApis", icon: TrendingUp, label: "Financial APIs", desc: "External financial data sources" },
              ].map(({ key, icon: Icon, label, desc }) => (
                <div key={key} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">{label}</div>
                      <div className="text-xs text-gray-400">{desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={dataSources[key as keyof typeof dataSources]}
                    onChange={(v) => setDataSources({ ...dataSources, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── NEW: Cube Column Mapping ─────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">
                Cube Column Mapping
              </label>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                NEW
              </span>
              <div className="group relative ml-auto">
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute right-0 bottom-6 z-10 hidden group-hover:block w-64 rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg">
                  Maps your natural language terms (actuals, budget) to the exact column values stored in your Anaplan cube. Configured once per tenant.
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-4">

              {/* 2-col grid: Actuals + Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Actuals Column
                  </label>
                  <Select
                    value={cubeMapping.actualsColumn}
                    options={actualsOptions}
                    onChange={(v) => setCubeMapping({ ...cubeMapping, actualsColumn: v })}
                  />
                  <p className="text-xs text-gray-400">plan_type value for "Actuals"</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Budget Column
                  </label>
                  <Select
                    value={cubeMapping.budgetColumn}
                    options={budgetOptions}
                    onChange={(v) => setCubeMapping({ ...cubeMapping, budgetColumn: v })}
                  />
                  <p className="text-xs text-gray-400">plan_type value for "Budget"</p>
                </div>
              </div>

              {/* 2-col grid: Forecast + Budget Year */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Forecast Column
                  </label>
                  <Select
                    value={cubeMapping.forecastColumn}
                    options={forecastOptions}
                    onChange={(v) => setCubeMapping({ ...cubeMapping, forecastColumn: v })}
                  />
                  <p className="text-xs text-gray-400">plan_type value for "Forecast"</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Default Budget Year
                  </label>
                  <Select
                    value={cubeMapping.budgetYear}
                    options={yearOptions}
                    onChange={(v) => setCubeMapping({ ...cubeMapping, budgetYear: v })}
                  />
                  <p className="text-xs text-gray-400">Used when user says "budget" with no year</p>
                </div>
              </div>

              {/* Rolling Forecasts */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Rolling Forecasts to Expose
                </label>
                <div className="flex flex-wrap gap-4">
                  {(["CF02", "CF05", "CF09", "CF11"] as const).map((cf) => (
                    <Checkbox
                      key={cf}
                      checked={cubeMapping.rollingForecasts[cf]}
                      onChange={(v) =>
                        setCubeMapping({
                          ...cubeMapping,
                          rollingForecasts: { ...cubeMapping.rollingForecasts, [cf]: v },
                        })
                      }
                      label={`${cf} 2025`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Checked versions will be selectable in board queries
                </p>
              </div>

              {/* Preview pill */}
              <div className="rounded-md bg-white border border-gray-200 px-3 py-2.5 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 font-medium mr-1 self-center">Preview:</span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-100">
                  actuals → {cubeMapping.actualsColumn}
                </span>
                <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-100">
                  budget → {cubeMapping.budgetColumn}
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100">
                  forecast → {cubeMapping.forecastColumn}
                </span>
              </div>
            </div>
          </div>
          {/* ── End Cube Column Mapping ── */}

        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create Board
          </button>
        </div>
      </div>
    </div>
  );
}
