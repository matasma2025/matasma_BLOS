export default function Slide07IngestionFlow() {
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
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>AI Query Flow</div>
          <div style={{ fontSize: "0.95vw", color: "#7AA2F7", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.8vw" }}>
            <span style={{ width: "3px", height: "1vw", backgroundColor: "#7AA2F7", borderRadius: "2px" }} />
            Document Ingestion
          </div>
          <div style={{ fontSize: "0.95vw", color: "#C0CAF5", opacity: 0.6 }}>Auth Flow</div>
        </div>
        <div style={{ marginTop: "auto", fontSize: "0.8vw", color: "#565F89" }}>v1.0 · June 2026</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "6vh 5vw", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "0.95vw", color: "#7AA2F7", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: "1vh" }}>
          Data Flow
        </div>
        <h1 style={{ fontSize: "2.8vw", fontWeight: 800, color: "#FFFFFF", margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          Document Ingestion Pipeline
        </h1>

        {/* Pipeline steps horizontal */}
        <div style={{ display: "flex", alignItems: "stretch", gap: "0", flex: 1 }}>

          {/* Step 1 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ backgroundColor: "rgba(224,175,104,0.08)", border: "1px solid rgba(224,175,104,0.25)", borderRadius: "0.5vw 0 0 0.5vw", padding: "2.5vh 2vw", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "0.8vw", color: "#E0AF68", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>Step 1</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Azure Blob Storage</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6, flex: 1 }}>
                Excel file uploaded to Blob Storage. Scheduler detects new blob via <span style={{ fontFamily: "'DM Mono', monospace", color: "#E0AF68" }}>azure_blob_file_registry</span> table — prevents re-ingestion.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 0.5vw", color: "#565F89", fontSize: "1.5vw" }}>→</div>

          {/* Step 2 */}
          <div style={{ flex: 1 }}>
            <div style={{ backgroundColor: "rgba(122,162,247,0.08)", border: "1px solid rgba(122,162,247,0.25)", borderRadius: "0", padding: "2.5vh 2vw", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "0.8vw", color: "#7AA2F7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>Step 2</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Python Parser</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6, flex: 1 }}>
                Python backend parses Excel file and extracts rows across <span style={{ fontFamily: "'DM Mono', monospace", color: "#7AA2F7" }}>78 columns</span> of financial data.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 0.5vw", color: "#565F89", fontSize: "1.5vw" }}>→</div>

          {/* Step 3 */}
          <div style={{ flex: 1 }}>
            <div style={{ backgroundColor: "rgba(158,206,106,0.08)", border: "1px solid rgba(158,206,106,0.25)", borderRadius: "0", padding: "2.5vh 2vw", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>Step 3</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Vector Embeddings</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6, flex: 1 }}>
                Azure OpenAI <span style={{ fontFamily: "'DM Mono', monospace", color: "#9ECE6A" }}>text-embedding-3-large</span> generates 3072-dimensional embeddings per document chunk.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 0.5vw", color: "#565F89", fontSize: "1.5vw" }}>→</div>

          {/* Step 4 */}
          <div style={{ flex: 1 }}>
            <div style={{ backgroundColor: "rgba(122,162,247,0.08)", border: "1px solid rgba(122,162,247,0.2)", borderRadius: "0", padding: "2.5vh 2vw", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "0.8vw", color: "#7AA2F7", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>Step 4</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>PostgreSQL Storage</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6, flex: 1 }}>
                Chunks + embeddings stored via pgvector. Structured rows written to <span style={{ fontFamily: "'DM Mono', monospace", color: "#7AA2F7" }}>cube_fact_data</span>.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 0.5vw", color: "#565F89", fontSize: "1.5vw" }}>→</div>

          {/* Step 5 */}
          <div style={{ flex: 1 }}>
            <div style={{ backgroundColor: "rgba(158,206,106,0.08)", border: "1px solid rgba(158,206,106,0.2)", borderRadius: "0 0.5vw 0.5vw 0", padding: "2.5vh 2vw", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "0.8vw", color: "#9ECE6A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>Step 5</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "1vh" }}>Available for Queries</div>
              <div style={{ fontSize: "0.9vw", color: "#9AA5CE", lineHeight: 1.6, flex: 1 }}>
                Financial data indexed and available for AI queries, KPI analysis, and semantic search.
              </div>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div style={{ marginTop: "2.5vh", backgroundColor: "rgba(122,162,247,0.06)", borderRadius: "0.4vw", padding: "1.5vh 2vw", border: "1px solid rgba(122,162,247,0.15)", display: "flex", alignItems: "center", gap: "1.5vw" }}>
          <div style={{ fontSize: "0.85vw", color: "#565F89", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Security Note</div>
          <div style={{ fontSize: "0.9vw", color: "#9AA5CE" }}>All data scoped to tenant <span style={{ fontFamily: "'DM Mono', monospace", color: "#7AA2F7" }}>company_id</span> at every stage — no cross-tenant access possible during ingestion or retrieval.</div>
        </div>

        <div style={{ marginTop: "1.5vh", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1vw", color: "#565F89", fontWeight: 500 }}>07</div>
          <div style={{ fontSize: "0.85vw", color: "#565F89" }}>LedgerLM · Internal / Bosch CS Review</div>
        </div>
      </div>
    </div>
  );
}
