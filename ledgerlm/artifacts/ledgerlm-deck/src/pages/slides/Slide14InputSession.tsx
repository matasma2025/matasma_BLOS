export default function Slide14InputSession() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Protection</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Input & Session Security
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Network & Audit</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Security Controls
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Input Security & Session Management
        </h1>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Input Security */}
          <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Input Security (SR-INPUT-01 / 02 / 03)</div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8vh" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>SQL Injection Prevention</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#9ECE6A" }}>SR-INPUT-01</div>
              </div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", marginBottom: "1vh" }}>All queries use parameterized statements. Drizzle ORM (Node.js) + psycopg2 (Python). No string concatenation.</div>
              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1vh 1.2vw", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5" }}>
                <div>cursor.execute(</div>
                <div style={{ paddingLeft: "1vw", color: "#9ECE6A" }}>"SELECT … WHERE cube_id = %s"</div>
                <div style={{ paddingLeft: "1vw" }}>,(cube_id,)  <span style={{ color: "#565F89" }}># never concatenated</span></div>
                <div>)</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 1.8vw", border: "1px solid rgba(158,206,106,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8vh" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>XSS Prevention</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#9ECE6A" }}>SR-INPUT-02</div>
              </div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", marginBottom: "1vh" }}>Helmet.js CSP restricts scripts to 'self'. React JSX escapes all dynamic content. X-Content-Type-Options: nosniff.</div>
              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1vh 1.2vw", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5" }}>
                <div>scriptSrc: [<span style={{ color: "#9ECE6A" }}>"'self'"</span>]</div>
                <div>objectSrc: [<span style={{ color: "#9ECE6A" }}>"'none'"</span>]</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 1.8vw", border: "1px solid rgba(158,206,106,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5vh" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>Clickjacking Prevention</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#9ECE6A" }}>SR-INPUT-03</div>
              </div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>X-Frame-Options: DENY (Helmet). CSP frameAncestors: none in production.</div>
            </div>
          </div>

          {/* Session Security */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Session Security (SR-SESSION-01)</div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2.5vh 2vw", border: "1px solid rgba(122,162,247,0.2)", flex: 1 }}>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6, marginBottom: "1.5vh" }}>
                Server-side sessions in PostgreSQL. Cookie flags enforced.
              </div>
              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.5vh 1.5vw", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", lineHeight: 1.8 }}>
                <div>cookie: {'{'}</div>
                <div style={{ paddingLeft: "1vw" }}>secure: <span style={{ color: "#9ECE6A" }}>true</span>,    <span style={{ color: "#565F89" }}>// HTTPS only</span></div>
                <div style={{ paddingLeft: "1vw" }}>httpOnly: <span style={{ color: "#9ECE6A" }}>true</span>,  <span style={{ color: "#565F89" }}>// no JS access</span></div>
                <div style={{ paddingLeft: "1vw" }}>sameSite: <span style={{ color: "#9ECE6A" }}>'strict'</span>, <span style={{ color: "#565F89" }}>// CSRF</span></div>
                <div style={{ paddingLeft: "1vw" }}>maxAge: <span style={{ color: "#E0AF68" }}>8h</span>,     <span style={{ color: "#565F89" }}>// enterprise TTL</span></div>
                <div>{'}'}</div>
              </div>

              <div style={{ marginTop: "1.5vh", display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>SESSION_SECRET enforced at startup</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>No client-side JWT — server-only</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>No sensitive data in localStorage</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>14</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
