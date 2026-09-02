import { Trash2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { queueClear, queueIndexOf, queueItemAfter, queueRemove, useQueue } from "@/lib/queue";
import { useView, type PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function QueueUpNext({
  meta,
  currentEpisode,
  roomGuest,
  onClose,
}: {
  meta: Meta;
  currentEpisode: PlayEpisode | undefined;
  roomGuest: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const queue = useQueue();
  const { openPicker } = useView();
  if (queue.length === 0) return null;
  const currentIdx = queueIndexOf(meta, currentEpisode);
  const currentId = currentIdx >= 0 ? queue[currentIdx]?.id ?? null : null;
  const nextId = queueItemAfter(meta, currentEpisode)?.id ?? null;
  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-edge-soft/60 pt-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
          {t("In your queue")}
          <span className="ms-1.5 font-semibold tabular-nums text-ink-subtle/70">{queue.length}</span>
        </h3>
        {!roomGuest && (
          <button
            type="button"
            onClick={() => queueClear()}
            className="text-[11px] font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            {t("Clear")}
          </button>
        )}
      </div>
      {queue.map((item, i) => {
        const isCurrent = item.id === currentId;
        const isNextUp = !isCurrent && item.id === nextId;
        return (
          <div
            key={item.id}
            className={`group flex items-center gap-2.5 rounded-xl p-2 transition-colors ${
              isNextUp
                ? "bg-accent/12 ring-1 ring-accent/35"
                : isCurrent
                  ? "bg-elevated/70"
                  : "bg-elevated/40"
            }`}
          >
            <span
              className={`w-5 shrink-0 text-center text-[12px] font-bold tabular-nums ${
                isNextUp ? "text-accent" : "text-ink-subtle"
              }`}
            >
              {i + 1}
            </span>
            <button
              type="button"
              disabled={roomGuest || isCurrent}
              onClick={() => {
                openPicker(item.meta, item.episode);
                onClose();
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-start disabled:cursor-default"
            >
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                {(item.meta.background || item.meta.poster) && (
                  <img
                    src={item.meta.background || item.meta.poster}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                {!isCurrent && !roomGuest && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play size={16} fill="currentColor" className="text-white" />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-1 text-[14px] font-medium text-ink">{item.meta.name}</span>
                <span className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
                  {isNextUp && (
                    <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      {t("Next Up")}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {t("Now Playing")}
                    </span>
                  )}
                  {item.episode && (
                    <span>{`S${item.episode.imdbSeason ?? item.episode.season} · E${item.episode.imdbEpisode ?? item.episode.episode}`}</span>
                  )}
                </span>
              </div>
            </button>
            <button
              type="button"
              aria-label={t("Remove from queue")}
              title={t("Remove from queue")}
              onClick={() => queueRemove(item.id)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle opacity-0 transition-all hover:bg-canvas/60 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
