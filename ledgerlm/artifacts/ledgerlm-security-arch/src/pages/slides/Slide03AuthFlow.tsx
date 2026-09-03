export default function Slide03AuthFlow() {
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
          top: "-15vh",
          left: "-8vw",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          border: "0.2vw solid #2A7B7B",
          opacity: 0.1,
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
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>02. AUTHENTICATION</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Authentication Flow
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#1A1A2E", letterSpacing: "0.06em", paddingBottom: "0.8vh", borderBottom: "0.15vh solid #E2E8F0" }}>PATH A — EMAIL OTP (Passwordless)</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>1</span>
                </div>
                <div style={{ backgroundColor: "#F0F9F9", border: "0.1vw solid #C8E6E6", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>User submits email address</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Domain extracted → tenant mapped</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#2A7B7B", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>2</span>
                </div>
                <div style={{ backgroundColor: "#F0F9F9", border: "0.1vw solid #C8E6E6", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>6-digit OTP generated</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>crypto.randomBytes — bcrypt hash stored, plaintext discarded</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#2A7B7B", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>3</span>
                </div>
                <div style={{ backgroundColor: "#F0F9F9", border: "0.1vw solid #C8E6E6", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>OTP delivered via SMTP (SMTPS :465)</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Encrypted transport, GoDaddy relay</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#2A7B7B", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>4</span>
                </div>
                <div style={{ backgroundColor: "#F0F9F9", border: "0.1vw solid #C8E6E6", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>User submits OTP code</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Rate limited: max 10 attempts / 15 min window</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#2A7B7B", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>5</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>bcrypt.compare() verification</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Session created — httpOnly, Secure, SameSite=Strict</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ width: "0.1vw", backgroundColor: "#E2E8F0" }} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#1A1A2E", letterSpacing: "0.06em", paddingBottom: "0.8vh", borderBottom: "0.15vh solid #E2E8F0" }}>PATH B — AZURE AD / ENTRA ID (SSO)</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#4A4A68", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>1</span>
                </div>
                <div style={{ backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Domain email detected (in.bosch.com)</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>SSO enabled flag checked for tenant</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#4A4A68", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#4A4A68", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>2</span>
                </div>
                <div style={{ backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Redirect to Azure AD OIDC endpoint</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Per-tenant clientId + tenantId configured</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#4A4A68", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#4A4A68", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>3</span>
                </div>
                <div style={{ backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Azure AD authenticates user</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Corporate MFA enforced by Azure AD policy</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#4A4A68", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#4A4A68", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>4</span>
                </div>
                <div style={{ backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>OIDC callback → group-based role mapping</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>Admin / Standard / Member assigned from AD groups</div>
                </div>
              </div>
              <div style={{ marginLeft: "1.1vw", width: "0.1vw", height: "1.5vh", backgroundColor: "#4A4A68", opacity: 0.4 }} />
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "2.2vw", height: "2.2vw", borderRadius: "50%", backgroundColor: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#FFFFFF" }}>5</span>
                </div>
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1vh 1vw", flex: 1 }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1A1A2E" }}>Session established — same cookie policy</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68" }}>SSO client secret encrypted in DB / Key Vault</div>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: "#FFF8E7", border: "0.1vw solid #E8C84A", borderRadius: "0.4vw", padding: "1.2vh 1.2vw", marginTop: "0.5vh" }}>
              <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#7A6000", marginBottom: "0.3vh" }}>SR-AUTH-04 — Brute Force Protection</div>
              <div style={{ fontSize: "0.75vw", color: "#5A4800" }}>OTP: 10 attempts / 15 min • Resend: 3 / min • express-rate-limit applied</div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>03</div>
      </div>
    </div>
  );
}
