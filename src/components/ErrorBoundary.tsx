import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[GNL1Z] Unhandled render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", flexDirection: "column", gap: "16px",
          fontFamily: "monospace", padding: "2rem", background: "#0f1117", color: "#e5e7eb"
        }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#f97316" }}>GNL1Z — Application Error</h1>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.875rem", textAlign: "center", maxWidth: "480px" }}>
            An unexpected error prevented the app from loading. Check the browser console for details.
          </p>
          <pre style={{
            background: "#1f2937", borderRadius: "8px", padding: "1rem",
            fontSize: "0.75rem", color: "#f87171", maxWidth: "600px",
            overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word"
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#f97316", color: "white", border: "none",
              borderRadius: "6px", padding: "8px 20px", cursor: "pointer",
              fontSize: "0.875rem", fontFamily: "monospace"
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
