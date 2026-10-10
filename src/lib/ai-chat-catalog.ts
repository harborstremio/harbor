import { searchCinemeta } from "./search";
import { meta as fetchFullMeta, type Meta } from "./cinemeta";
import { safeFetch as fetch } from "./safe-fetch";
import { get } from "./providers/tmdb/tmdb-client";
import {
  movieMeta,
  seriesMeta,
  type Page,
  type RawMovie,
  type RawSeries,
} from "./providers/tmdb/tmdb-meta-mappers";
import { TMDB } from "./providers/tmdb/tmdb-client";
import { loadStoredSettings } from "./settings/load";
import {
  catalogReleaseVerdict,
  pickRecommendationMatch,
  recommendationReleaseFallback,
  recommendationReleaseInfo,
  validReleaseDate,
  type RecommendationItem,
} from "./ai-chat-recommendations";

export type ResolvedRecommendation = {
  meta: Meta;
  reason?: string;
  runtimeMinutes?: number | null;
  finishTime?: string | null;
  isReleased?: boolean;
  releaseDate?: string;
};

export function parseRuntimeMinutes(runtime?: string): number | null {
  if (!runtime) return null;
  const minMatch = runtime.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  const hMatch = runtime.match(/(\d+)\s*h(?:our)?s?/i);
  const mMatch = runtime.match(/(\d+)\s*m(?:in)?s?/i);
  if (hMatch || mMatch) {
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
    return hours * 60 + mins;
  }
  const num = parseInt(runtime, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function formatFinishTime(minutes: number): string {
  const finish = new Date(Date.now() + minutes * 60 * 1000);
  return finish.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

async function searchTmdbRecommendation(item: RecommendationItem, apiKey: string): Promise<Meta[]> {
  const type = item.type ?? "movie";
  const path = type === "movie" ? "search/movie" : "search/tv";
  const yearParam = type === "movie" ? "year" : "first_air_date_year";
  const queries = [item.title, item.title.replace(/\s*\(\s*\d{4}\s*\)/g, "").trim()];
  const output: Meta[] = [];

  for (const query of new Set(queries)) {
    const result = await get<Page<RawMovie | RawSeries>>(apiKey, path, {
      query,
      include_adult: "false",
      language: "en-US",
      ...(item.year ? { [yearParam]: String(item.year) } : {}),
    }).catch(() => null);
    for (const raw of result?.results ?? []) {
      if (type === "movie" && "title" in raw) {
        output.push(movieMeta(raw, raw.title));
      } else if (type === "series" && "name" in raw) {
        output.push(seriesMeta(raw, raw.name));
      }
    }
    if (pickRecommendationMatch(output, item)) break;
  }

  return output;
}

async function tmdbWorldwideReleaseVerdict(
  meta: Meta,
  apiKey: string,
  now: number,
): Promise<{ isReleased?: boolean; releaseDate?: string }> {
  const match = /^tmdb:movie:(\d+)$/.exec(meta.id);
  if (!match) return {};

  const url = new URL(`${TMDB}/movie/${match[1]}/release_dates`);
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url.toString()).catch(() => null);
  if (!response?.ok) return {};

  const data = (await response.json().catch(() => null)) as {
    results?: Array<{
      release_dates?: Array<{ release_date?: string; type?: number }>;
    }>;
  } | null;
  const dates = (data?.results ?? [])
    .flatMap((country) => country.release_dates ?? [])
    .filter((entry) => typeof entry.release_date === "string")
    .map((entry) => entry.release_date!.slice(0, 10))
    .filter((date) => validReleaseDate(date))
    .sort();
  if (!dates.length) return {};

  const today = new Date(now).toISOString().slice(0, 10);
  const releasedDate = dates.find((date) => date <= today);
  return releasedDate
    ? { isReleased: true, releaseDate: releasedDate }
    : { isReleased: false, releaseDate: dates[0] };
}

export async function resolveChatRecommendations(
  items: RecommendationItem[],
  signal?: AbortSignal,
): Promise<ResolvedRecommendation[]> {
  const currentYear = new Date().getFullYear();
  const tmdbKey = loadStoredSettings().tmdbKey.trim();

  const resolveItem = async (item: RecommendationItem): Promise<ResolvedRecommendation | null> => {
    signal?.throwIfAborted();
    const now = Date.now();
    // A model's bare "upcoming" label is not a reliable premiere date.
    const modelReleased = recommendationReleaseFallback(item, currentYear, now);

    try {
      const [cinemetaMatches, tmdbMatches] = await Promise.all([
        Promise.all(
          [...new Set([item.title, item.title.replace(/\s*\(\s*\d{4}\s*\)/g, "").trim()])]
            .filter((title) => title.length >= 2)
            .map((title) => searchCinemeta(title)),
        ),
        tmdbKey ? searchTmdbRecommendation(item, tmdbKey) : Promise.resolve([]),
      ]);
      const cinemetaPool = cinemetaMatches.flatMap((result) => [
        ...result.movies,
        ...result.series,
      ]);
      const meta =
        pickRecommendationMatch(tmdbMatches, item) ?? pickRecommendationMatch(cinemetaPool, item);

      if (!meta) {
        return null;
      }

      // Best-effort full catalog record: the source of truth for runtime AND release data.
      let record = meta;
      try {
        if (
          meta.id &&
          !meta.id.startsWith("custom-") &&
          (meta.type === "movie" || meta.type === "series")
        ) {
          const full = await fetchFullMeta(meta.type, meta.id);
          if (full) record = full;
        }
      } catch {}

      // Catalog verdict wins over the model's guess; dates come from the program.
      const globalRelease = tmdbKey ? await tmdbWorldwideReleaseVerdict(meta, tmdbKey, now) : {};
      const verdict =
        globalRelease.isReleased !== undefined
          ? globalRelease
          : catalogReleaseVerdict(record, now, currentYear);
      const isReleased = verdict.isReleased ?? modelReleased;
      const programDate = verdict.releaseDate || record.releaseDate?.trim() || undefined;
      const resolvedYear = recommendationReleaseInfo(record, item.year);

      let runtime = record.runtime;
      // Fallback to runtime provided by Gemini if Cinemeta doesn't have it
      if (!runtime && item.runtime && isReleased) {
        runtime = item.runtime;
      }

      // Only compute duration and finish time for movies that are already released!
      const runtimeMinutes =
        isReleased && record.type === "movie" ? parseRuntimeMinutes(runtime) : null;
      const finishTime = runtimeMinutes ? formatFinishTime(runtimeMinutes) : null;

      return {
        meta: {
          ...meta,
          runtime: isReleased ? runtime : undefined,
          releaseDate: programDate || meta.releaseDate,
          releaseInfo: resolvedYear,
        },
        reason: item.reason,
        runtimeMinutes,
        finishTime,
        isReleased,
        releaseDate: programDate || item.releaseDate,
      };
    } catch {
      signal?.throwIfAborted();
      return null;
    }
  };
  const resolved: Array<ResolvedRecommendation | null> = [];
  // Avoid flooding metadata services when a franchise returns many titles.
  for (let index = 0; index < items.length; index += 4) {
    signal?.throwIfAborted();
    resolved.push(...(await Promise.all(items.slice(index, index + 4).map(resolveItem))));
  }

  const out: ResolvedRecommendation[] = [];
  const seen = new Set<string>();
  for (const r of resolved) {
    if (!r) continue;
    if (seen.has(r.meta.id)) continue;
    seen.add(r.meta.id);
    out.push(r);
  }
  return out;
}
