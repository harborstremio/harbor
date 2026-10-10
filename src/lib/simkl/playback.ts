import { simklRequest, SimklApiError } from "./client";
import { getSession } from "./session";
import { simklEntryIdKeys, simklEpisodeWatchKeys, simklLookupIds } from "./ids";
import type { SimklEpisodeCoords } from "./ids";
import { isCwDismissed } from "@/lib/cw-dismiss";
import { readResumeEntry, saveResumeBatch } from "@/lib/resume";
import type { LibraryItem } from "@/lib/stremio";

type Ids = {
  imdb?: string;
  tmdb?: number | string;
  mal?: number;
  kitsu?: number;
  anilist?: number;
  anidb?: number;
};

type Node = { title?: string; year?: number; ids?: Ids };

type RawSession = {
  progress?: number;
  paused_at?: string;
  watched_at?: string;
  movie?: Node;
  show?: Node;
  anime?: Node;
  episode?: {
    season?: number;
    number?: number;
    episode?: number;
    tvdb_season?: number;
    tvdb_number?: number;
  };
};

const DURATION_MS = { movie: 6_300_000, series: 2_640_000 };

function movieMetaId(ids?: Ids): string | null {
  if (!ids) return null;
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:movie:${ids.tmdb}`;
  return null;
}

function seriesMetaId(ids?: Ids): string | null {
  if (!ids) return null;
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:tv:${ids.tmdb}`;
  if (ids.mal) return `mal:${ids.mal}`;
  if (ids.kitsu) return `kitsu:${ids.kitsu}`;
  return null;
}

function buildItem(
  id: string,
  type: "movie" | "series",
  node: Node,
  pct: number,
  durMs: number,
  when: string,
  season?: number,
  episode?: number,
  isAnime?: boolean,
): LibraryItem {
  const hasEpisode =
    type === "series" && season != null && season > 0 && episode != null && episode > 0;
  return {
    _id: id,
    type,
    name: node.title ?? "Untitled",
    state: {
      timeOffset: Math.round((pct / 100) * durMs),
      duration: durMs,
      season: hasEpisode ? season : undefined,
      episode: hasEpisode ? episode : undefined,
      video_id: hasEpisode ? `${id}:${season}:${episode}` : undefined,
      lastWatched: when,
    },
    removed: false,
    temp: false,
    _ctime: when,
    _mtime: when,
    external: "simkl",
    isAnime,
  };
}

async function toLibraryItem(raw: RawSession): Promise<LibraryItem | null> {
  const pct = Math.min(100, Math.max(0, raw.progress ?? 0));
  if (pct < 1 || pct > 98) return null;
  const when = raw.paused_at ?? raw.watched_at ?? new Date(0).toISOString();

  if (raw.movie) {
    const id = movieMetaId(raw.movie.ids);
    return id ? buildItem(id, "movie", raw.movie, pct, DURATION_MS.movie, when) : null;
  }

  if (!raw.show && !raw.episode && raw.anime) {
    const movieId = movieMetaId(raw.anime.ids);
    if (movieId) {
      return buildItem(
        movieId,
        "movie",
        raw.anime,
        pct,
        DURATION_MS.movie,
        when,
        undefined,
        undefined,
        true,
      );
    }
  }

  const seriesNode = raw.show ?? raw.anime;
  if (seriesNode) {
    const anime = !!raw.anime && !raw.show;
    const ids = seriesNode.ids;
    const nativeId =
      anime &&
      (ids?.kitsu
        ? `kitsu:${ids.kitsu}`
        : ids?.mal
          ? `mal:${ids.mal}`
          : ids?.anilist
            ? `anilist:${ids.anilist}`
            : null);
    const mappedAnime = anime && !nativeId;
    const id = nativeId || seriesMetaId(ids);
    if (!id) return null;
    const season = mappedAnime
      ? raw.episode?.tvdb_season
      : (raw.episode?.season ?? (anime ? 1 : undefined));
    const episode = mappedAnime
      ? raw.episode?.tvdb_number
      : (raw.episode?.number ?? raw.episode?.episode);
    // Season-based anime IDs cannot be attached to franchise IDs without a mapping.
    if (mappedAnime && (season == null || episode == null)) return null;
    return buildItem(
      id,
      "series",
      seriesNode,
      pct,
      DURATION_MS.series,
      when,
      season,
      episode,
      anime,
    );
  }
  return null;
}

// The replayed stop exists to close a stuck "actively playing" session; a stop
// without one would only re-mark an item the user may have unmarked since the
// watch, so the pending replay gates it on this check.
export async function hasActiveSimklPlayback(
  metaId: string,
  episode: SimklEpisodeCoords | undefined,
  imdb?: string,
): Promise<boolean> {
  const wanted = new Set(simklLookupIds(metaId, imdb));
  let raw: RawSession[];
  try {
    raw = await simklRequest<RawSession[]>("/sync/playback?hide_watched=true&limit=40");
  } catch (e) {
    if (e instanceof SimklApiError && e.status === 404) return false;
    throw e;
  }
  if (!Array.isArray(raw)) return false;
  for (const r of raw) {
    const kind = r.movie ? "movie" : "show";
    const node = r.movie ?? r.show ?? r.anime;
    if (!node) continue;
    if (!simklEntryIdKeys(node.ids, kind).some((key) => wanted.has(key))) continue;
    if (!episode) return true;
    const season = r.episode?.season;
    const number = r.episode?.number ?? r.episode?.episode;
    if (season == null && number == null) continue;
    if (simklEpisodeWatchKeys(episode).includes(`${season}:${number}`)) return true;
  }
  return false;
}

export async function fetchSimklPlaybackItems(): Promise<LibraryItem[]> {
  const owner = getSession();
  if (!owner) return [];
  let raw: RawSession[];
  try {
    raw = await simklRequest<RawSession[]>("/sync/playback?hide_watched=true&limit=40");
  } catch (e) {
    if (e instanceof SimklApiError && e.status === 404) return [];
    throw e;
  }
  if (getSession() !== owner) throw new Error("SIMKL session changed");
  if (!Array.isArray(raw)) return [];

  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const item = await toLibraryItem(r);
    if (!item?.state) continue;
    const key = `${item._id}|${item.state.season ?? ""}|${item.state.episode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    // A dismissed card must not be resurrected by this backfill: dismiss clears the
    // resume entry, and rewriting it with t=now would manufacture fresh activity that
    // beats the dismissal. Genuine new progress still surfaces via paused_at/ratio.
    if (isCwDismissed(item)) continue;
    // Newer-wins backfill: overwrite a stale entry when the remote pause is newer
    // (paused_at) or, when the stored entry has no usable timestamp, further ahead.
    const existing = readResumeEntry(item._id, item.state.season, item.state.episode);
    const remoteT = Date.parse(item.state.lastWatched ?? "");
    const remoteValid = Number.isFinite(remoteT) && remoteT > 0;
    const shouldWrite =
      !existing ||
      (remoteValid && remoteT >= existing.t) ||
      (!existing.t && item.state.timeOffset > existing.ms);
    if (shouldWrite) {
      // Persist the true remote percent alongside the synthetic ms so consumers
      // can prefer pct x real runtime once migrated; pct rides along with the
      // winning write and is never mixed with another entry's ms.
      const pct01 = Math.min(100, Math.max(0, r.progress ?? 0)) / 100;
      saveResumeBatch([
        {
          id: item._id,
          ms: item.state.timeOffset,
          season: item.state.season,
          episode: item.state.episode,
          pct: pct01,
          source: "simkl",
          t: remoteValid ? remoteT : 0,
        },
      ]);
    }
  }
  return items;
}
