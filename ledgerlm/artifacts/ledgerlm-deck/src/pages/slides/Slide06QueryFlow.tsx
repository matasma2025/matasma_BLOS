export default function Slide06QueryFlow() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Azure Services</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            AI Query Flow
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Document Ingestion</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Data Flow
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          AI Financial Query Flow
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh", flex: 1 }}>
          {/* Step 1 */}
          <div style={{ display: "flex", alignItems: "stretch", gap: "2vw" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "2.5vw", height: "2.5vw", borderRadius: "50%", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid #7AA2F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#7AA2F7", fontSize: "1vw", fontWeight: 700, flexShrink: 0 }}>1</div>
              <div style={{ width: "1px", flex: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "0.5vh 0" }} />
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "0.5vh" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>User submits question in chat</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#9ECE6A" }}>"What was Bosch total revenue in Q1 2025?"</div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", alignItems: "stretch", gap: "2vw" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "2.5vw", height: "2.5vw", borderRadius: "50%", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid #7AA2F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#7AA2F7", fontSize: "1vw", fontWeight: 700, flexShrink: 0 }}>2</div>
              <div style={{ width: "1px", flex: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "0.5vh 0" }} />
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "0.5vh" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>Express API — authenticate session, resolve tenant</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Session check · domain_id from auth (not user input) · forward to Python</div>
            </div>
          </div>

          {/* Step 3 — branching */}
          <div style={{ display: "flex", alignItems: "stretch", gap: "2vw" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "2.5vw", height: "2.5vw", borderRadius: "50%", backgroundColor: "rgba(158,206,106,0.15)", border: "1px solid #9ECE6A", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ECE6A", fontSize: "1vw", fontWeight: 700, flexShrink: 0 }}>3</div>
              <div style={{ width: "1px", flex: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "0.5vh 0" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: "1.5vw", marginBottom: "0.5vh" }}>
                <div style={{ flex: 1, backgroundColor: "rgba(158,206,106,0.08)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw", border: "1px solid rgba(158,206,106,0.2)" }}>
                  <div style={{ fontSize: "0.85vw", color: "#9ECE6A", fontWeight: 700, marginBottom: "0.3vh" }}>FAST PATH (known metric)</div>
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Keyword detected → 1 of 33 deterministic builders → no LLM call</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "rgba(122,162,247,0.08)", borderRadius: "0.4vw", padding: "1.2vh 1.5vw", border: "1px solid rgba(122,162,247,0.2)" }}>
                  <div style={{ fontSize: "0.85vw", color: "#7AA2F7", fontWeight: 700, marginBottom: "0.3vh" }}>AI PATH (unknown query)</div>
                  <div style={{ fontSize: "0.85vw", color: "#9AA5CE" }}>Azure OpenAI parses intent → generates SQL structure</div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div style={{ display: "flex", alignItems: "stretch", gap: "2vw" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "2.5vw", height: "2.5vw", borderRadius: "50%", backgroundColor: "rgba(224,175,104,0.15)", border: "1px solid #E0AF68", display: "flex", alignItems: "center", justifyContent: "center", color: "#E0AF68", fontSize: "1vw", fontWeight: 700, flexShrink: 0 }}>4</div>
              <div style={{ width: "1px", flex: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "0.5vh 0" }} />
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "0.5vh" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>Semantic SQL Engine executes parameterized query</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", color: "#E0AF68" }}>WHERE cube_id = %s AND domain_id = %s AND year = %s  — scoped to tenant</div>
            </div>
          </div>

          {/* Step 5 */}
          <div style={{ display: "flex", alignItems: "stretch", gap: "2vw" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "2.5vw", height: "2.5vw", borderRadius: "50%", backgroundColor: "rgba(122,162,247,0.15)", border: "1px solid #7AA2F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#7AA2F7", fontSize: "1vw", fontWeight: 700, flexShrink: 0 }}>5</div>
            </div>
            <div style={{ flex: 1, backgroundColor: "#16161E", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.3vh" }}>GPT-5.2 formats data into natural language · SSE stream to browser</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>Response streamed over HTTPS/SSE · audit row written to query_audits table</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>06</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
