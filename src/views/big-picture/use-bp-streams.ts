import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveAddonLogo } from "@/components/addon-logo";
import type { Addon } from "@/lib/addons";
import type { AddonProgress } from "@/lib/streams/addons";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { useDebridClients } from "@/lib/debrid/registry";
import type { DebridStore } from "@/lib/debrid/types";
import type { LocalEntry } from "@/lib/local-library";
import { findLocalEpisodeVersions, findLocalMovieVersions } from "@/lib/local-library/versions";
import { mediaServerConnections } from "@/lib/media-server/connections";
import { mediaServerItems } from "@/lib/media-server/index-store";
import { matchingServerItems, serverPlayableCopies } from "@/lib/media-server/selectors";
import type {
  MediaServerConnection,
  MediaServerItem,
  PlayableCopy,
} from "@/lib/media-server/types";
import {
  readPlayback,
  streamMatchesEntry,
  streamMatchesSource,
  type PlaybackEntry,
} from "@/lib/playback-history";
import { readSeasonLock } from "@/lib/season-lock";
import { useSettings } from "@/lib/settings";
import type { PipelineResult } from "@/lib/streams/pipeline";
import type { ScoredStream } from "@/lib/streams/types";
import { useTogether } from "@/lib/together/provider";
import { hostSourceMatchesMedia } from "@/lib/together/room-derive";
import { buildMatchScores, matchBadge } from "@/lib/together/source-match";
import type { PlayEpisode } from "@/lib/view";
import { streamIsCached } from "@/views/play-picker/picker-utils";
import { useAddons } from "@/views/play-picker/use-addons";
import { useAnimeAltTitles } from "@/views/play-picker/use-anime-alt-titles";
import { useImdbId } from "@/views/play-picker/use-imdb-id";
import { usePipelineResult } from "@/views/play-picker/use-pipeline-result";
import { useStreamIds } from "@/views/play-picker/use-stream-ids";
import { useBpStreamFilters, type BpStreamFilters } from "./bp-stream-filters";

const ANIME_ID_RE = /^(kitsu|mal|anilist|anidb):/;

export type BpCachedOn = { name: string; owned: boolean };

export type BpStreams = BpStreamFilters & {
  loading: boolean;
  done: boolean;
  error: string | null;
  refresh: () => void;
  result: PipelineResult | null;
  addons: Addon[] | null;
  pendingAddonCount: number;
  firstResultAt: number | null;
  autoSettleReady: boolean;
  addonQuorum: AddonProgress;
  pipelineStartedAt: number | null;
  setAutoSettleReady: (v: boolean) => void;
  previousPlayback: PlaybackEntry | null;
  sourceEntry: PlaybackEntry | null;
  animeTitles: string[] | null;
  isAnimeRequest: boolean;
  filterDisabled: boolean;
  isCached: (s: ScoredStream) => boolean;
  cachedOn: (s: ScoredStream) => BpCachedOn | null;
  addonLogo: (s: ScoredStream) => string | null;
  addonLogoFor: (key: string) => string | null;
  hostMatchFor: (s: ScoredStream) => "same" | "close" | null;
  debrids: DebridStore[];
  imdbId: string | null;
  imdbIdVerified: boolean;
  isAnime: boolean;
  localFiles: LocalEntry[];
  homeServerCopies: PlayableCopy[];
  homeServerConnections: MediaServerConnection[];
  homeServerItems: MediaServerItem[];
  homeServersLoaded: boolean;
  noSources: boolean;
  rememberedStream: ScoredStream | null;
  strictMode: boolean;
  forceShowAll: boolean;
  canLoosen: boolean;
  searchWider: () => void;
  showEverything: () => void;
};

export function useBpStreams(params: { meta: Meta; episode?: PlayEpisode }): BpStreams {
  const { meta, episode } = params;
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const debrids = useDebridClients();
  const { addons } = useAddons(authKey, settings);
  const resolvedImdb = useImdbId(meta, settings.tmdbKey);
  const streamIds = useStreamIds(meta, episode, resolvedImdb.id);
  const animeTitles = useAnimeAltTitles(meta);
  const { hostSource, snapshot: roomSnapshot, clientId } = useTogether();
  const [strictMode, setStrictMode] = useState(settings.streamFilterLevel === "strict");
  const [forceShowAll, setForceShowAll] = useState(false);
  const filterDisabled = settings.streamFilterLevel === "off" || forceShowAll;

  useEffect(() => {
    setStrictMode(settings.streamFilterLevel === "strict");
    setForceShowAll(false);
  }, [meta.id, episode?.season, episode?.episode, settings.streamFilterLevel]);

  const {
    result,
    loading,
    pipelineDone,
    firstResultAt,
    autoSettleReady,
    addonQuorum,
    pipelineStartedAt,
    resolveError,
    refresh,
    setAutoSettleReady,
  } = usePipelineResult({
    meta,
    episode,
    imdbId: resolvedImdb.id,
    streamIds,
    addons,
    debrids,
    settings,
    strictMode,
    filterDisabled,
    animeTitles,
  });

  const isCached = useCallback((s: ScoredStream) => streamIsCached(s, debrids), [debrids]);

  const cachedOn = useCallback(
    (s: ScoredStream): BpCachedOn | null => {
      for (const d of debrids) {
        if (s.inLibrary[d.slug] === true) return { name: d.name, owned: true };
      }
      for (const d of debrids) {
        if (s.cached[d.slug] === true) return { name: d.name, owned: false };
      }
      return null;
    },
    [debrids],
  );

  const hostSourceForMedia = useMemo(() => {
    const foreignHost =
      Boolean(roomSnapshot.hostClientId) && roomSnapshot.hostClientId !== clientId;
    if (roomSnapshot.state !== "joined" || !foreignHost) return null;
    return hostSourceMatchesMedia(hostSource, meta.id, episode ?? null)
      ? (hostSource?.descriptor ?? null)
      : null;
  }, [roomSnapshot.state, roomSnapshot.hostClientId, clientId, hostSource, meta.id, episode]);

  // The host's own pick has to win the ordering, otherwise a guest picking by
  // position desyncs the room.
  const hostMatch = useMemo(
    () =>
      hostSourceForMedia && result ? buildMatchScores(result.picker.all, hostSourceForMedia) : null,
    [hostSourceForMedia, result],
  );
  const hostMatchFor = useCallback(
    (s: ScoredStream) => (hostMatch ? matchBadge(hostMatch.get(s)) : null),
    [hostMatch],
  );

  // Keyed by transport url as well as manifest id: two installs of the same
  // addon share an id, and only the url tells their logos apart.
  const logos = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of addons ?? []) {
      const logo = resolveAddonLogo(a.manifest.logo, a.transportUrl);
      if (a.transportUrl) m.set(a.transportUrl, logo);
      if (!m.has(a.manifest.id)) m.set(a.manifest.id, logo);
    }
    return m;
  }, [addons]);

  const addonLogo = useCallback(
    (s: ScoredStream) => logos.get(s.addonUrl ?? "") ?? logos.get(s.addonId) ?? null,
    [logos],
  );

  const addonLogoFor = useCallback((key: string) => logos.get(key) ?? null, [logos]);

  const isAnime = useMemo(
    () =>
      ANIME_ID_RE.test(meta.id) ||
      (streamIds ?? []).some((id) => id.startsWith("kitsu:") || id.startsWith("mal:")),
    [meta.id, streamIds],
  );

  const isAnimeRequest = useMemo(
    () => (streamIds ?? []).some((id) => id.startsWith("kitsu:") || id.startsWith("mal:")),
    [streamIds],
  );

  const isAnimeMetaId = ANIME_ID_RE.test(meta.id);

  // The remembered pick and the season lock are what "don't ask me again" means.
  // Neither was read back here, so both settings silently did nothing.
  const previousPlayback = useMemo(
    () =>
      settings.rememberLastStream ? readPlayback(meta.id, episode?.season, episode?.episode) : null,
    [meta.id, episode?.season, episode?.episode, settings.rememberLastStream],
  );

  const sourceEntry = useMemo(
    () =>
      settings.seasonSourceLock && (meta.type === "series" || isAnimeMetaId)
        ? readSeasonLock(meta.id, isAnimeMetaId ? null : (episode?.season ?? null))
        : null,
    [meta.id, meta.type, isAnimeMetaId, episode?.season, settings.seasonSourceLock],
  );

  const rememberedEntry = useMemo(() => {
    if (previousPlayback) return { entry: previousPlayback, kind: "playback" as const };
    if (sourceEntry) return { entry: sourceEntry, kind: "source" as const };
    return null;
  }, [previousPlayback, sourceEntry]);

  const rememberedStream = useMemo(() => {
    const pool = result?.picker.all ?? [];
    if (!rememberedEntry || pool.length === 0) return null;
    const match =
      rememberedEntry.kind === "playback"
        ? (pool.find((s) => streamMatchesEntry(s, rememberedEntry.entry)) ?? null)
        : (pool.find((s) => streamMatchesSource(s, rememberedEntry.entry)) ?? null);
    if (!match || isAnimeMetaId || !episode || rememberedEntry.kind === "source") return match;
    if (match.episode != null && match.episode !== episode.episode) return null;
    if (
      match.episode != null &&
      match.season != null &&
      episode.season != null &&
      match.season !== episode.season
    ) {
      return null;
    }
    return match;
  }, [result, rememberedEntry, episode, isAnimeMetaId]);

  const filters = useBpStreamFilters({
    result,
    addons,
    debrids,
    isCached,
    isAnimeRequest,
    hostMatch,
    pinned: rememberedStream,
    addonLogoFor,
  });

  const localFiles = useMemo(() => {
    const m = meta.id.match(/^tmdb:(?:movie|tv):(\d+)$/);
    const tmdbId = m ? parseInt(m[1], 10) : null;
    if (tmdbId == null && !resolvedImdb.id) return [];
    return episode
      ? findLocalEpisodeVersions(episode.season, episode.episode, tmdbId, resolvedImdb.id)
      : findLocalMovieVersions(tmdbId, resolvedImdb.id);
  }, [meta.id, resolvedImdb.id, episode]);

  const [homeServerState, setHomeServerState] = useState<{
    copies: PlayableCopy[];
    connections: MediaServerConnection[];
    items: MediaServerItem[];
  }>({ copies: [], connections: [], items: [] });
  const [homeServersLoaded, setHomeServersLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHomeServersLoaded(false);
    const match = meta.id.match(/^tmdb:(?:movie|tv):(\d+)$/);
    const identity = {
      tmdbId: match ? Number(match[1]) : undefined,
      imdbId: resolvedImdb.id ?? (meta.id.startsWith("tt") ? meta.id : undefined),
    };
    void mediaServerItems().then((indexed) => {
      if (cancelled) return;
      const connections = mediaServerConnections();
      const items = matchingServerItems(
        indexed,
        identity,
        episode ? "series" : "movie",
        episode?.season,
        episode?.episode,
      );
      setHomeServerState({
        copies: serverPlayableCopies(items, connections),
        connections,
        items,
      });
      setHomeServersLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [meta.id, resolvedImdb.id, episode?.season, episode?.episode]);

  const pendingAddonCount = useMemo(() => {
    if (!addons || pipelineDone) return 0;
    const returned = new Set((result?.picker.all ?? []).map((s) => s.addonId));
    return addons.filter((a) => {
      const id = a.manifest?.id;
      if (!id) return false;
      const hasStream = (a.manifest?.resources ?? []).some((r) =>
        typeof r === "string" ? r === "stream" : r.name === "stream",
      );
      return hasStream && !returned.has(id);
    }).length;
  }, [addons, pipelineDone, result]);

  return {
    ...filters,
    loading: loading && filters.total === 0,
    done: pipelineDone,
    error: resolveError,
    refresh,
    result,
    addons,
    pendingAddonCount,
    firstResultAt,
    autoSettleReady,
    addonQuorum,
    pipelineStartedAt,
    setAutoSettleReady,
    previousPlayback,
    sourceEntry,
    animeTitles,
    isAnimeRequest,
    filterDisabled,
    isCached,
    cachedOn,
    addonLogo,
    addonLogoFor,
    hostMatchFor,
    debrids,
    imdbId: resolvedImdb.id,
    imdbIdVerified: resolvedImdb.verified,
    isAnime,
    localFiles,
    homeServerCopies: homeServerState.copies,
    homeServerConnections: homeServerState.connections,
    homeServerItems: homeServerState.items,
    homeServersLoaded,
    noSources: addons !== null && addons.length === 0 && debrids.length === 0,
    rememberedStream,
    strictMode,
    forceShowAll,
    canLoosen: strictMode || !filterDisabled,
    searchWider: () => setStrictMode(false),
    showEverything: () => setForceShowAll(true),
  };
}
