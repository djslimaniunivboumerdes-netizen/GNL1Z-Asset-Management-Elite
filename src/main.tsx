import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./index.css";
import { initSync } from "./lib/sync";
import { ErrorBoundary } from "./components/ErrorBoundary";

try {
  const stopSync = initSync();
  if (import.meta.hot) import.meta.hot.dispose(stopSync);
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
