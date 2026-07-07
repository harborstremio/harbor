import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EpisodeJumper } from "@/components/episode-jumper";
import { EpisodeWatchedMenu, type WatchedMenuTarget } from "@/components/episode-watched-menu";
import {
  manualWatchedVersion,
  recordManualWatchedMeta,
  setManualWatchedMany,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import type { Meta } from "@/lib/cinemeta";
import { getEpisodeProgress, resumeDefaultSeason } from "@/lib/episode-progress";
import { getLastSeason, setLastSeason } from "@/lib/last-season";
import { tmdbSeasonEpisodes, type Episode, type Season } from "@/lib/providers/tmdb";
import { tvdbEpisodes, tvdbSeriesByImdb, type TvdbEpisode } from "@/lib/providers/tvdb";
import { omdbSeasonRatings } from "@/lib/providers/omdb";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import { useSettings } from "@/lib/settings";
import { spoilerMaskFor } from "@/lib/spoilers";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { loadSimklWatchedMap, simklWatchedForId } from "@/lib/simkl/list-status";
import { markEpisodesWatched, unmarkEpisodeWatched } from "@/lib/simkl/history";
import { stremioIdToSimklTarget } from "@/lib/simkl/ids";
import { useSimkl } from "@/lib/simkl/provider";
import { useT } from "@/lib/i18n";
import { CinemetaEpisodeRow } from "./cinemeta-episodes";
import { EpisodeGridControls } from "./episode-grid-controls";
import { EpisodeLayoutToggle } from "./episode-layout-toggle";
import { EpisodeRow } from "./series-episode-row";
import { EpisodeGridSkeleton } from "./episode-grid-skeleton";
import { EpisodeStrip } from "./episode-strip";
import { RandomEpisodeButton } from "./random-episode-button";
import { SeasonPicker } from "./series-episodes/season-picker";

export function SeriesEpisodes({
  meta,
  tvId,
  imdbId,
  seasons,
  lastEpisodeAir,
  scrollRef,
  cinemetaVideos,
  stremioWatched,
  resumeSeason,
  onSeasonChange,
}: {
  meta: Meta;
  tvId: number;
  imdbId: string | null;
  seasons: Season[];
  lastEpisodeAir?: { seasonNumber: number; airDate: string | null };
  scrollRef: React.RefObject<HTMLElement | null>;
  cinemetaVideos?: NonNullable<Meta["videos"]>;
  stremioWatched?: Set<string>;
  resumeSeason?: number;
  onSeasonChange?: (season: number) => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const mwVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const [watchedMenu, setWatchedMenu] = useState<WatchedMenuTarget | null>(null);
  const openWatchedMenu = (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
  ) => {
    e.preventDefault();
    setWatchedMenu({ x: e.clientX, y: e.clientY, season, episode, watched });
  };
  const userPickedRef = useRef(false);
  const autoSeasonRef = useRef(false);
  const [active, setActive] = useState<number>(() => {
    const saved = getLastSeason(meta.id);
    if (saved != null && seasons.some((s) => s.seasonNumber === saved)) return saved;
    if (resumeSeason != null && seasons.some((s) => s.seasonNumber === resumeSeason)) return resumeSeason;
    return resumeDefaultSeason(meta.id, seasons, stremioWatched);
  });
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [tvdbBySeason, setTvdbBySeason] = useState<Map<number, Map<number, TvdbEpisode>>>(new Map());
  const [omdbBySeason, setOmdbBySeason] = useState<Map<number, Map<number, number>>>(new Map());
  const [harborImdb, setHarborImdb] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [traktWatched, setTraktWatched] = useState<Set<string>>(() => new Set());
  const [simklWatched, setSimklWatched] = useState<Set<string>>(() => new Set());
  const cache = useRef<Map<number, Episode[]>>(new Map());

  useEffect(() => {
    if (!traktConnected) {
      setTraktWatched(new Set());
      return;
    }
    let cancelled = false;
    fetchWatchedKeySet()
      .then((set) => {
        if (!cancelled) setTraktWatched(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [traktConnected]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklWatched(new Set());
      return;
    }
    let cancelled = false;
    loadSimklWatchedMap()
      .then((map) => {
        if (!cancelled) setSimklWatched(simklWatchedForId(map, imdbId, meta.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected, imdbId, meta.id]);

  const traktKey = imdbId ?? meta.id;

  useEffect(() => {
    userPickedRef.current = false;
    autoSeasonRef.current = false;
  }, [meta.id]);

  useEffect(() => {
    if (userPickedRef.current) return;
    const saved = getLastSeason(meta.id);
    if (saved != null && seasons.some((s) => s.seasonNumber === saved)) {
      autoSeasonRef.current = true;
      setActive(saved);
      onSeasonChange?.(saved);
    }
  }, [meta.id, seasons]);

  useEffect(() => {
    if (userPickedRef.current) return;
    if (resumeSeason == null || !seasons.some((s) => s.seasonNumber === resumeSeason)) return;
    const saved = getLastSeason(meta.id);
    if (saved != null && seasons.some((s) => s.seasonNumber === saved)) return;
    autoSeasonRef.current = true;
    setActive(resumeSeason);
    onSeasonChange?.(resumeSeason);
  }, [resumeSeason, seasons, meta.id]);

  useEffect(() => {
    if (userPickedRef.current || autoSeasonRef.current) return;
    if (!stremioWatched || stremioWatched.size === 0) return;
    autoSeasonRef.current = true;
    const defaultSeason = resumeDefaultSeason(meta.id, seasons, stremioWatched);
    setActive(defaultSeason);
    onSeasonChange?.(defaultSeason);
  }, [stremioWatched, seasons, meta.id]);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.current.get(active);
    if (cached) {
      setEpisodes(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    tmdbSeasonEpisodes(settings.tmdbKey, tvId, active).then((eps) => {
      if (cancelled) return;
      if (eps.length > 0) {
        const m = cache.current;
        m.delete(active);
        m.set(active, eps);
        while (m.size > 2) {
          const oldest = m.keys().next().value;
          if (oldest === undefined) break;
          m.delete(oldest);
        }
      }
      setEpisodes(eps);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tvId, active, settings.tmdbKey]);

  useEffect(() => {
    if (!settings.tvdbKey || !imdbId) return;
    if (tvdbBySeason.has(active)) return;
    let cancelled = false;
    (async () => {
      const seriesId = await tvdbSeriesByImdb(settings.tvdbKey, imdbId);
      if (!seriesId || cancelled) return;
      const eps = await tvdbEpisodes(settings.tvdbKey, seriesId, active);
      if (cancelled) return;
      const map = new Map<number, TvdbEpisode>();
      for (const e of eps) map.set(e.number, e);
      setTvdbBySeason((prev) => {
        const next = new Map(prev);
        next.set(active, map);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [imdbId, active, settings.tvdbKey, tvdbBySeason]);

  useEffect(() => {
    if (!settings.omdbKey || !imdbId) return;
    if (omdbBySeason.has(active)) return;
    let cancelled = false;
    (async () => {
      const map = await omdbSeasonRatings(settings.omdbKey, imdbId, active);
      if (cancelled || map.size === 0) return;
      setOmdbBySeason((prev) => {
        const next = new Map(prev);
        next.set(active, map);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [imdbId, active, settings.omdbKey, omdbBySeason]);

  useEffect(() => {
    if (!imdbId) return;
    let cancelled = false;
    void harborImdbEpisodes(imdbId).then((map) => {
      if (!cancelled && map.size > 0) setHarborImdb(map);
    });
    return () => {
      cancelled = true;
    };
  }, [imdbId]);

  const tvdbForSeason = tvdbBySeason.get(active);
  const omdbForSeason = omdbBySeason.get(active);
  const enrichedEpisodes = useMemo<Episode[]>(() => {
    if (!tvdbForSeason && !omdbForSeason && harborImdb.size === 0) return episodes;
    return episodes.map((ep): Episode => {
      let next: Episode = ep;
      const tv = tvdbForSeason?.get(ep.episodeNumber);
      if (tv) {
        const overview =
          tv.overview && tv.overview.trim().length > (next.overview?.trim().length ?? 0)
            ? tv.overview
            : next.overview;
        next = {
          ...next,
          overview,
          runtime: next.runtime ?? tv.runtime ?? null,
          name: next.name || tv.name || next.name,
          airDate: next.airDate ?? tv.aired ?? null,
        };
      }
      const imdbRating =
        harborImdb.get(`${active}:${ep.episodeNumber}`) ?? omdbForSeason?.get(ep.episodeNumber);
      if (imdbRating != null && imdbRating > 0) {
        next = { ...next, imdbRating };
      }
      return next;
    });
  }, [episodes, tvdbForSeason, omdbForSeason, harborImdb, active]);

  const activeSeason = seasons.find((s) => s.seasonNumber === active);

  const progressByEp = useMemo(() => {
    const m = new Map<number, { ratio: number; watched: boolean; startedAt: number }>();
    for (const ep of enrichedEpisodes) {
      m.set(
        ep.episodeNumber,
        getEpisodeProgress(
          meta.id,
          ep.seasonNumber,
          ep.episodeNumber,
          ep.runtime,
          traktKey,
          traktWatched,
          stremioWatched,
          undefined,
          simklWatched,
        ),
      );
    }
    return m;
  }, [enrichedEpisodes, meta.id, traktKey, traktWatched, stremioWatched, simklWatched, mwVersion]);
  const nextUpEp = useMemo(() => {
    for (const ep of enrichedEpisodes) {
      if (!progressByEp.get(ep.episodeNumber)?.watched) return ep.episodeNumber;
    }
    return null;
  }, [enrichedEpisodes, progressByEp]);
  const spoilerFor = (epNumber: number) =>
    spoilerMaskFor(settings, {
      watched: progressByEp.get(epNumber)?.watched ?? false,
      isNextUp: epNumber === nextUpEp,
    });
  const allWatched =
    enrichedEpisodes.length > 0 &&
    enrichedEpisodes.every((ep) => progressByEp.get(ep.episodeNumber)?.watched);
  const markSeason = (watched: boolean) => {
    if (enrichedEpisodes.length === 0) return;
    if (watched)
      recordManualWatchedMeta(meta.id, {
        type: "series",
        name: meta.name,
        poster: meta.poster,
        background: meta.background,
      });
    setManualWatchedMany(
      meta.id,
      enrichedEpisodes.map((ep) => ({ season: ep.seasonNumber, episode: ep.episodeNumber })),
      watched,
    );
    if (!simklConnected) return;
    const r = stremioIdToSimklTarget(meta.id, { season: active, episode: 1 });
    const showIds = r.ok && r.target.kind === "episode" ? r.target.show.ids : null;
    if (!showIds) return;
    if (watched) {
      void markEpisodesWatched(showIds, active, enrichedEpisodes.map((e) => e.episodeNumber));
    } else {
      for (const e of enrichedEpisodes) void unmarkEpisodeWatched(showIds, active, e.episodeNumber);
    }
  };

  return (
    <div data-episodes className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <h3 className="text-[22px] font-medium tracking-tight text-ink">{t("Episodes")}</h3>
        <div className="flex items-center gap-2.5">
          <RandomEpisodeButton meta={meta} seasons={seasons} />
          <EpisodeLayoutToggle
            value={settings.episodeLayout}
            onChange={(v) => update({ episodeLayout: v })}
          />
          {settings.episodeLayout === "grid" && (
            <EpisodeGridControls
              sort={settings.episodeSort}
              onSort={(s) => update({ episodeSort: s })}
              allWatched={allWatched}
              onMarkSeason={markSeason}
            />
          )}
          {seasons.length > 1 && (
            <SeasonPicker
              seasons={seasons}
              active={active}
              onChange={(n) => {
                userPickedRef.current = true;
                setLastSeason(meta.id, n);
                setActive(n);
                onSeasonChange?.(n);
              }}
              lastEpisodeAir={lastEpisodeAir}
            />
          )}
        </div>
      </div>

      {activeSeason && (activeSeason.airDate || activeSeason.episodeCount > 0) && (
        <p className="text-[13px] text-ink-subtle">
          {activeSeason.episodeCount === 1
            ? t("{n} episode", { n: activeSeason.episodeCount })
            : t("{n} episodes", { n: activeSeason.episodeCount })}
          {activeSeason.airDate && ` · ${activeSeason.airDate.slice(0, 4)}`}
        </p>
      )}

      {loading && <EpisodeGridSkeleton />}

      {!loading && enrichedEpisodes.length === 0 && (
        <CinemetaFallback meta={meta} videos={cinemetaVideos} season={active} />
      )}

      {!loading && enrichedEpisodes.length > 0 && (
        <div key={settings.episodeLayout} className="animate-fade-in">
          {settings.episodeLayout !== "list" ? (
            <EpisodeStrip
              layout={settings.episodeLayout === "grid" ? "grid" : "strip"}
              meta={meta}
              episodes={enrichedEpisodes}
              progressFor={(ep) =>
                getEpisodeProgress(
                  meta.id,
                  ep.seasonNumber,
                  ep.episodeNumber,
                  ep.runtime,
                  traktKey,
                  traktWatched,
                  stremioWatched,
                  undefined,
                  simklWatched,
                )
              }
              thumbnailFor={(ep) =>
                cinemetaVideos?.find(
                  (v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber,
                )?.thumbnail
              }
              spoilerFor={(ep) => spoilerFor(ep.episodeNumber)}
              onContextMenu={openWatchedMenu}
            />
          ) : (
            <div className="flex flex-col gap-1">
              {enrichedEpisodes.map((ep) => (
                <EpisodeRow
                  key={ep.id}
                  meta={meta}
                  ep={ep}
                  cinemetaThumbnail={
                    cinemetaVideos?.find(
                      (v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber,
                    )?.thumbnail
                  }
                  progress={progressByEp.get(ep.episodeNumber)!}
                  spoiler={spoilerFor(ep.episodeNumber)}
                  onContextMenu={openWatchedMenu}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {settings.episodeLayout === "list" && (
        <EpisodeJumper scrollRef={scrollRef} totalEpisodes={enrichedEpisodes.length} />
      )}
      {watchedMenu && (
        <EpisodeWatchedMenu
          metaId={meta.id}
          meta={{ type: "series", name: meta.name, poster: meta.poster, background: meta.background }}
          target={watchedMenu}
          onClose={() => setWatchedMenu(null)}
        />
      )}
    </div>
  );
}

function CinemetaFallback({
  meta,
  videos,
  season,
}: {
  meta: Meta;
  videos: NonNullable<Meta["videos"]> | undefined;
  season: number;
}) {
  const t = useT();
  const eps = useMemo(() => {
    if (!videos) return [];
    return videos
      .filter((v) => v.season === season && v.episode != null)
      .slice()
      .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
  }, [videos, season]);
  if (eps.length === 0) {
    return <p className="text-[14px] text-ink-subtle">{t("No episodes available for this season.")}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {eps.map((ep) => (
        <CinemetaEpisodeRow key={ep.id ?? `${ep.season}-${ep.episode}`} meta={meta} ep={ep} />
      ))}
    </div>
  );
}
