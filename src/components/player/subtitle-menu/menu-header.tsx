import { SlidersHorizontal, X } from "lucide-react";
import type { TrackInfo } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { HoverTooltip } from "@/components/hover-tooltip";
import { SyncControl } from "./sync-control";

type Props = {
  count: number;
  selectedTrack: TrackInfo | null;
  delaySec: number;
  delayNonZero: boolean;
  onOpenStyleBar?: () => void;
  onClose: () => void;
};

export function MenuHeader(p: Props) {
  const tr = useT();
  const autoSync = useAutoSyncHandle();

  const autoSyncOn =
    autoSync?.status === "analyzing" ||
    autoSync?.status === "synced" ||
    autoSync?.status === "best-effort";
  const canAutoSync = p.selectedTrack?.external === true || autoSyncOn;

  return (
    <header className="flex items-center justify-between border-b border-edge-soft px-4 py-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[13.5px] font-semibold text-ink">{tr("Subtitles")}</span>
        {p.count > 0 && (
          <span className="text-[11.5px] tabular-nums text-ink-subtle">{p.count}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <SyncControl
          canAutoSync={canAutoSync}
          delaySec={p.delaySec}
          delayNonZero={p.delayNonZero}
          onClose={p.onClose}
        />

        {p.onOpenStyleBar && (
          <HoverTooltip label={tr("Subtitle appearance")} side="bottom" align="end">
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
          </HoverTooltip>
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
