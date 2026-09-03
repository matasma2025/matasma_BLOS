export default function Slide04SessionSecurity() {
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
          top: "50%",
          right: "-15vw",
          transform: "translateY(-50%)",
          width: "45vw",
          height: "45vw",
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
        <div style={{ marginBottom: "3.5vh" }}>
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>03. SESSION MANAGEMENT</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Session Security &amp; Cookie Policy
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: "2vh" }}>

            <div style={{ backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "2.5vh 2.5vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "1.5vh" }}>SESSION COOKIE CONFIGURATION</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>httpOnly</span>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B" }}>true</span>
                  <span style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.5)" }}>JS cannot read cookie</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>secure</span>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B" }}>true (prod)</span>
                  <span style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.5)" }}>HTTPS only</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>sameSite</span>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B" }}>strict</span>
                  <span style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.5)" }}>CSRF protection</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.1vh solid rgba(255,255,255,0.1)", paddingBottom: "0.8vh" }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>maxAge</span>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B" }}>8 hours</span>
                  <span style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.5)" }}>Auto-expire TTL</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85vw", fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>store</span>
                  <span style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B" }}>PostgreSQL</span>
                  <span style={{ fontSize: "0.75vw", color: "rgba(255,255,255,0.5)" }}>connect-pg-simple</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ flex: 1, backgroundColor: "#F0F9F9", border: "0.15vw solid #2A7B7B", borderRadius: "0.6vw", padding: "2vh 1.8vw" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1vh" }}>SESSION STORE</div>
                <div style={{ fontSize: "0.8vw", color: "#1A1A2E", lineHeight: 1.6 }}>
                  Sessions stored in PostgreSQL via connect-pg-simple. Server-side only — no session data in browser. Session ID signed with SESSION_SECRET (Key Vault injected).
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#F8F9FA", border: "0.1vw solid #E2E8F0", borderRadius: "0.6vw", padding: "2vh 1.8vw" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#1A1A2E", letterSpacing: "0.06em", marginBottom: "1vh" }}>STARTUP GUARD</div>
                <div style={{ fontSize: "0.8vw", color: "#4A4A68", lineHeight: 1.6 }}>
                  Application refuses to start if SESSION_SECRET is absent. No silent fallback — explicit hard fail prevents insecure deployment.
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 0.9, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2vh 1.8vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>NO CLIENT-SIDE TOKENS</div>
              <div style={{ fontSize: "0.8vw", color: "#4A4A68", lineHeight: 1.6, marginBottom: "1.5vh" }}>
                No JWT or tokens stored in localStorage or sessionStorage. Session ID in httpOnly cookie only — inaccessible to JavaScript.
              </div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>CSRF PROTECTION</div>
              <div style={{ fontSize: "0.8vw", color: "#4A4A68", lineHeight: 1.6, marginBottom: "1.5vh" }}>
                SameSite=Strict prevents cross-site request forgery. Cookie not sent on cross-origin requests.
              </div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "1.2vh" }}>HSTS ENFORCEMENT</div>
              <div style={{ fontSize: "0.8vw", color: "#4A4A68", lineHeight: 1.6 }}>
                max-age: 31,536,000s (1 year), includeSubDomains, preload — forces HTTPS on all future visits.
              </div>
            </div>

            <div style={{ backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.6vw", padding: "1.5vh 1.8vw" }}>
              <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "0.8vh" }}>TARA CONTROLS MET</div>
              <div style={{ fontSize: "0.78vw", color: "#1A1A2E", lineHeight: 1.6 }}>SR-AUTH-01 · SR-DATA-01 · SR-SESSION-01</div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>04</div>
      </div>
    </div>
  );
}
