import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import type { MalEpisodeTitle } from "@/lib/providers/episode-placeholder";
import { safeFetch } from "@/lib/safe-fetch";

// MAL carries an English and a romaji name for episodes long before the other
// anime providers do (TVDB often only has the Japanese original). The app reads
// none of them, so this is a last-resort source: it only fills rows the rest of
// the pipeline left unnamed, and never overrides a title another provider set.
//
// Tenrai is a free, authless, Jikan-compatible mirror of MAL's data. MAL's own
// API v2 has no episode endpoint, and Jikan's public instance is no longer
// reliable.
const API = "https://api.tenrai.org/v1";
const TTL = 6 * 60 * 60 * 1000;
const NEG_TTL = 30 * 60 * 1000;
const CACHE_MAX = 200;

type CacheEntry = { v: MalEpisodeTitle[] | null; t: number };

const cache = new Map<number, CacheEntry>();
const inflight = new Map<number, Promise<MalEpisodeTitle[] | null>>();

registerCache("mal:episodes", () => cache.size);

function readEntry(entry: unknown): MalEpisodeTitle | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const number = typeof e.mal_id === "number" ? e.mal_id : null;
  if (number == null) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    number,
    title: str(e.title),
    romaji: str(e.title_romanji),
    japanese: str(e.title_japanese),
  };
}

export async function malEpisodeTitles(malId: number): Promise<MalEpisodeTitle[] | null> {
  if (!Number.isFinite(malId) || malId <= 0) return null;
  const hit = cache.get(malId);
  if (hit && Date.now() - hit.t < (hit.v ? TTL : NEG_TTL)) return hit.v;
  const existing = inflight.get(malId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const out: MalEpisodeTitle[] = [];
      // Airing cours can exceed 100 episodes; follow the pagination cursor.
      for (let page = 1; page <= 5; page += 1) {
        const res = await safeFetch(`${API}/anime/${malId}/episodes?page=${page}`);
        if (!res.ok) break;
        const json = (await res.json()) as {
          data?: unknown[];
          pagination?: { has_next_page?: boolean };
        };
        for (const raw of json?.data ?? []) {
          const ep = readEntry(raw);
          if (ep) out.push(ep);
        }
        if (!json?.pagination?.has_next_page) break;
      }
      const v = out.length > 0 ? out : null;
      lruSet(cache, malId, { v, t: Date.now() }, CACHE_MAX);
      return v;
    } catch {
      lruSet(cache, malId, { v: null, t: Date.now() }, CACHE_MAX);
      return null;
    } finally {
      inflight.delete(malId);
    }
  })();
  inflight.set(malId, p);
  return p;
}
