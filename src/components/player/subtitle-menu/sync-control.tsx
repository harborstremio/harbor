import { AudioLines, ChevronDown, Loader2 } from "lucide-react";
import { UiIcon } from "@/components/ui-icon";
import { useEffect, useRef, useState } from "react";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { useT } from "@/lib/i18n";
import { openSyncBar } from "@/lib/player/sub-sync";

type Props = {
  canAutoSync: boolean;
  canLiveSync: boolean;
  delaySec: number;
  delayNonZero: boolean;
  onLiveSync?: () => void | Promise<void>;
  onClose: () => void;
};

export function SyncControl({
  canAutoSync,
  canLiveSync,
  delaySec,
  delayNonZero,
  onLiveSync,
  onClose,
}: Props) {
  const tr = useT();
  const autoSync = useAutoSyncHandle();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const busy = autoSync?.status === "analyzing";
  const applied = autoSync?.status === "synced" || autoSync?.status === "best-effort";
  const autoSyncOn = busy || applied;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const runAutoSync = () => {
    if (!canAutoSync) return;
    if (autoSyncOn) {
      autoSync?.stop();
      return;
    }
    autoSync?.run();
    onClose();
  };

  const label = applied ? tr("Synced: on") : tr("Auto sync");

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={tr("{label}, sync options", { label })}
        aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold transition-colors ${
          autoSyncOn
            ? "text-accent hover:bg-raised"
            : open
              ? "bg-raised text-ink"
              : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {busy && (
          <Loader2 size={13} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" />
        )}
        <span>{label}</span>
        <ChevronDown
          size={13}
          strokeWidth={2.4}
          className={`-me-0.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        {delayNonZero && !autoSyncOn && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-[calc(100%+6px)] z-[60] w-[206px] overflow-hidden rounded-md bg-elevated py-1 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)] animate-menu-pop">
          <button
            type="button"
            disabled={!canLiveSync || !onLiveSync}
            onClick={() => {
              setOpen(false);
              void Promise.resolve(onLiveSync?.()).finally(onClose);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:text-ink-subtle/50"
          >
            <AudioLines size={14} strokeWidth={2.2} />
            <span className="flex-1">{tr("Live sync")}</span>
            <span className="text-[10.5px] text-ink-subtle">{tr("Guided")}</span>
          </button>
          <button
            type="button"
            disabled={!canAutoSync}
            onClick={() => {
              setOpen(false);
              runAutoSync();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:text-ink-subtle/50"
          >
            <UiIcon name="auto-sync" className="h-3.5 w-3.5" />
            {autoSyncOn ? tr("Turn off auto-sync") : tr("Auto sync")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openSyncBar(delaySec);
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] text-ink transition-colors hover:bg-raised"
          >
            <UiIcon name="manual-offset" className="h-3.5 w-3.5" />
            <span className="flex-1">{tr("Manual offset")}</span>
            {delayNonZero && (
              <span className="font-mono text-[11.5px] tabular-nums text-accent">
                {delaySec > 0 ? `+${delaySec.toFixed(1)}` : delaySec.toFixed(1)}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
