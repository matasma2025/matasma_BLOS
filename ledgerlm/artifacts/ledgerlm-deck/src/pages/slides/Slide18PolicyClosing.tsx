export default function Slide18PolicyClosing() {
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
        background: "radial-gradient(ellipse at 60% 50%, rgba(122,162,247,0.06) 0%, transparent 60%)",
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Test Cases</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Policy & Closing
          </div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Policy Compliance
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Policy Compliance & Summary
        </h1>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Policy table */}
          <div style={{ flex: 1.2 }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh", marginBottom: "1.5vh" }}>Bosch Policy Requirements</div>
            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", padding: "1.2vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Production data not used in pilot release</div>
                <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontWeight: 600, textAlign: "right" }}>Confirmed</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", padding: "1.2vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>CSO team informed of releases</div>
                <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontWeight: 600, textAlign: "right" }}>Confirmed</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", padding: "1.2vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Security Concept document reviewed</div>
                <div style={{ fontSize: "0.85vw", color: "#E0AF68", fontWeight: 600, textAlign: "right" }}>In draft</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", padding: "1.2vh 2vw" }}>
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>TARA full report</div>
                <div style={{ fontSize: "0.85vw", color: "#E0AF68", fontWeight: 600, textAlign: "right" }}>Awaiting</div>
              </div>
            </div>

            <div style={{ marginTop: "2.5vh", backgroundColor: "rgba(224,175,104,0.06)", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(224,175,104,0.2)", fontSize: "0.85vw", color: "#9AA5CE" }}>
              Security Concept document and full TARA report awaiting final versions from Bosch CSO team.
            </div>
          </div>

          {/* Summary */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>Overall Security Posture</div>

            <div style={{ backgroundColor: "rgba(158,206,106,0.06)", borderRadius: "0.5vw", padding: "2.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)", textAlign: "center" }}>
              <div style={{ fontSize: "5vw", fontWeight: 800, color: "#9ECE6A", lineHeight: 1 }}>95%</div>
              <div style={{ fontSize: "1vw", color: "#9AA5CE", marginTop: "1vh" }}>TARA requirements implemented</div>
              <div style={{ fontSize: "0.85vw", color: "#565F89", marginTop: "0.5vh" }}>18 of 19 · 0 critical gaps</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Authentication & RBAC fully implemented</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>All secrets managed via Azure Key Vault</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#9ECE6A", borderRadius: "50%" }} />
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>9 security test cases passing</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
                <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#E0AF68", borderRadius: "50%" }} />
                <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>SSL cert verification fix before Azure go-live</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.8vh 1.8vw", border: "1px solid rgba(255,255,255,0.07)", marginTop: "auto" }}>
              <div style={{ fontSize: "0.85vw", color: "#565F89", marginBottom: "0.5vh" }}>Document prepared by</div>
              <div style={{ fontSize: "0.95vw", color: "#FFFFFF", fontWeight: 600 }}>LedgerLM Development Team</div>
              <div style={{ fontSize: "0.85vw", color: "#7AA2F7" }}>Tejas M · BGSW/BDO-IT · Tejas.M@in.bosch.com</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>18</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
