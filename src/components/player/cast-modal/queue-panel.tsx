import { Check, Clock, Moon, Play, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { fetchUpcomingEpisodes } from "@/lib/series-episodes";
import { useContinueWatching, type CwCard } from "@/lib/continue-watching";
import {
  queueClear,
  queueRemove,
  queueReorder,
  queueToggle,
  setSleepAtEnd,
  useIsQueued,
  useQueue,
  useSleepAtEnd,
  type QueueItem,
} from "@/lib/queue";
import type { PlayEpisode } from "@/lib/view";

function runtimeMinutes(item: QueueItem): number {
  if (item.episode?.runtime) return item.episode.runtime;
  const r = item.meta.runtime;
  if (typeof r === "string") {
    const n = parseInt(r, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return typeof r === "number" ? r : 0;
}

function fmtTotal(mins: number): string {
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function episodeLabel(ep?: PlayEpisode): string | null {
  if (!ep) return null;
  return `S${ep.imdbSeason ?? ep.season} · E${String(ep.imdbEpisode ?? ep.episode).padStart(2, "0")}`;
}

function cwMeta(c: CwCard): Meta {
  return { id: c.id, type: c.type, name: c.name, poster: c.poster, background: c.background };
}

function cwEpisode(c: CwCard): PlayEpisode | undefined {
  if (c.type !== "series" || c.season == null || c.episode == null) return undefined;
  return { season: c.season, episode: c.episode, videoId: c.videoId };
}

function CwSuggestionRow({
  card,
  onPlay,
}: {
  card: CwCard;
  onPlay: (meta: Meta, episode?: PlayEpisode) => void;
}) {
  const t = useT();
  const meta = cwMeta(card);
  const episode = cwEpisode(card);
  const queued = useIsQueued(meta, episode);
  const pct = Math.round(card.progress * 100);
  const epLabel = episode
    ? `S${episode.season} · E${String(episode.episode).padStart(2, "0")}`
    : null;
  return (
    <div className="group flex items-center gap-3 rounded-xl bg-white/[0.04] p-2 transition-colors hover:bg-white/[0.07]">
      <button
        type="button"
        onClick={() => onPlay(meta, episode)}
        className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]"
        aria-label={t("Play")}
      >
        {(card.background || card.poster) && (
          <img src={card.background || card.poster} alt="" className="h-full w-full object-cover" />
        )}
        {pct > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <span className="block h-full bg-white" style={{ width: `${pct}%` }} />
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-1 text-[14.5px] font-semibold text-white">{card.name}</span>
        <span className="text-[12.5px] text-white/45">
          {[epLabel, pct > 0 ? t("{pct}% watched", { pct }) : null].filter(Boolean).join(" · ")}
        </span>
      </div>
      <button
        type="button"
        onClick={() => queueToggle(meta, episode)}
        aria-label={queued ? t("Remove from queue") : t("Add to queue")}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          queued
            ? "bg-white text-black"
            : "bg-white/[0.08] text-white/70 ring-1 ring-white/12 hover:bg-white/15"
        }`}
      >
        {queued ? <Check size={17} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.3} />}
      </button>
    </div>
  );
}

export function QueuePanel({
  onPlay,
  currentMeta,
  currentEpisode,
}: {
  onPlay: (meta: Meta, episode?: PlayEpisode) => void;
  currentMeta?: Meta | null;
  currentEpisode?: PlayEpisode | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const queue = useQueue();
  const sleepAtEnd = useSleepAtEnd();
  const [upcoming, setUpcoming] = useState<PlayEpisode[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const dropQueue = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      const ids = queue.map((q) => q.id);
      const to = ids.indexOf(targetId);
      ids.splice(ids.indexOf(dragId), 1);
      ids.splice(to, 0, dragId);
      queueReorder(ids);
    }
    setDragId(null);
    setOverId(null);
  };

  const isSeriesCurrent =
    !!currentMeta &&
    !!currentEpisode &&
    (currentMeta.type === "series" ||
      currentMeta.id.startsWith("tmdb:tv:") ||
      /^(kitsu|mal|anilist):/.test(currentMeta.id));

  useEffect(() => {
    if (queue.length > 0 || !isSeriesCurrent || !currentMeta || !currentEpisode) {
      setUpcoming([]);
      return;
    }
    let cancelled = false;
    fetchUpcomingEpisodes(
      currentMeta,
      { season: currentEpisode.season, episode: currentEpisode.episode },
      8,
      {
        tmdbKey: settings.tmdbKey,
      },
    )
      .then((eps) => {
        if (!cancelled) setUpcoming(eps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [queue.length, isSeriesCurrent, currentMeta, currentEpisode, settings.tmdbKey]);

  const cwList = useContinueWatching(currentMeta?.id);
  const totalMins = queue.reduce((sum, i) => sum + runtimeMinutes(i), 0);

  if (queue.length === 0) {
    return (
      <div className="flex flex-col gap-5 px-6 pb-8 pt-1 sm:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-[14px] leading-relaxed text-white/60">
          {t("Your queue is empty. Add movies or shows and they'll play back-to-back here.")}
        </div>
        {upcoming.length > 0 && currentMeta && (
          <section className="flex flex-col gap-3">
            <h3 className="px-1 text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">
              {t("Up next from {name}", { name: currentMeta.name ?? "" })}
            </h3>
            <div className="flex flex-col gap-2">
              {upcoming.map((ep) => (
                <button
                  key={`${ep.season}-${ep.episode}`}
                  type="button"
                  onClick={() => onPlay(currentMeta, ep)}
                  className="group flex items-center gap-3 rounded-xl bg-white/[0.04] p-2 text-start transition-colors hover:bg-white/[0.09]"
                >
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                    {(ep.still || currentMeta.background || currentMeta.poster) && (
                      <img
                        src={ep.still || currentMeta.background || currentMeta.poster}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute bottom-1 start-1 flex h-5 min-w-5 items-center justify-center rounded bg-black/70 px-1 text-[11px] font-bold text-white">
                      {ep.episode}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-1 text-[14px] font-medium text-white/90">
                      {ep.name || t("Episode {n}", { n: ep.episode })}
                    </span>
                    <span className="text-[12px] text-white/45">{episodeLabel(ep)}</span>
                  </div>
                  <Play
                    size={16}
                    className="shrink-0 text-white/40 group-hover:text-white"
                    fill="currentColor"
                  />
                </button>
              ))}
            </div>
          </section>
        )}
        {cwList.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="px-1 text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">
              {t("Continue watching")}
            </h3>
            <div className="flex flex-col gap-2">
              {cwList.map((c) => (
                <CwSuggestionRow key={c.id} card={c} onPlay={onPlay} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 pb-8 pt-1 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[13px] text-white/55">
          {totalMins > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} strokeWidth={2.2} />
              {t("{count} in queue · {time}", { count: queue.length, time: fmtTotal(totalMins) })}
            </span>
          )}
          {totalMins <= 0 && <span>{t("{count} in queue", { count: queue.length })}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSleepAtEnd(!sleepAtEnd)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              sleepAtEnd
                ? "bg-white text-black"
                : "bg-white/[0.08] text-white/70 ring-1 ring-white/12 hover:bg-white/15"
            }`}
          >
            <Moon size={15} strokeWidth={2.3} />
            {t("Sleep at end")}
          </button>
          <button
            type="button"
            onClick={queueClear}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold text-white/70 ring-1 ring-white/12 transition-colors hover:bg-white/15"
          >
            <Trash2 size={15} strokeWidth={2.2} />
            {t("Clear")}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {queue.map((item, i) => {
          const mins = runtimeMinutes(item);
          const epLabel = episodeLabel(item.episode);
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                setDragId(item.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragId && overId !== item.id) setOverId(item.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropQueue(item.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`group flex cursor-grab items-center gap-3 rounded-xl bg-white/[0.04] p-2 transition-colors hover:bg-white/[0.07] active:cursor-grabbing ${
                dragId === item.id ? "opacity-40" : ""
              } ${overId === item.id && dragId !== item.id ? "ring-2 ring-white/40" : ""}`}
            >
              <span className="w-6 shrink-0 text-center text-[13px] font-bold text-white/35">
                {i + 1}
              </span>
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
                {(item.meta.background || item.meta.poster) && (
                  <img
                    src={item.meta.background || item.meta.poster}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-1 text-[14.5px] font-semibold text-white">
                  {item.meta.name}
                </span>
                <span className="text-[12.5px] text-white/45">
                  {[epLabel, mins > 0 ? `${mins}m` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  queueRemove(item.id);
                  onPlay(item.meta, item.episode);
                }}
                aria-label={t("Play")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
              >
                <Play size={17} fill="currentColor" className="ml-0.5" />
              </button>
              <button
                type="button"
                onClick={() => queueRemove(item.id)}
                aria-label={t("Remove from queue")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
