import { activeProfileId } from "@/lib/active-profile-id";
import { tmdbImdbCached, tmdbFromImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { fetchPmdbWatchedKeySet } from "./history";
import { getImdbForTmdb } from "./mappings";
import { getSession } from "./session";

const BASE_KEY = "harbor.publicmetadb.watched.v1";
const PEEK_TTL_MS = 24 * 60 * 60 * 1000;
const ENRICH_POOL = 5;
const ENRICH_MAX_IDS = 100;

function storageKey(): string {
  return `${BASE_KEY}.${activeProfileId()}`;
}

type SavedWatched = { account: string; at: number; keys: unknown };

function accountId(): string | null {
  const session = getSession();
  if (!session) return null;
  return session.username ?? "key";
}

// Synchronous starting point for the first paint. The async pull still runs
// and replaces this, so a stale copy can only delay hiding a card, never
// leave it permanently wrong.
export function peekPmdbWatched(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  const account = accountId();
  if (!account) return new Set();
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
    const saved = raw as SavedWatched | null;
    if (
      !saved ||
      saved.account !== account ||
      typeof saved.at !== "number" ||
      Date.now() - saved.at > PEEK_TTL_MS ||
      !Array.isArray(saved.keys)
    )
      return new Set();
    return new Set(saved.keys.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

export function rememberPmdbWatched(keys: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  const account = accountId();
  if (!account) return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ account, at: Date.now(), keys: [...keys] }));
  } catch {
    /* ignore quota */
  }
}

export function clearPmdbWatchedPeek(): void {
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}

function num(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Converts PMDB-shaped watched keys into the Trakt-shaped keys Harbor's
 * consumers match on (`imdb:tt…[:S:E]`, `tmdb:{id}[:S:E]`), plus title-level
 * keys for the catalog hide-watched truncation. Bare `S:E` keys are dropped:
 * without a show scope they collide across shows. Cross-ID counterparts come
 * from the free synchronous TMDB caches; the async mappings enrichment in
 * `enrichPmdbTitleKeys` covers the rest.
 */
export function normalizePmdbWatchedKeys(input: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const key of input) {
    if (typeof key !== "string" || !key) continue;
    const parts = key.split(":");
    if (parts[0] === "tmdb" && parts[1] === "movie") {
      const id = parts.length >= 3 ? num(parts[2]) : null;
      if (id == null) continue;
      out.add(`tmdb:${id}`);
      const imdb = tmdbImdbCached(`tmdb:movie:${id}`);
      if (imdb) out.add(`imdb:${imdb}`);
      continue;
    }
    if (parts[0] === "tmdb" && parts[1] === "tv") {
      const id = parts.length >= 3 ? num(parts[2]) : null;
      if (id == null) continue;
      const season = parts.length >= 4 ? num(parts[3]) : null;
      const episode = parts.length >= 5 ? num(parts[4]) : null;
      out.add(`tmdb:${id}`);
      const imdb = tmdbImdbCached(`tmdb:tv:${id}`);
      if (season != null && episode != null) {
        out.add(`tmdb:${id}:${season}:${episode}`);
        if (imdb) out.add(`imdb:${imdb}:${season}:${episode}`);
      }
      if (imdb) out.add(`imdb:${imdb}`);
      continue;
    }
    if (parts[0] === "tmdb" && parts.length >= 2) {
      // Already normalized (`tmdb:{id}[:S:E]`).
      const id = num(parts[1]);
      if (id == null) continue;
      out.add(parts.length >= 4 ? `tmdb:${id}:${parts[2]}:${parts[3]}` : `tmdb:${id}`);
      continue;
    }
    if (parts[0] === "imdb" && parts.length >= 2 && /^tt\d+$/.test(parts[1])) {
      const imdb = parts[1];
      if (parts.length >= 4) {
        out.add(`imdb:${imdb}:${parts[2]}:${parts[3]}`);
      } else {
        out.add(`imdb:${imdb}`);
      }
      const tmdb = tmdbFromImdbCached(imdb);
      if (tmdb) {
        const match = /^tmdb:(movie|tv):(\d+)$/.exec(tmdb);
        if (match) {
          const id = num(match[2]);
          if (id != null) {
            out.add(`tmdb:${id}`);
            if (match[1] === "tv" && parts.length >= 4) {
              out.add(`tmdb:${id}:${parts[2]}:${parts[3]}`);
            }
          }
        }
      }
      continue;
    }
  }
  return out;
}

/**
 * Resolves TMDB ids in a normalized set to IMDb ids through PMDB's community
 * mappings (persistently cached), emitting `imdb:` counterparts for both
 * title-level and episode-level keys. Ids already resolved via local caches
 * are skipped. Failures degrade silently to the un-enriched set.
 */
export async function enrichPmdbTitleKeys(normalized: Set<string>): Promise<Set<string>> {
  const out = new Set(normalized);
  const seriesIds = new Set<number>();
  const movieIds = new Set<number>();
  for (const key of normalized) {
    const full = /^tmdb:(\d+):(\d+):(\d+)$/.exec(key);
    if (full) {
      seriesIds.add(Number(full[1]));
      continue;
    }
    const bare = /^tmdb:(\d+)$/.exec(key);
    if (bare) movieIds.add(Number(bare[1]));
  }
  for (const id of seriesIds) movieIds.delete(id);

  const candidates: Array<{ id: number; media: "movie" | "tv" }> = [
    ...[...seriesIds].map((id) => ({ id, media: "tv" as const })),
    ...[...movieIds].map((id) => ({ id, media: "movie" as const })),
  ].slice(0, ENRICH_MAX_IDS);

  const imdbById = new Map<number, string>();

  const queue = [...candidates];
  const workers = Array.from({ length: Math.min(ENRICH_POOL, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      // Skip ids that already gained an IMDb counterpart from local caches.
      let known: string | null = null;
      for (const key of out) {
        if (key === `tmdb:${next.id}`) continue;
        const m = /^imdb:(tt\d+)$/.exec(key);
        if (m) {
          const tmdb = tmdbFromImdbCached(m[1]);
          if (tmdb === `tmdb:movie:${next.id}` || tmdb === `tmdb:tv:${next.id}`) {
            known = m[1];
            break;
          }
        }
      }
      if (known) {
        imdbById.set(next.id, known);
        continue;
      }
      try {
        const imdb = await getImdbForTmdb(next.id, next.media);
        if (imdb) imdbById.set(next.id, imdb);
      } catch {
        /* degrade silently */
      }
    }
  });
  await Promise.all(workers);

  for (const [, imdb] of imdbById) {
    out.add(`imdb:${imdb}`);
  }
  for (const key of [...out]) {
    const m = /^tmdb:(\d+):(\d+):(\d+)$/.exec(key);
    if (m) {
      const imdb = imdbById.get(Number(m[1]));
      if (imdb) out.add(`imdb:${imdb}:${m[2]}:${m[3]}`);
    }
  }
  return out;
}

/**
 * Full pipeline for Home hide-watched: global fetch, Trakt-shape
 * normalization, and mappings-backed cross-ID enrichment.
 */
export async function loadPmdbTitleWatchedKeys(): Promise<Set<string>> {
  const raw = await fetchPmdbWatchedKeySet();
  const normalized = normalizePmdbWatchedKeys(raw);
  return enrichPmdbTitleKeys(normalized);
}
