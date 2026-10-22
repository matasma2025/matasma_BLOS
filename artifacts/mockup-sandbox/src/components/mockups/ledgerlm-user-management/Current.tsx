import { useState } from "react";
import "./_group.css";
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Download,
  Edit3,
  FileText,
  Folder,
  Globe2,
  Home,
  KeyRound,
  LayoutGrid,
  LogIn,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundPlus,
  UserX,
  Workflow,
} from "lucide-react";

const users = [
  { email: "bosch.admin@bosch.com", role: "Admin", otp: "123456", added: "09/03/2026" },
  { email: "finance.lead@bosch.com", role: "Admin", otp: "123456", added: "09/03/2026" },
  { email: "analyst@bosch.com", role: "Standard", otp: "Email OTP", added: "09/09/2026" },
];

const auditRows = [
  { time: "21 Oct 2026, 09:42:18", email: "bosch.admin@bosch.com", event: "Login", actor: "Login", status: "Success", roleChange: "—", reason: "—", icon: LogIn, tone: "text-primary" },
  { time: "21 Oct 2026, 09:31:02", email: "analyst@bosch.com", event: "Login Failed", actor: "Login", status: "Failed", roleChange: "—", reason: "Invalid assertion", icon: ShieldAlert, tone: "text-destructive" },
  { time: "20 Oct 2026, 16:05:44", email: "finance.lead@bosch.com", event: "Provisioned", actor: "Sync Job", status: "Success", roleChange: "Standard", reason: "—", icon: UserRoundPlus, tone: "text-emerald-700" },
  { time: "20 Oct 2026, 15:52:11", email: "analyst@bosch.com", event: "Role Updated", actor: "Sync Job", status: "Success", roleChange: "Standard → Admin", reason: "—", icon: ArrowRightLeft, tone: "text-violet-700" },
  { time: "19 Oct 2026, 13:14:07", email: "former.user@bosch.com", event: "Deactivated", actor: "Sync Job", status: "Success", roleChange: "—", reason: "Removed from group", icon: UserX, tone: "text-amber-700" },
];

function Sidebar() {
  const primary = [
    { label: "Home", icon: Home },
    { label: "Vault", icon: Folder },
    { label: "Boards", icon: LayoutGrid },
    { label: "Agentic Workflow", icon: Workflow },
  ];
  const admin = [
    { label: "Enterprise Data", icon: Building2 },
    { label: "User Management", icon: UserRoundPlus, active: true },
    { label: "Agentic Workflow", icon: Workflow },
    { label: "Board Administration", icon: FileText },
  ];

  return (
    <aside className="hidden w-[208px] shrink-0 flex-col rounded-2xl bg-[#dce9e8] p-3 md:flex">
      <div className="mb-5 flex items-center gap-2 px-1 text-sm font-bold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] text-white">✦</span>
        LedgerLM
      </div>
      <div className="mb-4 flex h-8 items-center gap-2 rounded-md border border-border/70 bg-white px-2 text-[11px] text-muted-foreground">
        <Search className="h-3.5 w-3.5" /> Search for chats...
      </div>
      <nav className="space-y-1">
        {primary.map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {label}
          </div>
        ))}
      </nav>
      <p className="mb-1 mt-5 px-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Admin</p>
      <nav className="space-y-1">
        {admin.map(({ label, icon: Icon, active }) => (
          <div key={label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${active ? "bg-white font-medium text-primary shadow-sm" : "text-muted-foreground"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </div>
        ))}
      </nav>
      <p className="mb-1 mt-5 px-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/80">Recent Chats</p>
      <div className="space-y-1 px-2 text-[10px] leading-5 text-muted-foreground">
        <p>New Analysis</p>
        <p className="truncate">Analysis - Bosch KPI Metric Board</p>
        <p>New Analysis</p>
        <p className="truncate">Analysis - Resume_Sudhan-KS.pdf</p>
      </div>
      <div className="mt-auto space-y-2 pt-4">
        <button className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-primary text-[11px] font-medium text-primary-foreground">
          <UserPlus className="h-3.5 w-3.5" /> New Analysis
        </button>
        <div className="flex h-9 items-center justify-between rounded-md bg-white px-2 text-[11px]">
          <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] text-white">BA</span>Bosch Admin</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}

function UsersTab() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe2 className="h-4 w-4" /></span>
          Domain Information
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Domain", "bosch.com"],
            ["Admin", "bosch.admin@bosch.com"],
            ["Default OTP", "123456"],
            ["Users", "3 / 100"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 truncate text-xs font-medium">{value}</p>
            </div>
          ))}
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2 xl:col-span-4">
            <div className="mb-2 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Quota Usage</span>
              <span className="font-medium text-foreground">3% used</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[3%] rounded-full bg-primary" /></div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Domain Users</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Users registered in bosch.com</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <thead className="bg-muted/40 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>{["Email", "Role", "OTP", "Added", "Actions"].map((label) => <th key={label} className="px-4 py-2.5">{label}</th>)}</tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-t border-border/60 text-[11px] hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${user.role === "Admin" ? "bg-primary/10 font-medium text-primary" : "bg-muted text-muted-foreground"}`}>
                      {user.role === "Admin" && <CheckCircle2 className="h-3 w-3" />}{user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 font-mono text-[10px]">
                      {user.otp !== "Email OTP" && <KeyRound className="h-3 w-3" />}{user.otp}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{user.added}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AuditTab() {
  const metrics = [
    { label: "Total SSO Events", value: "1,248", tone: "text-foreground" },
    { label: "Logins · 30d", value: "864", tone: "text-primary" },
    { label: "Provisioned · 30d", value: "42", tone: "text-emerald-700" },
    { label: "Deactivated · 30d", value: "8", tone: "text-amber-700" },
    { label: "Role Changes · 30d", value: "16", tone: "text-violet-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border/70 bg-white px-3 py-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground">{metric.label}</p>
            <p className={`mt-1 text-xl font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border/70 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="min-w-36 flex-1">
            <span className="mb-1 block text-[9px] font-medium text-muted-foreground">Event type</span>
            <select className="h-8 w-full rounded-md border border-border bg-white px-2 text-[10px]"><option>All SSO Events</option></select>
          </label>
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-[9px] font-medium text-muted-foreground">Email</span>
            <input className="h-8 w-full rounded-md border border-border bg-white px-2 text-[10px]" placeholder="Filter by email..." />
          </label>
          <label className="w-32">
            <span className="mb-1 block text-[9px] font-medium text-muted-foreground">From</span>
            <input type="date" className="h-8 w-full rounded-md border border-border bg-white px-2 text-[10px]" />
          </label>
          <label className="w-32">
            <span className="mb-1 block text-[9px] font-medium text-muted-foreground">To</span>
            <input type="date" className="h-8 w-full rounded-md border border-border bg-white px-2 text-[10px]" />
          </label>
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[10px] font-medium"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <button className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[10px] font-medium text-white"><Download className="h-3.5 w-3.5" />Export CSV</button>
        </div>
        <div className="flex items-center gap-2 border-t border-border/60 pt-2 text-[9px] text-muted-foreground">
          <span>Showing 1–5 of 1,248 events</span><span className="rounded-full bg-muted px-2 py-0.5">Updated just now</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead className="bg-muted/40 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>{["Timestamp", "Email", "Event", "Role / Change", "Triggered By", "Status", "Reason"].map((label) => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr>
            </thead>
            <tbody>
              {auditRows.map((row) => {
                const Icon = row.icon;
                return (
                  <tr key={row.time} className="border-t border-border/60 text-[10px] hover:bg-muted/20">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[9px] text-muted-foreground">{row.time}</td>
                    <td className="max-w-40 truncate px-3 py-3 font-medium">{row.email}</td>
                    <td className="px-3 py-3"><span className={`flex items-center gap-1.5 font-medium ${row.tone}`}><Icon className="h-3.5 w-3.5" />{row.event}</span></td>
                    <td className="px-3 py-3 font-mono text-[9px] text-muted-foreground">{row.roleChange}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border px-2 py-1 text-[9px]">{row.actor}</span></td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-medium ${row.status === "Success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.status}</span></td>
                    <td className="px-3 py-3 text-muted-foreground">{row.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
          <span>Page 1 of 25</span>
          <div className="flex gap-1.5"><button className="rounded-md border border-border px-2 py-1">← Prev</button><button className="rounded-md border border-border px-2 py-1">Next →</button></div>
        </div>
      </section>
    </div>
  );
}

export function Current() {
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  return (
    <div className="min-h-screen bg-primary/10 p-3 font-sans text-foreground sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-3">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary/40 px-5 py-4 sm:px-6">
            <div>
              <h1 className="text-base font-semibold tracking-tight">User Management</h1>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Manage users in bosch.com</p>
            </div>
            <button className="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[10px] font-medium text-white shadow-sm"><UserPlus className="h-3.5 w-3.5" />Invite User</button>
          </header>
          <div className="flex h-10 items-center gap-1 border-b border-border/70 px-5 sm:px-6">
            <button onClick={() => setActiveTab("users")} className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-[10px] ${activeTab === "users" ? "bg-white font-semibold text-primary shadow-sm" : "text-muted-foreground"}`}><UserRoundPlus className="h-3.5 w-3.5" />Users</button>
            <button onClick={() => setActiveTab("audit")} className={`flex h-7 items-center gap-1.5 rounded-md px-3 text-[10px] ${activeTab === "audit" ? "bg-white font-semibold text-primary shadow-sm" : "text-muted-foreground"}`}><ShieldCheck className="h-3.5 w-3.5" />SSO Audit</button>
          </div>
          <div className="p-4 sm:p-5">
            {activeTab === "users" ? <UsersTab /> : <AuditTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
