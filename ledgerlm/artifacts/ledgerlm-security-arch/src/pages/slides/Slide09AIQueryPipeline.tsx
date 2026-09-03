export default function Slide09AIQueryPipeline() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#FAFBFC",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-18vh",
          right: "-8vw",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          border: "0.2vw solid #2A7B7B",
          opacity: 0.12,
        }}
      />

      <div
        style={{
          padding: "5.5vh 7vw 0 7vw",
          height: "90vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: "2.5vh" }}>
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>08. AI PIPELINE SECURITY</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            AI Query Pipeline — Security Controls
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#4A4A68", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>QUERY EXECUTION PIPELINE</div>

            <div style={{ display: "flex", alignItems: "stretch", gap: "0" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center', width: '2.5vw" }}>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ display: "flex", gap: "1.5vw", alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "2vw", flexShrink: 0 }}>
                  <div style={{ width: "1.5vw", height: "1.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.7vw", fontWeight: 700, color: "#FFFFFF" }}>1</span>
                  </div>
                  <div style={{ width: "0.1vw", flex: 1, backgroundColor: "#CBD5E0", marginTop: "0.3vh" }} />
                </div>
                <div style={{ flex: 1, backgroundColor: "#EAF4F4", border: "0.1vw solid #C8E6E6", borderRadius: "0.4vw", padding: "1vh 1.2vw", marginBottom: "0.5vh" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E" }}>Express — auth + tenant resolution</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Session validated, domain_id extracted from session (not user input). All queries scoped before reaching Python.</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.5vw", alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "2vw", flexShrink: 0 }}>
                  <div style={{ width: "1.5vw", height: "1.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.7vw", fontWeight: 700, color: "#FFFFFF" }}>2</span>
                  </div>
                  <div style={{ width: "0.1vw", flex: 1, backgroundColor: "#CBD5E0", marginTop: "0.3vh" }} />
                </div>
                <div style={{ flex: 1, backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1.2vw", marginBottom: "0.5vh" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E" }}>Python FastAPI — intent detection</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Known metric keyword &#x2192; hardcoded SQL builder (33 builders, no LLM). Unknown query &#x2192; Azure OpenAI intent parse. Minimizes LLM attack surface.</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.5vw", alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "2vw", flexShrink: 0 }}>
                  <div style={{ width: "1.5vw", height: "1.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.7vw", fontWeight: 700, color: "#FFFFFF" }}>3</span>
                  </div>
                  <div style={{ width: "0.1vw", flex: 1, backgroundColor: "#CBD5E0", marginTop: "0.3vh" }} />
                </div>
                <div style={{ flex: 1, backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1.2vw", marginBottom: "0.5vh" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E" }}>Parameterized SQL execution</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Drizzle ORM / psycopg2 parameterized queries only. No string interpolation. SQL injection not possible. cube_id + domain_id always in WHERE clause.</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.5vw", alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "2vw", flexShrink: 0 }}>
                  <div style={{ width: "1.5vw", height: "1.5vw", borderRadius: "50%", backgroundColor: "#2A7B7B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.7vw", fontWeight: 700, color: "#FFFFFF" }}>4</span>
                  </div>
                  <div style={{ width: "0.1vw", flex: 1, backgroundColor: "#CBD5E0", marginTop: "0.3vh" }} />
                </div>
                <div style={{ flex: 1, backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1vh 1.2vw", marginBottom: "0.5vh" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E" }}>Azure OpenAI GPT-5.2 — response format</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Data rows (already scoped) passed for language formatting only. LLM does not determine data scope. API key from Key Vault.</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.5vw" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "2vw", flexShrink: 0 }}>
                  <div style={{ width: "1.5vw", height: "1.5vw", borderRadius: "50%", backgroundColor: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.7vw", fontWeight: 700, color: "#FFFFFF" }}>5</span>
                  </div>
                </div>
                <div style={{ flex: 1, backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E" }}>SSE stream to browser over HTTPS</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Streamed via Server-Sent Events. TLS encrypted end-to-end.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2vh 1.8vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>AI SECURITY DESIGN</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
                <div>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E", marginBottom: "0.3vh" }}>LLM scope minimization</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>33 deterministic builders handle known KPIs — LLM not invoked for routine queries</div>
                </div>
                <div style={{ height: "0.1vh", backgroundColor: "#E2E8F0" }} />
                <div>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E", marginBottom: "0.3vh" }}>No direct DB access by LLM</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>LLM only receives pre-fetched, already-scoped data rows — cannot query DB directly</div>
                </div>
                <div style={{ height: "0.1vh", backgroundColor: "#E2E8F0" }} />
                <div>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E", marginBottom: "0.3vh" }}>Parameterized queries only</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>SQL built via Drizzle ORM / psycopg2 — no raw string interpolation</div>
                </div>
                <div style={{ height: "0.1vh", backgroundColor: "#E2E8F0" }} />
                <div>
                  <div style={{ fontSize: "0.82vw", fontWeight: 600, color: "#1A1A2E", marginBottom: "0.3vh" }}>Vector search scoped</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>pgvector similarity search filtered by company_ids from session before ranking</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100vw",
          height: "10vh",
          backgroundColor: "#2A7B7B",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 7vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", letterSpacing: "0.05em" }}>LedgerLM Security Architecture</div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>09</div>
      </div>
    </div>
  );
}
