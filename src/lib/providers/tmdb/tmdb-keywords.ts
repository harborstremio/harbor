import { lruSet } from "@/lib/cache";
import { get } from "./tmdb-client";

const KEYWORD_CACHE_MAX = 500;
const keywordCache = new Map<string, number | null>();
const keywordInflight = new Map<string, Promise<number | null>>();

export async function tmdbKeywordIdByName(key: string, name: string): Promise<number | null> {
  if (!key || !name) return null;
  const k = name.trim().toLowerCase();
  if (keywordCache.has(k)) return keywordCache.get(k) ?? null;
  if (keywordInflight.has(k)) return keywordInflight.get(k)!;
  const p = (async () => {
    const data = await get<{ results?: Array<{ id: number; name: string }> }>(
      key,
      "search/keyword",
      { query: name },
    );
    const results = data?.results ?? [];
    const exact = results.find((r) => r.name.trim().toLowerCase() === k);
    const id = exact?.id ?? results[0]?.id ?? null;
    lruSet(keywordCache, k, id, KEYWORD_CACHE_MAX);
    return id;
  })().finally(() => keywordInflight.delete(k));
  keywordInflight.set(k, p);
  return p;
}

export async function tmdbResolveKeywordIds(key: string, names: string[]): Promise<number[]> {
  const results = await Promise.all(names.map((n) => tmdbKeywordIdByName(key, n)));
  return results.filter((id): id is number => id != null);
}
