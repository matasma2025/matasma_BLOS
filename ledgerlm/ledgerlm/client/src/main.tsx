import { createRoot } from "react-dom/client";
import "./lib/deviceProof";
import App from "./App";
import "./index.css";
import { clearLegacyAuthStorage } from "./lib/legacyAuthStorage";

clearLegacyAuthStorage();
createRoot(document.getElementById("root")!).render(<App />);
