export default function Slide05DbAzureServices() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Application Backends</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Azure Services
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Flows</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Components
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Azure Services
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2vw", flex: 1 }}>

          {/* PostgreSQL */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(122,162,247,0.2)" }}>
            <div style={{ fontSize: "0.8vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace", marginBottom: "1vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>Database</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>PostgreSQL Flexible Server</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· PostgreSQL 15 + pgvector ext.</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· 25+ tables · vector embeddings</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· SSL enforced on all connections</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Session store · automated backups</div>
            </div>
          </div>

          {/* Azure OpenAI */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontFamily: "'DM Mono', monospace", marginBottom: "1vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Model</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>Azure OpenAI Service</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· GPT-5.2 deployment</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· text-embedding-3-large (3072-dim)</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Chat responses · query parsing</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Document analysis</div>
            </div>
          </div>

          {/* Key Vault */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(224,175,104,0.2)" }}>
            <div style={{ fontSize: "0.8vw", color: "#E0AF68", fontFamily: "'DM Mono', monospace", marginBottom: "1vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>Secrets</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>Azure Key Vault</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· DB credentials · API keys</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Session secret · SMTP password</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Injected as env vars at runtime</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· No secrets in image or code</div>
            </div>
          </div>

          {/* Blob Storage */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(122,162,247,0.15)" }}>
            <div style={{ fontSize: "0.8vw", color: "#7AA2F7", fontFamily: "'DM Mono', monospace", marginBottom: "1vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>Storage</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>Azure Blob Storage</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Raw Excel/CSV data files</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Ingested documents</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Auto-sync pipeline</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Registry table prevents re-ingestion</div>
            </div>
          </div>

          {/* Azure AD */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(192,202,245,0.15)" }}>
            <div style={{ fontSize: "0.8vw", color: "#C0CAF5", fontFamily: "'DM Mono', monospace", marginBottom: "1vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>Identity</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>Azure AD / Entra ID</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· SSO / OIDC enterprise federation</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Group-based role mapping</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Configurable per tenant</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>· Admin / Standard / Member roles</div>
            </div>
          </div>

          {/* ACR + Anaplan */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontFamily: "'DM Mono', monospace", marginBottom: "1vh", textTransform: "uppercase", letterSpacing: "0.05em" }}>Registry & Integration</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1.5vh" }}>ACR + Anaplan</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>ACR: Private Docker image store</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>ACR: App Service pulls on deploy</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Anaplan: Financial planning data</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Anaplan: Scheduled REST API sync</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>05</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
