import { currentActivitiesAll } from "./activities/gate";
import { simklRequest } from "./client";
import { simklTargetIds } from "./ids";
import type { SimklIds, SimklItem, SimklTarget } from "./types";

export type RawIds = {
  simkl?: number;
  imdb?: string;
  tmdb?: number | string;
  tvdb?: number;
  mal?: number;
  anidb?: number;
};
type RawNode = { title?: string; year?: number | null; ids?: RawIds };
type RawEntry = { added_to_watchlist_at?: string; movie?: RawNode; show?: RawNode };
type RawAllItems = { movies?: RawEntry[]; shows?: RawEntry[]; anime?: RawEntry[] };

export function num(v: number | string | undefined): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function mapIds(ids: RawIds | undefined): SimklIds {
  return {
    simkl: ids?.simkl,
    imdb: ids?.imdb,
    tmdb: num(ids?.tmdb),
    tvdb: ids?.tvdb,
    mal: ids?.mal,
    anidb: ids?.anidb,
  };
}

const WATCHLIST_TTL_MS = 25000;
const statusCache = new Map<string, { at: number; marker: string | null; val: Promise<SimklItem[]> }>();

export function invalidateWatchlistCache(): void {
  statusCache.clear();
}

async function fetchByStatus(status: string): Promise<SimklItem[]> {
  const all = await currentActivitiesAll();
  const hit = statusCache.get(status);
  if (hit) {
    if (all !== null && all === hit.marker) return hit.val;
    if (all === null && Date.now() - hit.at < WATCHLIST_TTL_MS) return hit.val;
  }
  const val = fetchByStatusRaw(status);
  statusCache.set(status, { at: Date.now(), marker: all, val });
  return val;
}

async function fetchByStatusRaw(status: string): Promise<SimklItem[]> {
  const data = await simklRequest<RawAllItems>(`/sync/all-items/all/${status}?extended=full`).catch(
    () => ({}) as RawAllItems,
  );
  const out: SimklItem[] = [];
  for (const e of data.movies ?? []) {
    const m = e.movie;
    if (!m) continue;
    out.push({
      type: "movie",
      title: m.title ?? "",
      year: m.year ?? null,
      ids: mapIds(m.ids),
      watchedAt: e.added_to_watchlist_at,
    });
  }
  for (const e of [...(data.shows ?? []), ...(data.anime ?? [])]) {
    const s = e.show;
    if (!s) continue;
    out.push({
      type: "show",
      title: s.title ?? "",
      year: s.year ?? null,
      ids: mapIds(s.ids),
      watchedAt: e.added_to_watchlist_at,
    });
  }
  return out;
}

export async function fetchWatchlist(): Promise<SimklItem[]> {
  return fetchByStatus("plantowatch");
}

export async function fetchWatchingItems(): Promise<SimklItem[]> {
  return fetchByStatus("watching");
}

export async function addToWatchlist(target: SimklTarget): Promise<boolean> {
  try {
    const body =
      target.kind === "movie"
        ? { movies: [{ to: "plantowatch", ids: target.ids }] }
        : { shows: [{ to: "plantowatch", ids: simklTargetIds(target) }] };
    await simklRequest("/sync/add-to-list", { method: "POST", body });
    invalidateWatchlistCache();
    return true;
  } catch {
    return false;
  }
}

export async function removeFromWatchlist(target: SimklTarget): Promise<boolean> {
  try {
    const body =
      target.kind === "movie"
        ? { movies: [{ ids: target.ids }] }
        : { shows: [{ ids: simklTargetIds(target) }] };
    await simklRequest("/sync/history/remove", { method: "POST", body });
    invalidateWatchlistCache();
    return true;
  } catch {
    return false;
  }
}
