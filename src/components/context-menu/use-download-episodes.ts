import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import { readContextWatchedSnapshot } from "@/lib/context-watched-state";
import { getEpisodeProgress, resumeDefaultSeason } from "@/lib/episode-progress";
import { useHiddenEpisodes } from "@/lib/hidden-episodes";
import {
  manualEpisodeKeys,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { tmdbSeasonEpisodes, type Episode, type Season } from "@/lib/providers/tmdb";
import { fetchSeasonEpisodes, fetchSeasonList, isAnimeId } from "@/lib/series-episodes";
import { useSettings } from "@/lib/settings";
import { effectiveOrderProvider } from "@/lib/settings/episode-order";
import { episodeSpoilerMasks } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { useEpisodeEnrich } from "@/views/detail/series-episodes/use-episode-enrich";
import { useEpisodeOrder } from "@/views/detail/series-episodes/use-episode-order";
import { useSeriesTvdbStills } from "@/views/detail/series-episodes/use-series-tvdb-stills";

type Title = {
  meta: Meta;
  tmdbId?: string;
  imdbId: string | null;
  seasons?: Season[];
  pending: boolean;
};
type Watched = Awaited<ReturnType<typeof readContextWatchedSnapshot>>;
const EMPTY_EPISODES: Episode[] = [];
const EMPTY_PLAY: PlayEpisode[] = [];

export function useDownloadEpisodes(
  title: Title,
  requested: PlayEpisode | undefined,
  isCurrent: () => boolean,
) {
  const { settings } = useSettings();
  const guard = useRef(isCurrent);
  guard.current = isCurrent;
  const anime = isAnimeId(title.meta.id);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [season, setSeason] = useState<number>(
    (anime ? requested?.imdbSeason : undefined) ?? requested?.season ?? 1,
  );
  const chosen = useRef(!!requested);
  const [loaded, setLoaded] = useState<{
    season: number;
    raw: Episode[];
    play: PlayEpisode[];
  } | null>(null);
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [watched, setWatched] = useState<Watched | null>(null);
  const manualVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const series = title.meta.type === "series";
  const order = useEpisodeOrder(
    title.imdbId,
    title.meta.id,
    effectiveOrderProvider(settings),
    settings.tvdbSeasonType,
    settings.tvdbKey,
    series && !title.pending && !anime,
  );
  const availableSeasons = order?.seasons ?? seasons;
  const hidden = useHiddenEpisodes(title.meta.id);

  useEffect(() => {
    if (!series || title.pending) return;
    let cancelled = false;
    const valid = () => !cancelled && guard.current();
    setFailed(false);
    const work = title.seasons?.length
      ? Promise.resolve(title.seasons)
      : fetchSeasonList(title.meta, { tmdbKey: settings.tmdbKey }).then((numbers) =>
          numbers.map((n) => ({
            id: n,
            seasonNumber: n,
            name: "",
            overview: "",
            episodeCount: 0,
            airDate: null,
            posterPath: null,
          })),
        );
    void work.then(
      (list) => {
        if (!valid()) return;
        setSeasons(list);
        if (!chosen.current) setSeason(resumeDefaultSeason(title.meta.id, list));
        if (!list.length) setPending(false);
      },
      () => {
        if (valid()) {
          setFailed(true);
          setPending(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [series, title.pending, title.meta, title.seasons, settings.tmdbKey, revision]);

  useEffect(() => {
    if (!series || title.pending || !availableSeasons.length) return;
    let cancelled = false;
    const valid = () => !cancelled && guard.current();
    setPending(true);
    setFailed(false);
    setLoaded(null);
    if (anime) setWatched(null);
    const ordered = order?.bySeason.get(season);
    const tvId = title.tmdbId?.match(/^tmdb:tv:(\d+)$/)?.[1];
    const work = ordered
      ? Promise.resolve({ raw: ordered, play: EMPTY_PLAY })
      : tvId && settings.tmdbKey && !anime
        ? tmdbSeasonEpisodes(settings.tmdbKey, Number(tvId), season).then(async (raw) => ({
            raw,
            play: raw.length
              ? EMPTY_PLAY
              : await fetchSeasonEpisodes(title.meta, season, { tmdbKey: settings.tmdbKey }),
          }))
        : fetchSeasonEpisodes(title.meta, season, { tmdbKey: settings.tmdbKey }).then((play) => ({
            raw: EMPTY_EPISODES,
            play,
          }));
    void work.then(
      (value) => {
        if (valid()) {
          setLoaded({ season, ...value });
          setPending(false);
        }
      },
      () => {
        if (valid()) {
          setFailed(true);
          setPending(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    series,
    title.pending,
    title.meta,
    title.tmdbId,
    availableSeasons,
    order,
    season,
    settings.tmdbKey,
    anime,
    revision,
  ]);

  const raw = loaded?.season === season ? loaded.raw : EMPTY_EPISODES;
  const { episodes: enriched } = useEpisodeEnrich({
    episodes: raw,
    active: season,
    imdbId: title.imdbId,
    tvdbKey: settings.tvdbKey,
    omdbKey: "",
    metaId: title.meta.id,
    preferCustomMeta: settings.preferCustomMetaAddon,
    ratings: false,
  });
  const tvdbStills = useSeriesTvdbStills(title.imdbId, enriched.length, settings.tvdbSeasonType);
  const allEpisodes = useMemo<PlayEpisode[]>(() => {
    if (loaded?.season !== season) return [];
    const values = enriched.length
      ? enriched.map((ep) => {
          const video = title.meta.videos?.find(
            (v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber,
          );
          const still = ep.stillPath
            ? /^https?:/.test(ep.stillPath)
              ? ep.stillPath
              : `https://image.tmdb.org/t/p/${settings.hdEpisodeImages ? "original" : "w300"}${ep.stillPath}`
            : ep.stillUrl ||
              tvdbStills[`s${ep.seasonNumber}e${ep.episodeNumber}`] ||
              tvdbStills[`abs${ep.episodeNumber}`] ||
              video?.thumbnail;
          return {
            season: ep.seasonNumber,
            episode: ep.episodeNumber,
            name: ep.name || undefined,
            overview: ep.overview || undefined,
            airDate: ep.airDate || undefined,
            runtime: ep.runtime ?? undefined,
            videoId: video?.id,
            imdbId: /^tt\d+(?::\d+:\d+)?$/.test(video?.id ?? "") ? video!.id : undefined,
            still,
          };
        })
      : loaded.play;
    return values;
  }, [loaded, season, enriched, title.meta.videos, settings.hdEpisodeImages, tvdbStills]);
  const episodes = useMemo(
    () =>
      settings.episodeHiding
        ? allEpisodes.filter((ep) => !hidden.has(`${ep.season}:${ep.episode}`))
        : allEpisodes,
    [allEpisodes, settings.episodeHiding, hidden],
  );
  // Default Details computes next-up before hiding rows; ordered Details uses its visible order.
  const policyEpisodes = order ? episodes : allEpisodes;
  // Anime provider coordinates come from the loaded source entry, not from the page's title.
  const projection = anime && loaded?.season === season ? loaded.play : undefined;
  const projectionImdb =
    title.imdbId ||
    projection?.find((ep) => /^tt\d+(?::|$)/.test(ep.imdbId ?? ""))?.imdbId?.split(":")[0] ||
    null;
  useEffect(() => {
    if (!series || title.pending || (anime && !projection)) return;
    let cancelled = false;
    setWatched(null);
    void readContextWatchedSnapshot(
      {
        meta: title.meta,
        imdbId: projectionImdb,
        ...(projection ? { episodeProjection: projection } : {}),
      },
      () => !cancelled && guard.current(),
    ).then(
      (snapshot) => {
        if (!cancelled && guard.current()) setWatched(snapshot);
      },
      () => {
        if (!cancelled && guard.current())
          setWatched({ keys: null, providers: [{ provider: "unavailable", watched: null }] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [series, title.pending, title.meta, projectionImdb, projection, anime, revision]);
  const providerKeys = useMemo(
    () => new Set(watched?.providers.flatMap((p) => [...(p.watched ?? [])])),
    [watched],
  );
  const defaultSeasonKeys = useMemo(() => {
    const keys = new Set(providerKeys);
    const manual = manualEpisodeKeys(title.meta.id);
    for (const key of manual.watched) keys.add(key);
    for (const key of manual.unwatched) keys.delete(key);
    return keys;
  }, [providerKeys, title.meta.id, manualVersion]);
  useEffect(() => {
    if (!chosen.current && availableSeasons.length)
      setSeason(resumeDefaultSeason(title.meta.id, availableSeasons, defaultSeasonKeys));
  }, [title.meta.id, availableSeasons, defaultSeasonKeys]);
  const progress = useMemo(
    () =>
      new Map(
        allEpisodes.map((ep) => [
          ep,
          getEpisodeProgress(
            ep.sourceMetaId ?? title.meta.id,
            ep.season,
            ep.episode,
            ep.runtime ?? null,
            ep.imdbId?.split(":")[0] ?? projectionImdb,
            new Set(),
            providerKeys,
            undefined,
            undefined,
            undefined,
            ep.imdbSeason,
            ep.imdbEpisode,
          ),
        ]),
      ),
    [allEpisodes, title.meta.id, projectionImdb, providerKeys, manualVersion],
  );
  const policyPending = !watched || watched.providers.some((p) => p.watched == null);
  const masks = episodeSpoilerMasks(
    settings,
    policyEpisodes,
    (ep) => progress.get(ep)?.watched ?? false,
    policyPending,
  );
  const selectSeason = (number: number) => {
    chosen.current = true;
    setSeason(number);
  };
  return {
    seasons: availableSeasons,
    season,
    selectSeason,
    episodes,
    masks,
    progress,
    pending: series && (title.pending || pending),
    failed,
    retry: () => setRevision((n) => n + 1),
  };
}
