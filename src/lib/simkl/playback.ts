import { readResumeMs, saveResumeMs } from "@/lib/resume";
import type { LibraryItem } from "@/lib/stremio";

import { simklRequest, SimklApiError } from "./client";
import { getSession } from "./session";

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
  watched_at?: string;
  movie?: Node;
  show?: Node;
  anime?: Node;
  episode?: { season?: number; number?: number };
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
  return {
    _id: id,
    type,
    name: node.title ?? "Untitled",
    state: {
      timeOffset: Math.round((pct / 100) * durMs),
      duration: durMs,
      season: season && season > 0 ? season : undefined,
      episode: episode && episode > 0 ? episode : undefined,
    },
    removed: false,
    temp: false,
    _ctime: when,
    _mtime: when,
    external: "simkl",
    isAnime,
  };
}

function toLibraryItem(raw: RawSession): LibraryItem | null {
  const pct = Math.min(100, Math.max(0, raw.progress ?? 0));
  if (pct < 2 || pct > 98) return null;
  const when = raw.watched_at ?? new Date(0).toISOString();

  if (raw.movie) {
    const id = movieMetaId(raw.movie.ids);
    return id ? buildItem(id, "movie", raw.movie, pct, DURATION_MS.movie, when) : null;
  }

  if (!raw.show && !raw.episode && raw.anime) {
    const movieId = movieMetaId(raw.anime.ids);
    if (movieId) {
      return buildItem(movieId, "movie", raw.anime, pct, DURATION_MS.movie, when, undefined, undefined, true);
    }
  }

  const seriesNode = raw.show ?? raw.anime;
  if (seriesNode) {
    const id = seriesMetaId(seriesNode.ids);
    if (!id) return null;
    return buildItem(
      id,
      "series",
      seriesNode,
      pct,
      DURATION_MS.series,
      when,
      raw.episode?.season,
      raw.episode?.number,
      !raw.show,
    );
  }
  return null;
}

export async function fetchSimklPlaybackItems(): Promise<LibraryItem[]> {
  if (!getSession()) return [];
  let raw: RawSession[];
  try {
    raw = await simklRequest<RawSession[]>("/sync/playback?hide_watched=true&limit=40");
  } catch (e) {
    if (e instanceof SimklApiError && e.status === 404) return [];
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const item = toLibraryItem(r);
    if (!item?.state) continue;
    const key = `${item._id}|${item.state.season ?? ""}|${item.state.episode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    const existing = readResumeMs(item._id, item.state.season, item.state.episode);
    if (existing <= 0) {
      saveResumeMs(item._id, item.state.timeOffset, item.state.season, item.state.episode);
    }
  }
  return items;
}
