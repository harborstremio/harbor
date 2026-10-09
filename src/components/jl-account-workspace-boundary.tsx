import { useEffect, type ReactNode } from "react";
import { useJlWorkspaceError } from "@/lib/jl/account/client";

/** Mount above private data/settings providers so a failed account swap cannot expose their state. */
export function JlAccountWorkspaceBoundary({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const error = useJlWorkspaceError();
  useEffect(() => { if (error) onReady?.(); }, [error, onReady]);
  if (!error) return children;
  return (
    <main role="alert" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 32, background: "#10151c", color: "#f5f7fa", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24 }}>Your saved account needs attention</h1>
      <p style={{ maxWidth: 560, lineHeight: 1.6 }}>{error}</p>
      <button onClick={() => window.location.reload()} style={{ width: "fit-content", padding: "12px 20px", marginTop: 16 }}>Try again</button>
    </main>
  );
}
