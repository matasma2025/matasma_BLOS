export default function Slide01Title() {
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
          right: "-10vw",
          width: "52vw",
          height: "52vw",
          borderRadius: "50%",
          border: "0.2vw solid #2A7B7B",
          opacity: 0.18,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-8vh",
          right: "8vw",
          width: "30vw",
          height: "30vw",
          borderRadius: "50%",
          border: "0.15vw solid #2A7B7B",
          opacity: 0.1,
        }}
      />

      <div
        style={{
          padding: "8vh 8vw",
          height: "90vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", top: "7vh", left: "8vw" }}>
          <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.06em" }}>LedgerLM</div>
        </div>
        <div style={{ position: "absolute", top: "7vh", right: "8vw" }}>
          <div style={{ fontSize: "1vw", fontWeight: 500, color: "#4A4A68", letterSpacing: "0.04em" }}>CONFIDENTIAL — Bosch CS MS/ECL51</div>
        </div>

        <div style={{ zIndex: 1 }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#2A7B7B",
              color: "#FFFFFF",
              fontSize: "0.9vw",
              fontWeight: 700,
              letterSpacing: "0.12em",
              padding: "0.6vh 1.2vw",
              marginBottom: "3vh",
            }}
          >
            SECURITY ARCHITECTURE REVIEW
          </div>
          <h1
            style={{
              fontSize: "6vw",
              fontWeight: 700,
              color: "#1A1A2E",
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            LedgerLM
          </h1>
          <h1
            style={{
              fontSize: "6vw",
              fontWeight: 400,
              color: "#2A7B7B",
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Security Architecture
          </h1>

          <div style={{ display: "flex", alignItems: "center", marginTop: "4vh" }}>
            <div style={{ width: "4vw", height: "0.3vh", backgroundColor: "#2A7B7B", marginRight: "2vw" }} />
            <p
              style={{
                fontSize: "1.6vw",
                fontWeight: 400,
                color: "#4A4A68",
                margin: 0,
                maxWidth: "55vw",
                lineHeight: 1.5,
              }}
            >
              Granular security layer diagrams for TARA compliance review — Azure-hosted, multi-tenant financial intelligence platform
            </p>
          </div>

          <div style={{ display: "flex", gap: "4vw", marginTop: "5vh" }}>
            <div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "0.5vh" }}>PREPARED FOR</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#1A1A2E" }}>Bosch Cyber Security Team (MS/ECL51)</div>
            </div>
            <div style={{ width: "0.1vw", backgroundColor: "#E2E8F0" }} />
            <div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "0.5vh" }}>DATE</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#1A1A2E" }}>June 2026</div>
            </div>
            <div style={{ width: "0.1vw", backgroundColor: "#E2E8F0" }} />
            <div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#2A7B7B", letterSpacing: "0.08em", marginBottom: "0.5vh" }}>VERSION</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#1A1A2E" }}>1.0</div>
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
          padding: "0 8vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", letterSpacing: "0.05em" }}>
          LedgerLM — AI-Powered Financial Intelligence
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#FFFFFF", opacity: 0.8 }}>
          Confidential • 2026
        </div>
      </div>
    </div>
  );
}
