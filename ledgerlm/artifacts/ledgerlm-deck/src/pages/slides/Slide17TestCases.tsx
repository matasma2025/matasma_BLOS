export default function Slide17TestCases() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Gaps & Remediation</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Test Cases
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Policy Compliance</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Test Cases
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 2.5vh 0", letterSpacing: "-0.02em" }}>
          Security Test Evidence
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.8vw", flex: 1 }}>
          {/* TC-AUTH-01 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-AUTH-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>Unauthenticated Access</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Access /api/chats without session</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>HTTP 401 returned</div>
          </div>

          {/* TC-AUTH-02 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-AUTH-02</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>OTP Rate Limit</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Submit incorrect OTP 10× in 15 min</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>HTTP 429 returned</div>
          </div>

          {/* TC-AUTHZ-01 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-AUTHZ-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>Cross-Tenant Access</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Bosch user queries Nemko cube_id</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>HTTP 403 / empty result</div>
          </div>

          {/* TC-AUTHZ-02 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-AUTHZ-02</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>Non-Admin Admin Route</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Standard user POST /api/admin/users</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>HTTP 403 returned</div>
          </div>

          {/* TC-INPUT-01 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-INPUT-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>SQL Injection</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5, fontFamily: "'DM Mono', monospace" }}>'; DROP TABLE cube_fact_data; --</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>Treated as literal string</div>
          </div>

          {/* TC-SESSION-01 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-SESSION-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>Session Cookie Flags</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Inspect cookie in browser DevTools</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>HttpOnly + SameSite + Secure</div>
          </div>

          {/* TC-NET-01 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-NET-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>CORS Rejection</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Request from http://evil.com origin</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>CORS error, request blocked</div>
          </div>

          {/* TC-NET-02 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-NET-02</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>HSTS Header</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Check headers on HTTPS response</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>STS: max-age=31536000</div>
          </div>

          {/* TC-AUDIT-01 */}
          <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8vh" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#7AA2F7" }}>TC-AUDIT-01</div>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700 }}>PASS</div>
            </div>
            <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.5vh" }}>Query Audit Logging</div>
            <div style={{ fontSize: "0.8vw", color: "#9AA5CE", lineHeight: 1.5 }}>Submit AI query, check audit table</div>
            <div style={{ marginTop: "0.8vh", fontFamily: "'DM Mono', monospace", fontSize: "0.8vw", color: "#9ECE6A" }}>Row in query_audits</div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>17</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
