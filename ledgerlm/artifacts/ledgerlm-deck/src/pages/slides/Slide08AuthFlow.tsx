export default function Slide08AuthFlow() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Document Ingestion</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Authentication Flow
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Network Architecture</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Authentication Flow
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          User Authentication
        </h1>

        <div style={{ display: "flex", gap: "4vw", flex: 1 }}>
          {/* Left — OTP flow */}
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: "2px solid #7AA2F7", paddingBottom: "1vh", marginBottom: "2vh" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#7AA2F7" }}>OTP Flow (Email Passwordless)</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid rgba(122,162,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#7AA2F7", flexShrink: 0 }}>1</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>User enters email — domain resolves tenant</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid rgba(122,162,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#7AA2F7", flexShrink: 0 }}>2</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>6-digit OTP sent via SMTP email (GoDaddy / :465)</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid rgba(122,162,247,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#7AA2F7", flexShrink: 0 }}>3</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>OTP verified via bcrypt hash comparison — plaintext never stored</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid rgba(158,206,106,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#9ECE6A", flexShrink: 0 }}>4</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>Server-side session created in PostgreSQL session store</div>
              </div>

              {/* Session cookie box */}
              <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 1.5vw", border: "1px solid rgba(255,255,255,0.07)", fontFamily: "'DM Mono', monospace" }}>
                <div style={{ fontSize: "0.8vw", color: "#565F89", marginBottom: "0.8vh" }}>Session Cookie</div>
                <div style={{ fontSize: "0.85vw", lineHeight: 1.7, color: "#C0CAF5" }}>
                  <div>httpOnly: <span style={{ color: "#9ECE6A" }}>true</span></div>
                  <div>sameSite: <span style={{ color: "#9ECE6A" }}>'strict'</span></div>
                  <div>secure: <span style={{ color: "#9ECE6A" }}>true</span> (prod)</div>
                  <div>maxAge: <span style={{ color: "#E0AF68" }}>8 hours</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />

          {/* Right — SSO flow */}
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: "2px solid #9ECE6A", paddingBottom: "1vh", marginBottom: "2vh" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#9ECE6A" }}>SSO Flow (Azure AD / Entra ID)</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid rgba(158,206,106,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#9ECE6A", flexShrink: 0 }}>1</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>User enters email — SSO enabled check on tenant</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid rgba(158,206,106,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#9ECE6A", flexShrink: 0 }}>2</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>Redirect to Azure AD OIDC endpoint with tenant ID</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid rgba(158,206,106,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#9ECE6A", flexShrink: 0 }}>3</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>Azure AD validates identity — group claims returned</div>
              </div>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
                <div style={{ width: "2vw", height: "2vw", borderRadius: "50%", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid rgba(158,206,106,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8vw", fontWeight: 700, color: "#9ECE6A", flexShrink: 0 }}>4</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>Group → role mapped (Admin / Standard / Member)</div>
              </div>
            </div>

            {/* Rate limiting note */}
            <div style={{ backgroundColor: "rgba(224,175,104,0.06)", borderRadius: "0.4vw", padding: "1.5vh 1.5vw", border: "1px solid rgba(224,175,104,0.2)", marginTop: "2vh" }}>
              <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#E0AF68", marginBottom: "0.5vh" }}>Brute Force Protection (OTP)</div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>
                Rate limiter: 10 attempts / 15 min · Resend: 3 / min · Returns HTTP 429
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>08</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
