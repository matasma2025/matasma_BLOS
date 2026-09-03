export default function Slide07SecretManagement() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#FAFBFC",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-18vh",
          right: "-10vw",
          width: "48vw",
          height: "48vw",
          borderRadius: "50%",
          border: "0.2vw solid #2A7B7B",
          opacity: 0.12,
        }}
      />

      <div
        style={{
          padding: "5.5vh 7vw 0 7vw",
          height: "90vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: "3vh" }}>
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>06. SECRET MANAGEMENT</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Azure Key Vault Secret Pipeline
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: "1.5vh" }}>

            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "1.8vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>SECRET INJECTION FLOW</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                <div style={{ flex: 1, backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1.2vh 1vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#1A1A2E" }}>Developer</div>
                  <div style={{ fontSize: "0.68vw", color: "#4A4A68" }}>source code / git</div>
                  <div style={{ fontSize: "0.65vw", color: "#C00000", marginTop: "0.4vh" }}>NO secrets here</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0.5vw" }}>
                  <div style={{ fontSize: "0.7vw", color: "#4A4A68" }}>&#x25B6;</div>
                </div>
                <div style={{ flex: 1.2, backgroundColor: "#1A1A2E", borderRadius: "0.4vw", padding: "1.2vh 1vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#2A7B7B" }}>Azure Key Vault</div>
                  <div style={{ fontSize: "0.68vw", color: "rgba(255,255,255,0.6)" }}>Single source of truth</div>
                  <div style={{ fontSize: "0.65vw", color: "rgba(255,255,255,0.5)", marginTop: "0.4vh" }}>All 5 secrets stored</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0.5vw" }}>
                  <div style={{ fontSize: "0.7vw", color: "#4A4A68" }}>&#x25B6;</div>
                </div>
                <div style={{ flex: 1.2, backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1.2vh 1vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#1A1A2E" }}>App Service</div>
                  <div style={{ fontSize: "0.68vw", color: "#4A4A68" }}>Key Vault References</div>
                  <div style={{ fontSize: "0.65vw", color: "#2A7B7B", marginTop: "0.4vh" }}>Injected as env vars</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0.5vw" }}>
                  <div style={{ fontSize: "0.7vw", color: "#4A4A68" }}>&#x25B6;</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1.2vh 1vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#1A1A2E" }}>Container</div>
                  <div style={{ fontSize: "0.68vw", color: "#4A4A68" }}>process.env.*</div>
                  <div style={{ fontSize: "0.65vw", color: "#4A4A68", marginTop: "0.4vh" }}>Runtime access only</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1.5vw" }}>
              <div style={{ flex: 1, backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "1.8vh 1.8vw" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>KEY VAULT SECRETS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>db-connection-string</span>
                    <span style={{ fontSize: "0.72vw", color: "#2A7B7B" }}>PostgreSQL</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>session-secret</span>
                    <span style={{ fontSize: "0.72vw", color: "#2A7B7B" }}>Session signing</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>azure-openai-key</span>
                    <span style={{ fontSize: "0.72vw", color: "#2A7B7B" }}>AI API key</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>smtp-password</span>
                    <span style={{ fontSize: "0.72vw", color: "#2A7B7B" }}>Email relay</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)", fontFamily: "monospace" }}>anaplan-credentials</span>
                    <span style={{ fontSize: "0.72vw", color: "#2A7B7B" }}>External SaaS</span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "1.8vh 1.8vw" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>FAIL-SAFE DESIGN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
                    <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                    <div style={{ fontSize: "0.78vw", color: "#4A4A68" }}>App refuses to start without SESSION_SECRET — no silent fallback</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
                    <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                    <div style={{ fontSize: "0.78vw", color: "#4A4A68" }}>Secrets never in Docker image or source code — .gitignore enforced</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
                    <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                    <div style={{ fontSize: "0.78vw", color: "#4A4A68" }}>Connector API credentials AES-encrypted before DB storage</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
                    <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                    <div style={{ fontSize: "0.78vw", color: "#4A4A68" }}>Key Vault access via Managed Identity — no credential required by app</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.6vw", padding: "2vh 1.8vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>WHAT IS NOT STORED IN CODE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E", display: "flex", alignItems: "center", gap: "0.6vw" }}>
                  <span style={{ color: "#C00000", fontWeight: 700 }}>&#x2717;</span> DB passwords
                </div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E", display: "flex", alignItems: "center", gap: "0.6vw" }}>
                  <span style={{ color: "#C00000", fontWeight: 700 }}>&#x2717;</span> API keys
                </div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E", display: "flex", alignItems: "center", gap: "0.6vw" }}>
                  <span style={{ color: "#C00000", fontWeight: 700 }}>&#x2717;</span> Session secrets
                </div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E", display: "flex", alignItems: "center", gap: "0.6vw" }}>
                  <span style={{ color: "#C00000", fontWeight: 700 }}>&#x2717;</span> SMTP credentials
                </div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E", display: "flex", alignItems: "center", gap: "0.6vw" }}>
                  <span style={{ color: "#C00000", fontWeight: 700 }}>&#x2717;</span> SSO client secrets
                </div>
                <div style={{ height: "0.1vh", backgroundColor: "#C8E6E6", margin: "0.5vh 0" }} />
                <div style={{ fontSize: "0.75vw", color: "#4A4A68", fontStyle: "italic" }}>All validated: no hardcoded credentials found in codebase review</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "1.5vh 1.8vw" }}>
              <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "0.6vh" }}>TARA CONTROL MET</div>
              <div style={{ fontSize: "0.78vw", color: "#1A1A2E" }}>SR-DATA-03 — Secret Management</div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100vw",
          height: "10vh",
          backgroundColor: "#2A7B7B",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 7vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", letterSpacing: "0.05em" }}>LedgerLM Security Architecture</div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>07</div>
      </div>
    </div>
  );
}
