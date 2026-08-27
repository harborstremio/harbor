import { AudioLines, ChevronDown, Loader2, Timer, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { useT } from "@/lib/i18n";
import { openSyncBar } from "@/lib/player/sub-sync";
import { HoverTooltip } from "@/components/hover-tooltip";

type Props = {
  canAutoSync: boolean;
  canLiveSync: boolean;
  delaySec: number;
  delayNonZero: boolean;
  onLiveSync?: () => void | Promise<void>;
  onClose: () => void;
};

function MaybeTip({
  show,
  label,
  children,
}: {
  show: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <HoverTooltip label={label} side="bottom" align="end">
      {children}
    </HoverTooltip>
  );
}

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

  const label = busy ? tr("Cancel sync") : applied ? tr("Synced: on") : tr("Auto sync");

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <div
        className={`flex items-center rounded-full transition-colors ${
          autoSyncOn ? "bg-accent text-canvas" : open ? "bg-raised" : ""
        }`}
      >
        <MaybeTip show={!canAutoSync} label={tr("Needs an external subtitle")}>
          <button
            type="button"
            disabled={!canAutoSync}
            onClick={runAutoSync}
            aria-label={tr("Auto sync")}
            aria-pressed={autoSyncOn}
            className={`flex h-9 items-center gap-1.5 rounded-s-full ps-3 pe-1.5 text-[12.5px] font-semibold transition-colors ${
              autoSyncOn
                ? "hover:brightness-110"
                : canAutoSync
                  ? "text-ink-muted hover:bg-raised hover:text-ink"
                  : "cursor-not-allowed text-ink-subtle/50"
            }`}
          >
            {busy ? (
              <Loader2
                size={14}
                strokeWidth={2.4}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Wand2 size={14} strokeWidth={2.2} />
            )}
            {label}
          </button>
        </MaybeTip>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={tr("Sync options")}
          aria-expanded={open}
          className={`relative flex h-9 w-7 items-center justify-center rounded-e-full transition-colors ${
            autoSyncOn ? "hover:brightness-110" : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          <ChevronDown size={14} strokeWidth={2.4} className={open ? "rotate-180" : ""} />
          {delayNonZero && !autoSyncOn && (
            <span className="absolute end-1 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>
      </div>

      {open && (
        <div className="absolute end-0 top-[calc(100%+6px)] z-[60] w-[206px] overflow-hidden rounded-xl border border-edge bg-elevated py-1 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)]">
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
            <Wand2 size={14} strokeWidth={2.2} />
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
            <Timer size={14} strokeWidth={2} />
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
