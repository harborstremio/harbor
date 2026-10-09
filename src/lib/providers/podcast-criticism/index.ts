import { useEffect, useState } from "react";
import { lruSet } from "@/lib/cache";
import { safeFetch } from "@/lib/safe-fetch";
import { rankEpisodes, type CriticismEpisode, type RawEpisode } from "./match";

export type { CriticismEpisode } from "./match";
export { durationLabelOf } from "./match";

const SEARCH = "https://itunes.apple.com/search";
const LIMIT = 25;
const TIMEOUT_MS = 9000;
const CACHE_MAX = 60;

const cache = new Map<string, CriticismEpisode[]>();
const inflight = new Map<string, Promise<CriticismEpisode[]>>();

export type CriticismQuery = {
  title: string;
  originalTitle?: string;
  year?: string | number | null;
  directors: string[];
};

function keyFor(query: CriticismQuery): string {
  return [query.title, query.originalTitle ?? "", query.year ?? "", query.directors.join("/")]
    .join("|")
    .toLowerCase();
}

function termFor(query: CriticismQuery): string {
  const director = query.directors[0]?.trim();
  return director ? `${query.title} ${director}` : query.title;
}

function yearNumber(value: CriticismQuery["year"]): number | null {
  const parsed = Number(String(value ?? "").slice(0, 4));
  return Number.isFinite(parsed) && parsed > 1870 ? parsed : null;
}

async function readResults(term: string): Promise<RawEpisode[]> {
  const url = `${SEARCH}?media=podcast&entity=podcastEpisode&limit=${LIMIT}&term=${encodeURIComponent(term)}`;
  const response = await safeFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return [];
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("html")) return [];
  const body = await response.text();
  if (/^\s*</.test(body)) return [];
  const parsed = JSON.parse(body) as { resultCount?: unknown; results?: unknown };
  if (typeof parsed.resultCount !== "number" || !Array.isArray(parsed.results)) return [];
  return parsed.results as RawEpisode[];
}

export async function fetchCriticism(query: CriticismQuery): Promise<CriticismEpisode[]> {
  const title = query.title.trim();
  if (title.length < 2) return [];
  const key = keyFor(query);
  const cached = cache.get(key);
  if (cached) return cached;
  const running = inflight.get(key);
  if (running) return running;

  const promise = (async () => {
    let episodes: CriticismEpisode[] = [];
    try {
      const results = await readResults(termFor(query));
      const titles = [title];
      const original = query.originalTitle?.trim();
      if (original && original.toLowerCase() !== title.toLowerCase()) titles.push(original);
      episodes = rankEpisodes(results, titles, yearNumber(query.year), query.directors);
    } catch {
      episodes = [];
    }
    lruSet(cache, key, episodes, CACHE_MAX);
    return episodes;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function useCriticism(query: CriticismQuery | undefined): CriticismEpisode[] {
  const key = query ? keyFor(query) : "";
  const [episodes, setEpisodes] = useState<CriticismEpisode[]>(() => cache.get(key) ?? []);

  useEffect(() => {
    if (!query) {
      setEpisodes([]);
      return;
    }
    const known = cache.get(key);
    setEpisodes(known ?? []);
    if (known) return;
    let alive = true;
    void fetchCriticism(query).then((found) => {
      if (alive) setEpisodes(found);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return episodes;
}
