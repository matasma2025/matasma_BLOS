export default function Slide10SecurityPosture() {
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
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "70vw",
          height: "70vw",
          borderRadius: "50%",
          border: "0.2vw solid #2A7B7B",
          opacity: 0.07,
        }}
      />

      <div
        style={{
          padding: "5.5vh 7vw 0 7vw",
          height: "90vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ marginBottom: "3vh" }}>
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>09. SECURITY POSTURE</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            TARA Requirements — Implementation Summary
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#4A4A68", letterSpacing: "0.06em", marginBottom: "0.5vh" }}>AUTHENTICATION &amp; IDENTITY</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7vh" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTH-01</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>Session-gated API access</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTH-02</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>OTP bcrypt, passwordless</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTH-03</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>Azure AD / OIDC SSO</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTH-04</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>Rate limiting, brute force</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#4A4A68", letterSpacing: "0.06em", marginTop: "1vh", marginBottom: "0.5vh" }}>AUTHORISATION &amp; ACCESS CONTROL</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7vh" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTHZ-01</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>RBAC — three-tier roles</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTHZ-02</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>Multi-tenant domain isolation</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-AUTHZ-03</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>Super admin isolation</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#4A4A68", letterSpacing: "0.06em", marginBottom: "0.5vh" }}>DATA PROTECTION</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7vh" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-DATA-01</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>TLS 1.2+, HSTS, SMTPS</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-DATA-02</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>AES-256 at rest, bcrypt OTPs</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.9vh 1.2vw" }}>
                <div>
                  <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#1A1A2E" }}>SR-DATA-03</span>
                  <span style={{ fontSize: "0.75vw", color: "#4A4A68", marginLeft: "1vw" }}>Key Vault, no hardcoded secrets</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.3vw", padding: "0.2vh 0.7vw" }}>
                  <span style={{ fontSize: "0.72vw", fontWeight: 700, color: "#2A7B7B" }}>IMPLEMENTED</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "2vh", backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "2.5vh 2.5vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.5vh" }}>OUTSTANDING RECOMMENDATIONS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#E8C84A", marginTop: "0.35vh", flexShrink: 0 }} />
                  <div style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)" }}>Enable ACR image scanning for container vulnerability detection</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#E8C84A", marginTop: "0.35vh", flexShrink: 0 }} />
                  <div style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)" }}>Confirm VNet private endpoints are active for DB, Key Vault, Blob Storage</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#E8C84A", marginTop: "0.35vh", flexShrink: 0 }} />
                  <div style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)" }}>Centralised audit logging to Azure Monitor / Log Analytics</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", backgroundColor: "#E8C84A", marginTop: "0.35vh", flexShrink: 0 }} />
                  <div style={{ fontSize: "0.78vw", color: "rgba(255,255,255,0.8)" }}>Key Vault secret rotation policy — schedule automated rotation</div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>10</div>
      </div>
    </div>
  );
}
