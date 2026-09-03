export default function Slide11TaraSummary() {
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
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            TARA Summary
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Auth Controls</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Protection</div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Input Security</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          TARA Security Evidence
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 1vh 0", letterSpacing: "-0.02em" }}>
          Security Requirements Summary
        </h1>
        <p style={{ fontSize: "1vw", color: "#9AA5CE", margin: "0 0 3vh 0" }}>
          19 TARA requirements assessed · 18 fully implemented · 1 partial (planned pre-deployment fix)
        </p>

        {/* Category table */}
        <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: "2.5vh" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.2vh 2vw" }}>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</div>
            <div style={{ fontSize: "0.8vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Total</div>
            <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Impl.</div>
            <div style={{ fontSize: "0.8vw", color: "#E0AF68", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Partial</div>
            <div style={{ fontSize: "0.8vw", color: "#F7768E", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Pending</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Authentication</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>4</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>4</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Authorisation</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>3</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>3</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Data Protection</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>3</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>3</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Input Security</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>3</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>3</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Session Security</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>1</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>1</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Network Security</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>2</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>1</div>
            <div style={{ fontSize: "0.9vw", color: "#E0AF68", textAlign: "center", fontWeight: 700 }}>1</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Audit & Logging</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>1</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>1</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "0.9vh 2vw", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5" }}>Infrastructure</div>
            <div style={{ fontSize: "0.9vw", color: "#C0CAF5", textAlign: "center" }}>2</div>
            <div style={{ fontSize: "0.9vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>2</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
            <div style={{ fontSize: "0.9vw", color: "#565F89", textAlign: "center" }}>0</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "1vh 2vw", backgroundColor: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontSize: "0.95vw", color: "#FFFFFF", fontWeight: 700 }}>Total</div>
            <div style={{ fontSize: "0.95vw", color: "#FFFFFF", textAlign: "center", fontWeight: 700 }}>19</div>
            <div style={{ fontSize: "0.95vw", color: "#9ECE6A", textAlign: "center", fontWeight: 700 }}>18</div>
            <div style={{ fontSize: "0.95vw", color: "#E0AF68", textAlign: "center", fontWeight: 700 }}>1</div>
            <div style={{ fontSize: "0.95vw", color: "#565F89", textAlign: "center", fontWeight: 700 }}>0</div>
          </div>
        </div>

        {/* Bottom stat */}
        <div style={{ backgroundColor: "rgba(158,206,106,0.06)", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(158,206,106,0.2)", display: "flex", alignItems: "center", gap: "3vw" }}>
          <div>
            <div style={{ fontSize: "3vw", fontWeight: 800, color: "#9ECE6A" }}>95%</div>
            <div style={{ fontSize: "0.85vw", color: "#565F89", textTransform: "uppercase", letterSpacing: "0.05em" }}>Implemented</div>
          </div>
          <div style={{ width: "1px", height: "6vh", backgroundColor: "rgba(255,255,255,0.08)" }} />
          <div style={{ fontSize: "1vw", color: "#9AA5CE", lineHeight: 1.6 }}>
            One partial item: <span style={{ fontFamily: "'DM Mono', monospace", color: "#E0AF68" }}>rejectUnauthorized: false</span> on DB SSL — planned pre-deployment fix before Azure go-live. All other 18 requirements fully satisfied.
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>11</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
