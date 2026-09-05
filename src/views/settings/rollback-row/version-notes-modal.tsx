import { ArrowDownToLine, Check, Info, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RichNote } from "@/components/update/rich-notes";
import { advanceFocus, captureFocusReturn } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { hasRichNote, releaseNote, type ReleaseNote } from "@/lib/updater/release-notes";
import { installerUrl, type VersionEntry } from "@/lib/updater/versions";
import { openUrl } from "@/lib/window";
import { ROW_DESC } from "../kit";
import { SButton } from "../ui";
import { VERSION_BADGE } from "./badge";

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
  const [scrolls, setScrolls] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => captureFocusReturn(), []);

  useEffect(() => {
    if (closeRef.current) advanceFocus(closeRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  useEffect(() => {
    let ok = true;
    releaseNote(entry.version).then((n) => ok && setRich(n));
    return () => {
      ok = false;
    };
  }, [entry.version]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rich]);

  const onNotesKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = bodyRef.current;
    const dir = getDirection(e.nativeEvent);
    if (!el || (dir !== "up" && dir !== "down")) return;
    const atStart = el.scrollTop <= 1;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if (dir === "up" ? atStart : atEnd) return;
    e.preventDefault();
    el.scrollBy({ top: (dir === "down" ? 0.8 : -0.8) * el.clientHeight, behavior: "smooth" });
  };

  return (
    <ModalShell closing={closing} onDismiss={close}>
      <div className="flex items-start gap-4 px-6 pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-[19px] font-semibold leading-[26px] tabular-nums tracking-tight text-ink">
              {entry.version}
            </h2>
            {entry.channel === "beta" && (
              <span className={`${VERSION_BADGE} bg-accent-soft text-accent`}>{t("Beta")}</span>
            )}
            {entry.channel === "stable" && (
              <span className={`${VERSION_BADGE} bg-elevated text-ink-subtle`}>{t("Stable")}</span>
            )}
          </div>
          {entry.date && <p className={ROW_DESC}>{entry.date}</p>}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label={t("Close")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div
        ref={bodyRef}
        tabIndex={scrolls ? 0 : undefined}
        onKeyDown={scrolls ? onNotesKey : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-6 pt-4"
      >
        {hasRichNote(rich) ? (
          <RichNote note={rich} />
        ) : entry.notes ? (
          <p className={`max-w-[70ch] whitespace-pre-line ${ROW_DESC}`}>{entry.notes}</p>
        ) : (
          <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
            <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t("No notes were published for this build.")}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 pb-6 pt-5">
        <SButton onClick={() => openUrl(RELEASES_URL)}>{t("All releases on GitHub")}</SButton>
        {isCurrent ? (
          <span className={`${VERSION_BADGE} bg-accent-soft text-accent`}>
            <Check size={13} strokeWidth={2.8} />
            {t("Current")}
          </span>
        ) : url ? (
          <SButton
            variant="primary"
            title={t("Download this build's installer, then run it over your current copy")}
            onClick={() => openUrl(url)}
          >
            <ArrowDownToLine size={16} strokeWidth={2.4} />
            {t("Download this build")}
          </SButton>
        ) : null}
      </div>
    </ModalShell>
  );
}
