import { useState } from "react";
import type { FormEvent } from "react";
import "./_group.css";
import {
  Building2, Check, CheckCircle2, ChevronDown, FileText, Folder, Globe2, Home,
  KeyRound, LayoutGrid, LockKeyhole, Pencil, Plus, Search, ShieldCheck, Trash2,
  UserRoundPlus, Users, Workflow, X,
} from "lucide-react";

type DomainUser = { email: string; role: "Admin" | "Standard"; otp: string; added: string };
const seedUsers: DomainUser[] = [
  { email: "bosch.admin@bosch.com", role: "Admin", otp: "123456", added: "09/03/2026" },
  { email: "finance.lead@bosch.com", role: "Admin", otp: "123456", added: "09/03/2026" },
  { email: "analyst@bosch.com", role: "Standard", otp: "Email OTP", added: "09/09/2026" },
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
    <div className="mt-auto space-y-2 pt-6"><button className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1f7777] text-[11px] font-semibold text-white shadow-sm"><Plus size={14} />New Analysis</button><div className="flex h-10 items-center justify-between rounded-lg bg-white px-2.5 text-[11px] text-[#385252]"><span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#d8e9e6] text-[9px] font-bold text-[#276b69]">BA</span>Bosch Admin</span><ChevronDown size={14} className="text-[#849795]" /></div></div>
  </aside>;
}

function Tabs({ active }: { active: "users" | "audit" }) {
  return <div className="flex h-[48px] items-end gap-1 border-b border-[#e4ecea] px-5 sm:px-7">
    <button className={`flex h-[36px] items-center gap-2 rounded-t-lg px-3.5 text-[11px] font-semibold ${active === "users" ? "border-b-2 border-[#278080] bg-[#f2f8f7] text-[#1f7070]" : "text-[#849493]"}`}><Users size={14} />Users</button>
    <button className={`flex h-[36px] items-center gap-2 rounded-t-lg px-3.5 text-[11px] font-semibold ${active === "audit" ? "border-b-2 border-[#278080] bg-[#f2f8f7] text-[#1f7070]" : "text-[#849493]"}`}><ShieldCheck size={14} />SSO Audit</button>
  </div>;
}

export function UsersProposed() {
  const [users, setUsers] = useState(seedUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  // The production page selects a domain only for the customer super-admin identity.
  // This illustration shows the existing domain-admin state; no new selection route is added.
  const isSuperAdmin = false;
  const showNotice = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const invite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setUsers((rows) => [...rows, { email: inviteEmail.trim(), role: "Standard", otp: "Email OTP", added: "10/21/2026" }]);
    setInviteEmail(""); setInviteOpen(false); showNotice("User added to bosch.com");
  };
  const deleteUser = (index: number) => {
    if (window.confirm(`Remove user "${users[index].email}"?`)) { setUsers((rows) => rows.filter((_, i) => i !== index)); showNotice("User removed"); }
  };
  return <div className="min-h-[100dvh] bg-[#edf4f2] p-3 font-['DM_Sans',sans-serif] text-[#233b3b] sm:p-4">
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1600px] gap-3">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden rounded-[18px] border border-[#dce8e6] bg-[#fbfdfc] shadow-[0_8px_30px_#194b4b0a]">
        <header className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#d9e8e5] bg-[#e5f1ef] px-5 py-3.5 sm:px-7">
          <div><div className="mb-1 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[.14em] text-[#6f8b88]"><span>Administration</span><span>/</span><span>User access</span></div><h1 className="text-[19px] font-bold tracking-[-.035em] text-[#1c3a3a]">User Management</h1><p className="mt-0.5 text-[11px] text-[#6e8582]">{isSuperAdmin ? "Select a domain and manage its users" : "Manage users in bosch.com"}</p></div>
          <button onClick={() => setInviteOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-[#217878] px-3.5 text-[11px] font-semibold text-white shadow-[0_2px_5px_#1b69692e] transition hover:bg-[#185f60]"><UserRoundPlus size={15} />Invite User</button>
        </header>
        <Tabs active="users" />
        <div className="space-y-4 p-4 sm:p-6 lg:px-7">
          {isSuperAdmin ? <section className="rounded-xl border border-[#dce8e6] bg-white p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Globe2 size={17} className="text-[#277878]" />Select Domain</div><p className="mb-3 text-xs text-[#768986]">Choose a domain to manage its users</p><select aria-label="Select a domain to manage" className="h-10 w-full rounded-lg border border-[#d7e3e1] bg-white px-3 text-sm"><option>Select a domain to manage</option><option>bosch.com — bosch.admin@bosch.com</option></select></section> : <section className="rounded-xl border border-[#dce8e6] bg-white px-4 py-4 shadow-[0_2px_8px_#22474708] sm:px-5">
            <div className="mb-4 flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf4f2] text-[#287b79]"><Globe2 size={16} /></span><div><h2 className="text-[13px] font-bold tracking-[-.02em]">Domain Information</h2><p className="mt-0.5 text-[10px] text-[#80918f]">Identity settings and user capacity</p></div><span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#eaf5ef] px-2.5 py-1 text-[9px] font-semibold text-[#317451]"><span className="h-1.5 w-1.5 rounded-full bg-[#4c9c6d]" />Active domain</span></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[["Domain", "bosch.com"], ["Admin", "bosch.admin@bosch.com"], ["Default OTP", "123456"], ["Users", `${users.length} / 100`]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-[#e5ecea] bg-[#f8fbfa] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#839491]">{label}</p><p className="mt-1 truncate text-[12px] font-semibold text-[#314c4b]">{value}</p></div>)}
            </div>
            <div className="mt-2 rounded-lg border border-[#e5ecea] bg-[#f8fbfa] px-3.5 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold text-[#607674]">Quota Usage</span><span className="text-[10px] font-bold tabular-nums text-[#357e7b]">{users.length}% used <span className="font-normal text-[#849390]">· {users.length} of 100 seats</span></span></div><div className="h-[6px] overflow-hidden rounded-full bg-[#e4eeec]"><div className="h-full min-w-[8px] rounded-full bg-[#4b9993]" style={{ width: `${users.length}%` }} /></div></div>
          </section>}
          <section className="overflow-hidden rounded-xl border border-[#dce8e6] bg-white shadow-[0_2px_8px_#22474708]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"><div><div className="flex items-center gap-2"><h2 className="text-[13px] font-bold tracking-[-.02em]">Domain Users</h2><span className="rounded-md bg-[#edf5f3] px-1.5 py-0.5 text-[9px] font-bold text-[#397c78]">{users.length}</span></div><p className="mt-1 text-[10px] text-[#82928f]">Users registered in bosch.com</p></div><span className="inline-flex items-center gap-1.5 text-[10px] text-[#7d8e8c]"><LockKeyhole size={12} />Domain-scoped access</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left"><thead><tr className="border-y border-[#e8efed] bg-[#f5f9f8] text-[9px] font-bold uppercase tracking-[.1em] text-[#82928f]">{["Email", "Role", "OTP", "Added", "Actions"].map((item) => <th key={item} className="px-5 py-2.5">{item}</th>)}</tr></thead><tbody>{users.map((user, i) => <tr key={`${user.email}-${i}`} className="border-b border-[#edf1f0] text-[11px] last:border-0 hover:bg-[#f8fbfa]"><td className="px-5 py-3.5 font-semibold text-[#36504f]">{user.email}</td><td className="px-5 py-3.5">{user.role === "Admin" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f3f1] px-2.5 py-1 text-[9px] font-semibold text-[#28736f]"><CheckCircle2 size={12} />Admin</span> : <span className="rounded-full bg-[#f0f3f2] px-2.5 py-1 text-[9px] font-medium text-[#687b79]">Standard</span>}</td><td className="px-5 py-3.5">{user.otp === "Email OTP" ? <span className="rounded-md bg-[#f2f5f4] px-2 py-1 text-[9px] text-[#687b79]">Email OTP</span> : <span className="inline-flex items-center gap-1 rounded-md bg-[#f2f6f5] px-2 py-1 font-mono text-[10px] text-[#546a68]"><KeyRound size={11} />{user.otp}</span>}</td><td className="px-5 py-3.5 text-[10px] tabular-nums text-[#798a88]">{user.added}</td><td className="px-5 py-3.5"><div className="flex items-center gap-1.5"><button aria-label={`Edit ${user.email}`} onClick={() => setEditing(i)} className="flex h-7 items-center gap-1 rounded-md border border-[#dce6e4] px-2 text-[9px] font-semibold text-[#607d7b] transition hover:border-[#7bb2ac] hover:bg-[#eff8f6] hover:text-[#216e6c]"><Pencil size={11} />Edit</button><button aria-label={`Delete ${user.email}`} onClick={() => deleteUser(i)} className="flex h-7 items-center gap-1 rounded-md border border-[#eadfdd] px-2 text-[9px] font-semibold text-[#aa6760] transition hover:bg-[#fbefed]"><Trash2 size={11} />Delete</button></div></td></tr>)}</tbody></table></div>
          </section>
          <p className="flex items-center gap-1.5 px-1 text-[9px] text-[#91a09d]"><LockKeyhole size={11} />Illustrative data for design review · not connected to live accounts</p>
        </div>
      </main>
    </div>
    {(inviteOpen || editing !== null) && <div className="fixed inset-0 z-20 grid place-items-center bg-[#1c3938]/30 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setInviteOpen(false); setEditing(null); } }}><section className="w-full max-w-[420px] rounded-2xl border border-[#dce8e6] bg-[#fbfdfc] p-5 shadow-[0_20px_60px_#12383830]"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-[16px] font-bold">{inviteOpen ? "Invite New User" : "Edit User"}</h2><p className="mt-1 text-[11px] text-[#748784]">{inviteOpen ? "Add a user to bosch.com" : users[editing ?? 0]?.email}</p></div><button aria-label="Close" onClick={() => { setInviteOpen(false); setEditing(null); }} className="grid h-7 w-7 place-items-center rounded-md text-[#718582] hover:bg-[#edf4f2]"><X size={16} /></button></div>{inviteOpen ? <form onSubmit={invite} className="space-y-4"><label className="block text-[11px] font-semibold text-[#506966]">Email Address<input autoFocus type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@bosch.com" className="mt-1.5 h-10 w-full rounded-lg border border-[#d9e4e2] bg-white px-3 text-[12px] outline-none focus:border-[#4e9993]" /><span className="mt-1 block text-[10px] font-normal text-[#879592]">Email must match the domain: @bosch.com</span></label><label className="block text-[11px] font-semibold text-[#506966]">Role<select className="mt-1.5 h-10 w-full rounded-lg border border-[#d9e4e2] bg-white px-3 text-[12px]"><option>Standard User</option><option>Domain Admin</option></select></label><label className="block text-[11px] font-semibold text-[#506966]">Hardcoded OTP (optional)<input maxLength={10} placeholder="6-digit code" className="mt-1.5 h-10 w-full rounded-lg border border-[#d9e4e2] bg-white px-3 text-[12px]" /><span className="mt-1 block text-[10px] font-normal text-[#879592]">If set, this user will use this code instead of email OTP</span></label><button className="h-10 w-full rounded-lg bg-[#217878] text-[11px] font-semibold text-white">Add User</button></form> : <div className="space-y-4"><label className="block text-[11px] font-semibold text-[#506966]">Role<select className="mt-1.5 h-10 w-full rounded-lg border border-[#d9e4e2] bg-white px-3 text-[12px]"><option>{users[editing ?? 0]?.role === "Admin" ? "Domain Admin" : "Standard User"}</option><option>Standard User</option><option>Domain Admin</option></select></label><label className="block text-[11px] font-semibold text-[#506966]">Hardcoded OTP (optional)<input defaultValue={users[editing ?? 0]?.otp === "Email OTP" ? "" : users[editing ?? 0]?.otp} placeholder="6-digit code" className="mt-1.5 h-10 w-full rounded-lg border border-[#d9e4e2] bg-white px-3 text-[12px]" /><span className="mt-1 block text-[10px] font-normal text-[#879592]">Leave empty to use email-based OTP</span></label><div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="h-9 rounded-lg border border-[#dce6e4] px-3 text-[11px] font-semibold text-[#607572]">Cancel</button><button onClick={() => { setEditing(null); showNotice("User settings updated"); }} className="h-9 rounded-lg bg-[#217878] px-3 text-[11px] font-semibold text-white">Save Changes</button></div></div>}</section></div>}
    {toast && <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-lg bg-[#1c4d49] px-4 py-2.5 text-[11px] font-semibold text-white shadow-lg"><Check size={14} />{toast}</div>}
  </div>;
}
