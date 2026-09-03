export default function Slide15NetworkAudit() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Input & Session Security</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Network & Audit
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Gaps & Remediation</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Security Controls
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Network Security & Audit Logging
        </h1>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Network */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Network Security</div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 2vw", border: "1px solid rgba(158,206,106,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8vh" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>CORS Control</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#9ECE6A" }}>SR-NET-01</div>
              </div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", marginBottom: "1vh" }}>CORS allowlist via ALLOWED_ORIGINS env var. Non-listed origins rejected.</div>
              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1vh 1.2vw", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5" }}>
                <div>origin: (origin, cb) {"=>"} {'{'}</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#9AA5CE" }}>if</span> (allowedOrigins.includes(origin))</div>
                <div style={{ paddingLeft: "2vw" }}>cb(<span style={{ color: "#9ECE6A" }}>null, true</span>)</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#9AA5CE" }}>else</span> cb(<span style={{ color: "#F7768E" }}>new Error</span>(…))</div>
                <div>{'}'}</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2vh 2vw", border: "1px solid rgba(224,175,104,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8vh" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>DB Connection Security</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75vw", color: "#E0AF68" }}>SR-NET-02 · PARTIAL</div>
              </div>
              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", marginBottom: "1vh" }}>SSL enabled. Azure PostgreSQL enforces SSL. rejectUnauthorized fix pending for Azure go-live.</div>
              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1vh 1.2vw", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5" }}>
                <div style={{ color: "#565F89" }}>// Current (Neon dev DB):</div>
                <div>ssl: {'{'} rejectUnauthorized: <span style={{ color: "#F7768E" }}>false</span> {'}'}</div>
                <div style={{ color: "#565F89", marginTop: "0.8vh" }}>// Required before Azure go-live:</div>
                <div>ssl: {'{'} rejectUnauthorized: <span style={{ color: "#9ECE6A" }}>true</span> {'}'}</div>
              </div>
            </div>
          </div>

          {/* Audit */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Audit & Logging (SR-AUDIT-01)</div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "2.5vh 2vw", border: "1px solid rgba(122,162,247,0.2)", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1vh" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 600, color: "#FFFFFF" }}>Structured Audit Logging</div>
                <div style={{ fontSize: "0.8vw", color: "#9ECE6A", backgroundColor: "rgba(158,206,106,0.1)", padding: "0.2vh 0.7vw", borderRadius: "0.2vw" }}>IMPLEMENTED</div>
              </div>

              <div style={{ fontSize: "0.85vw", color: "#9AA5CE", marginBottom: "1.5vh" }}>
                Pino structured JSON logging on all requests. Query audit table records every AI query with user identity, timestamp, and cube reference.
              </div>

              <div style={{ backgroundColor: "#0D0E14", borderRadius: "0.3vw", padding: "1.2vh 1.5vw", fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#C0CAF5", marginBottom: "1.5vh", lineHeight: 1.7 }}>
                <div style={{ color: "#565F89" }}>// Pino log output example:</div>
                <div>{'{'}<span style={{ color: "#7AA2F7" }}>"level"</span>:<span style={{ color: "#9ECE6A" }}>"info"</span>,</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#7AA2F7" }}>"method"</span>:<span style={{ color: "#9ECE6A" }}>"POST"</span>,</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#7AA2F7" }}>"status"</span>:<span style={{ color: "#E0AF68" }}>200</span>,</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#7AA2F7" }}>"duration_ms"</span>:<span style={{ color: "#E0AF68" }}>62</span>,</div>
                <div style={{ paddingLeft: "1vw" }}><span style={{ color: "#7AA2F7" }}>"ip"</span>:<span style={{ color: "#9ECE6A" }}>"115.246.x.x"</span>{'}'}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.7vh" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>query_audits table: userId, query, cubeId, timestamp</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Python backend: SQL metric + rows + duration logged</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                  <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Azure App Service streams logs to Azure Monitor</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>15</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
