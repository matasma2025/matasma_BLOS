export default function Slide12AuthControls() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>TARA Summary</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Auth & RBAC Controls
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Protection</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Input Security</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Security Controls
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Authentication & RBAC
        </h1>

        <div style={{ display: "flex", gap: "2.5vw", flex: 1 }}>
          {/* SR-AUTH-01 */}
          <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>SR-AUTH-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF" }}>Secure Authentication</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.5 }}>All API routes protected by session middleware. Unauthenticated requests return HTTP 401.</div>
            <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.2vh 1.2vw", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", marginTop: "auto" }}>
              <div><span style={{ color: "#9ECE6A" }}>if</span> (!req.session?.userId) {'{'}</div>
              <div style={{ paddingLeft: "1vw" }}>res.status(<span style={{ color: "#E0AF68" }}>401</span>).json(…)</div>
              <div>{'}'}</div>
            </div>
          </div>

          {/* SR-AUTH-02 */}
          <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>SR-AUTH-02</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF" }}>OTP Passwordless Auth</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.5 }}>6-digit OTP stored as bcrypt hash. 256-bit invitation token entropy via crypto.randomBytes(32).</div>
            <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.2vh 1.2vw", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", marginTop: "auto" }}>
              <div><span style={{ color: "#7AA2F7" }}>const</span> codeHash = <span style={{ color: "#9AA5CE" }}>await</span></div>
              <div style={{ paddingLeft: "1vw" }}>bcrypt.hash(otpCode, <span style={{ color: "#E0AF68" }}>10</span>)</div>
            </div>
          </div>

          {/* SR-AUTH-04 */}
          <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>SR-AUTH-04</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF" }}>OTP Rate Limiting</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.5 }}>express-rate-limit on OTP verify and resend endpoints. Returns HTTP 429 after threshold.</div>
            <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.2vh 1.2vw", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", marginTop: "auto" }}>
              <div>max: <span style={{ color: "#E0AF68" }}>10</span>, windowMs: <span style={{ color: "#E0AF68" }}>15min</span></div>
              <div>resend: <span style={{ color: "#E0AF68" }}>3</span> / <span style={{ color: "#E0AF68" }}>1min</span></div>
            </div>
          </div>

          {/* SR-AUTHZ-01 */}
          <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(122,162,247,0.2)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>SR-AUTHZ-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#FFFFFF" }}>RBAC</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE", lineHeight: 1.5 }}>Roles: admin / standard / member. requireAdmin and requireCompanyAdmin middleware on all protected routes.</div>
            <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.2vh 1.2vw", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", marginTop: "auto" }}>
              <div><span style={{ color: "#9AA5CE" }}>if</span> (user.role !== <span style={{ color: "#9ECE6A" }}>'admin'</span>)</div>
              <div style={{ paddingLeft: "1vw" }}>res.status(<span style={{ color: "#E0AF68" }}>403</span>)</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>12</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
