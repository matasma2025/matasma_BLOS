export default function Slide13DataProtection() {
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
        <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#565F89", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2vh" }}>Security</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh", marginBottom: "4vh" }}>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Auth & RBAC</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Data Protection
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Input Security</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Session Security</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Security Controls
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Data Protection
        </h1>

        <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
          {/* SR-DATA-01 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1vh" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>SR-DATA-01</div>
                <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
              </div>
              <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Data in Transit Encryption</div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.6, marginBottom: "1.2vh" }}>HTTPS/TLS enforced by Azure App Service. HSTS header (1 year). CSP upgradeInsecureRequests.</div>
              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.2vh 1.5vw", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5" }}>
                <div>hsts: {'{'} maxAge: <span style={{ color: "#E0AF68" }}>31536000</span>,</div>
                <div style={{ paddingLeft: "1vw" }}>includeSubDomains: <span style={{ color: "#9ECE6A" }}>true</span> {'}'}</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1vh" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>SR-DATA-02</div>
                <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
              </div>
              <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Data at Rest Encryption</div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.6 }}>
                Azure PostgreSQL: AES-256 at-rest (Azure-managed). Connector API credentials encrypted before DB storage. OTP codes stored as bcrypt hashes.
              </div>
            </div>
          </div>

          {/* SR-DATA-03 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(224,175,104,0.25)", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1vh" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#E0AF68" }}>SR-DATA-03</div>
                <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
              </div>
              <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Secret Management</div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.6, marginBottom: "1.5vh" }}>All secrets stored in Azure Key Vault, injected as env vars at runtime. App refuses to start without SESSION_SECRET.</div>

              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.5vh 1.5vw", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", marginBottom: "1.5vh" }}>
                <div><span style={{ color: "#9AA5CE" }}>if</span> (!process.env.SESSION_SECRET) {'{'}</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#9AA5CE" }}>throw new</span> <span style={{ color: "#F7768E" }}>Error</span>(</div>
                <div style={{ paddingLeft: "2vw", color: "#9ECE6A" }}>"SESSION_SECRET required"</div>
                <div style={{ paddingLeft: "1vw" }}>)</div>
                <div>{'}'}</div>
              </div>

              <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.8vh" }}>Key Vault Secrets</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
                <div style={{ display: "flex", gap: "1vw" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#E0AF68", width: "12vw" }}>db-connection-string</div>
                  <div style={{ fontSize: "0.8vw", color: "#565F89" }}>PostgreSQL credentials</div>
                </div>
                <div style={{ display: "flex", gap: "1vw" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#E0AF68", width: "12vw" }}>session-secret</div>
                  <div style={{ fontSize: "0.8vw", color: "#565F89" }}>Express session signing</div>
                </div>
                <div style={{ display: "flex", gap: "1vw" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#E0AF68", width: "12vw" }}>azure-openai-key</div>
                  <div style={{ fontSize: "0.8vw", color: "#565F89" }}>OpenAI API key</div>
                </div>
                <div style={{ display: "flex", gap: "1vw" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#E0AF68", width: "12vw" }}>smtp-password</div>
                  <div style={{ fontSize: "0.8vw", color: "#565F89" }}>Email service</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>13</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
