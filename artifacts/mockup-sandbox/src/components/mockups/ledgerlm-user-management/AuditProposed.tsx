import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import "./_group.css";
import {
  ArrowRightLeft, Building2, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, Download, FileText, Folder, Home, LayoutGrid,
  LogIn, RefreshCw, Search, ShieldAlert, ShieldCheck, UserPlus, UserRoundPlus,
  UserX, Workflow,
} from "lucide-react";

type AuditRow = { time: string; email: string; event: string; role: string; actor: string; status: "Success" | "Failed"; reason: string; eventType: string };
const auditRows: AuditRow[] = [
  { time: "21 Oct 2026, 09:42:18", email: "bosch.admin@bosch.com", event: "Login", actor: "Login", status: "Success", role: "—", reason: "—", eventType: "SSO_LOGIN" },
  { time: "21 Oct 2026, 09:31:02", email: "analyst@bosch.com", event: "Login Failed", actor: "Login", status: "Failed", role: "—", reason: "Invalid assertion", eventType: "SSO_LOGIN_FAILED" },
  { time: "20 Oct 2026, 16:05:44", email: "finance.lead@bosch.com", event: "Provisioned", actor: "Sync Job", status: "Success", role: "Standard", reason: "—", eventType: "SSO_USER_PROVISIONED" },
  { time: "20 Oct 2026, 15:52:11", email: "analyst@bosch.com", event: "Role Updated", actor: "Sync Job", status: "Success", role: "Standard → Admin", reason: "—", eventType: "SSO_ROLE_UPDATED" },
  { time: "19 Oct 2026, 13:14:07", email: "former.user@bosch.com", event: "Deactivated", actor: "Sync Job", status: "Success", role: "—", reason: "Removed from group", eventType: "SSO_USER_DEACTIVATED" },
  { time: "19 Oct 2026, 11:08:43", email: "controller@bosch.com", event: "Role Synced", actor: "Login", status: "Success", role: "Standard → Admin", reason: "—", eventType: "SSO_ROLE_SYNCED" },
  { time: "18 Oct 2026, 17:26:09", email: "analyst@bosch.com", event: "Login", actor: "Login", status: "Success", role: "—", reason: "—", eventType: "SSO_LOGIN" },
  { time: "18 Oct 2026, 14:02:31", email: "finance.lead@bosch.com", event: "Provisioned", actor: "Sync Job", status: "Success", role: "Standard", reason: "—", eventType: "SSO_USER_PROVISIONED" },
];
const eventTypes = [
  ["", "All SSO Events"], ["SSO_LOGIN", "Login Success"], ["SSO_LOGIN_FAILED", "Login Failed"],
  ["SSO_USER_PROVISIONED", "User Provisioned"], ["SSO_USER_DEACTIVATED", "User Deactivated"],
  ["SSO_ROLE_SYNCED", "Role Synced (Login)"], ["SSO_ROLE_UPDATED", "Role Updated (Sync Job)"],
];

function Sidebar() {
  const mainItems = [{ label: "Home", Icon: Home }, { label: "Vault", Icon: Folder }, { label: "Boards", Icon: LayoutGrid }, { label: "Agentic Workflow", Icon: Workflow }];
  const adminItems = [{ label: "Enterprise Data", Icon: Building2 }, { label: "User Management", Icon: UserRoundPlus }, { label: "Agentic Workflow", Icon: Workflow }, { label: "Board Administration", Icon: FileText }];
  return <aside className="hidden w-[218px] shrink-0 flex-col rounded-[18px] border border-[#d1e1df] bg-[#e5efed] p-3.5 md:flex">
    <div className="mb-6 flex items-center gap-2.5 px-1 text-[14px] font-bold tracking-[-.03em] text-[#183d3d]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1e7777] text-white"><div className="h-2.5 w-2.5 rotate-45 border-2 border-white" /></span>LedgerLM</div>
    <div className="mb-5 flex h-9 items-center gap-2 rounded-lg border border-[#d4e0de] bg-white/90 px-2.5 text-[11px] text-[#758b8b]"><Search size={14} />Search for chats...</div>
    <nav className="space-y-1">{mainItems.map(({ label, Icon }) => <div key={label} className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[11px] text-[#637979]"><Icon size={14} strokeWidth={1.8} />{label}</div>)}</nav>
    <p className="mb-1.5 mt-6 px-2.5 text-[9px] font-bold uppercase tracking-[.13em] text-[#79908f]">Administration</p>
    <nav className="space-y-1">{adminItems.map(({ label, Icon }) => <div key={label} className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[11px] ${label === "User Management" ? "bg-white font-semibold text-[#176c6c] shadow-[0_1px_3px_#234a4a12]" : "text-[#637979]"}`}><Icon size={14} strokeWidth={1.8} />{label}</div>)}</nav>
    <p className="mb-1.5 mt-6 px-2.5 text-[9px] font-bold uppercase tracking-[.13em] text-[#79908f]">Recent Chats</p>
    <div className="space-y-1.5 px-2.5 text-[10px] leading-5 text-[#718583]"><p>New Analysis</p><p className="truncate">Analysis · Bosch KPI Metric Board</p><p>New Analysis</p><p className="truncate">Analysis · Regional outlook</p></div>
    <div className="mt-auto space-y-2 pt-6"><button className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1f7777] text-[11px] font-semibold text-white"><span className="text-base leading-none">+</span>New Analysis</button><div className="flex h-10 items-center justify-between rounded-lg bg-white px-2.5 text-[11px] text-[#385252]"><span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#d8e9e6] text-[9px] font-bold text-[#276b69]">BA</span>Bosch Admin</span><ChevronDown size={14} className="text-[#849795]" /></div></div>
  </aside>;
}
function eventIcon(type: string) {
  if (type === "SSO_LOGIN") return <LogIn size={14} />;
  if (type === "SSO_LOGIN_FAILED") return <ShieldAlert size={14} />;
  if (type === "SSO_USER_PROVISIONED") return <UserPlus size={14} />;
  if (type === "SSO_USER_DEACTIVATED") return <UserX size={14} />;
  if (type.includes("ROLE")) return <ArrowRightLeft size={14} />;
  return <ShieldCheck size={14} />;
}
function eventTone(type: string) {
  if (type === "SSO_LOGIN_FAILED") return "text-[#a94f4a]";
  if (type === "SSO_USER_PROVISIONED") return "text-[#347b59]";
  if (type === "SSO_USER_DEACTIVATED") return "text-[#a56b2a]";
  if (type.includes("ROLE")) return "text-[#686a9a]";
  return "text-[#267774]";
}

export function AuditProposed() {
  const [eventType, setEventType] = useState("");
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [refreshLabel, setRefreshLabel] = useState("Updated just now");
  const activeFilters = Boolean(eventType || email || from || to);
  const filteredRows = useMemo(() => auditRows.filter((row) => {
    if (eventType && row.eventType !== eventType) return false;
    if (email && !row.email.toLowerCase().includes(email.toLowerCase())) return false;
    const timestamp = new Date(row.time);
    if (from && timestamp < new Date(`${from}T00:00:00`)) return false;
    if (to && timestamp > new Date(`${to}T23:59:59`)) return false;
    return true;
  }), [eventType, email, from, to]);
  const total = activeFilters ? Math.max(filteredRows.length, 1) : 1248;
  const pageCount = Math.max(1, Math.ceil(total / 50));
  const visibleRows = activeFilters ? filteredRows.slice((page - 1) * 50, page * 50) : page === 1 ? auditRows.slice(0, 5) : auditRows.slice(3, 8);
  const resetPage = () => setPage(1);
  const onText = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => { setter(event.target.value); resetPage(); };
  const clearFilters = () => { setEventType(""); setEmail(""); setFrom(""); setTo(""); setPage(1); };
  const exportCsv = () => {
    const csv = [["Timestamp", "Email", "Event", "Role / Change", "Triggered By", "Status", "Reason"], ...filteredRows.map((r) => [r.time, r.email, r.event, r.role, r.actor, r.status, r.reason])].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = href; link.download = "domain-sso-audit-illustrative.csv"; link.click(); URL.revokeObjectURL(href);
  };
  const metrics = [
    { title: "Total SSO Events", value: "1,248", note: "All recorded events", tone: "base" },
    { title: "Logins (30d)", value: "864", note: "Successful sign-ins", tone: "teal" },
    { title: "Provisioned (30d)", value: "42", note: "New user accounts", tone: "green" },
    { title: "Deactivated (30d)", value: "8", note: "Access removed", tone: "amber" },
    { title: "Role Changes (30d)", value: "16", note: "Role assignments", tone: "slate" },
  ];
  return <div className="min-h-[100dvh] bg-[#edf4f2] p-3 font-['DM_Sans',sans-serif] text-[#233b3b] sm:p-4">
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1600px] gap-3">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden rounded-[18px] border border-[#dce8e6] bg-[#fbfdfc] shadow-[0_8px_30px_#194b4b0a]">
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#d9e8e5] bg-[#e5f1ef] px-5 py-3.5 sm:px-7">
          <div><div className="mb-1 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.14em] text-[#6f8b88]"><span>Administration</span><span>/</span><span>User access</span></div><h1 className="text-[19px] font-bold tracking-[-.035em] text-[#1c3a3a]">User Management</h1><p className="mt-0.5 text-[11px] text-[#6e8582]">Manage users in bosch.com</p></div>
          <div className="flex items-center gap-2 rounded-lg border border-[#d1e3df] bg-white/75 px-3 py-2 text-[10px] text-[#68817d]"><span className="h-1.5 w-1.5 rounded-full bg-[#4c9c6d]" />bosch.com <span className="text-[#b3c1bf]">·</span> Domain admin</div>
        </header>
        <div className="flex h-[48px] items-end gap-1 border-b border-[#e4ecea] px-5 sm:px-7"><button className="flex h-[36px] items-center gap-2 rounded-t-lg px-3.5 text-[11px] font-semibold text-[#849493]"><UsersIcon />Users</button><button className="flex h-[36px] items-center gap-2 rounded-t-lg border-b-2 border-[#278080] bg-[#f2f8f7] px-3.5 text-[11px] font-semibold text-[#1f7070]"><ShieldCheck size={14} />SSO Audit</button></div>
        <div className="space-y-4 p-4 sm:p-5 lg:px-7">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><div className="flex items-center gap-2"><h2 className="text-[14px] font-bold tracking-[-.025em]">SSO Audit Log</h2><span className="rounded-md border border-[#d9e7e4] bg-[#f4f9f8] px-2 py-0.5 text-[9px] font-medium text-[#607b77]">bosch.com</span></div><p className="mt-1 text-[10px] text-[#81918e]">Identity events and access changes · illustrative sample data</p></div><div className="flex items-center gap-1.5 text-[9px] text-[#849491]"><span className="h-1.5 w-1.5 rounded-full bg-[#4a9b73]" />Auto-refresh every 30 seconds</div></div>
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            {metrics.map((metric, i) => <div key={metric.title} className="relative overflow-hidden rounded-xl border border-[#dfe9e7] bg-white px-3.5 py-3 shadow-[0_2px_7px_#214c4b08]"><span className={`absolute left-0 top-0 h-full w-[3px] ${["bg-[#6e8986]", "bg-[#398a84]", "bg-[#5b9a70]", "bg-[#bb8a48]", "bg-[#777b9e]"][i]}`} /><p className="text-[9px] font-semibold text-[#778b87]">{metric.title}</p><p className={`mt-1 text-[22px] font-bold leading-none tracking-[-.045em] tabular-nums ${metric.tone === "teal" ? "text-[#267774]" : metric.tone === "green" ? "text-[#397b59]" : metric.tone === "amber" ? "text-[#a97735]" : metric.tone === "slate" ? "text-[#65698b]" : "text-[#2e4947]"}`}>{metric.value}</p><p className="mt-1.5 text-[9px] text-[#92a09e]">{metric.note}</p></div>)}
          </section>
          <section className="rounded-xl border border-[#dfe9e7] bg-white p-3.5 shadow-[0_2px_7px_#214c4b08] sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-[#728784]"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#edf5f3] text-[#4d817c]"><Search size={12} /></span>Filter events</div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[1.25fr_1.4fr_.85fr_.85fr_auto_auto_auto] xl:items-end">
              <label className="block"><span className="mb-1 block text-[9px] font-semibold text-[#758985]">Event type</span><select value={eventType} onChange={(e) => { setEventType(e.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-[#dce6e4] bg-[#fcfdfd] px-2.5 text-[10px] text-[#405a57] outline-none focus:border-[#64a49f]">{eventTypes.map(([value, label]) => <option key={value || "all"} value={value}>{label}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-[9px] font-semibold text-[#758985]">Email</span><input value={email} onChange={onText(setEmail)} placeholder="Filter by email..." className="h-9 w-full rounded-lg border border-[#dce6e4] bg-[#fcfdfd] px-2.5 text-[10px] outline-none placeholder:text-[#9aa9a6] focus:border-[#64a49f]" /></label>
              <label className="block"><span className="mb-1 block text-[9px] font-semibold text-[#758985]">From</span><span className="relative block"><CalendarDays size={12} className="pointer-events-none absolute left-2.5 top-3 text-[#91a19e]" /><input type="date" value={from} onChange={onText(setFrom)} className="h-9 w-full rounded-lg border border-[#dce6e4] bg-[#fcfdfd] pl-7 pr-1 text-[10px] text-[#526764] outline-none focus:border-[#64a49f]" /></span></label>
              <label className="block"><span className="mb-1 block text-[9px] font-semibold text-[#758985]">To</span><span className="relative block"><CalendarDays size={12} className="pointer-events-none absolute left-2.5 top-3 text-[#91a19e]" /><input type="date" value={to} onChange={onText(setTo)} className="h-9 w-full rounded-lg border border-[#dce6e4] bg-[#fcfdfd] pl-7 pr-1 text-[10px] text-[#526764] outline-none focus:border-[#64a49f]" /></span></label>
              <button onClick={() => { setRefreshLabel("Updated just now"); window.setTimeout(() => setRefreshLabel("Updated just now"), 500); }} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#d7e3e1] px-3 text-[10px] font-semibold text-[#536d69] transition hover:bg-[#f5f9f8]"><RefreshCw size={13} />Refresh</button>
              <button onClick={exportCsv} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#247878] px-3 text-[10px] font-semibold text-white transition hover:bg-[#1a6666]"><Download size={13} />Export CSV</button>
              {activeFilters && <button onClick={clearFilters} className="h-9 rounded-lg px-2 text-[10px] font-semibold text-[#6d8581] underline decoration-[#b9cbc7] underline-offset-2 hover:text-[#216c6a]">Clear filters</button>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1f0] pt-2.5 text-[9px] text-[#8a9996]"><span>{activeFilters ? `Showing ${visibleRows.length ? (page - 1) * 50 + 1 : 0}–${(page - 1) * 50 + visibleRows.length} of ${total} events` : "Showing 1–5 of 1,248 events"}</span><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#60a280]" />{refreshLabel}</span></div>
          </section>
          <section className="overflow-hidden rounded-xl border border-[#dce7e5] bg-white shadow-[0_2px_8px_#22474708]">
            <div className="overflow-x-auto"><table className="w-full min-w-[990px] text-left"><thead><tr className="border-b border-[#e6edeb] bg-[#f4f8f7] text-[9px] font-bold uppercase tracking-[.09em] text-[#7c8e8b]">{["Timestamp", "Email", "Event", "Role / Change", "Triggered By", "Status", "Reason"].map((name) => <th key={name} className="px-3.5 py-3">{name}</th>)}</tr></thead><tbody>{visibleRows.map((row, i) => <tr key={`${row.time}-${i}`} className="border-b border-[#edf1f0] text-[10px] last:border-0 hover:bg-[#f8fbfa]"><td className="whitespace-nowrap px-3.5 py-3.5 font-mono text-[9px] tabular-nums text-[#748683]">{row.time}</td><td className="max-w-[180px] truncate px-3.5 py-3.5 font-semibold text-[#405856]">{row.email}</td><td className="px-3.5 py-3.5"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-semibold ${eventTone(row.eventType)}`}>{eventIcon(row.eventType)}{row.event}</span></td><td className="whitespace-nowrap px-3.5 py-3.5 font-mono text-[9px] text-[#6d7f7c]">{row.role}</td><td className="px-3.5 py-3.5"><span className="rounded-full border border-[#e2e9e7] bg-[#fbfcfc] px-2 py-1 text-[9px] text-[#697d79]">{row.actor}</span></td><td className="px-3.5 py-3.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${row.status === "Success" ? "bg-[#edf6ef] text-[#3a7954]" : "bg-[#fbefed] text-[#a85650]"}`}><span className={`h-1 w-1 rounded-full ${row.status === "Success" ? "bg-[#4c9a67]" : "bg-[#bd655b]"}`} />{row.status}</span></td><td className={`max-w-[180px] truncate px-3.5 py-3.5 ${row.reason === "—" ? "text-[#9ba8a5]" : "text-[#9d605b]"}`}>{row.reason}</td></tr>)}
              {!visibleRows.length && <tr><td colSpan={7} className="py-12 text-center"><div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-[#f1f6f5] text-[#668784]"><CircleAlert size={16} /></div><p className="text-[11px] font-semibold text-[#526a67]">No SSO events found</p><p className="mt-1 text-[10px] text-[#8b9a97]">Try changing the filters or clearing them.</p></td></tr>}
            </tbody></table></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8efed] bg-[#fcfdfd] px-3.5 py-2.5 text-[9px] text-[#7e8e8b]"><span>{activeFilters ? `Page ${page} of ${pageCount}` : "Page 1 of 25"} <span className="ml-1 text-[#a0adaa]">· 50 events per page</span></span><div className="flex items-center gap-1.5"><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-7 items-center gap-1 rounded-md border border-[#dce6e4] px-2.5 font-semibold text-[#607875] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={12} />Prev</button><span className="px-2">Page {page} of {activeFilters ? pageCount : 25}</span><button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="flex h-7 items-center gap-1 rounded-md border border-[#dce6e4] px-2.5 font-semibold text-[#607875] disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={12} /></button></div></div>
          </section>
          <p className="flex items-center gap-1.5 px-1 text-[9px] text-[#91a09d]"><ShieldCheck size={11} />Audit event sample is illustrative and not sourced from live API responses.</p>
        </div>
      </main>
    </div>
  </div>;
}
function UsersIcon() { return <UserRoundPlus size={14} />; }
