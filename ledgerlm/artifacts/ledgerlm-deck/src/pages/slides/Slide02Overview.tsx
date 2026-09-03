export default function Slide02Overview() {
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

        <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#565F89", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2vh" }}>
          Architecture
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh", marginBottom: "4vh" }}>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>System Overview</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Application Overview
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Components</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Flows</div>
        </div>

        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>
          v1.0 · June 2026
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "7vh 6vw",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1.5vh" }}>
          Application Overview
        </div>

        <h1
          style={{
            fontSize: "3.2vw",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 1.5vh 0",
            letterSpacing: "-0.02em",
          }}
        >
          What is LedgerLM?
        </h1>

        <p
          style={{
            fontSize: "1.2vw",
            color: "#9AA5CE",
            lineHeight: 1.6,
            maxWidth: "46vw",
            margin: "0 0 4vh 0",
          }}
        >
          A multi-tenant, AI-powered enterprise financial intelligence platform for ledger management, KPI analysis, and natural language querying of financial data — deployed on Azure App Service for Containers.
        </p>

        {/* Two columns */}
        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Left column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div
              style={{
                backgroundColor: "#16161E",
                borderRadius: "0.5vw",
                padding: "2.5vh 2vw",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Active Tenants</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#9ECE6A" }}>in.bosch.com</div>
                  <div style={{ fontSize: "0.9vw", color: "#565F89" }}>— Bosch BGSW/BDO-IT</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#7AA2F7", borderRadius: "50%" }} />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#7AA2F7" }}>nemko.com</div>
                  <div style={{ fontSize: "0.9vw", color: "#565F89" }}>— Nemko</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#E0AF68", borderRadius: "50%" }} />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#E0AF68" }}>ledgerlm.ai</div>
                  <div style={{ fontSize: "0.9vw", color: "#565F89" }}>— Super Admin</div>
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#16161E",
                borderRadius: "0.5vw",
                padding: "2.5vh 2vw",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Core Capabilities</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
                <div style={{ fontSize: "1vw", color: "#9AA5CE" }}>· Natural language financial queries (AI)</div>
                <div style={{ fontSize: "1vw", color: "#9AA5CE" }}>· KPI analysis with 33 deterministic builders</div>
                <div style={{ fontSize: "1vw", color: "#9AA5CE" }}>· Document ingestion & RAG pipeline</div>
                <div style={{ fontSize: "1vw", color: "#9AA5CE" }}>· Excel/Blob auto-ingestion via Anaplan</div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div
              style={{
                backgroundColor: "#16161E",
                borderRadius: "0.5vw",
                padding: "2.5vh 2vw",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>Hosting Platform</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5vh" }}>
                <div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89", marginBottom: "0.3vh" }}>Platform</div>
                  <div style={{ fontSize: "1vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace" }}>Azure App Service</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89", marginBottom: "0.3vh" }}>SKU</div>
                  <div style={{ fontSize: "1vw", color: "#C0CAF5", fontFamily: "'DM Mono', monospace" }}>P2v3 · 4 vCPU / 16 GB</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89", marginBottom: "0.3vh" }}>Runtime</div>
                  <div style={{ fontSize: "1vw", color: "#C0CAF5", fontFamily: "'DM Mono', monospace" }}>Linux Container</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89", marginBottom: "0.3vh" }}>Entry Port</div>
                  <div style={{ fontSize: "1vw", color: "#C0CAF5", fontFamily: "'DM Mono', monospace" }}>Port 80 (Nginx)</div>
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "rgba(122,162,247,0.06)",
                borderRadius: "0.5vw",
                padding: "2.5vh 2vw",
                border: "1px solid rgba(122,162,247,0.15)",
              }}
            >
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Security Posture</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1vw", marginBottom: "0.8vh" }}>
                <div style={{ fontSize: "3vw", fontWeight: 800, color: "#9ECE6A" }}>95%</div>
                <div style={{ fontSize: "1vw", color: "#9AA5CE" }}>TARA requirements implemented</div>
              </div>
              <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>
                18 of 19 requirements fully implemented. One partial item (DB SSL cert verification) is a planned pre-deployment fix.
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>02</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
