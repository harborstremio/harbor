import { traktRequest, TraktApiError } from "./client";
import { getSession } from "./session";
import { readResumeMs, saveResumeMs } from "@/lib/resume";
import type { LibraryItem } from "@/lib/stremio";
import type { TraktIds } from "./types";

type Node = { title?: string; year?: number | null; ids?: TraktIds };

type RawPlayback = {
  progress?: number;
  paused_at?: string;
  type?: "movie" | "episode";
  movie?: Node;
  show?: Node;
  episode?: { season?: number; number?: number; title?: string; ids?: TraktIds };
};

const DURATION_MS = { movie: 6_300_000, series: 2_640_000 };

function movieMetaId(ids?: TraktIds): string | null {
  if (!ids) return null;
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:movie:${ids.tmdb}`;
  return null;
}

function seriesMetaId(ids?: TraktIds): string | null {
  if (!ids) return null;
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:tv:${ids.tmdb}`;
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
    external: "trakt",
  };
}

function toLibraryItem(raw: RawPlayback): LibraryItem | null {
  const pct = Math.min(100, Math.max(0, raw.progress ?? 0));
  if (pct < 2 || pct > 98) return null;
  const when = raw.paused_at ?? new Date(0).toISOString();

  if (raw.movie && !raw.episode) {
    const id = movieMetaId(raw.movie.ids);
    return id ? buildItem(id, "movie", raw.movie, pct, DURATION_MS.movie, when) : null;
  }

  if (raw.show) {
    const id = seriesMetaId(raw.show.ids);
    if (!id) return null;
    return buildItem(
      id,
      "series",
      raw.show,
      pct,
      DURATION_MS.series,
      when,
      raw.episode?.season,
      raw.episode?.number,
    );
  }
  return null;
}

export async function fetchTraktPlaybackItems(): Promise<LibraryItem[]> {
  if (!getSession()) return [];
  let raw: RawPlayback[];
  try {
    raw = await traktRequest<RawPlayback[]>("/sync/playback?limit=40");
  } catch (e) {
    if (e instanceof TraktApiError && e.status === 404) return [];
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
