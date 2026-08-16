import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, X } from "lucide-react";
import simklLogo from "@/assets/simkl.png";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { animeKitsuMeta, type AnimeKitsuVideo } from "@/lib/providers/anime-kitsu-addon";
import { tmdbLiteMeta } from "@/lib/providers/tmdb/tmdb-lite";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb";
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
import { aniZipByAnidb, aniZipByAnilist, aniZipByKitsu, aniZipByMal } from "@/lib/providers/anizip";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { resolvePreferredAnimeTitle } from "@/lib/anime-title";
import { stripFranchiseSuffix } from "@/lib/providers/jikan";
import { getAnimeCwId } from "@/lib/anime-cw-ids";
import {
  aniZipLookupKey,
  applyAniZipEpisode,
  effectiveAnimeLookupId,
  needsAniZipEpisodeLookup,
} from "@/lib/cw-anime-episode";
import { isGenericEpisodeTitle, pickPreferredEpisodeTitle } from "@/lib/episode-title";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

async function fetchAniZipMapping(metaId: string) {
  const key = aniZipLookupKey(metaId);
  if (!key) return null;
  const lookup =
    key.scheme === "mal"
      ? aniZipByMal
      : key.scheme === "anilist"
        ? aniZipByAnilist
        : key.scheme === "anidb"
          ? aniZipByAnidb
          : aniZipByKitsu;
  return lookup(key.id).catch(() => null);
}

type Props = {
  item: LibraryItem;
  watched?: boolean;
  onDismiss?: (item: LibraryItem) => void;
  /**
   * Overrides the default play behaviour. The local library row passes this
   * because it already knows the file on disk, whereas the default path
   * re-resolves through playLocalAware and cannot handle a `local:` id.
   */
  onPlayOverride?: (episode: PlayEpisode | undefined) => void;
};

export const ContinueCard = memo(function ContinueCard({
  item,
  watched = false,
  onDismiss,
  onPlayOverride,
}: Props) {
  const { openMeta, openPicker, openPlayer } = useView();
  const t = useT();
  const { settings, update } = useSettings();
  const { profiles, activeProfile } = useProfiles();
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
  const waitingForAir = (item as Record<string, unknown>).waitingForAir === true;
  const nextAirDate = waitingForAir
    ? ((item as Record<string, unknown>).nextAirDate as string | undefined)
    : undefined;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!waitingForAir || !nextAirDate) return;
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, [waitingForAir, nextAirDate]);
  const countdown = useMemo(() => {
    if (!nextAirDate) return "";
    const diff = Date.parse(nextAirDate) - now;
    if (diff <= 0) return t("Airing now");
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (days > 0)
      return t("Next in {days}d {hours}h", { days: String(days), hours: String(hours) });
    if (hours > 0)
      return t("Next in {hours}h {minutes}m", { hours: String(hours), minutes: String(minutes) });
    return t("Next in {minutes}m", { minutes: String(Math.max(1, minutes)) });
  }, [nextAirDate, now, t]);
  const kitsuThreeSeg =
    /^(kitsu|mal|anilist|anidb):/.test(item._id) &&
    (item.state?.video_id ?? "").split(":").length === 3;
  const ep =
    item.state?.season && item.state?.episode
      ? { season: item.state.season, episode: item.state.episode }
      : kitsuThreeSeg
        ? null
        : episodeFromVideoId(item.state?.video_id);
  const animeLookupId = effectiveAnimeLookupId(item._id, getAnimeCwId(item._id));
  const animeEp = kitsuThreeSeg
    ? Number((item.state?.video_id ?? "").split(":")[2])
    : animeLookupId && ep
      ? ep.episode
      : null;
  const [logo, setLogo] = useState<string | undefined>();
  const [metaBg, setMetaBg] = useState<string | undefined>();
  const [hydratedMeta, setHydratedMeta] = useState<Meta | null>(null);
  const [kitsuVideo, setKitsuVideo] = useState<AnimeKitsuVideo | null>(null);
  const [epTitle, setEpTitle] = useState<string | null>(null);
  const [aniZipTitle, setAniZipTitle] = useState<string | null>(null);
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
    setAniZipTitle(null);
    setTranslatedTitle(null);
    setImgIdx(0);
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      if (animeLookupId) {
        let aniZipStarted = false;
        const loadAniZipTitle = () => {
          if (
            aniZipStarted ||
            animeEp == null ||
            !Number.isFinite(animeEp) ||
            animeEp <= 0
          )
            return;
          aniZipStarted = true;
          void fetchAniZipMapping(animeLookupId).then((mapping) => {
            if (cancelled) return;
            const resolved = applyAniZipEpisode(
              { season: ep?.season ?? 1, episode: animeEp },
              mapping,
            );
            setAniZipTitle(resolved.name ?? null);
          });
        };
        resolvePreferredAnimeTitle(animeLookupId, settingsRef.current.simklAnimeTitleLanguage)
          .then((tt) => {
            if (!cancelled && tt) setTranslatedTitle(tt);
          })
          .catch(() => {});
        animeKitsuMeta(animeLookupId)
          .then((m) => {
            if (cancelled) return;
            if (!m) {
              loadAniZipTitle();
              return;
            }
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
            if (animeEp != null && Number.isFinite(animeEp)) {
              const vid =
                m.videos.find((v) => v.id === item.state?.video_id) ??
                m.videos.find((v) => v.episode === animeEp);
              if (vid) setKitsuVideo(vid);
              if (!vid || isGenericEpisodeTitle(vid.title, animeEp)) loadAniZipTitle();
            }
          })
          .catch(() => loadAniZipTitle());
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
          if (!full.background && key && item._id.startsWith("tt")) {
            void resolveTmdbBackdrop(key, item._id, full.type)
              .then((b) => {
                if (!cancelled && b) setMetaBg(b);
              })
              .catch(() => {});
          }
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
  }, [item._id, item.type, item.state?.video_id, animeLookupId]);

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

  const episodeTitle =
    animeEp != null && Number.isFinite(animeEp) && animeEp > 0
      ? pickPreferredEpisodeTitle(animeEp, epTitle, kitsuVideo?.title, aniZipTitle)
      : epTitle;

  const animeSeasonMapped =
    kitsuVideo &&
    kitsuVideo.imdbSeason != null &&
    kitsuVideo.imdbSeason >= 2 &&
    kitsuVideo.imdbEpisode != null
      ? { season: kitsuVideo.imdbSeason, episode: kitsuVideo.imdbEpisode }
      : null;
  const sub = animeSeasonMapped
    ? `S${animeSeasonMapped.season} · E${String(animeSeasonMapped.episode).padStart(2, "0")}`
    : ep
      ? `S${ep.season}E${ep.episode}`
      : animeEp && Number.isFinite(animeEp) && animeEp > 0
        ? `Ep ${animeEp}`
        : "";

  const meta: Meta = hydratedMeta
    ? { ...hydratedMeta, id: item._id, type: libraryMetaType(item.type) }
    : {
        id: item._id,
        type: libraryMetaType(item.type),
        name: item.name,
        poster: item.poster,
        background: item.background,
      };

  const rawTitle = translatedTitle || hydratedMeta?.name?.trim() || item.name;
  const displayTitle = isAnimeCwItem(item) ? stripFranchiseSuffix(rawTitle) || rawTitle : rawTitle;

  const onOpenDetails = () => {
    const isAnime = /^(kitsu|mal|anilist|anidb):/.test(meta.id);
    openMeta(meta, ep || isAnime ? { episodeHint: ep ?? undefined, exact: isAnime } : undefined);
  };

  const resolveEpisode = async (): Promise<PlayEpisode | undefined> => {
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
    if (animeLookupId && needsAniZipEpisodeLookup(animeLookupId, episode) && episode) {
      episode = applyAniZipEpisode(episode, await fetchAniZipMapping(animeLookupId));
    }
    if (episode && !episode.sourceMetaId && item._id.startsWith("tt") && animeLookupId) {
      episode = { ...episode, sourceMetaId: animeLookupId };
    }
    return episode;
  };

  const onChooseSource = async () => {
    const episode = await resolveEpisode();
    if (onPlayOverride) {
      onPlayOverride(episode);
      return;
    }
    openPicker(meta, episode, { autoPlay: false, resume: false });
  };

  const onPlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const episode = await resolveEpisode();
    if (onPlayOverride) {
      onPlayOverride(episode);
      return;
    }
    playLocalAware({
      meta,
      episode: episode ?? null,
      mode: settings.localPlaybackMode,
      source: "manual",
      resumeId: meta.id,
      playStream: () => openPicker(meta, episode, { autoPlay: true, resume: true }),
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
    <div className="group relative w-full min-w-0">
      <button
        ref={cardRef}
        type="button"
        onClick={() => void onChooseSource()}
        onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta })}
        aria-label={`${t("Choose another source")}: ${displayTitle}`}
        title={t("Choose another source")}
        className="block w-full min-w-0 rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="harbor-poster relative aspect-[16/9] overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] will-change-transform [transform:translate3d(0,0,0)] transition-transform duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02]">
          <div className="absolute inset-0 bg-gradient-to-br from-raised via-elevated to-surface" />
          {src && (
            <img
              key={src}
              src={src}
              alt=""
              decoding="async"
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
              {waitingForAir && countdown ? (
                <span className="shrink-0 font-medium text-amber">{countdown}</span>
              ) : upNext ? (
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
      </button>
      {settings.liquidGlass ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[16/9] items-center justify-center">
          <ThreeLiquidGlassSurface
            radius="9999px"
            shaderRadius={0.58}
            intensity={0.9}
            experimentalStyle={{
              background:
                "linear-gradient(145deg, rgba(8,12,18,0.50), rgba(8,12,18,0.38) 52%, rgba(8,12,18,0.44))",
            }}
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)" }}
            className="pointer-events-none h-14 w-14 scale-95 rounded-full border border-white/[0.10] opacity-0 transition-[opacity,transform] duration-[120ms] group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 focus-within:pointer-events-auto focus-within:scale-100 focus-within:opacity-100"
            contentClassName="flex h-full w-full"
          >
            <button
              type="button"
              onClick={onPlay}
              aria-label={t("Play {name}", { name: displayTitle })}
              title={t("Play")}
              className="flex h-full w-full items-center justify-center rounded-full bg-transparent text-ink outline-none transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Play size={22} fill="currentColor" className="ml-0.5 text-ink" />
            </button>
          </ThreeLiquidGlassSurface>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[16/9] items-center justify-center opacity-0 transition-opacity duration-[220ms] group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={onPlay}
            aria-label={t("Play {name}", { name: displayTitle })}
            title={t("Play")}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-canvas ring-1 ring-white/15 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)] transition-transform duration-150 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Play size={22} fill="currentColor" className="ml-0.5 text-ink" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={`${t("Open details")}: ${displayTitle}`}
        className="mt-2.5 block w-full truncate rounded-sm text-start text-[13px] font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {displayTitle}
      </button>
      {onDismiss && (
        settings.liquidGlass ? (
          <div className="absolute end-0.5 top-0.5 z-10 flex h-11 w-11 items-center justify-center">
            <ThreeLiquidGlassSurface
              radius="9999px"
              shaderRadius={0.58}
              intensity={0.9}
              experimentalStyle={{
                background:
                  "linear-gradient(145deg, rgba(8,12,18,0.50), rgba(8,12,18,0.38) 52%, rgba(8,12,18,0.44))",
              }}
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)" }}
              className="pointer-events-none h-9 w-9 scale-95 rounded-full border border-white/[0.09] opacity-0 transition-[opacity,transform] duration-[120ms] group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 focus-within:pointer-events-auto focus-within:scale-100 focus-within:opacity-100"
              contentClassName="flex h-full w-full"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(item);
                }}
                aria-label={t("Remove from Continue Watching")}
                className="flex h-full w-full items-center justify-center rounded-full bg-transparent text-ink-muted outline-none transition-colors duration-150 hover:text-ink active:scale-95"
              >
                <X size={20} strokeWidth={2.4} />
              </button>
            </ThreeLiquidGlassSurface>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(item);
            }}
            aria-label={t("Remove from Continue Watching")}
            className="group/x absolute end-0.5 top-0.5 z-10 flex h-11 w-11 items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas/85 text-ink-muted ring-1 ring-white/12 backdrop-blur-sm transition-colors group-hover/x:bg-canvas group-hover/x:text-ink">
              <X size={20} strokeWidth={2.4} />
            </span>
          </button>
        )
      )}
    </div>
  );
});

function downscaleTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url
    .replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w300/")
    .replace(/(images\.metahub\.space\/background\/)(medium|large)\//i, "$1small/");
}

async function resolveTmdbBackdrop(
  key: string,
  imdbId: string,
  type: string,
): Promise<string | undefined> {
  const tmdbId = await tmdbIdFromImdb(key, imdbId, narrowMediaType(type)).catch(() => null);
  if (!tmdbId) return undefined;
  const kind = type === "movie" ? "movie" : "tv";
  const lite = await tmdbLiteMeta(key, `tmdb:${kind}:${tmdbId}`).catch(() => null);
  return lite?.background ?? undefined;
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
