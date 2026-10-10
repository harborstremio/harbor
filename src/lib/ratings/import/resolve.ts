import { externalToKitsu, imdbToKitsu, tmdbTvToKitsu } from "@/lib/providers/anime-mapping";
import { aniZipByAnidb, aniZipByAnilist, aniZipByMal } from "@/lib/providers/anizip";
import { tmdbImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { tmdbSearchTitle } from "@/lib/providers/tmdb/tmdb-catalogs";
import type { RatingMediaType } from "@/lib/ratings/types";
import type { ExternalIds, ImportedRating } from "./types";

export type ResolvedItem = { itemKey: string; mediaType: RatingMediaType };

const ANIME_KEY = /^(kitsu|mal|anilist|anidb):/;
const TCONST = /^tt\d+$/;

const resolved = new Map<string, ResolvedItem>();

function isId(n: number | undefined): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function tconst(imdb: string | undefined): string | null {
  const s = imdb?.trim();
  return s && TCONST.test(s) ? s : null;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function memoKeyOf(mediaType: RatingMediaType, ids: ExternalIds): string {
  return [
    mediaType,
    tconst(ids.imdb) ?? "",
    ids.tmdb ?? "",
    ids.kitsu ?? "",
    ids.mal ?? "",
    ids.anilist ?? "",
    ids.anidb ?? "",
  ].join("|");
}

function screenKey(mediaType: RatingMediaType, ids: ExternalIds): string | null {
  const imdb = tconst(ids.imdb);
  if (imdb) return imdb;
  if (!isId(ids.tmdb)) return null;
  const key = `tmdb:${mediaType === "movie" ? "movie" : "tv"}:${ids.tmdb}`;
  return tmdbImdbCached(key) ?? key;
}

function kitsuProbes(ids: ExternalIds): Array<() => Promise<number | null>> {
  const out: Array<() => Promise<number | null>> = [];
  if (isId(ids.mal)) {
    const n = ids.mal;
    out.push(() => externalToKitsu("myanimelist", n));
    out.push(async () => (await aniZipByMal(n))?.mappings?.kitsu_id ?? null);
  }
  if (isId(ids.anilist)) {
    const n = ids.anilist;
    out.push(() => externalToKitsu("anilist", n));
    out.push(async () => (await aniZipByAnilist(n))?.mappings?.kitsu_id ?? null);
  }
  if (isId(ids.anidb)) {
    const n = ids.anidb;
    out.push(() => externalToKitsu("anidb", n));
    out.push(async () => (await aniZipByAnidb(n))?.mappings?.kitsu_id ?? null);
  }
  const imdb = tconst(ids.imdb);
  if (imdb) out.push(() => imdbToKitsu(imdb));
  if (isId(ids.tmdb)) {
    const n = ids.tmdb;
    out.push(() => tmdbTvToKitsu(n));
  }
  return out;
}

async function toKitsu(ids: ExternalIds, signal?: AbortSignal): Promise<number | null> {
  if (isId(ids.kitsu)) return ids.kitsu;
  for (const probe of kitsuProbes(ids)) {
    throwIfAborted(signal);
    const n = await probe().catch(() => null);
    if (n != null && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

async function animeKey(ids: ExternalIds, signal?: AbortSignal): Promise<string | null> {
  const kitsu = await toKitsu(ids, signal);
  if (kitsu != null) return `kitsu:${kitsu}`;
  if (isId(ids.mal)) return `mal:${ids.mal}`;
  if (isId(ids.anilist)) return `anilist:${ids.anilist}`;
  if (isId(ids.anidb)) return `anidb:${ids.anidb}`;
  return screenKey("series", ids);
}

async function searchKey(
  r: ImportedRating,
  tmdbKey: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const title = r.title?.trim();
  if (!title) return null;
  throwIfAborted(signal);
  const type = r.mediaType === "movie" ? "movie" : "series";
  const hit =
    (await tmdbSearchTitle(tmdbKey, type, title, r.year).catch(() => null)) ??
    (r.year ? await tmdbSearchTitle(tmdbKey, type, title).catch(() => null) : null);
  const id = hit?.id;
  if (!id) return null;
  return tmdbImdbCached(id) ?? id;
}

export async function resolveItemKey(
  r: ImportedRating,
  signal?: AbortSignal,
  tmdbKey?: string,
): Promise<ResolvedItem | null> {
  if (r.mediaType === "manga") return null;
  throwIfAborted(signal);
  const memo = `${memoKeyOf(r.mediaType, r.ids)}|${r.title ?? ""}|${r.year ?? ""}`;
  const hit = resolved.get(memo);
  if (hit) return hit;
  const direct =
    r.mediaType === "anime" ? await animeKey(r.ids, signal) : screenKey(r.mediaType, r.ids);
  const itemKey = direct ?? (tmdbKey ? await searchKey(r, tmdbKey, signal) : null);
  if (!itemKey) return null;
  const out: ResolvedItem = {
    itemKey,
    mediaType: ANIME_KEY.test(itemKey) ? "anime" : r.mediaType,
  };
  resolved.set(memo, out);
  return out;
}

export function clearResolveCache(): void {
  resolved.clear();
}
