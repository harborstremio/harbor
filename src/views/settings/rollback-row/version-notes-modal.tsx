import { ArrowDownToLine, Check, X } from "lucide-react";
import { useModalExit } from "@/components/modal-shell";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BetaTag } from "@/components/beta-tag";
import { RichNote } from "@/components/update/rich-notes";
import { useT } from "@/lib/i18n";
import { hasRichNote, releaseNote, type ReleaseNote } from "@/lib/updater/release-notes";
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
  const { closing, close } = useModalExit(onClose);
  const t = useT();
  const url = installerUrl(entry);
  const [rich, setRich] = useState<ReleaseNote | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    let ok = true;
    releaseNote(entry.version).then((n) => ok && setRich(n));
    return () => {
      ok = false;
    };
  }, [entry.version]);

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[240] flex items-center justify-center p-6`}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface harbor-float`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[17px] font-semibold tabular-nums text-ink">
                {entry.version}
              </h2>
              {entry.channel === "beta" && <BetaTag force />}
              {entry.channel === "stable" && (
                <span className="inline-flex shrink-0 items-center rounded-md bg-canvas px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  {t("Stable")}
                </span>
              )}
            </div>
            {entry.date && <p className="text-[12.5px] text-ink-subtle">{entry.date}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {hasRichNote(rich) ? (
            <RichNote note={rich} />
          ) : entry.notes ? (
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-muted">{entry.notes}</p>
          ) : (
            <p className="rounded-md bg-canvas px-3.5 py-3 text-[13px] text-ink-subtle">
              {t("No notes were published for this build.")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-5">
          <button
            type="button"
            onClick={() => openUrl(RELEASES_URL)}
            className="h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("All releases on GitHub")}
          </button>
          {isCurrent ? (
            <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-canvas px-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent">
              <Check size={14} strokeWidth={2.8} />
              {t("Current")}
            </span>
          ) : url ? (
            <button
              type="button"
              title={t("Download this build's installer, then run it over your current copy")}
              onClick={() => openUrl(url)}
              className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
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
