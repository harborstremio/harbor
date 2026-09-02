import { createPortal } from "react-dom";
import { HelpCircle, Plus, X } from "lucide-react";
import { useState } from "react";
import { usePlaybackPosition } from "@/lib/player/playback-clock";
import { useT } from "@/lib/i18n";
import { useEscape } from "@/components/modal-shell";
import type { AdRange } from "@/lib/ad-report/submit";
import { AboutPanel } from "./ad-report-modal/about-panel";
import { RangeRow } from "./ad-report-modal/range-row";

export function AdReportModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (ranges: AdRange[]) => Promise<boolean>;
}) {
  const t = useT();
  useEscape(onClose, open);
  const position = usePlaybackPosition();
  const [view, setView] = useState<"report" | "about">("report");
  const [ranges, setRanges] = useState<AdRange[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!open) return null;

  const addRange = () => {
    const start = Math.max(0, Math.round(position));
    setRanges((r) => [...r, { startSec: start, endSec: start + 30 }]);
  };
  const updateRange = (i: number, next: AdRange) =>
    setRanges((r) => r.map((x, idx) => (idx === i ? next : x)));
  const removeRange = (i: number) => setRanges((r) => r.filter((_, idx) => idx !== i));

  const valid = ranges.length > 0 && ranges.every((r) => r.endSec > r.startSec);

  const submit = async () => {
    if (!valid || status === "sending") return;
    setStatus("sending");
    const ok = await onSubmit(ranges);
    setStatus(ok ? "sent" : "error");
    if (ok) window.setTimeout(onClose, 1200);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Report an injected ad")}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[82vh] w-[440px] max-w-[92vw] flex-col gap-4 overflow-y-auto rounded-2xl border border-edge bg-surface p-5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] animate-popover-in"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            {view === "about" ? t("What is this?") : t("Report an injected ad")}
          </h2>
          <div className="flex items-center gap-1">
            {view === "report" && (
              <button
                type="button"
                onClick={() => setView("about")}
                className="flex h-8 items-center gap-1.5 rounded-full bg-elevated px-3 text-[11.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <HelpCircle size={13} strokeWidth={2} />
                {t("What is this?")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Close")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <div key={view} className="flex flex-col gap-4 animate-in fade-in duration-200 ease-out">
          {view === "about" ? (
            <AboutPanel onBack={() => setView("report")} />
          ) : (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {t("Play to where the ad starts and add it, then play to the end and tap Now. You can also type the times. Add more than one if there are several.")}
              </p>
              {ranges.length > 0 && (
                <div className="flex flex-col gap-2">
                  {ranges.map((r, i) => (
                    <RangeRow
                      key={i}
                      index={i}
                      range={r}
                      currentSec={position}
                      onChange={(next) => updateRange(i, next)}
                      onRemove={() => removeRange(i)}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addRange}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge text-[13.5px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:bg-elevated hover:text-ink"
              >
                <Plus size={16} strokeWidth={2.2} />
                {t("Add an ad starting at the current time")}
              </button>
              {status === "error" && (
                <p className="text-[12px] text-danger">{t("Could not send. Try again.")}</p>
              )}
              {status === "sent" && (
                <p className="text-[12px] text-accent">{t("Thanks. Sent for review.")}</p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!valid || status === "sending"}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-ink text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
              >
                {status === "sending" ? t("Sending...") : t("Submit report")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
