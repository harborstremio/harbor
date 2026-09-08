import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { meta as fetchMeta, type Meta } from "./cinemeta";
import type { PlayEpisode } from "./view";
import { airedOnly } from "./aired";
import { readActiveStremioAuthKey, useAuth } from "./auth";
import { captureMembershipProfile, isMembershipProfileCurrent } from "./membership-operations";
import { ANIME_CLOUD_ID, cloudWriteId, libraryGetOneStrict } from "./stremio";
import { decodeWatchedEpisodes, stremioMovieWatched } from "./stremio-watched";
import { readTraktWatched } from "./media-provider-actions";
import {
  isAuthenticated as traktConnected,
  getSession as traktSession,
  subscribeSession as subscribeTrakt,
} from "./trakt/session";
import {
  isAuthenticated as simklConnected,
  getSession as simklSession,
  subscribeSession as subscribeSimkl,
} from "./simkl/session";
import {
  isAuthenticated as anilistConnected,
  getSession as anilistSession,
  subscribeSession as subscribeAnilist,
} from "./anilist/session";
import {
  isAuthenticated as malConnected,
  getSession as malSession,
  subscribeSession as subscribeMal,
} from "./mal/session";
import { resolveAnilistMediaId } from "./anilist/sync";
import { fetchListEntry as readAnilistEntry } from "./anilist/mutations";
import { resolveMalMediaId, fetchListEntry as readMalEntry } from "./mal/mutations";
import { stremioIdToTraktTarget } from "./trakt/ids";
import { stremioIdToSimklTarget } from "./simkl/ids";
import { readSimklStateStrict } from "./simkl/list-status";
import { manualWatchedState, manualWatchedVersion, subscribeManualWatched } from "./manual-watched";
import { isMovieWatchedLocal, movieWatchedVersion, subscribeMovieWatched } from "./movie-watched";
import { isWatchedFlagged } from "./watched-flag";
import { getEpisodeProgress } from "./episode-progress";

type ProviderState = { provider: string; watched: Set<string> | null };
export type ContextWatchedInput = {
  meta: Meta;
  imdbId?: string | null;
  episode?: PlayEpisode;
  episodeScope?: boolean;
};
type WatchedSnapshot = { keys: string[] | null; providers: ProviderState[] };
export type ContextWatchedSummary = {
  status: "watched" | "unwatched" | "partial" | "unknown";
  watched: number;
  total: number;
  unavailable: string[];
};

/** A missing override is not evidence of absence in a connected provider. */
export function summarizeContextWatched({
  keys,
  local,
  providers,
}: WatchedSnapshot & { local: (key: string) => boolean | undefined }): ContextWatchedSummary {
  const unavailable = providers.filter((p) => p.watched === null).map((p) => p.provider);
  const unique = [...new Set(keys ?? [])];
  let watched = 0;
  let unknown = false;
  for (const key of unique) {
    const override = local(key);
    if (override === false) continue;
    if (override === true || providers.some((p) => p.watched?.has(key))) watched++;
    else if (unavailable.length) unknown = true;
  }
  const total = unique.length;
  const status = !total
    ? "unknown"
    : watched === total
      ? "watched"
      : watched > 0
        ? "partial"
        : unknown
          ? "unknown"
          : "unwatched";
  return { status, watched, total, unavailable };
}

function sourceId(input: ContextWatchedInput): string {
  return input.episode?.sourceMetaId || input.meta.id;
}

function episodeKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

function releasedKeys(meta: Meta, videos: Meta["videos"]): string[] | null {
  if (!videos?.length) return null;
  const ordered = videos
    .flatMap((video) => {
      const season = video.season ?? (meta.type === "anime" ? 1 : 0);
      const episode = video.episode ?? video.number;
      return Number.isInteger(season) && season >= 1 && Number.isInteger(episode) && episode! >= 1
        ? [{ season, episode: episode!, released: video.released ?? video.firstAired }]
        : [];
    })
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  return [
    ...new Set(
      airedOnly(ordered, (video) => video.released).map((video) =>
        episodeKey(video.season, video.episode),
      ),
    ),
  ];
}

/** Called only for an open menu. Reads use the same identities as its explicit writes. */
export async function readContextWatchedSnapshot(
  input: ContextWatchedInput,
  isCurrent: () => boolean = () => true,
): Promise<WatchedSnapshot> {
  const profile = captureMembershipProfile();
  const authKey = readActiveStremioAuthKey();
  const trakt = traktConnected() ? traktSession() : null;
  const simkl = simklConnected() ? simklSession() : null;
  const anilist = anilistConnected() ? anilistSession() : null;
  const mal = malConnected() ? malSession() : null;
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error("This menu is no longer open.");
    const currentTrakt = traktConnected() ? traktSession() : null;
    if (
      !isMembershipProfileCurrent(profile) ||
      readActiveStremioAuthKey() !== authKey ||
      (trakt?.username ?? trakt?.refreshToken) !==
        (currentTrakt?.username ?? currentTrakt?.refreshToken) ||
      simkl?.accessToken !== (simklConnected() ? simklSession()?.accessToken : undefined) ||
      anilist?.userId !== (anilistConnected() ? anilistSession()?.userId : undefined) ||
      mal?.userName !== (malConnected() ? malSession()?.userName : undefined)
    )
      throw new Error("The active profile changed. Open the menu again.");
  };
  assertCurrent();
  const id = sourceId(input);
  const movie = input.meta.type === "movie";
  const anime = ANIME_CLOUD_ID.test(id) || input.meta.type === "anime";
  const selected = input.episode;
  const localKey = selected ? episodeKey(selected.season, selected.episode) : null;
  const mappedKey =
    selected && input.imdbId
      ? episodeKey(selected.imdbSeason ?? selected.season, selected.imdbEpisode ?? selected.episode)
      : localKey;
  const normalize = (keys: Set<string>) =>
    localKey && mappedKey ? new Set(keys.has(mappedKey) ? [localKey] : []) : keys;
  let videos = id === input.meta.id ? input.meta.videos : undefined;
  if (!movie && !selected && !input.episodeScope && !videos?.length) {
    videos = (await fetchMeta("series", anime ? id : input.imdbId || id).catch(() => null))?.videos;
    assertCurrent();
  }
  const keys = movie
    ? ["movie"]
    : localKey
      ? [localKey]
      : input.episodeScope
        ? null
        : releasedKeys(input.meta, videos);
  const jobs: Array<{ provider: string; read: () => Promise<Set<string>> }> = [];
  if (authKey && !anime)
    jobs.push({
      provider: "Stremio",
      read: async () => {
        const canonical = cloudWriteId(id, input.imdbId ?? null, !!input.imdbId);
        if (!canonical) throw new Error("Missing Stremio identity");
        const item = await libraryGetOneStrict(authKey, canonical);
        assertCurrent();
        if (movie) return new Set(stremioMovieWatched(item) ? ["movie"] : []);
        if (!item?.state?.watched) return new Set();
        let canonicalVideos = videos;
        if (
          !canonicalVideos?.length ||
          canonicalVideos.some((v) => !v.id?.startsWith(`${canonical}:`))
        ) {
          canonicalVideos = (await fetchMeta("series", canonical))?.videos;
          assertCurrent();
        }
        if (!canonicalVideos?.length) throw new Error("Missing episode information");
        return normalize(await decodeWatchedEpisodes(item.state.watched, canonicalVideos, true));
      },
    });
  if (trakt)
    jobs.push({
      provider: "Trakt",
      read: async () => {
        if (
          anime &&
          (!selected ||
            !input.imdbId ||
            selected.imdbSeason == null ||
            selected.imdbEpisode == null)
        )
          throw new Error("Missing verified anime episode mapping");
        const resolved = stremioIdToTraktTarget(input.imdbId || id);
        if (!resolved.ok) throw new Error("Missing Trakt identity");
        const ids =
          resolved.target.kind === "episode" ? resolved.target.show.ids : resolved.target.ids;
        const state = await readTraktWatched(ids, movie, assertCurrent);
        return movie ? new Set(state.movie ? ["movie"] : []) : normalize(state.episodes);
      },
    });
  if (simkl)
    jobs.push({
      provider: "Simkl",
      read: async () => {
        if (
          anime &&
          !movie &&
          input.imdbId &&
          (!selected || selected.imdbSeason == null || selected.imdbEpisode == null)
        )
          throw new Error("Missing verified anime episode mapping");
        const resolved = stremioIdToSimklTarget(input.imdbId || id);
        const match = /^(mal|anilist|anidb|kitsu):(\d+)$/.exec(id);
        const target = resolved.ok ? resolved.target : null;
        const ids = target
          ? target.kind === "episode"
            ? target.show.ids
            : target.kind === "anime-episode"
              ? target.anime.ids
              : target.ids
          : match
            ? { [match[1]]: Number(match[2]) }
            : null;
        if (!ids) throw new Error("Missing Simkl identity");
        const state = await readSimklStateStrict({ kind: movie ? "movie" : "show", ids });
        assertCurrent();
        return movie
          ? new Set(state.status === "completed" ? ["movie"] : [])
          : normalize(state.watched);
      },
    });
  // Progress providers count positions within one anime, not mapped TV coordinates.
  const fromAnimeProgress = (completed: boolean, progress: number, total: number | null) => {
    if (!Number.isInteger(progress) || progress < 0) throw new Error("Invalid anime progress");
    if (completed && (!Number.isInteger(total) || total! <= 0))
      throw new Error("Missing verified anime episode total");
    const count = completed && total != null && total > 0 ? total : progress;
    if (movie) return new Set(completed || count > 0 ? ["movie"] : []);
    const sourceKeys = releasedKeys(input.meta, videos);
    if (!sourceKeys?.length || !sourceKeys.every((key, index) => key === `1:${index + 1}`))
      throw new Error("Missing verified anime episode order");
    const watched = new Set(sourceKeys.slice(0, Math.min(count, sourceKeys.length)));
    if (localKey && !sourceKeys.includes(localKey))
      throw new Error("Missing anime episode position");
    return localKey ? new Set(watched.has(localKey) ? [localKey] : []) : watched;
  };
  if (anime && anilist)
    jobs.push({
      provider: "AniList",
      read: async () => {
        const mediaId = await resolveAnilistMediaId(id);
        assertCurrent();
        if (!mediaId) throw new Error("Missing AniList identity");
        const info = await readAnilistEntry(mediaId, true);
        assertCurrent();
        if (!info.entry) return new Set();
        return fromAnimeProgress(
          info.entry.status === "COMPLETED",
          info.entry.progress,
          info.episodes,
        );
      },
    });
  if (anime && mal)
    jobs.push({
      provider: "MyAnimeList",
      read: async () => {
        const mediaId = await resolveMalMediaId(id);
        assertCurrent();
        if (!mediaId) throw new Error("Missing MyAnimeList identity");
        const info = await readMalEntry(mediaId, true);
        assertCurrent();
        if (!info.entry) return new Set();
        return fromAnimeProgress(
          info.entry.status === "completed",
          info.entry.numEpisodesWatched,
          info.numEpisodes,
        );
      },
    });
  const results = await Promise.allSettled(jobs.map((job) => job.read()));
  assertCurrent();
  return {
    keys,
    providers: results.map((result, index) => ({
      provider: jobs[index].provider,
      watched: result.status === "fulfilled" ? result.value : null,
    })),
  };
}

function localWatched(input: ContextWatchedInput, key: string): boolean | undefined {
  const id = sourceId(input);
  if (key === "movie")
    return [id, input.imdbId].some(
      (value) => value && (isMovieWatchedLocal(value) || isWatchedFlagged(value)),
    )
      ? true
      : undefined;
  const [season, episode] = key.split(":").map(Number);
  const selected = input.episode;
  const mappedSeason = selected?.imdbSeason ?? season;
  const mappedEpisode = selected?.imdbEpisode ?? episode;
  const manual =
    manualWatchedState(id, season, episode) ??
    (input.imdbId ? manualWatchedState(input.imdbId, mappedSeason, mappedEpisode) : undefined);
  if (manual !== undefined) return manual;
  const runtime = selected?.runtime ?? Number.parseFloat(input.meta.runtime ?? "");
  return getEpisodeProgress(
    id,
    season,
    episode,
    Number.isFinite(runtime) ? runtime : null,
    input.imdbId ?? null,
    new Set(),
    undefined,
    undefined,
    undefined,
    undefined,
    mappedSeason,
    mappedEpisode,
  ).watched
    ? true
    : undefined;
}

function subscribeLocal(listener: () => void) {
  const offManual = subscribeManualWatched(listener);
  const offMovie = subscribeMovieWatched(listener);
  return () => {
    offManual();
    offMovie();
  };
}

let accountVersion = 0;
function subscribeAccounts(listener: () => void) {
  const changed = () => {
    accountVersion++;
    listener();
  };
  const subscriptions = [
    subscribeTrakt(changed),
    subscribeSimkl(changed),
    subscribeAnilist(changed),
    subscribeMal(changed),
  ];
  window.addEventListener("harbor:active-profile-changed", changed);
  window.addEventListener("harbor:profiles-updated", changed);
  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe());
    window.removeEventListener("harbor:active-profile-changed", changed);
    window.removeEventListener("harbor:profiles-updated", changed);
  };
}

export function useContextWatchedState(input: ContextWatchedInput | null, session?: number) {
  const { user, authKey } = useAuth();
  useSyncExternalStore(subscribeLocal, () => `${manualWatchedVersion()}:${movieWatchedVersion()}`);
  const accounts = useSyncExternalStore(subscribeAccounts, () => accountVersion);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const inputRef = useRef(input);
  inputRef.current = input;
  const key = input
    ? JSON.stringify([
        session,
        sourceId(input),
        input.meta.type,
        input.imdbId,
        input.episode,
        input.episodeScope,
        revision,
        accounts,
        user?._id,
        !!authKey,
      ])
    : "";
  const [loaded, setLoaded] = useState<{ key: string; snapshot: WatchedSnapshot } | null>(null);
  useEffect(() => {
    const target = inputRef.current;
    if (!target) return;
    let cancelled = false;
    void readContextWatchedSnapshot(target, () => !cancelled).then(
      (snapshot) => {
        if (!cancelled) setLoaded({ key, snapshot });
      },
      () => {
        if (!cancelled) setLoaded({ key, snapshot: { keys: null, providers: [] } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  const summary =
    input && loaded?.key === key
      ? summarizeContextWatched({
          ...loaded.snapshot,
          local: (value) => localWatched(input, value),
        })
      : null;
  return { summary, loading: !!input && !summary, refresh };
}
