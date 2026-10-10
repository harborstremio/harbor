import { episodeFromVideoId, libraryMetaType, type LibraryItem } from "@/lib/stremio";
import type { HistoryItem } from "@/lib/trakt/history";
import { parseTs, type WatchlistMerged } from "./shared";

export type HistoryEntry = WatchlistMerged & {
  season?: number;
  episode?: number;
  progress: number;
  watched: boolean;
  durationMs: number;
  timeOffsetMs: number;
  watchedAt: number | null;
  item?: LibraryItem;
};

export function filterHistory(items: LibraryItem[]): LibraryItem[] {
  return items
    .filter((i) => !i.removed || i.temp)
    .filter(
      (i) =>
        (i.state?.flaggedWatched ?? 0) > 0 ||
        (i.state?.timesWatched ?? 0) > 0 ||
        (i.state?.timeOffset ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        Date.parse(b.state?.lastWatched ?? b._mtime) - Date.parse(a.state?.lastWatched ?? a._mtime),
    );
}

function episodeOf(i: LibraryItem): { season: number; episode: number } | null {
  const s = i.state?.season;
  const e = i.state?.episode;
  if (s && e) return { season: s, episode: e };
  const vid = i.state?.video_id ?? "";
  if (/^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3) {
    const ep = Number(vid.split(":")[2]);
    return ep > 0 ? { season: 1, episode: ep } : null;
  }
  const parsed = episodeFromVideoId(vid);
  return parsed && parsed.episode > 0 ? parsed : null;
}

export function mergeHistory(stremio: LibraryItem[], trakt: HistoryItem[]): HistoryEntry[] {
  const out = new Map<string, HistoryEntry>();
  for (const item of stremio) {
    const dur = item.state?.duration ?? 0;
    const off = item.state?.timeOffset ?? 0;
    const progress = dur > 0 ? Math.min(1, off / dur) : 0;
    const ep = item.type === "movie" ? null : episodeOf(item);
    out.set(item._id, {
      key: item._id,
      meta: {
        id: item._id,
        type: libraryMetaType(item.type),
        name: item.name,
        poster: item.poster,
        background: item.background,
      },
      date: parseTs(item._mtime),
      stremioId: item._id,
      season: ep?.season,
      episode: ep?.episode,
      progress,
      watched:
        (item.state?.flaggedWatched ?? 0) > 0 ||
        (item.state?.timesWatched ?? 0) > 0 ||
        progress >= 0.9,
      durationMs: dur,
      timeOffsetMs: off,
      watchedAt: parseTs(item.state?.lastWatched ?? item._mtime),
      item,
    });
  }
  for (const h of trakt) {
    const id = h.type === "movie" ? h.imdb : h.showImdb;
    if (!id || out.has(id)) continue;
    out.set(id, {
      key: id,
      meta: {
        id,
        type: h.type === "movie" ? "movie" : "series",
        name: h.title,
      },
      date: parseTs(h.watchedAt),
      progress: 0,
      watched: false,
      durationMs: 0,
      timeOffsetMs: 0,
      watchedAt: parseTs(h.watchedAt),
    });
  }
  return Array.from(out.values());
}

export function historyItemsToDated(items: HistoryItem[]): WatchlistMerged[] {
  const seen = new Set<string>();
  const out: WatchlistMerged[] = [];
  for (const h of items) {
    const id = h.type === "movie" ? h.imdb : h.showImdb;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      key: id,
      meta: {
        id,
        type: h.type === "movie" ? "movie" : "series",
        name: h.title,
      },
      date: parseTs(h.watchedAt),
    });
  }
  return out;
}
