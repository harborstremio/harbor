import { saveStremioBookmark } from "@/lib/stremio";

import { traktRequest } from "./client";
import type { TraktIds, TraktItem } from "./types";
import { fetchWatchlist } from "./watchlist";

const CHUNK = 100;
const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

type SyncEntry = { ids: TraktIds };
type SyncCount = { movies?: number; shows?: number };
type WatchlistPostResponse = { added?: SyncCount; existing?: SyncCount };

export type WatchlistSource = { id: string; type?: string; removed?: boolean; temp?: boolean };

export type ExportPlan = {
  movies: SyncEntry[];
  shows: SyncEntry[];
  skippedAnime: number;
  total: number;
};

export type ExportResult = {
  exportable: number;
  synced: number;
  skippedAnime: number;
  unmatched: number;
};

function idToTraktIds(id: string): TraktIds | null {
  if (/^tt\d+$/.test(id)) return { imdb: id };
  if (id.startsWith("tmdb:")) {
    const n = Number(id.split(":")[2]);
    if (Number.isFinite(n)) return { tmdb: n };
  }
  return null;
}

export function planExport(items: WatchlistSource[]): ExportPlan {
  const movies: SyncEntry[] = [];
  const shows: SyncEntry[] = [];
  const seen = new Set<string>();
  let skippedAnime = 0;
  let total = 0;
  for (const item of items) {
    if (item.removed || item.temp || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    total++;
    if (ANIME_ID.test(item.id)) {
      skippedAnime++;
      continue;
    }
    const ids = idToTraktIds(item.id);
    if (!ids) continue;
    const isShow = item.type === "series" || item.type === "tv" || item.type === "channel";
    (isShow ? shows : movies).push({ ids });
  }
  return { movies, shows, skippedAnime, total };
}

export async function runExport(plan: ExportPlan): Promise<ExportResult> {
  const exportable = plan.movies.length + plan.shows.length;
  let synced = 0;
  let firstErr: unknown = null;
  const post = async (body: { movies?: SyncEntry[]; shows?: SyncEntry[] }) => {
    try {
      const res = await traktRequest<WatchlistPostResponse>("/sync/watchlist", { method: "POST", body });
      synced +=
        (res.added?.movies ?? 0) + (res.added?.shows ?? 0) + (res.existing?.movies ?? 0) + (res.existing?.shows ?? 0);
    } catch (e) {
      console.error("[trakt] export chunk failed", e);
      if (firstErr == null) firstErr = e;
    }
  };
  for (let i = 0; i < plan.movies.length; i += CHUNK) await post({ movies: plan.movies.slice(i, i + CHUNK) });
  for (let i = 0; i < plan.shows.length; i += CHUNK) await post({ shows: plan.shows.slice(i, i + CHUNK) });
  if (synced === 0 && firstErr != null) throw firstErr;
  return { exportable, synced, skippedAnime: plan.skippedAnime, unmatched: Math.max(0, exportable - synced) };
}

function traktItemToStremioId(it: TraktItem): string | null {
  if (it.ids.imdb && /^tt\d+$/.test(it.ids.imdb)) return it.ids.imdb;
  if (it.ids.tmdb != null) return `tmdb:${it.type === "show" ? "tv" : "movie"}:${it.ids.tmdb}`;
  return null;
}

export function fetchTraktWatchlist(): Promise<TraktItem[]> {
  return fetchWatchlist();
}

export async function runImport(
  authKey: string,
  items: TraktItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ total: number; added: number }> {
  let added = 0;
  let done = 0;
  for (const it of items) {
    const id = traktItemToStremioId(it);
    if (id) {
      try {
        await saveStremioBookmark(authKey, id, {
          type: it.type === "show" ? "series" : "movie",
          name: it.title,
        });
        added++;
      } catch {
        /* keep going; one failed item shouldn't abort the import */
      }
    }
    done++;
    onProgress?.(done, items.length);
  }
  return { total: items.length, added };
}
