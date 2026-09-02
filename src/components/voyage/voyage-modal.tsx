import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FlameStreak } from "@/components/icons/flame-streak";
import { useT } from "@/lib/i18n";
import { closeVoyage, useVoyage } from "@/lib/voyage/store";
import { VoyageChooser } from "./voyage-chooser";
import { VoyageRoute } from "./voyage-route";

const CLOSE_MS = 200;

export function VoyageModal() {
  const t = useT();
  const { active, streak } = useVoyage();
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(closeVoyage, CLOSE_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-canvas/80 p-4 sm:p-6"
      style={{ animation: closing ? `voyage-scrim-out ${CLOSE_MS}ms ease forwards` : "voyage-scrim-in 200ms ease both" }}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-lg bg-elevated shadow-[0_40px_120px_-24px_rgba(0,0,0,0.85)]"
        style={{
          animation: closing
            ? `voyage-pop-out ${CLOSE_MS}ms cubic-bezier(0.4,0,1,1) forwards`
            : "voyage-pop-in 380ms ease-in-out both",
        }}
      >
        {active && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24"
            style={{ background: `linear-gradient(to bottom, color-mix(in oklch, ${active.accent}, transparent 90%), transparent)` }}
          />
        )}

        {streak > 1 && (
          <span className="absolute start-4 top-4 z-30 flex h-[22px] items-baseline gap-1 rounded-md bg-white/[0.06] ps-1.5 pe-2.5 text-[11px] font-semibold text-ink-muted">
            <FlameStreak size={14} className="text-accent" />
            <span className="tabular-nums">{streak}</span>
            <span className="text-ink-subtle">{t("day streak")}</span>
          </span>
        )}

        <button
          type="button"
          onClick={requestClose}
          aria-label={t("Close")}
          className="harbor-press-pop absolute end-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-ink-subtle transition-colors hover:bg-white/[0.10] hover:text-ink"
        >
          <X size={17} />
        </button>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-12">
          {active ? <VoyageRoute voyage={active} /> : <VoyageChooser />}
        </div>
      </div>
      <style>{`
        @keyframes voyage-scrim-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes voyage-scrim-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes voyage-pop-in {
          0% { opacity: 0; translate: 0 14px; scale: 0.985 1.01 }
          55% { opacity: 1 }
          68% { translate: 0 -3px; scale: 1.004 0.994 }
          100% { opacity: 1; translate: 0 0; scale: 1 1 }
        }
        @keyframes voyage-pop-out { from { opacity: 1; transform: none } to { opacity: 0; transform: scale(0.99) translateY(3px) } }
      `}</style>
    </div>,
    document.body,
  );
}
