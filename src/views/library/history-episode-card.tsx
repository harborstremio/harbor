import { RotateCcw, Trash2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Meta } from "@/lib/cinemeta";
import { useContextMenu, useContextTarget, type ContextMenuTarget } from "@/lib/context-menu";
import { captureMembershipProfile, isMembershipProfileCurrent } from "@/lib/membership-operations";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { fetchSeasonEpisodes } from "@/lib/series-episodes";
import { type HistoryEntry } from "./history-merge";

export function HistoryEpisodeCard({
  entry,
  onRemove,
}: {
  entry: HistoryEntry;
  onRemove?: (stremioId: string) => void;
}) {
  const t = useT();
  const { openMeta } = useView();
  const { settings } = useSettings();
  const { open: openContextMenu } = useContextMenu();
  const cardRef = useRef<HTMLButtonElement>(null);
  const [still, setStill] = useState<string | undefined>();
  const [epTitle, setEpTitle] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  const isEpisode = entry.meta.type === "series" && !!entry.season && !!entry.episode;

  useEffect(() => {
    setStill(undefined);
    setEpTitle(null);
    if (!isEpisode) return;
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const metaLike: Meta = { id: entry.meta.id, type: "series", name: entry.meta.name };
      fetchSeasonEpisodes(metaLike, entry.season!, { tmdbKey: settings.tmdbKey })
        .then((eps) => {
          if (cancelled) return;
          const found = eps.find((e) => e.episode === entry.episode);
          if (found?.still) setStill(found.still);
          if (found?.name) setEpTitle(found.name);
        })
        .catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [entry.meta.id, entry.meta.name, entry.season, entry.episode, isEpisode, settings.tmdbKey]);

  useEffect(() => setImgIdx(0), [still]);

  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of [still, entry.meta.background, entry.meta.poster]) {
      if (!u) continue;
      const d = downscale(u);
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
  }, [still, entry.meta.background, entry.meta.poster]);

  const src = candidates[imgIdx];
  const remaining =
    entry.durationMs > 0 && !entry.watched
      ? formatRemaining(t, entry.durationMs - entry.timeOffsetMs)
      : "";

  const open = () =>
    openMeta(
      entry.meta,
      isEpisode ? { episodeHint: { season: entry.season!, episode: entry.episode! } } : undefined,
    );
  const contextTarget = (): ContextMenuTarget => {
    const profile = captureMembershipProfile();
    return {
      kind: "meta",
      meta: entry.meta,
      ...(isEpisode
        ? {
            episode: { season: entry.season!, episode: entry.episode! },
            watchScope: "episode" as const,
          }
        : {}),
      extra: {
        isValid: () => isMembershipProfileCurrent(profile),
        actions: () => [
          ...(isEpisode
            ? [
                {
                  id: `history:episode:${entry.key}`,
                  label: t("Open episode"),
                  run: open,
                  restoreFocus: false,
                  group: "history",
                },
              ]
            : []),
          ...(onRemove && entry.stremioId
            ? [
                {
                  id: `history:remove:${entry.stremioId}`,
                  label: t("Clear Stremio watch history for this title…"),
                  danger: true,
                  group: "remove",
                  run: () => onRemove(entry.stremioId!),
                  restoreFocus: false,
                },
              ]
            : []),
        ],
      },
    };
  };
  const contextRef = useContextTarget<HTMLButtonElement>(contextTarget);

  return (
    <div className="group relative w-full min-w-0">
      <button
        ref={(element) => {
          cardRef.current = element;
          contextRef(element);
        }}
        onClick={open}
        onContextMenu={(e) => openContextMenu(e, contextTarget())}
        className="flex w-full min-w-0 flex-col gap-2.5 text-start"
      >
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-raised via-elevated to-surface" />
          {src && (
            <img
              key={src}
              src={src}
              alt=""
              decoding="async"
              loading="lazy"
              onError={() => setImgIdx((i) => i + 1)}
              className="absolute inset-0 h-full w-full object-cover brightness-95"
            />
          )}
          <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.4)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/80 to-transparent" />
          {entry.watched ? (
            <div className="absolute bottom-2 start-2 flex items-center gap-1.5 rounded-md bg-canvas/95 px-2 py-1 text-[11px]">
              <RotateCcw size={11} strokeWidth={2.4} className="shrink-0 text-emerald-300" />
              <span className="shrink-0 font-medium text-emerald-200">{t("Watched")}</span>
            </div>
          ) : remaining ? (
            <div className="absolute bottom-2 start-2 flex items-center gap-1.5 rounded-md bg-canvas/95 px-2 py-1 text-[11px]">
              <Play size={11} fill="currentColor" className="shrink-0 text-ink" />
              <span className="shrink-0 text-ink-muted">{remaining}</span>
            </div>
          ) : null}
          {entry.progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-canvas/40">
              <div className="h-full bg-accent" style={{ width: `${entry.progress * 100}%` }} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          {isEpisode ? (
            <>
              <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {entry.meta.name || entry.meta.id}
              </p>
              <p className="truncate text-[13px] font-medium text-ink">
                S{entry.season} E{entry.episode}
                {epTitle ? ` - ${epTitle}` : ""}
              </p>
            </>
          ) : (
            <p className="truncate text-[13px] font-medium text-ink">
              {entry.meta.name || entry.meta.id}
            </p>
          )}
          {entry.watchedAt && (
            <p className="text-[11px] text-ink-subtle">{formatShortDate(entry.watchedAt)}</p>
          )}
        </div>
      </button>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[16/9] items-center justify-center opacity-0 transition-opacity duration-[220ms] group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          aria-label={t("Play")}
          title={t("Play")}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-canvas ring-1 ring-white/15 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)] transition-transform duration-150 hover:scale-[1.06]"
        >
          <Play size={20} fill="currentColor" className="ml-0.5 text-ink" />
        </button>
      </div>
      {onRemove && entry.stremioId && (
        <RemoveButton onRemove={() => onRemove(entry.stremioId as string)} />
      )}
    </div>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={t("Clear Stremio watch history for this title…")}
      className="absolute end-2 top-2 z-10 flex h-7 w-7 items-center justify-center gap-1 rounded-full bg-canvas/70 text-white opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200 hover:bg-canvas/90 group-hover:opacity-100"
    >
      <Trash2 size={12} strokeWidth={2.2} />
    </button>
  );
}

function downscale(url: string): string {
  return url.replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w500/");
}

function formatShortDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function formatRemaining(
  t: (key: string, vars?: Record<string, string | number>) => string,
  ms: number,
): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return t("{m}m left", { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t("{h}h left", { h }) : t("{h}h {m}m left", { h, m });
}
