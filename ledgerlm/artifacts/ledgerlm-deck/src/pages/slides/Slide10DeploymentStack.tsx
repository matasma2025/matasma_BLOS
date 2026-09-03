export default function Slide10DeploymentStack() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Network & Multi-tenancy</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Deployment & Stack
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>TARA Security</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Deployment Pipeline & Tech Stack
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Deployment & Technology
        </h1>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Pipeline */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1.5vh", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Deployment Pipeline</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "0.3vw", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid rgba(122,162,247,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75vw", fontWeight: 700, color: "#7AA2F7", flexShrink: 0 }}>1</div>
                <div>
                  <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>Developer (Replit)</div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89", fontFamily: "'DM Mono', monospace" }}>git push origin main</div>
                </div>
              </div>
              <div style={{ paddingLeft: "1vw", color: "#565F89", fontFamily: "'DM Mono', monospace", fontSize: "0.85vw" }}>↓</div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "0.3vw", backgroundColor: "rgba(224,175,104,0.15)", border: "1px solid rgba(224,175,104,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75vw", fontWeight: 700, color: "#E0AF68", flexShrink: 0 }}>2</div>
                <div>
                  <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>GitHub (matasma2025/ledgerlm-private)</div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89", fontFamily: "'DM Mono', monospace" }}>docker build → tag image</div>
                </div>
              </div>
              <div style={{ paddingLeft: "1vw", color: "#565F89", fontFamily: "'DM Mono', monospace", fontSize: "0.85vw" }}>↓</div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "0.3vw", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid rgba(158,206,106,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75vw", fontWeight: 700, color: "#9ECE6A", flexShrink: 0 }}>3</div>
                <div>
                  <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>Azure Container Registry (ACR)</div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89" }}>Private registry · image stored</div>
                </div>
              </div>
              <div style={{ paddingLeft: "1vw", color: "#565F89", fontFamily: "'DM Mono', monospace", fontSize: "0.85vw" }}>↓</div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "0.3vw", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid rgba(122,162,247,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75vw", fontWeight: 700, color: "#7AA2F7", flexShrink: 0 }}>4</div>
                <div>
                  <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>Azure App Service for Containers</div>
                  <div style={{ fontSize: "0.85vw", color: "#565F89" }}>Pulls image · runs DB migrations on startup · live</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tech Stack table */}
          <div style={{ flex: 1.2 }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1.5vh", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Technology Stack</div>
            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "1vh 1.5vw" }}>
                <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Layer</div>
                <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Technology</div>
                <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Version</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Frontend</div>
                <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace" }}>React + Vite</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>React 18</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Backend API</div>
                <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace" }}>Node.js + Express</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>Node 20</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>AI Backend</div>
                <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontFamily: "'DM Mono', monospace" }}>Python + FastAPI</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>Python 3.11</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Database</div>
                <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace" }}>PostgreSQL + pgvector</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>PG 15</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>AI Model</div>
                <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontFamily: "'DM Mono', monospace" }}>Azure OpenAI GPT-5.2</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>gpt-5.2</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Container</div>
                <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace" }}>Docker / Nginx / Supervisor</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>Nginx 1.24</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr", padding: "0.8vh 1.5vw" }}>
                <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Auth</div>
                <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace" }}>Email OTP (bcrypt) + OIDC</div>
                <div style={{ fontSize: "0.85vw", color: "#565F89" }}>bcryptjs</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>10</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
