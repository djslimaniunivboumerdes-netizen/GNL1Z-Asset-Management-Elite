import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSync } from "./lib/sync";
import { ErrorBoundary } from "./components/ErrorBoundary";

try {
  initSync();
} catch (e) {
  console.warn("[GNL1Z] initSync failed (offline mode):", e);
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
