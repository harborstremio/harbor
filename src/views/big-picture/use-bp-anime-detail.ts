import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useAnilistWatched } from "@/lib/anilist/use-anilist-watched";
import type { EpisodeProgress } from "@/lib/episode-progress";
import { useMalWatched } from "@/lib/mal/use-mal-watched";
import { manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import { animeDetails, type AnimeDetailExtras } from "@/lib/providers/anime-detail";
import { parseKitsuId, type KitsuEpisode, type KitsuStreamer } from "@/lib/providers/kitsu";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import type { TvdbOrderType, TvdbSeasonTypeOption } from "@/lib/providers/tvdb";
import { pickTvdbImage } from "@/lib/providers/tvdb-proxy";
import { useSettings } from "@/lib/settings";
import type { SpoilerMask } from "@/lib/spoilers";
import { effectiveOrderProvider, tvdbPanelEnabled } from "@/lib/settings/episode-order";
import type { PlayEpisode } from "@/lib/view";
import { animeSeasonKey } from "@/views/detail/anime-episodes/anime-season-key";
import { useAnimeOrder } from "@/views/detail/anime-episodes/use-anime-order";
import { useAnimePreferredSeason } from "@/views/detail/anime-episodes/use-anime-preferred-season";
import { useAnimeProgressMap } from "@/views/detail/anime-episodes/use-anime-progress-map";
import { useAnimeTvdbPanel } from "@/views/detail/anime-episodes/use-anime-tvdb-panel";
import { useTvdbProxyImages } from "@/views/detail/anime-episodes/use-tvdb-proxy-images";
import type { PickerItem } from "@/views/detail/series-episodes/season-arc-picker";
import { isAnimeId } from "@/views/mobile/mobile-detail/anime-data";

const EMPTY_EPISODES: KitsuEpisode[] = [];
const EMPTY_STREAMERS: KitsuStreamer[] = [];

// Anime progress lives in Simkl and AniList, never Trakt, so the Trakt set the
// desktop hooks expect stays empty on this path.
const NO_TRAKT: Set<string> = new Set();

const NOOP = () => {};

export type BpAnimeDetail = {
  isAnime: boolean;
  owns: boolean;
  loading: boolean;
  detail: TmdbDetail | null;
  // The tracker key, and only ever that. It is resolved from the kitsu id the
  // anime provider chain returned, never bridged from a tt: resolveAnilistMediaId
  // refuses anything but anilist/kitsu/mal, and a guessed mapping writes a user's
  // list status onto the wrong show with no undo. Null means the chain never
  // resolved, in which case the caller must keep meta.id and get no tracker
  // rather than invent one.
  canonicalId: string | null;
  streamers: KitsuStreamer[];
  episodes: KitsuEpisode[];
  showSeason: boolean;
  seasons: PickerItem[];
  seasonKey: string;
  onSeason: (key: string) => void;
  orderTypes: TvdbSeasonTypeOption[];
  orderType: TvdbOrderType;
  onOrderType: (value: TvdbOrderType) => void;
  progressFor: (ep: KitsuEpisode) => EpisodeProgress;
  spoilerFor: (ep: KitsuEpisode) => SpoilerMask;
  allWatched: boolean;
  nextUpId: number | null;
  resume: { ep: PlayEpisode; resumed: boolean } | null;
};

export function bpAnimePlayEpisode(ep: KitsuEpisode): PlayEpisode {
  return {
    season: animeSeasonKey(ep),
    episode: ep.number,
    name: ep.title,
    still: ep.thumbnail ?? ep.thumbnailFallback ?? undefined,
    overview: ep.synopsis || undefined,
    kitsuStreamId: ep.streamId,
    imdbId: ep.imdbId,
    imdbSeason: ep.imdbSeason,
    imdbEpisode: ep.imdbEpisode,
    absoluteNumber: ep.absoluteNumber ?? ep.number,
    tvdbEpisodeId: ep.tvdbEpisodeId,
    sourceMetaId: ep.sourceMetaId,
    airDate: ep.airdate ?? undefined,
    runtime: ep.length ?? undefined,
  };
}

function mergeExtras(base: TmdbDetail, patch: AnimeDetailExtras): TmdbDetail {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as TmdbDetail;
}

type Loaded = {
  key: string;
  detail: TmdbDetail;
  episodes: KitsuEpisode[];
  streamers: KitsuStreamer[];
  kitsuId: number;
  imdbId: string | null;
};

export type BpAnimeDetailOptions = {
  /**
   * Where the user came from, when that carries a season. Only a season of 2 or
   * more counts, and only as a tiebreak: it outranks the progress-derived
   * preferred season, so a stale local guess must never be fed in here.
   */
  episodeHint?: { season: number; episode: number };
};

export function useBpAnimeDetail(meta: Meta | null, opts?: BpAnimeDetailOptions): BpAnimeDetail {
  const { settings, update } = useSettings();
  const hintSeason = opts?.episodeHint?.season ?? 0;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const metaId = meta?.id ?? "";
  const isAnime = metaId !== "" && isAnimeId(metaId);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Which id the provider chain has finished with, not a boolean: a plain
  // loading flag is false on the render that first sees an anime id, and that
  // one frame is enough to mount the wrong episodes section and tear it down.
  const [settled, setSettled] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(null);
    const seed = metaRef.current;
    if (!isAnime || !seed) {
      setSettled(metaId);
      return;
    }
    let alive = true;
    const patch = (fn: (prev: Loaded) => Loaded) =>
      setLoaded((prev) => (prev && prev.key === metaId ? fn(prev) : prev));
    void animeDetails(settingsRef.current, seed)
      .then((res) => {
        if (!alive) return;
        setSettled(metaId);
        if (!res) return;
        setLoaded({
          key: metaId,
          detail: res.detail,
          episodes: res.episodes,
          streamers: res.streamers,
          kitsuId: res.kitsuId,
          imdbId: res.imdbId ?? res.detail.imdbId ?? null,
        });
        void res.extrasPromise
          .then((extras) => {
            if (!alive) return;
            patch((prev) => ({
              ...prev,
              detail: mergeExtras(prev.detail, extras),
              imdbId: extras.imdbId ?? prev.imdbId,
            }));
          })
          .catch(NOOP);
        // enrichEpisodes fills thumbnails and fillers by mutating the array it
        // was handed, so a copy is the only thing that tells React anything moved.
        void res.enrichPromise
          .then((eps) => {
            if (!alive) return;
            patch((prev) => ({ ...prev, episodes: [...eps] }));
          })
          .catch(NOOP);
      })
      .catch(() => {
        if (alive) setSettled(metaId);
      });
    return () => {
      alive = false;
    };
  }, [isAnime, metaId]);

  const loading = isAnime && settled !== metaId;

  const episodes = loaded?.episodes ?? EMPTY_EPISODES;
  const kitsuId = loaded?.kitsuId ?? (isAnime ? parseKitsuId(metaId) : null);
  // animeDetails remaps an ova or side entry onto its main TV series, so the
  // canonical id is the tracker key only. Local resume and manual watched are
  // written under the id the player was handed, which is meta.id, and reading
  // them under the canonical id alone loses every tick the user just earned.
  const canonicalId = loaded ? `kitsu:${loaded.kitsuId}` : metaId;
  const trackId = canonicalId === metaId ? undefined : canonicalId;
  const imdbId = loaded?.imdbId ?? null;
  const mwVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const { watchedKeys: anilistWatched } = useAnilistWatched(isAnime ? canonicalId : "", episodes);
  const { watchedKeys: malWatched } = useMalWatched(isAnime ? canonicalId : "", episodes);

  const preferredSeasonKey = useAnimePreferredSeason({
    episodes,
    metaId,
    trackId,
    traktWatched: NO_TRAKT,
    anilistWatched,
    malWatched,
    mwVersion,
  });

  // A kitsu entry that is itself a later season maps every episode onto one
  // imdbSeason, and landing such a title on season one is the ordering bug
  // people report most. A hint from the caller is the second answer and never
  // the first, matching anime-episodes.tsx:116-137: the shape of the episode
  // list is evidence, an arrival route is only an intent.
  const intentSeasonKey = useMemo(() => {
    const counts = new Map<number, number>();
    for (const ep of episodes) {
      if (ep.sourceMetaId != null) continue;
      const s = ep.imdbSeason;
      if (s == null || s < 1) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    if (counts.size === 1) {
      const only = [...counts.keys()][0];
      if (only >= 2) return String(only);
    }
    return hintSeason >= 2 ? String(hintSeason) : null;
  }, [episodes, hintSeason]);

  const panelOn = isAnime && episodes.length > 0 && tvdbPanelEnabled(settings);
  const tvdb = useAnimeTvdbPanel(
    kitsuId,
    imdbId,
    episodes,
    settings.tvdbSeasonType,
    settings.tvdbKey,
    panelOn,
    undefined,
    preferredSeasonKey ?? undefined,
    intentSeasonKey ?? undefined,
  );
  // buildAnimeOrder discards the fetch outright when there are no episodes to
  // group, so an ungated call bills every tmdb:tv detail open a TVDB round trip
  // whose result can never be used.
  const orderOn = isAnime && episodes.length > 0;
  const order = useAnimeOrder(
    imdbId,
    canonicalId,
    episodes,
    orderOn ? effectiveOrderProvider(settings) : "default",
    settings.tvdbSeasonType,
    settings.tvdbKey,
    preferredSeasonKey ?? undefined,
    intentSeasonKey ?? undefined,
  );

  const visible = tvdb.panel ? tvdb.panel.visibleEpisodes : (order?.visibleEpisodes ?? episodes);
  const proxyImages = useTvdbProxyImages(kitsuId, imdbId, episodes.length, settings.tvdbSeasonType);
  const shown = useMemo(() => {
    if (Object.keys(proxyImages).length === 0) return visible;
    return visible.map((ep) => {
      const img = pickTvdbImage(proxyImages, ep);
      return img ? { ...ep, thumbnail: img } : ep;
    });
  }, [visible, proxyImages]);

  const progress = useAnimeProgressMap({
    episodes,
    displayEpisodes: shown,
    metaId,
    trackId,
    traktWatched: NO_TRAKT,
    anilistWatched,
    malWatched,
    mwVersion,
    settings,
  });

  const onOrderType = useCallback(
    (value: TvdbOrderType) => update({ tvdbSeasonType: value }),
    [update],
  );

  const showSeason = useMemo(
    () => new Set(shown.map((e) => e.imdbSeason ?? e.seasonNumber ?? 1)).size > 1,
    [shown],
  );

  let resume: BpAnimeDetail["resume"] = null;
  if (shown.length > 0) {
    const target = shown.find((e) => e.id === progress.nextUpId) ?? shown[0];
    resume = {
      ep: bpAnimePlayEpisode(target),
      resumed:
        progress.progressFor(target).ratio > 0.01 ||
        shown.some((e) => progress.progressFor(e).watched),
    };
  }

  return {
    isAnime,
    owns: isAnime && (loading || shown.length > 0),
    loading,
    detail: loaded?.detail ?? null,
    canonicalId: loaded ? canonicalId : null,
    streamers: loaded?.streamers ?? EMPTY_STREAMERS,
    episodes: shown,
    showSeason,
    seasons: tvdb.panel?.items ?? order?.items ?? [],
    seasonKey: tvdb.panel?.activeKey ?? order?.activeKey ?? "",
    onSeason: tvdb.panel?.onSelect ?? order?.onSelect ?? NOOP,
    orderTypes: tvdb.panel?.orderTypes ?? [],
    orderType: tvdb.panel?.activeType ?? "aired",
    onOrderType,
    progressFor: progress.progressFor,
    spoilerFor: progress.spoilerFor,
    allWatched: progress.allWatched,
    nextUpId: progress.nextUpId,
    resume,
  };
}
