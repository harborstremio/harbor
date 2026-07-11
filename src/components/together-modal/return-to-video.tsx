import type { SyncState } from "@/lib/together/protocol";
import { Play } from "lucide-react";

export function ReturnToVideo({ media, onReturn }: { media: SyncState; onReturn: () => void }) {
  return (
    <button
      onClick={onReturn}
      className="group flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-2 text-start transition-colors hover:bg-accent/15"
    >
      <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-md bg-canvas/60 ring-1 ring-edge-soft/60">
        {media.posterUrl ? (
          <img src={media.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-canvas to-elevated" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Now watching</span>
        <span className="truncate text-[13px] font-semibold text-ink">{media.mediaTitle ?? "Untitled"}</span>
        {media.episode && (
          <span className="font-mono text-[10.5px] tracking-[0.1em] text-ink-subtle">
            S{media.episode.imdbSeason ?? media.episode.season} · E
            {String(media.episode.imdbEpisode ?? media.episode.episode).padStart(2, "0")}
          </span>
        )}
      </div>
      <span className="me-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-transform group-hover:scale-105">
        <Play size={14} strokeWidth={2.4} className="translate-x-px" />
      </span>
    </button>
  );
}
