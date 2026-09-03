export default function Slide09NetworkMultitenant() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#1A1B26",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        color: "#C0CAF5",
        position: "relative",
      }}
    >
      {/* Left Sidebar */}
      <div
        style={{
          width: "22vw",
          height: "100vh",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          padding: "5vh 3vw",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1vw", marginBottom: "6vh" }}>
          <div style={{ width: "1.5vw", height: "1.5vw", backgroundColor: "#7AA2F7", borderRadius: "0.3vw" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF" }}>LedgerLM</div>
        </div>
        <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#565F89", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2vh" }}>Architecture</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh", marginBottom: "4vh" }}>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Authentication Flow</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Network & Multi-tenancy
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Deployment Pipeline</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Architecture
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Network Architecture & Multi-Tenancy
        </h1>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Network diagram column */}
          <div style={{ flex: 1.2 }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1.5vh", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Network Architecture (Azure)</div>
            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2vh 2vw", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", lineHeight: 2 }}>
              <div style={{ color: "#C0CAF5" }}>Internet</div>
              <div style={{ color: "#565F89", paddingLeft: "2vw" }}>│  HTTPS / TLS 1.2+</div>
              <div style={{ color: "#565F89", paddingLeft: "2vw" }}>▼</div>
              <div style={{ color: "#7AA2F7", paddingLeft: "2vw" }}>Azure App Service (public endpoint)</div>
              <div style={{ color: "#565F89", paddingLeft: "3vw" }}>│  internal (localhost only)</div>
              <div style={{ color: "#565F89", paddingLeft: "3vw" }}>├──► Node.js  :5000</div>
              <div style={{ color: "#565F89", paddingLeft: "3vw" }}>└──► Python   :8000</div>
              <div style={{ color: "#565F89", paddingLeft: "4vw" }}>│  Private Endpoint / VNet</div>
              <div style={{ color: "#9ECE6A", paddingLeft: "4vw" }}>├──► PostgreSQL Flexible Server</div>
              <div style={{ color: "#9ECE6A", paddingLeft: "4vw" }}>├──► Key Vault</div>
              <div style={{ color: "#9ECE6A", paddingLeft: "4vw" }}>└──► Blob Storage</div>
              <div style={{ color: "#565F89", marginTop: "1vh" }}>Azure OpenAI ◄── HTTPS (Azure backbone)</div>
              <div style={{ color: "#565F89" }}>SMTP         ◄── SMTPS :465</div>
            </div>
          </div>

          {/* Multi-tenancy column */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1.5vh", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Multi-Tenancy Design</div>

            <div style={{ backgroundColor: "rgba(122,162,247,0.06)", borderRadius: "0.5vw", padding: "2vh 2vw", border: "1px solid rgba(122,162,247,0.15)", marginBottom: "2vh" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1vh" }}>Single deployment — logical isolation</div>
              <div style={{ display: "flex", gap: "1.5vw", marginBottom: "1.5vh" }}>
                <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.2vh 1.2vw", border: "1px solid rgba(122,162,247,0.2)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#7AA2F7" }}>Bosch</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#565F89" }}>domain_id = UUID-A</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.2vh 1.2vw", border: "1px solid rgba(158,206,106,0.2)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#9ECE6A" }}>Nemko</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#565F89" }}>domain_id = UUID-B</div>
                </div>
              </div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6 }}>
                All DB queries scoped by <span style={{ fontFamily: "'DM Mono', monospace", color: "#7AA2F7" }}>domain_id</span> — derived from authenticated session, never from user input. No cross-tenant data joins possible.
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 1.8vw", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.8vh" }}>Isolation guarantees</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.7vh" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>· Session resolves tenant — no user-supplied domain</div>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>· Vector search scoped to company_ids from session</div>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>· Super admin identity hardcoded separately</div>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>· Cross-tenant test: HTTP 403 or empty result</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>09</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
