import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, X } from "lucide-react";
import simklLogo from "@/assets/simkl.png";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { animeKitsuMeta, type AnimeKitsuVideo } from "@/lib/providers/anime-kitsu-addon";
import { tmdbLiteMeta } from "@/lib/providers/tmdb/tmdb-lite";
import { useContextMenu } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
import { readSnapshot, useSnapshotVersion } from "@/lib/snapshots";
import {
  episodeFromVideoId,
  isAnimeCwItem,
  libraryMetaType,
  type LibraryItem,
} from "@/lib/stremio";
import { useHasNewEpisode } from "@/lib/new-episodes";
import { Tooltip } from "@/views/detail/tooltip";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useView, type PlayEpisode } from "@/lib/view";
import { getWatchedBy } from "@/lib/watched-by";
import { playLocalAware } from "@/lib/local-library/playback";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { fetchSeasonEpisodes } from "@/lib/series-episodes";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { resolvePreferredAnimeTitle } from "@/lib/anime-title";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

type Props = {
  item: LibraryItem;
  watched?: boolean;
  onDismiss?: (item: LibraryItem) => void;
};

let backdropBlurHasWarmed = false;

export const ContinueCard = memo(function ContinueCard({
  item,
  watched = false,
  onDismiss,
}: Props) {
  const { openMeta, openPicker, openPlayer } = useView();
  const t = useT();
  const { settings, update } = useSettings();
  const { profiles, activeProfile } = useProfiles();
  const [hasActivatedGlass, setHasActivatedGlass] = useState(false);
  const [shouldRevealGlass, setShouldRevealGlass] = useState(false);
  const hasActivatedGlassRef = useRef(false);
  const revealFrameRef = useRef<number | null>(null);
  const watcherId = getWatchedBy(item._id);
  const watcher = watcherId ? profiles.find((p) => p.id === watcherId) : null;
  const showWatcher = !!watcher && watcher.id !== activeProfile?.id;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const { open: openContextMenu } = useContextMenu();
  useSnapshotVersion();
  const newEpisode = useHasNewEpisode(item);
  const snapshot = readSnapshot(item._id);
  const isExternal = item.external === "simkl";
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  const progress = dur > 0 ? Math.min(1, off / dur) : 0;
  const remaining = dur > 0 && !isExternal ? formatRemaining(t, dur - off) : "";
  const upNext = item.upNext === true;
  const kitsuThreeSeg =
    /^(kitsu|mal|anilist|anidb):/.test(item._id) &&
    (item.state?.video_id ?? "").split(":").length === 3;
  const ep =
    item.state?.season && item.state?.episode
      ? { season: item.state.season, episode: item.state.episode }
      : kitsuThreeSeg
        ? null
        : episodeFromVideoId(item.state?.video_id);
  const animeEp = kitsuThreeSeg
    ? Number((item.state?.video_id ?? "").split(":")[2])
    : isAnimeCwItem(item) && ep
      ? ep.episode
      : null;

  useEffect(
    () => () => {
      if (revealFrameRef.current !== null) {
        cancelAnimationFrame(revealFrameRef.current);
      }
    },
    [],
  );

  const activateGlass = () => {
    if (hasActivatedGlassRef.current) return;

    hasActivatedGlassRef.current = true;
    setHasActivatedGlass(true);

    if (backdropBlurHasWarmed) {
      setShouldRevealGlass(true);
      return;
    }

    backdropBlurHasWarmed = true;
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = requestAnimationFrame(() => {
        revealFrameRef.current = null;
        setShouldRevealGlass(true);
      });
    });
  };

  const glassSurfaceRevealClass = shouldRevealGlass
    ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
    : "opacity-0";
  const glassContentRevealClass = shouldRevealGlass
    ? "scale-95 opacity-0 transition-[opacity,transform] duration-[120ms] group-hover:scale-100 group-hover:opacity-100 focus-within:scale-100 focus-within:opacity-100"
    : "scale-95 opacity-0";
  const sub =
    animeEp && Number.isFinite(animeEp) && animeEp > 0
      ? `Ep ${animeEp}`
      : ep
        ? `S${ep.season}E${ep.episode}`
        : "";
  const [logo, setLogo] = useState<string | undefined>();
  const [metaBg, setMetaBg] = useState<string | undefined>();
  const [hydratedMeta, setHydratedMeta] = useState<Meta | null>(null);
  const [kitsuVideo, setKitsuVideo] = useState<AnimeKitsuVideo | null>(null);
  const [epTitle, setEpTitle] = useState<string | null>(null);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const cardRef = useRef<HTMLButtonElement>(null);

  const candidates = useMemo(() => {
    const thumb = upNext ? undefined : snapshot;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of [thumb, metaBg, item.background, item.poster]) {
      if (!u) continue;
      const d = downscaleTmdb(u)!;
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
  }, [snapshot, metaBg, item.background, item.poster, upNext]);

  const src = candidates[imgIdx];

  useEffect(() => {
    setLogo(undefined);
    setMetaBg(undefined);
    setHydratedMeta(null);
    setKitsuVideo(null);
    setTranslatedTitle(null);
    setImgIdx(0);
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      if (/^(kitsu|mal|anilist|anidb):/.test(item._id)) {
        resolvePreferredAnimeTitle(item._id, settingsRef.current.simklAnimeTitleLanguage)
          .then((tt) => {
            if (!cancelled && tt) setTranslatedTitle(tt);
          })
          .catch(() => {});
        animeKitsuMeta(item._id)
          .then((m) => {
            if (cancelled || !m) return;
            setHydratedMeta({
              id: item._id,
              type: libraryMetaType(item.type),
              name: m.name?.trim() ? m.name : item.name,
              poster: m.poster,
              background: m.background,
              logo: m.logo,
            });
            if (m.logo) setLogo(m.logo);
            else
              resolveLogo(settingsRef.current.tmdbKey, {
                id: item._id,
                type: libraryMetaType(item.type),
                name: m.name || item.name,
              })
                .then((l) => {
                  if (!cancelled && l) setLogo(l);
                })
                .catch(() => {});
            const bg = m.background || (item.background ? undefined : m.poster);
            if (bg) setMetaBg(bg);
            if (kitsuThreeSeg) {
              const vid =
                m.videos.find((v) => v.id === item.state?.video_id) ??
                m.videos.find((v) => v.episode === animeEp);
              if (vid) setKitsuVideo(vid);
            }
          })
          .catch(() => {});
        return;
      }
      if (item._id.startsWith("tmdb:")) {
        tmdbLiteMeta(settingsRef.current.tmdbKey, item._id)
          .then((m) => {
            if (cancelled || !m) return;
            setHydratedMeta({
              id: item._id,
              type: libraryMetaType(item.type),
              name: m.name?.trim() ? m.name : item.name,
              poster: m.poster ?? item.poster,
              background: m.background ?? item.background,
            });
            const bg = m.background || (item.background ? undefined : m.poster);
            if (bg) setMetaBg(bg);
          })
          .catch(() => {});
        return;
      }
      const looksEpisodic = item.type === "movie" && episodeFromVideoId(item.state?.video_id);
      fetchMeta(looksEpisodic ? "series" : narrowMediaType(item.type), item._id)
        .then((full) => {
          if (cancelled || !full) return;
          setHydratedMeta(full);
          const key = settingsRef.current.tmdbKey;
          const cachedLogo = peekCachedLogo(key, full);
          if (cachedLogo) setLogo(cachedLogo);
          else
            void resolveLogo(key, full)
              .then((l) => {
                if (!cancelled && l) setLogo(l);
              })
              .catch(() => {});
          const bg = full.background || (item.background ? undefined : full.poster);
          if (bg) setMetaBg(bg);
        })
        .catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          start();
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
  }, [item._id, item.type, item.state?.video_id]);

  useEffect(() => {
    setEpTitle(null);
    if (!ep || kitsuThreeSeg) return;
    if (/^(kitsu|mal|anilist|anidb):/.test(item._id)) return;
    let cancelled = false;
    const epMeta: Meta = { id: item._id, type: "series", name: item.name };
    fetchSeasonEpisodes(epMeta, ep.season, { tmdbKey: settingsRef.current.tmdbKey })
      .then((eps) => {
        if (cancelled) return;
        const found = eps.find((e) => e.episode === ep.episode);
        if (found?.name) setEpTitle(found.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item._id, ep?.season, ep?.episode, kitsuThreeSeg]);

  const episodeTitle = epTitle ?? kitsuVideo?.title ?? null;

  const meta: Meta = hydratedMeta
    ? { ...hydratedMeta, id: item._id, type: libraryMetaType(item.type) }
    : {
        id: item._id,
        type: libraryMetaType(item.type),
        name: item.name,
        poster: item.poster,
        background: item.background,
      };

  const onClick = () => {
    openMeta(meta, ep ? { episodeHint: ep } : undefined);
  };

  const onPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    let episode: PlayEpisode | undefined = item.type === "series" && ep ? ep : undefined;
    if (!episode && kitsuThreeSeg) {
      if (kitsuVideo) {
        episode = {
          season: kitsuVideo.season || 1,
          episode: kitsuVideo.episode,
          name: kitsuVideo.title,
          still: kitsuVideo.thumbnail,
          overview: kitsuVideo.overview,
          kitsuStreamId: kitsuVideo.id,
          imdbId: kitsuVideo.imdb_id,
          imdbSeason: kitsuVideo.imdbSeason,
          imdbEpisode: kitsuVideo.imdbEpisode,
        };
      } else {
        const epNum = Number((item.state?.video_id ?? "").split(":")[2]);
        if (Number.isFinite(epNum) && epNum > 0) episode = { season: 1, episode: epNum };
      }
    }
    playLocalAware({
      meta,
      episode: episode ?? null,
      mode: settings.localPlaybackMode,
      source: "manual",
      resumeId: meta.id,
      playStream: () => openPicker(meta, episode, { autoPlay: settings.instantPlay, resume: true }),
      playLocal: (entry, o) => {
        const s = localPlayerSrc(entry);
        openPlayer({
          ...s,
          meta: {
            ...s.meta,
            id: meta.id,
            poster: meta.poster ?? s.meta.poster,
            background: meta.background,
          },
          startFromZero: o?.fromStart,
        });
      },
      setMode: (m) => update({ localPlaybackMode: m }),
    });
  };

  return (
    <div
      className="group relative w-full min-w-0"
      onPointerEnter={activateGlass}
      onFocusCapture={activateGlass}
    >
      <button
        ref={cardRef}
        onClick={onClick}
        onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta })}
        className="flex w-full min-w-0 flex-col gap-2.5 text-start"
      >
        <div className="harbor-poster relative aspect-[16/9] overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] will-change-transform [transform:translate3d(0,0,0)] transition-transform duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-raised via-elevated to-surface" />
          {src && (
            <img
              key={src}
              src={src}
              alt=""
              decoding="sync"
              onError={() => setImgIdx((i) => i + 1)}
              className="absolute inset-0 h-full w-full object-cover brightness-95"
            />
          )}
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.45)]" />
          {watched && (
            <span
              className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm"
              title={t("Watched on Trakt")}
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          {newEpisode > 0 && (
            <span className={`absolute top-2 ${watched ? "start-10" : "start-2"}`}>
              <Tooltip
                label={
                  newEpisode === 1
                    ? t("1 new episode since you last watched")
                    : t("{n} new episodes since you last watched", { n: newEpisode })
                }
                side="bottom"
              >
                <span className="flex h-6 items-center rounded-full bg-accent/90 px-2 text-[10px] font-bold tracking-[0.1em] text-canvas">
                  +{newEpisode}
                </span>
              </Tooltip>
            </span>
          )}
          {logo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
              <img
                src={logo}
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-[55%] w-auto max-w-[78%] object-contain opacity-80 transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:opacity-25"
              />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/80 to-transparent" />
          {(sub || remaining || isExternal || upNext || episodeTitle) && (
            <div className="absolute bottom-2 start-2 flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded-md bg-canvas/95 px-2 py-1 text-[11px]">
              {isExternal ? (
                <img
                  src={simklLogo}
                  alt=""
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  title={t("Paused on Simkl")}
                />
              ) : (
                <Play size={11} fill="currentColor" className="shrink-0 text-ink" />
              )}
              {sub && <span className="shrink-0 font-medium text-ink">{sub}</span>}
              {upNext ? (
                <>
                  {sub && <span className="shrink-0 text-ink-subtle">·</span>}
                  <span className="shrink-0 font-medium text-accent">{t("Up Next")}</span>
                </>
              ) : episodeTitle ? (
                <>
                  {sub && <span className="shrink-0 text-ink-subtle">·</span>}
                  <span className="min-w-0 truncate text-ink-muted">{episodeTitle}</span>
                </>
              ) : (
                remaining && (
                  <>
                    {sub && <span className="shrink-0 text-ink-subtle">·</span>}
                    <span className="shrink-0 text-ink-muted">{remaining}</span>
                  </>
                )
              )}
            </div>
          )}
          {showWatcher && watcher && (
            <div
              className="absolute bottom-2.5 end-2 z-[1]"
              title={t("Watched by {name}", { name: watcher.name })}
            >
              <span
                className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-elevated text-[11px] font-bold text-white"
                style={{ boxShadow: `0 0 0 2px ${watcher.color}, 0 2px 8px rgba(0,0,0,0.5)` }}
              >
                {watcher.avatar ? (
                  <img
                    src={watcher.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  (watcher.name.trim()[0]?.toUpperCase() ?? "?")
                )}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-canvas/40">
            <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <p className="truncate text-[13px] font-medium text-ink">
          {translatedTitle || hydratedMeta?.name?.trim() || item.name}
        </p>
      </button>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[16/9] items-center justify-center">
        <ThreeLiquidGlassSurface
          radius="9999px"
          shaderRadius={1}
          intensity={0.86}
          variant="overlay"
          backdropBlur={hasActivatedGlass}
          className="pointer-events-none h-14 w-14 group-hover:pointer-events-auto focus-within:pointer-events-auto"
          surfaceClassName={`border border-white/[0.10] ${glassSurfaceRevealClass}`}
          contentClassName={`h-full w-full ${glassContentRevealClass}`}
          style={{
            background: "transparent",
            boxShadow: "none",
          }}
        >
          <button
            type="button"
            onClick={onPlay}
            aria-label={t("Play")}
            title={t("Play")}
            className="
              flex h-full w-full
              items-center justify-center
              rounded-full bg-transparent
              text-ink outline-none
              transition-transform duration-150
              active:scale-95
            "
          >
            <Play size={22} fill="currentColor" className="ml-0.5 text-ink" />
          </button>
        </ThreeLiquidGlassSurface>
      </div>
      {onDismiss && (
        <div
          className="
            absolute end-0.5 top-0.5 z-10
            flex h-11 w-11
            items-center justify-center
          "
        >
          <ThreeLiquidGlassSurface
            radius="9999px"
            shaderRadius={1}
            intensity={0.74}
            variant="overlay"
            backdropBlur={hasActivatedGlass}
            className="pointer-events-none h-9 w-9 group-hover:pointer-events-auto focus-within:pointer-events-auto"
            surfaceClassName={`border border-white/[0.09] ${glassSurfaceRevealClass}`}
            contentClassName={`h-full w-full ${glassContentRevealClass}`}
            style={{
              background: "transparent",
              boxShadow: "none",
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(item);
              }}
              aria-label={t("Remove from Continue Watching")}
              className="
                flex h-full w-full
                items-center justify-center
                rounded-full bg-transparent
                text-ink-muted outline-none
                transition-colors duration-150
                hover:text-ink
                active:scale-95
              "
            >
              <X size={20} strokeWidth={2.4} />
            </button>
          </ThreeLiquidGlassSurface>
        </div>
      )}
    </div>
  );
});

function downscaleTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w300/");
}

function formatRemaining(
  t: (key: string, vars?: Record<string, string | number>) => string,
  ms: number,
) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return t("{m}m left", { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t("{h}h left", { h }) : t("{h}h {m}m left", { h, m });
}
