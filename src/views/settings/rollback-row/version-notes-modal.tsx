import { ArrowDownToLine, Check, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BetaTag } from "@/components/beta-tag";
import { useT } from "@/lib/i18n";
import { installerUrl, type VersionEntry } from "@/lib/updater/versions";
import { openUrl } from "@/lib/window";

const RELEASES_URL = "https://github.com/harborstremio/harbor/releases";

export function VersionNotesModal({
  entry,
  isCurrent,
  onClose,
}: {
  entry: VersionEntry;
  isCurrent: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const url = installerUrl(entry);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-canvas/80 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex max-h-[80vh] w-[min(94vw,560px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-edge-soft px-5 pb-3.5 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="font-display text-[20px] font-medium tabular-nums text-ink">
              {entry.version}
            </h2>
            {entry.channel === "beta" && <BetaTag force />}
            {entry.channel === "stable" && (
              <span className="inline-flex shrink-0 items-center rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted ring-1 ring-edge">
                {t("Stable")}
              </span>
            )}
            {entry.date && <span className="text-[12px] text-ink-subtle">{entry.date}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {entry.notes ? (
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-muted">
              {entry.notes}
            </p>
          ) : (
            <p className="text-[13px] text-ink-subtle">
              {t("No notes were published for this build.")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-5 py-3.5">
          <button
            type="button"
            onClick={() => openUrl(RELEASES_URL)}
            className="text-[12px] font-semibold text-ink-subtle underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            {t("All releases on GitHub")}
          </button>
          {isCurrent ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent">
              <Check size={13} strokeWidth={2.8} />
              {t("Current")}
            </span>
          ) : url ? (
            <button
              type="button"
              title={t("Download this build's installer, then run it over your current copy")}
              onClick={() => openUrl(url)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-all hover:scale-[1.02] active:scale-[0.97]"
            >
              <ArrowDownToLine size={14} strokeWidth={2.4} />
              {t("Download this build")}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
