import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { HARBOR_RANK_WEIGHTS } from "@/lib/harbor-rank";

const PILLARS = [
  { key: "quality", label: "Quality", tone: "bg-ink/70" },
  { key: "acclaim", label: "Acclaim", tone: "bg-ink/45" },
  { key: "awards", label: "Awards", tone: "bg-ink/28" },
  { key: "roles", label: "Roles", tone: "bg-ink/15" },
] as const;

export function HowHarborRankWorks({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[185] flex items-end justify-center bg-canvas/85 backdrop-blur-sm animate-in fade-in duration-150 motion-reduce:animate-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("How Harbor Rank works")}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-t-3xl bg-surface p-7 pt-6 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.85)] ring-1 ring-edge-soft animate-in fade-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none sm:m-6 sm:w-[min(92vw,460px)] sm:rounded-lg sm:slide-in-from-bottom-0 sm:zoom-in-95"
      >
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-ink-muted ring-1 ring-edge transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <h2 className="font-display pe-12 text-[26px] font-medium leading-tight tracking-tight text-ink">
          {t("How Harbor Rank works")}
        </h2>

        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          {t(
            "Harbor Rank scores a whole career, not a single hit. Four things move a rank: how good the work is on average, how much of it earned wide acclaim, the major awards it won, and how often the person carried the work as a lead. Each pillar is weighted, added up, then adjusted for the breadth and recency of the body of work. Every number that feeds a score is shown on the card, so you can always see why.",
          )}
        </p>

        <p className="mt-6 text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
          {t("How the four pillars are weighted")}
        </p>

        <div className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full ring-1 ring-edge-soft">
          {PILLARS.map((p) => (
            <div
              key={p.key}
              className={p.tone}
              style={{ width: `${HARBOR_RANK_WEIGHTS[p.key] * 100}%` }}
            />
          ))}
        </div>

        <ul className="mt-4 flex flex-col gap-2.5">
          {PILLARS.map((p) => (
            <li key={p.key} className="flex items-center gap-3">
              <span className={`h-3 w-3 shrink-0 rounded-[3px] ${p.tone}`} />
              <span className="flex-1 text-[14px] text-ink">{t(p.label)}</span>
              <span className="text-[14px] font-semibold text-ink-muted tabular-nums">
                {Math.round(HARBOR_RANK_WEIGHTS[p.key] * 100)}%
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-lg bg-canvas/60 px-4 py-3 text-[13px] leading-relaxed text-ink-subtle ring-1 ring-edge-soft">
          {t(
            "All-time body of work, not who is trending. Trending and Top on TMDB are the live tabs.",
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}
