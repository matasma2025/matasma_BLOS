export default function Slide08DataEncryption() {
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
          top: "-15vh",
          left: "-8vw",
          width: "38vw",
          height: "38vw",
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
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.1em", marginBottom: "0.8vh" }}>07. DATA PROTECTION</div>
          <h2 style={{ fontSize: "3.4vw", fontWeight: 700, color: "#1A1A2E", margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Encryption — Transit &amp; Rest
          </h2>
        </div>

        <div style={{ display: "flex", gap: "3vw", flex: 1, zIndex: 1 }}>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#1A1A2E", borderRadius: "0.6vw", padding: "2.5vh 2.5vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "2vh" }}>DATA IN TRANSIT</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
                <div style={{ backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.4)", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.4vh" }}>Browser ↔ App Service</div>
                  <div style={{ fontSize: "0.72vw", color: "rgba(255,255,255,0.65)" }}>HTTPS / TLS 1.2+ enforced. Azure App Service terminates SSL. HSTS max-age 1 year, includeSubDomains, preload.</div>
                </div>
                <div style={{ backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.4)", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.4vh" }}>App Service ↔ PostgreSQL</div>
                  <div style={{ fontSize: "0.72vw", color: "rgba(255,255,255,0.65)" }}>SSL enforced on all DB connections. sslmode=require in connection string. Rejected if certificate invalid.</div>
                </div>
                <div style={{ backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.4)", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.4vh" }}>App Service ↔ Azure OpenAI</div>
                  <div style={{ fontSize: "0.72vw", color: "rgba(255,255,255,0.65)" }}>HTTPS over Azure backbone. API key in Authorization header — never in URL.</div>
                </div>
                <div style={{ backgroundColor: "rgba(42,123,123,0.2)", border: "0.1vw solid rgba(42,123,123,0.4)", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.4vh" }}>App Service ↔ SMTP</div>
                  <div style={{ fontSize: "0.72vw", color: "rgba(255,255,255,0.65)" }}>SMTPS port 465. TLS wrapper from connection open. OTP codes never transmitted in plaintext.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ backgroundColor: "#F8F9FA", borderRadius: "0.6vw", padding: "2.5vh 2.5vw", flex: 1 }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#1A1A2E", letterSpacing: "0.08em", marginBottom: "2vh" }}>DATA AT REST</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
                <div style={{ backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.4vh" }}>PostgreSQL Storage</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Azure-managed AES-256 encryption. Storage layer — transparent to application. All tables, including session store and vector data.</div>
                </div>
                <div style={{ backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.4vh" }}>OTP Codes</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>bcrypt hash (cost factor 10) — plaintext never persisted. Verification by bcrypt.compare() only. Single-use invalidation on success.</div>
                </div>
                <div style={{ backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.4vh" }}>Connector Credentials</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Anaplan API keys, Blob Storage keys, SSO client secrets — AES-encrypted via encryptSensitiveFields() before DB insert.</div>
                </div>
                <div style={{ backgroundColor: "#FFFFFF", border: "0.1vw solid #E2E8F0", borderRadius: "0.4vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.82vw", fontWeight: 700, color: "#1A1A2E", marginBottom: "0.4vh" }}>Blob Storage (Excel/CSV)</div>
                  <div style={{ fontSize: "0.72vw", color: "#4A4A68" }}>Azure Blob Storage server-side encryption enabled by default. Storage account keys in Key Vault.</div>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: "#EAF4F4", border: "0.15vw solid #2A7B7B", borderRadius: "0.5vw", padding: "1.2vh 1.8vw" }}>
              <div style={{ fontSize: "0.8vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em", marginBottom: "0.4vh" }}>TARA CONTROLS MET</div>
              <div style={{ fontSize: "0.78vw", color: "#1A1A2E" }}>SR-DATA-01 (transit) · SR-DATA-02 (at rest)</div>
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
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>08</div>
      </div>
    </div>
  );
}
