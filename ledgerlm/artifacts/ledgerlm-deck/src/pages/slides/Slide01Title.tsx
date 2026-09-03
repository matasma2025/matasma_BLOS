export default function Slide01Title() {
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
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            System Overview
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Components</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Flows</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Network Design</div>
        </div>

        <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#565F89", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2vh" }}>
          Security
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>TARA Evidence</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Controls</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Gaps & Remediation</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Policy Compliance</div>
        </div>

        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>
          v1.0 · June 2026
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "8vh 6vw",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "2vh" }}>
          Bosch Cyber Security Review · MS/ECL51
        </div>

        <h1
          style={{
            fontSize: "4.5vw",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 2vh 0",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          LedgerLM
        </h1>

        <p
          style={{
            fontSize: "1.8vw",
            color: "#9AA5CE",
            lineHeight: 1.5,
            maxWidth: "38vw",
            margin: "0 0 5vh 0",
            fontWeight: 400,
          }}
        >
          System Architecture & TARA Security Evidence
        </p>

        {/* Classification badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "1.5vh 2vw",
            backgroundColor: "rgba(158,206,106,0.1)",
            border: "1px solid rgba(158,206,106,0.25)",
            borderRadius: "0.4vw",
            marginBottom: "5vh",
            width: "fit-content",
          }}
        >
          <div style={{ fontSize: "1vw", fontWeight: 600, color: "#9ECE6A", marginRight: "1.5vw", fontFamily: "'DM Mono', monospace" }}>
            CLASSIFICATION
          </div>
          <div style={{ fontSize: "1vw", color: "#FFFFFF", fontFamily: "'DM Mono', monospace" }}>
            Internal / Bosch CS Review
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "3vw" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
            <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#FFFFFF" }}>19</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textTransform: "uppercase", letterSpacing: "0.05em" }}>TARA Requirements</div>
          </div>
          <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
            <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#9ECE6A" }}>95%</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textTransform: "uppercase", letterSpacing: "0.05em" }}>Implemented</div>
          </div>
          <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
            <div style={{ fontSize: "2.5vw", fontWeight: 700, color: "#7AA2F7" }}>Azure</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textTransform: "uppercase", letterSpacing: "0.05em" }}>Production Target</div>
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>
            Prepared by LedgerLM Development Team · Tejas M (BGSW/BDO-IT)
          </div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>01</div>
        </div>
      </div>
    </div>
  );
}
