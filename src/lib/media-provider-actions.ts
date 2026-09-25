import { meta as fetchMeta, type Meta } from "./cinemeta";
import type { WatchlistInput } from "./watchlist";
import type { WatchedEpisode } from "./media-context-actions";
import { readActiveStremioAuthKey } from "./auth";
import {
  ANIME_CLOUD_ID,
  cloudWriteId,
  saveStremioBookmark,
  removeStremioBookmark,
} from "./stremio";
import { withItemLock } from "./stremio-item-lock";
import { markMovieWatchedStremio, setEpisodesWatchedStremio } from "./stremio-watched-sync";
import { traktRequest } from "./trakt/client";
import { isAuthenticated as traktConnected, getSession as getTraktSession } from "./trakt/session";
import { stremioIdToTraktTarget } from "./trakt/ids";
import { simklRequest } from "./simkl/client";
import { isAuthenticated as simklConnected } from "./simkl/session";
import { isAuthenticated as anilistConnected } from "./anilist/session";
import { isAuthenticated as malConnected } from "./mal/session";
import { stremioIdToSimklTarget } from "./simkl/ids";
import { readSimklStateStrict, invalidateSimklListStatus } from "./simkl/list-status";
import { invalidateWatchlistCache } from "./simkl/watchlist";
import { invalidateHistoryCache } from "./simkl/history";
import type { SimklTarget } from "./simkl/types";

export type ProviderWrite = {
  provider: string;
  preflight?: (assertCurrent: () => void) => Promise<string | undefined>;
  run: (assertCurrent: () => void) => Promise<void | string>;
};
type Ids = {
  imdb?: string;
  tmdb?: number | string;
  mal?: number;
  anilist?: number;
  anidb?: number;
  kitsu?: number;
};
type SyncResponse = {
  added?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  deleted?: Record<string, unknown>;
  not_found?: Record<string, unknown[]>;
};

function idsFor(input: WatchlistInput, provider: "Trakt" | "Simkl"): Ids | null {
  const resolution =
    provider === "Trakt"
      ? stremioIdToTraktTarget(input.imdbId || input.id)
      : stremioIdToSimklTarget(input.imdbId || input.id);
  if (resolution.ok) {
    const target = resolution.target;
    return target.kind === "episode"
      ? target.show.ids
      : target.kind === "anime-episode"
        ? target.anime.ids
        : target.ids;
  }
  if (provider === "Simkl") {
    const match = /^(mal|anilist|anidb|kitsu):(\d+)$/.exec(input.id);
    if (match) return { [match[1]]: Number(match[2]) };
  }
  return null;
}

function ensureResponse(
  response: SyncResponse,
  bucket: string,
  operation: "added" | "deleted",
  expected = 1,
): void {
  if (
    !response ||
    Object.values(response.not_found ?? {}).some(
      (items) => !Array.isArray(items) || items.length > 0,
    )
  )
    throw new Error("Provider could not identify the requested content.");
  const count = response[operation]?.[bucket];
  const existing = response.existing?.[bucket];
  if (
    typeof count !== "number" ||
    !Number.isFinite(count) ||
    count + (typeof existing === "number" ? existing : 0) < expected
  )
    throw new Error("Provider did not confirm every requested item.");
}

function captureTraktGuard() {
  const captured = getTraktSession();
  return () => {
    const current = getTraktSession();
    const sameAccount =
      captured?.username && current?.username
        ? captured.username === current.username
        : captured?.refreshToken === current?.refreshToken;
    if (!captured || !current || !sameAccount || !traktConnected())
      throw new Error("The Trakt account or session changed. Open the menu again.");
  };
}

type TraktWatchedRow = {
  movie?: { ids?: Ids };
  show?: { ids?: Ids };
  plays?: number;
  seasons?: Array<{ number: number; episodes: Array<{ number: number; plays: number }> }>;
};

export async function readTraktWatched(
  ids: Ids,
  movie: boolean,
  assertCurrent: () => void,
): Promise<{ movie: boolean; episodes: Set<string> }> {
  // Watched snapshots paginate since June 2026. A short page is not the end;
  // Trakt may reduce its effective page size when season progress is requested.
  const maximumPages = 1000;
  let previousPage = "";
  for (let page = 1; page <= maximumPages; page++) {
    assertCurrent();
    const rows = await traktRequest<TraktWatchedRow[]>(
      `/sync/watched/${movie ? "movies" : "shows"}?page=${page}&limit=100${movie ? "" : "&extended=progress"}`,
      { assertCurrent },
    );
    assertCurrent();
    if (!Array.isArray(rows))
      throw new Error("The current Trakt watched state could not be read safely.");
    if (!rows.length) return { movie: false, episodes: new Set() };
    const signature = JSON.stringify(rows);
    if (signature === previousPage)
      throw new Error("Trakt repeated a watched-state page. No Trakt history was added.");
    previousPage = signature;
    for (const row of rows) {
      const known = movie ? row?.movie?.ids : row?.show?.ids;
      if (!known || typeof known !== "object")
        throw new Error("The current Trakt watched state could not be read safely.");
      if (
        !(
          (ids.imdb && known.imdb === ids.imdb) ||
          (ids.tmdb != null && String(known.tmdb) === String(ids.tmdb))
        )
      )
        continue;
      if (movie) {
        if (!Number.isInteger(row.plays) || row.plays! < 0)
          throw new Error("The current Trakt watched state could not be read safely.");
        return { movie: row.plays! > 0, episodes: new Set() };
      }
      if (!Array.isArray(row.seasons))
        throw new Error("The current Trakt watched state could not be read safely.");
      const episodes = new Set<string>();
      for (const season of row.seasons) {
        if (
          !Number.isInteger(season?.number) ||
          season.number < 0 ||
          !Array.isArray(season.episodes)
        )
          throw new Error("The current Trakt watched state could not be read safely.");
        for (const episode of season.episodes) {
          if (
            !Number.isInteger(episode?.number) ||
            episode.number < 1 ||
            !Number.isInteger(episode.plays) ||
            episode.plays < 0
          )
            throw new Error("The current Trakt watched state could not be read safely.");
          if (episode.plays > 0) episodes.add(`${season.number}:${episode.number}`);
        }
      }
      return { movie: false, episodes };
    }
  }
  throw new Error(
    "The complete Trakt watched state could not be checked. No Trakt history was added.",
  );
}

export function episodeSeasons(episodes: WatchedEpisode[]) {
  const seasons = new Map<number, Set<number>>();
  for (const ep of episodes) {
    if (
      !Number.isInteger(ep.season) ||
      ep.season < 0 ||
      !Number.isInteger(ep.episode) ||
      ep.episode < 1
    )
      throw new Error("Invalid episode identity.");
    const values = seasons.get(ep.season) ?? new Set<number>();
    values.add(ep.episode);
    seasons.set(ep.season, values);
  }
  if (!seasons.size) throw new Error("No episodes were selected.");
  return [...seasons].map(([number, values]) => ({
    number,
    episodes: [...values].map((episode) => ({ number: episode })),
  }));
}

export function watchlistProviderWrites(input: WatchlistInput, on: boolean): ProviderWrite[] {
  const writes: ProviderWrite[] = [];
  const movie = input.type === "movie";
  const bucket = movie ? "movies" : "shows";
  const assertTrakt = captureTraktGuard();
  const simklPreflight = async (assertCurrent: () => void) => {
    const ids = idsFor(input, "Simkl");
    if (!ids) return undefined;
    const current = await readSimklStateStrict({ kind: movie ? "movie" : "show", ids });
    assertCurrent();
    if (!on && current.status === "plantowatch")
      return "Simkl removal also deletes watched history. Manage this title in Simkl.";
    if (on && current.status && current.status !== "plantowatch")
      return "This title already has a Simkl status. Change its status in Simkl.";
    return undefined;
  };
  if (traktConnected())
    writes.push({
      provider: "Trakt",
      run: async (assertCurrent) => {
        const ids = idsFor(input, "Trakt");
        if (!ids) return "No verified Trakt identity is available for this title.";
        assertCurrent();
        assertTrakt();
        const response = await traktRequest<SyncResponse>(
          on ? "/sync/watchlist" : "/sync/watchlist/remove",
          {
            method: "POST",
            body: { [bucket]: [{ ids }] },
            assertCurrent: () => {
              assertCurrent();
              assertTrakt();
            },
          },
        );
        ensureResponse(response, bucket, on ? "added" : "deleted", on ? 1 : 0);
      },
    });
  if (simklConnected())
    writes.push({
      provider: "Simkl",
      preflight: simklPreflight,
      run: async (assertCurrent) => {
        const ids = idsFor(input, "Simkl");
        if (!ids) return "No verified Simkl identity is available for this title.";
        const target: SimklTarget = { kind: movie ? "movie" : "show", ids };
        const current = await readSimklStateStrict(target);
        assertCurrent();
        if (!simklConnected()) throw new Error("Simkl disconnected.");
        // Simkl's whole-title removal also deletes history. It cannot implement membership-only removal.
        if (!on)
          return current.status === "plantowatch"
            ? "Unchanged: Simkl removal also deletes watched history. Manage this title in Simkl."
            : undefined;
        if (current.status === "plantowatch") return;
        if (current.status)
          return "Unchanged: this title already has a Simkl status. Change its status in Simkl.";
        const response = await simklRequest<SyncResponse>("/sync/add-to-list", {
          method: "POST",
          body: { [bucket]: [{ to: "plantowatch", ids }] },
        });
        const added = response?.added?.[bucket];
        if (
          Object.values(response?.not_found ?? {}).some((items) => items.length > 0) ||
          !Array.isArray(added) ||
          added.length !== 1 ||
          added[0]?.to !== "plantowatch"
        )
          throw new Error("Simkl did not confirm plan-to-watch status.");
        invalidateWatchlistCache();
        invalidateSimklListStatus();
      },
    });
  const authKey = readActiveStremioAuthKey();
  if (authKey)
    writes.push({
      provider: "Stremio",
      run: async (assertCurrent) => {
        const canonical = cloudWriteId(input.id, input.imdbId ?? null, !!input.imdbId);
        if (!canonical) return "This title cannot be synced to Stremio's watchlist.";
        const ids = on
          ? [canonical]
          : [
              ...new Set(
                [canonical, cloudWriteId(input.id, input.imdbId ?? null, false)].filter(
                  (id): id is string => !!id,
                ),
              ),
            ];
        for (const id of ids)
          await withItemLock(id, async () => {
            assertCurrent();
            if (readActiveStremioAuthKey() !== authKey) throw new Error("Stremio account changed.");
            if (on) await saveStremioBookmark(authKey, id, input, true);
            else await removeStremioBookmark(authKey, id, true);
          });
      },
    });
  return writes;
}

export function watchedProviderWrites(
  meta: Meta,
  watched: boolean,
  options: {
    episodes: WatchedEpisode[];
    videos?: Meta["videos"];
    imdbId?: string | null;
    verifiedEpisodeMapping?: boolean;
  },
): ProviderWrite[] {
  const writes: ProviderWrite[] = [];
  if (ANIME_CLOUD_ID.test(meta.id) || meta.type === "anime") {
    for (const [provider, connected] of [
      ["AniList", anilistConnected()],
      ["MyAnimeList", malConnected()],
    ] as const) {
      if (connected)
        writes.push({
          provider,
          run: async () =>
            "Anime watched changes are not synced to this provider. Manage progress there.",
        });
    }
  }
  const movie = meta.type === "movie";
  const input = { ...meta, imdbId: options.imdbId };
  const assertTrakt = captureTraktGuard();
  if (traktConnected())
    writes.push({
      provider: "Trakt",
      run: async (assertCurrent) => {
        if (
          (ANIME_CLOUD_ID.test(meta.id) || meta.type === "anime") &&
          !options.verifiedEpisodeMapping
        )
          return "No verified Trakt episode mapping is available for this anime.";
        const ids = idsFor(input, "Trakt");
        if (!ids) return "No verified Trakt identity is available for this title.";
        const validate = () => {
          assertCurrent();
          assertTrakt();
        };
        validate();
        let changing = options.episodes;
        if (watched) {
          const current = await readTraktWatched(ids, movie, validate);
          if (movie && current.movie) return;
          changing = options.episodes.filter(
            (ep) => !current.episodes.has(`${ep.season}:${ep.episode}`),
          );
          if (!movie && !changing.length) return;
        }
        validate();
        const body = movie
          ? { movies: [{ ids }] }
          : { shows: [{ ids, seasons: episodeSeasons(changing) }] };
        const response = await traktRequest<SyncResponse>(
          watched ? "/sync/history" : "/sync/history/remove",
          { method: "POST", body, assertCurrent: validate },
        );
        ensureResponse(
          response,
          movie ? "movies" : "episodes",
          watched ? "added" : "deleted",
          watched ? (movie ? 1 : changing.length) : 0,
        );
      },
    });
  const unverifiedSimklEpisode =
    !movie &&
    (ANIME_CLOUD_ID.test(meta.id) || meta.type === "anime") &&
    !!options.imdbId &&
    !options.verifiedEpisodeMapping;
  if (simklConnected())
    writes.push({
      provider: "Simkl",
      preflight: async () =>
        unverifiedSimklEpisode
          ? "Provider could not identify the requested content."
          : movie && !watched
            ? "Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl."
            : undefined,
      run: async (assertCurrent) => {
        if (unverifiedSimklEpisode) return "Provider could not identify the requested content.";
        const ids = idsFor(input, "Simkl");
        if (!ids) return "No verified Simkl identity is available for this title.";
        if (movie && !watched)
          return "Unchanged: Simkl cannot unwatch a movie without removing it from its library. Manage this title in Simkl.";
        const target: SimklTarget = { kind: movie ? "movie" : "show", ids };
        const current = await readSimklStateStrict(target);
        assertCurrent();
        if (!simklConnected()) throw new Error("Simkl disconnected.");
        if (movie && current.status === "completed") return;
        const changing = options.episodes.filter(
          (ep) => current.watched.has(`${ep.season}:${ep.episode}`) !== watched,
        );
        if (!movie && !changing.length) return;
        const body = movie
          ? { movies: [{ ids }] }
          : { shows: [{ ids, seasons: episodeSeasons(changing) }] };
        const response = await simklRequest<SyncResponse>(
          watched ? "/sync/history" : "/sync/history/remove",
          { method: "POST", body },
        );
        ensureResponse(
          response,
          movie ? "movies" : "episodes",
          watched ? "added" : "deleted",
          movie ? 1 : changing.length,
        );
        invalidateHistoryCache();
        invalidateSimklListStatus();
      },
    });
  const authKey = readActiveStremioAuthKey();
  if (authKey)
    writes.push({
      provider: "Stremio",
      run: async (assertCurrent) => {
        if (ANIME_CLOUD_ID.test(meta.id) || meta.type === "anime")
          return "Anime episode watched state is not synced to Stremio.";
        const canonical = cloudWriteId(meta.id, options.imdbId ?? null, !!options.imdbId);
        if (!canonical) return "No Stremio identity is available for this title.";
        let videos = options.videos;
        if (
          !movie &&
          (!videos?.length || videos.some((video) => !video.id?.startsWith(`${canonical}:`)))
        ) {
          videos = (await fetchMeta("series", canonical))?.videos;
        }
        assertCurrent();
        if (readActiveStremioAuthKey() !== authKey) throw new Error("Stremio account changed.");
        if (
          !movie &&
          (!videos?.length ||
            options.episodes.some(
              (ep) =>
                !videos!.some(
                  (video) =>
                    video.season === ep.season && (video.episode ?? video.number) === ep.episode,
                ),
            ))
        )
          return "The selected episodes could not be aligned with Stremio's episode list.";
        const selected = new Set(options.episodes.map((ep) => `${ep.season}:${ep.episode}`));
        const ok = movie
          ? await markMovieWatchedStremio(authKey, meta, canonical, watched)
          : await setEpisodesWatchedStremio(
              authKey,
              meta,
              canonical,
              videos,
              watched ? selected : new Set(),
              watched ? new Set() : selected,
            );
        if (!ok)
          throw new Error(
            "Stremio has not confirmed this change; a failed write may be queued for retry.",
          );
      },
    });
  return writes;
}
