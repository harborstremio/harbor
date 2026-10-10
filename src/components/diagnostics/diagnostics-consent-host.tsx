import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeDiagnosticsOpen } from "@/lib/social/diagnostics-open";
import type { DiagnosticsRequestSummary } from "@/lib/social/diagnostics";
import { DiagnosticsConsentModal } from "./remote-support-consent";
import { DiagnosticsProgress } from "./remote-support-progress";
import { useDiagnosticsRun } from "./use-diagnostics-run";
import { useT } from "@/lib/i18n";

type Active =
  | { requestId: string; phase: "consent" }
  | { requestId: string; phase: "progress"; ticket: string };

function ProgressShell({
  requestId,
  ticket,
  onClose,
}: {
  requestId: string;
  ticket: string;
  onClose: () => void;
}) {
  const t = useT();
  const run = useDiagnosticsRun(requestId, ticket);
  return createPortal(
    <div
      className="fixed inset-0 z-[240] grid place-items-center bg-canvas/60 p-4"
      style={{ animation: "diag-scrim-in 160ms ease both" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Sharing diagnostics")}
        className="harbor-together-surface w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-edge shadow-[0_40px_100px_-24px_rgba(0,0,0,0.85)]"
        style={{ animation: "diag-pop-in 220ms cubic-bezier(0.32,0.72,0.24,1) both" }}
      >
        <DiagnosticsProgress
          stage={run.stage}
          done={run.done}
          error={run.error}
          ticket={ticket}
          reducedMotion={run.reducedMotion}
          onRetry={run.retry}
          onClose={onClose}
        />
      </div>
      <style>{`
        @keyframes diag-scrim-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes diag-pop-in { from { opacity: 0; transform: translateY(10px) scale(0.98) } to { opacity: 1; transform: none } }
      `}</style>
    </div>,
    document.body,
  );
}

export function DiagnosticsConsentHost() {
  const [active, setActive] = useState<Active | null>(null);

  useEffect(
    () => subscribeDiagnosticsOpen((requestId) => setActive({ requestId, phase: "consent" })),
    [],
  );

  if (!active) return null;

  if (active.phase === "consent") {
    const share = (summary: DiagnosticsRequestSummary) =>
      setActive({ requestId: summary.id, phase: "progress", ticket: summary.ticket });
    return (
      <DiagnosticsConsentModal
        requestId={active.requestId}
        onShare={share}
        onClose={() => setActive(null)}
      />
    );
  }

  return (
    <ProgressShell
      requestId={active.requestId}
      ticket={active.ticket}
      onClose={() => setActive(null)}
    />
  );
}
