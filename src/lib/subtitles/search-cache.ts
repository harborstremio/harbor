import { normalizeLang } from "./language";
import type { SubResult } from "./types";

export const SUBTITLE_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

export type SubtitleSearchCacheScope = {
  languages: readonly string[];
  providers: {
    wyzie: boolean;
    addons: boolean;
    opensubtitles: boolean;
    subdl: boolean;
    subsource: boolean;
  };
  addonUrls: readonly string[];
  credentialBound: boolean;
};

export type SubtitleSearchCacheEntry = {
  results: SubResult[];
  createdAt: number;
};

export function subtitleSearchCacheKey(input: {
  imdbId: string;
  type: "movie" | "series";
  title: string;
  season?: number;
  episode?: number;
  filename?: string | null;
  scope: SubtitleSearchCacheScope;
}): string {
  return JSON.stringify([
    input.imdbId,
    input.type,
    input.title,
    input.season ?? null,
    input.episode ?? null,
    input.filename ?? null,
    input.scope.languages.map((language) => normalizeLang(language)),
    input.scope.providers,
    [...input.scope.addonUrls].sort(),
    input.scope.credentialBound ? "credential-bound-volatile" : "cacheable",
  ]);
}

export function subtitleSearchResultsMayBeCached(
  scope: SubtitleSearchCacheScope,
  results: readonly SubResult[],
): boolean {
  return !scope.credentialBound && results.every((result) => !result.downloadAuth);
}

export function readSubtitleSearchCacheEntry(
  entry: SubtitleSearchCacheEntry | undefined,
  now = Date.now(),
): SubResult[] | null {
  if (!entry || now - entry.createdAt >= SUBTITLE_SEARCH_CACHE_TTL_MS) return null;
  if (entry.results.some((result) => result.downloadAuth)) return null;
  return entry.results;
}
