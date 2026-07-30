import { Crosshair, Loader2, RotateCw, SlidersHorizontal, Timer, Wand2, X } from "lucide-react";
import type { TrackInfo } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";
import { openSyncBar } from "@/lib/player/sub-sync";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { Tooltip } from "../transport/tooltip";
import { useSubtitleSearch } from "./subtitle-search-store";

type Props = {
  count: number;
  selectedTrack: TrackInfo | null;
  delayNonZero: boolean;
  onOpenStyleBar?: () => void;
  onClose: () => void;
  onBestMatch: () => void;
  bestMatchHint: string | null;
};

export function MenuHeader(p: Props) {
  const tr = useT();
  const autoSync = useAutoSyncHandle();
  const search = useSubtitleSearch();

  const autoSyncBusy = autoSync?.status === "analyzing";
  const autoSyncApplied = autoSync?.status === "synced" || autoSync?.status === "best-effort";
  const autoSyncOn = autoSyncBusy || autoSyncApplied;
  const canAutoSync = p.selectedTrack?.external === true || autoSyncOn;
  const refreshing = search?.status === "searching";

  return (
    <header className="flex items-center justify-between border-b border-edge-soft px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[13.5px] font-semibold text-ink">{tr("Subtitles")}</span>
        {p.count > 0 && (
          <span className="text-[11.5px] tabular-nums text-ink-subtle">{p.count}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip
          label={
            refreshing
              ? tr("Searching every source again")
              : tr("Search all sources again for more subtitles")
          }
          side="bottom"
          align="end"
        >
          <button
            type="button"
            disabled={!search || refreshing}
            onClick={() => search?.refresh()}
            aria-label={tr("Refresh subtitles")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:text-ink-subtle/50"
          >
            {refreshing ? (
              <Loader2 size={16} strokeWidth={2.2} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <RotateCw size={16} strokeWidth={2.2} />
            )}
          </button>
        </Tooltip>

        <Tooltip
          label={p.bestMatchHint ?? tr("Pick the subtitle that fits this release")}
          side="bottom"
          align="end"
        >
          <button
            type="button"
            disabled={!p.bestMatchHint}
            onClick={p.onBestMatch}
            aria-label={tr("Best match")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:text-ink-subtle/50"
          >
            <Crosshair size={16} strokeWidth={2.2} />
          </button>
        </Tooltip>

        <Tooltip
          label={
            autoSyncBusy
              ? tr("Cancel auto-sync")
              : autoSyncApplied
                ? tr("Turn off auto-sync")
                : canAutoSync
                  ? tr("Auto-sync this subtitle now")
                  : tr("Pick an external subtitle to auto-sync")
          }
          side="bottom"
          align="end"
        >
          <button
            type="button"
            disabled={!canAutoSync}
            onClick={() => {
              if (!canAutoSync) return;
              if (autoSyncOn) {
                autoSync?.stop();
                return;
              }
              autoSync?.run();
              p.onClose();
            }}
            aria-label={tr("Auto sync")}
            aria-pressed={autoSyncOn}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors ${
              autoSyncOn
                ? "bg-accent text-canvas hover:brightness-110"
                : canAutoSync
                  ? "text-ink-muted hover:bg-raised hover:text-ink"
                  : "cursor-not-allowed text-ink-subtle/50"
            }`}
          >
            {autoSyncBusy ? (
              <Loader2 size={14} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Wand2 size={14} strokeWidth={2.2} />
            )}
            {autoSyncBusy ? tr("Cancel sync") : autoSyncApplied ? tr("Synced: on") : tr("Auto sync")}
          </button>
        </Tooltip>

        <Tooltip label={tr("Subtitle sync")} side="bottom" align="end">
          <button
            type="button"
            onClick={() => {
              openSyncBar();
              p.onClose();
            }}
            aria-label={tr("Subtitle sync")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <Timer size={16} strokeWidth={2} />
            {p.delayNonZero && (
              <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
        </Tooltip>

        {p.onOpenStyleBar && (
          <button
            type="button"
            onClick={() => {
              p.onOpenStyleBar?.();
              p.onClose();
            }}
            aria-label={tr("Subtitle appearance")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <SlidersHorizontal size={18} strokeWidth={2} />
          </button>
        )}

        <button
          onClick={p.onClose}
          aria-label={tr("Close")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
