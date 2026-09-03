export default function Slide06MultiTenantIsolation() {
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
          bottom: "-15vh",
          left: "-8vw",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          border: "0.2vw solid #2A7B7B",
          opacity: 0.1,
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
        <div style={{ marginBottom: "3vh" }}>
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>05. DATA ISOLATION</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Multi-Tenant Data Isolation
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1.3, display: "flex", flexDirection: "column", gap: "1.5vh" }}>

            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>LOGICAL ISOLATION MODEL</div>
              <div style={{ display: "flex", gap: "1.5vw" }}>
                <div style={{ flex: 1, backgroundColor: "#EAF4F4", border: "0.2vw solid #2A7B7B", borderRadius: "0.5vw", padding: "1.5vh 1.5vw" }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", marginBottom: "0.5vh" }}>Bosch</div>
                  <div style={{ fontSize: "0.75vw", color: "#1A1A2E", fontFamily: "monospace", marginBottom: "0.4vh" }}>domain: in.bosch.com</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68", fontFamily: "monospace" }}>domain_id: UUID-A</div>
                  <div style={{ marginTop: "0.8vh", paddingTop: "0.8vh", borderTop: "0.1vh solid #C8E6E6" }}>
                    <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>cube_fact_data WHERE domain_id=UUID-A</div>
                    <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>embeddings WHERE company_id=UUID-A</div>
                  </div>
                </div>
                <div style={{ flex: 1, backgroundColor: "#F0F4F8", border: "0.15vw solid #CBD5E0", borderRadius: "0.5vw", padding: "1.5vh 1.5vw" }}>
                  <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#4A4A68", marginBottom: "0.5vh" }}>Nemko</div>
                  <div style={{ fontSize: "0.75vw", color: "#1A1A2E", fontFamily: "monospace", marginBottom: "0.4vh" }}>domain: nemko.com</div>
                  <div style={{ fontSize: "0.75vw", color: "#4A4A68", fontFamily: "monospace" }}>domain_id: UUID-B</div>
                  <div style={{ marginTop: "0.8vh", paddingTop: "0.8vh", borderTop: "0.1vh solid #E2E8F0" }}>
                    <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>cube_fact_data WHERE domain_id=UUID-B</div>
                    <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>embeddings WHERE company_id=UUID-B</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "1vh", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "0.8vh 1vw" }}>
                <div style={{ fontSize: "0.78vw", fontWeight: 600, color: "#C00000" }}>Shared PostgreSQL instance — no cross-tenant queries possible</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "2vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "1.2vh" }}>ISOLATION ENFORCEMENT POINTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#2A7B7B", minWidth: "8vw" }}>Session resolve</div>
                  <div style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.7)" }}>domain_id extracted from authenticated session — never from request body or query string</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#2A7B7B", minWidth: "8vw" }}>SQL queries</div>
                  <div style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.7)" }}>All DB queries include WHERE domain_id = $1 or WHERE company_id = $1 via Drizzle ORM</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#2A7B7B", minWidth: "8vw" }}>Vector search</div>
                  <div style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.7)" }}>company_ids list from session injected into pgvector similarity search — no cross-tenant embedding access</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#2A7B7B", minWidth: "8vw" }}>Python backend</div>
                  <div style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.7)" }}>company_ids forwarded from Node.js session — Python cannot fabricate tenant context</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 0.9, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2vh 1.8vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>DATA TABLES SCOPED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>cube_fact_data</div>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>document_chunks</div>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>vector_embeddings</div>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>users / memberships</div>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>kpi_configurations</div>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>connector_configs</div>
                <div style={{ fontSize: "0.78vw", color: "#1A1A2E", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.4vh 0.8vw" }}>chat_messages</div>
                <div style={{ fontSize: "0.75vw", color: "#4A4A68", marginTop: "0.5vh" }}>25+ tables — all domain-scoped</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.6vw", padding: "1.5vh 1.8vw" }}>
              <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "0.6vh" }}>TARA CONTROL MET</div>
              <div style={{ fontSize: "0.78vw", color: "#1A1A2E" }}>SR-AUTHZ-02 — Multi-Tenant Data Isolation</div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>06</div>
      </div>
    </div>
  );
}
