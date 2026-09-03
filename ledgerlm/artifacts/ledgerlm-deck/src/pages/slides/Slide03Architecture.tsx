export default function Slide03Architecture() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Application Overview</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            System Architecture
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
          padding: "5vh 5vw",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          System Architecture
        </div>
        <h1
          style={{
            fontSize: "2.8vw",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 2.5vh 0",
            letterSpacing: "-0.02em",
          }}
        >
          High-Level Architecture Diagram
        </h1>

        {/* Architecture visualization */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>

          {/* Users layer */}
          <div style={{ backgroundColor: "rgba(122,162,247,0.08)", border: "1px solid rgba(122,162,247,0.2)", borderRadius: "0.5vw", padding: "1.2vh 2vw", textAlign: "center" }}>
            <div style={{ fontSize: "1vw", color: "#7AA2F7", fontWeight: 600 }}>USERS (Browser) — Bosch Employees @ in.bosch.com</div>
          </div>

          {/* Arrow */}
          <div style={{ textAlign: "center", fontSize: "1vw", color: "#565F89", fontFamily: "'DM Mono', monospace" }}>HTTPS / TLS 1.2+  ↓</div>

          {/* Azure App Service box */}
          <div style={{ backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5vw", padding: "1.5vh 2vw" }}>
            <div style={{ fontSize: "0.85vw", color: "#E0AF68", fontWeight: 600, marginBottom: "1.2vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Azure App Service for Containers · P2v3 (4 vCores, 16 GB)
            </div>
            <div style={{ display: "flex", gap: "2vw" }}>
              {/* Nginx */}
              <div style={{ flex: 0.8, backgroundColor: "rgba(224,175,104,0.08)", border: "1px solid rgba(224,175,104,0.2)", borderRadius: "0.4vw", padding: "1vh 1.5vw", textAlign: "center" }}>
                <div style={{ fontSize: "0.9vw", color: "#E0AF68", fontWeight: 600 }}>Nginx</div>
                <div style={{ fontSize: "0.8vw", color: "#565F89" }}>Reverse Proxy · Port 80</div>
              </div>
              {/* Supervisor */}
              <div style={{ flex: 0.8, backgroundColor: "rgba(224,175,104,0.08)", border: "1px solid rgba(224,175,104,0.2)", borderRadius: "0.4vw", padding: "1vh 1.5vw", textAlign: "center" }}>
                <div style={{ fontSize: "0.9vw", color: "#E0AF68", fontWeight: 600 }}>Supervisor</div>
                <div style={{ fontSize: "0.8vw", color: "#565F89" }}>Process Manager</div>
              </div>
              {/* Node.js */}
              <div style={{ flex: 1.2, backgroundColor: "rgba(122,162,247,0.08)", border: "1px solid rgba(122,162,247,0.2)", borderRadius: "0.4vw", padding: "1vh 1.5vw" }}>
                <div style={{ fontSize: "0.9vw", color: "#7AA2F7", fontWeight: 600, marginBottom: "0.5vh" }}>Node.js / Express · :5000</div>
                <div style={{ fontSize: "0.75vw", color: "#565F89" }}>React SPA · REST API · Auth · Sessions · Drizzle ORM</div>
              </div>
              {/* Python */}
              <div style={{ flex: 1.2, backgroundColor: "rgba(158,206,106,0.08)", border: "1px solid rgba(158,206,106,0.2)", borderRadius: "0.4vw", padding: "1vh 1.5vw" }}>
                <div style={{ fontSize: "0.9vw", color: "#9ECE6A", fontWeight: 600, marginBottom: "0.5vh" }}>Python / FastAPI · :8000</div>
                <div style={{ fontSize: "0.75vw", color: "#565F89" }}>RAG · Semantic SQL · Embeddings · NL→SQL</div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ textAlign: "center", fontSize: "1vw", color: "#565F89", fontFamily: "'DM Mono', monospace" }}>↓  Azure Services</div>

          {/* Azure Services row */}
          <div style={{ display: "flex", gap: "1.5vw" }}>
            <div style={{ flex: 1, backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontWeight: 700, marginBottom: "0.5vh" }}>PostgreSQL</div>
              <div style={{ fontSize: "0.75vw", color: "#565F89" }}>Flexible Server · pgvector · SSL enforced</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontWeight: 700, marginBottom: "0.5vh" }}>Azure OpenAI</div>
              <div style={{ fontSize: "0.75vw", color: "#565F89" }}>GPT-5.2 · text-embedding-3-large</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontSize: "0.85vw", color: "#E0AF68", fontWeight: 700, marginBottom: "0.5vh" }}>Key Vault</div>
              <div style={{ fontSize: "0.75vw", color: "#565F89" }}>All secrets · Env var injection</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontWeight: 700, marginBottom: "0.5vh" }}>Blob Storage</div>
              <div style={{ fontSize: "0.75vw", color: "#565F89" }}>Excel / CSV data files</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontSize: "0.85vw", color: "#C0CAF5", fontWeight: 700, marginBottom: "0.5vh" }}>Azure AD / Entra ID</div>
              <div style={{ fontSize: "0.75vw", color: "#565F89" }}>SSO · OIDC · Group roles</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw" }}>
              <div style={{ fontSize: "0.85vw", color: "#C0CAF5", fontWeight: 700, marginBottom: "0.5vh" }}>ACR</div>
              <div style={{ fontSize: "0.75vw", color: "#565F89" }}>Private Docker image registry</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>03</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
