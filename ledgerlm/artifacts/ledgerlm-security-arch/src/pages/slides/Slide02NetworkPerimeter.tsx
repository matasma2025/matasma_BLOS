export default function Slide02NetworkPerimeter() {
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
          top: "-20vh",
          right: "-10vw",
          width: "45vw",
          height: "45vw",
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
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>01. NETWORK ARCHITECTURE</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            System Perimeter &amp; Network Zones
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>
          <div style={{ flex: 1.6, display: "flex", flexDirection: "column", gap: "1.5vh" }}>

            <div style={{ backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.6vw", padding: "1.6vh 1.8vw", display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", minWidth: "7vw" }}>INTERNET</div>
              <div style={{ flex: 1, height: "0.15vh", backgroundColor: "#2A7B7B", opacity: 0.4 }} />
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#1A1A2E" }}>Browser clients (Bosch, Nemko users)</div>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3vh" }}>
                <div style={{ width: "0.15vw", height: "2vh", backgroundColor: "#2A7B7B" }} />
                <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em" }}>HTTPS / TLS 1.2+</div>
                <div style={{ width: "0.15vw", height: "2vh", backgroundColor: "#2A7B7B" }} />
              </div>
            </div>

            <div style={{ backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "1.8vh 1.8vw" }}>
              <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "1vh" }}>AZURE APP SERVICE FOR CONTAINERS (P2v3)</div>
              <div style={{ display: "flex", gap: "1.5vw" }}>
                <div style={{ flex: 1, backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.5)", borderRadius: "0.4vw", padding: "1.2vh 1vw" }}>
                  <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", marginBottom: "0.5vh" }}>NGINX :80</div>
                  <div style={{ fontSize: "0.75vw", color: "#FFFFFF", opacity: 0.75 }}>Reverse proxy</div>
                  <div style={{ fontSize: "0.75vw", color: "#FFFFFF", opacity: 0.75 }}>SSL termination</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.5)", borderRadius: "0.4vw", padding: "1.2vh 1vw" }}>
                  <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", marginBottom: "0.5vh" }}>Node.js :5000</div>
                  <div style={{ fontSize: "0.75vw", color: "#FFFFFF", opacity: 0.75 }}>API + Auth</div>
                  <div style={{ fontSize: "0.75vw", color: "#FFFFFF", opacity: 0.75 }}>Session mgmt</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.5)", borderRadius: "0.4vw", padding: "1.2vh 1vw" }}>
                  <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", marginBottom: "0.5vh" }}>Python :8000</div>
                  <div style={{ fontSize: "0.75vw", color: "#FFFFFF", opacity: 0.75 }}>AI/RAG engine</div>
                  <div style={{ fontSize: "0.75vw", color: "#FFFFFF", opacity: 0.75 }}>localhost only</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3vh" }}>
                <div style={{ width: "0.15vw", height: "2vh", backgroundColor: "#4A4A68" }} />
                <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#4A4A68", letterSpacing: "0.06em" }}>Private Endpoint / VNet</div>
                <div style={{ width: "0.15vw", height: "2vh", backgroundColor: "#4A4A68" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "1.5vw" }}>
              <div style={{ flex: 1, backgroundColor: "#F0F4F8", border: "0.1vw solid #CBD5E0", borderRadius: "0.5vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.3vh" }}>PostgreSQL</div>
                <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>SSL enforced, AES-256 at rest</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#F0F4F8", border: "0.1vw solid #CBD5E0", borderRadius: "0.5vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.3vh" }}>Key Vault</div>
                <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>All secrets, env injection</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#F0F4F8", border: "0.1vw solid #CBD5E0", borderRadius: "0.5vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.3vh" }}>Blob Storage</div>
                <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Excel/CSV ingestion</div>
              </div>
            </div>

          </div>

          <div style={{ flex: 0.9, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2vh 1.8vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.5vh" }}>SECURITY CONTROLS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.6vw", height: "0.6vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>TLS 1.2+ enforced</div>
                    <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Azure App Service terminates SSL; HSTS max-age 1 year</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.6vw", height: "0.6vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Internal port isolation</div>
                    <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Python :8000 reachable only via localhost — never exposed externally</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.6vw", height: "0.6vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>VNet private endpoints</div>
                    <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>DB, Key Vault, Blob Storage on private network</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.6vw", height: "0.6vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Helmet.js HTTP headers</div>
                    <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>CSP, X-Frame-Options, HSTS, upgradeInsecureRequests</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.6vw", height: "0.6vw", borderRadius: "50%", backgroundColor: "#2A7B7B", marginTop: "0.3vh", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Azure OpenAI via backbone</div>
                    <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>HTTPS over Azure internal network, not public internet</div>
                  </div>
                </div>
              </div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>02</div>
      </div>
    </div>
  );
}
