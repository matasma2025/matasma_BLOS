export default function Slide04NodePython() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>System Architecture</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Application Backends
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Data Flows</div>
        </div>

        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>
          v1.0 · June 2026
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          padding: "6vh 5vw",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Components
        </div>
        <h1
          style={{
            fontSize: "2.8vw",
            fontWeight: 800,
            color: "#FFFFFF",
            margin: "0 0 3vh 0",
            letterSpacing: "-0.02em",
          }}
        >
          Application Backends
        </h1>

        <div style={{ display: "flex", gap: "3vw", flex: 1 }}>
          {/* Node.js column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ borderBottom: "2px solid #7AA2F7", paddingBottom: "1.2vh", marginBottom: "0.5vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#7AA2F7" }}>Node.js / Express</div>
              <div style={{ fontSize: "0.9vw", color: "#565F89", fontFamily: "'DM Mono', monospace" }}>Port 5000 · TypeScript · Node 20</div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2vh 1.8vw", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1.2vh" }}>Responsibilities</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· React SPA serving (SSR dev / static prod)</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· All REST API route handling</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Authentication & session management</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Multi-tenant isolation (domain_id scope)</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Drizzle ORM type-safe DB access</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Pino structured JSON logging</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "1.8vh 1.8vw", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", lineHeight: 1.7, color: "#C0CAF5" }}>
                <div><span style={{ color: "#565F89" }}># Stack</span></div>
                <div>Framework: <span style={{ color: "#9ECE6A" }}>Express 4</span></div>
                <div>ORM: <span style={{ color: "#9ECE6A" }}>Drizzle ORM</span></div>
                <div>Sessions: <span style={{ color: "#9ECE6A" }}>connect-pg-simple</span></div>
                <div>Auth: <span style={{ color: "#9ECE6A" }}>bcryptjs · crypto</span></div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />

          {/* Python column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ borderBottom: "2px solid #9ECE6A", paddingBottom: "1.2vh", marginBottom: "0.5vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#9ECE6A" }}>Python / FastAPI</div>
              <div style={{ fontSize: "0.9vw", color: "#565F89", fontFamily: "'DM Mono', monospace" }}>Port 8000 · Python 3.11</div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "2vh 1.8vw", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "1vw", fontWeight: 600, color: "#FFFFFF", marginBottom: "1.2vh" }}>Responsibilities</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Document ingestion & RAG pipeline</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Semantic SQL engine (NL → SQL)</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· 33 deterministic KPI builders (no LLM)</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Vector embeddings (3072-dim)</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· psycopg2 parameterized DB queries</div>
                <div style={{ fontSize: "0.95vw", color: "#9AA5CE" }}>· Auto-started by Express on boot</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#16161E", borderRadius: "0.5vw", padding: "1.8vh 1.8vw", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85vw", lineHeight: 1.7, color: "#C0CAF5" }}>
                <div><span style={{ color: "#565F89" }}># Stack</span></div>
                <div>Framework: <span style={{ color: "#9ECE6A" }}>FastAPI 0.110</span></div>
                <div>Server: <span style={{ color: "#9ECE6A" }}>Uvicorn</span></div>
                <div>DB driver: <span style={{ color: "#9ECE6A" }}>psycopg2</span></div>
                <div>AI: <span style={{ color: "#9ECE6A" }}>Azure OpenAI SDK</span></div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>04</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
