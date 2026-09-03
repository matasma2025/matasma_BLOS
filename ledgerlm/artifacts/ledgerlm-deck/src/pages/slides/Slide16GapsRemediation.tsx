export default function Slide16GapsRemediation() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Network & Audit</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Gaps & Remediation
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Test Cases</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Policy Compliance</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "5.5vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Known Gaps
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Gaps & Remediation Plan
        </h1>

        {/* Gap table */}
        <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: "2.5vh" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 2fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.2vh 2vw" }}>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Gap</div>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk</div>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Planned Fix</div>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Timeline</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 2fr 1fr", padding: "1.5vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "start" }}>
            <div>
              <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>rejectUnauthorized: false on DB SSL</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#565F89" }}>server/db.ts — dev DB uses self-signed cert</div>
            </div>
            <div style={{ fontSize: "0.9vw", color: "#E0AF68" }}>Medium</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Set rejectUnauthorized: true before Azure deployment (Azure uses CA-signed cert)</div>
            <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontWeight: 600 }}>Before go-live</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 2fr 1fr", padding: "1.5vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "start" }}>
            <div>
              <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>No account lockout after repeated OTP failures</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#565F89" }}>Rate limiting present but no hard lockout counter</div>
            </div>
            <div style={{ fontSize: "0.9vw", color: "#E0AF68" }}>Medium</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Add failed attempt counter + account lockout after N consecutive failures</div>
            <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontWeight: 600 }}>Sprint 1</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 2fr 1fr", padding: "1.5vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "start" }}>
            <div>
              <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>Rate limiting only on OTP endpoints</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#565F89" }}>No global API rate limit in place</div>
            </div>
            <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Low–Med</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Add global API rate limiting (express-rate-limit on all routes)</div>
            <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontWeight: 600 }}>Sprint 1</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 2fr 1fr", padding: "1.5vh 2vw", alignItems: "start" }}>
            <div>
              <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>No explicit CSRF token</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78vw", color: "#565F89" }}>Mitigated by sameSite: strict cookie policy</div>
            </div>
            <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Low</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Add CSRF token (csurf or custom) for state-mutating forms</div>
            <div style={{ fontSize: "0.85vw", color: "#565F89", fontWeight: 600 }}>Sprint 2</div>
          </div>
        </div>

        {/* Risk summary */}
        <div style={{ display: "flex", gap: "2.5vw" }}>
          <div style={{ flex: 1, backgroundColor: "rgba(224,175,104,0.06)", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(224,175,104,0.2)" }}>
            <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#E0AF68", marginBottom: "0.3vh" }}>2</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Medium-risk items — Sprint 1</div>
          </div>
          <div style={{ flex: 1, backgroundColor: "rgba(122,162,247,0.06)", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(122,162,247,0.15)" }}>
            <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#7AA2F7", marginBottom: "0.3vh" }}>2</div>
            <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Low-risk items — Sprint 1–2</div>
          </div>
          <div style={{ flex: 2, backgroundColor: "rgba(158,206,106,0.06)", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(158,206,106,0.15)" }}>
            <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6 }}>
              No critical (high/critical) risks identified. All gaps have clear, low-complexity remediation paths. Production deployment blocked on the SSL fix only.
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>16</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
