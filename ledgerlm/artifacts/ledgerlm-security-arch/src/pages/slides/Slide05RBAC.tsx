export default function Slide05RBAC() {
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
          top: "-20vh",
          right: "-8vw",
          width: "42vw",
          height: "42vw",
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
        <div style={{ marginBottom: "3vh" }}>
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>04. ACCESS CONTROL</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Role-Based Access Control
          </h2>
        </div>

        <div style={{ display: "flex", gap: "2.5vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "2vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "0.5vh" }}>SUPER ADMIN</div>
              <div style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.5)", marginBottom: "1.2vh" }}>customer@ledgerlm.ai — platform-level only</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
                <div style={{ fontSize: "0.8vw", color: "#FFFFFF", opacity: 0.85 }}>• Tenant provisioning &amp; deprovisioning</div>
                <div style={{ fontSize: "0.8vw", color: "#FFFFFF", opacity: 0.85 }}>• Platform-wide configuration</div>
                <div style={{ fontSize: "0.8vw", color: "#FFFFFF", opacity: 0.85 }}>• No access to tenant data</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.6vw", padding: "2vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "0.5vh" }}>TENANT ADMIN</div>
              <div style={{ fontSize: "0.75vw", color: "#4A4A68", marginBottom: "1.2vh" }}>requireAdmin() middleware</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E" }}>• User management (invite / remove)</div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E" }}>• Connector configuration (Anaplan, Blob)</div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E" }}>• Domain settings &amp; SSO config</div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E" }}>• Data ingestion triggers</div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E" }}>• KPI cube management</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.6vw", padding: "2vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#1A1A2E", letterSpacing: "0.08em", marginBottom: "0.5vh" }}>STANDARD / MEMBER</div>
              <div style={{ fontSize: "0.75vw", color: "#4A4A68", marginBottom: "1.2vh" }}>Default authenticated user</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
                <div style={{ fontSize: "0.8vw", color: "#4A4A68" }}>• AI financial queries (own tenant data)</div>
                <div style={{ fontSize: "0.8vw", color: "#4A4A68" }}>• KPI dashboards &amp; reports</div>
                <div style={{ fontSize: "0.8vw", color: "#4A4A68" }}>• Document upload (own company)</div>
                <div style={{ fontSize: "0.8vw", color: "#4A4A68", textDecoration: "line-through" }}>No admin routes accessible</div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>ENFORCEMENT CHAIN</div>
              <div style={{ display: "flex", gap: "0", alignItems: "center" }}>
                <div style={{ backgroundColor: "#2A7B7B", borderRadius: "0.4vw", padding: "1vh 1.2vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#FFFFFF" }}>Request</div>
                  <div style={{ fontSize: "0.7vw", color: "rgba(255,255,255,0.7)" }}>arrives</div>
                </div>
                <div style={{ width: "2vw", height: "0.15vh", backgroundColor: "#CBD5E0" }} />
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1vh 1.2vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#1A1A2E" }}>requireAuth()</div>
                  <div style={{ fontSize: "0.7vw", color: "#4A4A68" }}>session check</div>
                </div>
                <div style={{ width: "2vw", height: "0.15vh", backgroundColor: "#CBD5E0" }} />
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1vh 1.2vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#1A1A2E" }}>requireAdmin()</div>
                  <div style={{ fontSize: "0.7vw", color: "#4A4A68" }}>role check</div>
                </div>
                <div style={{ width: "2vw", height: "0.15vh", backgroundColor: "#CBD5E0" }} />
                <div style={{ backgroundColor: "#EAF4F4", border: "0.1vw solid #2A7B7B", borderRadius: "0.4vw", padding: "1vh 1.2vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#1A1A2E" }}>domain_id</div>
                  <div style={{ fontSize: "0.7vw", color: "#4A4A68" }}>tenant scope</div>
                </div>
                <div style={{ width: "2vw", height: "0.15vh", backgroundColor: "#CBD5E0" }} />
                <div style={{ backgroundColor: "#1A1A2E", borderRadius: "0.4vw", padding: "1vh 1.2vw", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75vw", fontWeight: 700, color: "#FFFFFF" }}>Handler</div>
                  <div style={{ fontSize: "0.7vw", color: "rgba(255,255,255,0.7)" }}>executes</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1.5vw" }}>
              <div style={{ flex: 1, backgroundColor: "#FFF0F0", border: "0.1vw solid #E8A0A0", borderRadius: "0.5vw", padding: "1.5vh 1.5vw" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#C00000", marginBottom: "0.6vh" }}>HTTP 401 — Unauthenticated</div>
                <div style={{ fontSize: "0.75vw", color: "#7A0000" }}>No valid session cookie. Returned on any route without valid session.</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#FFF5E6", border: "0.1vw solid #E8C080", borderRadius: "0.5vw", padding: "1.5vh 1.5vw" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#7A4000", marginBottom: "0.6vh" }}>HTTP 403 — Forbidden</div>
                <div style={{ fontSize: "0.75vw", color: "#5A3000" }}>Authenticated but insufficient role. Admin routes return 403 to non-admin users.</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "1.8vh 2vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1vh" }}>ADMIN-ONLY ROUTE EXAMPLES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8vh 1.5vw" }}>
                <div style={{ fontSize: "0.78vw", color: "#4A4A68", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.3vh 0.6vw" }}>POST /api/users/invite</div>
                <div style={{ fontSize: "0.78vw", color: "#4A4A68", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.3vh 0.6vw" }}>PUT /api/connectors/:id</div>
                <div style={{ fontSize: "0.78vw", color: "#4A4A68", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.3vh 0.6vw" }}>POST /api/ingestion/trigger</div>
                <div style={{ fontSize: "0.78vw", color: "#4A4A68", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.3vh 0.6vw" }}>PUT /api/domain/settings</div>
                <div style={{ fontSize: "0.78vw", color: "#4A4A68", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.3vh 0.6vw" }}>DELETE /api/users/:id</div>
                <div style={{ fontSize: "0.78vw", color: "#4A4A68", fontFamily: "monospace", backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.3vw", padding: "0.3vh 0.6vw" }}>POST /api/sso/configure</div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>05</div>
      </div>
    </div>
  );
}
