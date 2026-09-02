import { safeFetch } from "@/lib/safe-fetch";
import { languageName, normalizeLang } from "@/lib/subtitles/language";
import {
  browserSubtitleCredentialKey,
  subtitleCredentialRequest,
} from "@/lib/subtitles/provider-auth";
import type { ProviderMatchEvidence, SubtitleRating, SubSearchQuery } from "@/lib/subtitles/types";
import {
  imdbTt,
  isSeries,
  wantedLangs,
  markRateLimited,
  rateLimitDelaySeconds,
  type ProviderCtx,
  type SourceSubCandidate,
  type SubtitleProviderFetch,
  type SubSource,
} from "./sub-source-contract";

const BASE = "https://api.subsource.net/api/v1";
const LANGUAGE_OVERRIDES: Record<string, string> = {
  fa: "farsi_persian",
  "pt-br": "brazilian_portuguese",
  "es-419": "spanish_latin_america",
};

type SubsourceMovie = {
  movieId?: unknown;
  title?: unknown;
  alternateTitle?: unknown;
  type?: unknown;
  releaseYear?: unknown;
  imdbId?: unknown;
  tmdbId?: unknown;
  season?: unknown;
  subtitleCount?: unknown;
};

type SubsourceContributor = {
  id?: unknown;
  displayname?: unknown;
};

type SubsourceSubtitle = {
  subtitleId?: unknown;
  movieId?: unknown;
  language?: unknown;
  releaseInfo?: unknown;
  commentary?: unknown;
  files?: unknown;
  size?: unknown;
  hearingImpaired?: unknown;
  foreignParts?: unknown;
  framerate?: unknown;
  productionType?: unknown;
  releaseType?: unknown;
  downloads?: unknown;
  comments?: unknown;
  rating?: unknown;
  preview?: unknown;
  uploaderId?: unknown;
  createdAt?: unknown;
  contributors?: unknown;
};

type SubsourceEnvelope = {
  success?: unknown;
  data?: unknown;
};

type FetchJsonResult =
  | { kind: "ok"; data: SubsourceEnvelope }
  | { kind: "failed" }
  | { kind: "limited" };

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const out = String(value).trim();
  return out || null;
}

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const out = typeof value === "number" ? value : Number(value);
  return Number.isFinite(out) ? out : null;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizedTitle(value: unknown): string {
  return (
    text(value)
      ?.toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim() ?? ""
  );
}

function subsourceLanguage(code: string): string {
  const normalized = normalizeLang(code);
  return (
    LANGUAGE_OVERRIDES[normalized] ??
    languageName(normalized).toLocaleLowerCase().replace(/\s+/g, "_")
  );
}

function releaseSearchValue(filename: string | undefined): string | null {
  const raw = filename?.trim();
  if (!raw) return null;
  const withoutQuery = raw.split(/[?#]/, 1)[0];
  const slash = Math.max(withoutQuery.lastIndexOf("/"), withoutQuery.lastIndexOf("\\"));
  const basename = slash >= 0 ? withoutQuery.slice(slash + 1) : withoutQuery;
  return basename.replace(/\.(?:mkv|mp4|m4v|avi|mov|ts|m2ts|webm)$/i, "").trim() || null;
}

function ratingOf(value: unknown): SubtitleRating | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const good = number(raw.good) ?? undefined;
  const bad = number(raw.bad) ?? undefined;
  const total =
    number(raw.total) ?? (good != null || bad != null ? (good ?? 0) + (bad ?? 0) : undefined);
  const score = total && good != null ? good / total : undefined;
  return score != null || good != null || bad != null || total != null
    ? { score, good, bad, total }
    : undefined;
}

function releaseOf(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map(text).filter((part): part is string => part !== null);
    return parts.length ? parts.join(" ") : null;
  }
  return text(value);
}

function movieTypeMatches(movie: SubsourceMovie, series: boolean): boolean {
  const type = text(movie.type)?.toLowerCase();
  if (!type) return true;
  return series ? ["series", "tv", "tvseries", "show"].includes(type) : type === "movie";
}

function chooseMovie(q: SubSearchQuery, movies: SubsourceMovie[]): SubsourceMovie | null {
  const requestedImdb = imdbTt(q.imdbId);
  const requestedTmdb = text(q.tmdbId);
  const series = isSeries(q);
  const candidates = movies.filter((movie) => movieTypeMatches(movie, series));
  if (requestedImdb) {
    return (
      candidates.find((movie) => imdbTt(text(movie.imdbId) ?? undefined) === requestedImdb) ?? null
    );
  }
  if (requestedTmdb) {
    return candidates.find((movie) => text(movie.tmdbId) === requestedTmdb) ?? null;
  }

  const requestedTitle = normalizedTitle(q.title);
  if (!requestedTitle) return null;
  const scored = candidates
    .map((movie) => {
      const primaryMatch = normalizedTitle(movie.title) === requestedTitle;
      const alternateMatch = normalizedTitle(movie.alternateTitle) === requestedTitle;
      const yearMatches = q.year == null || number(movie.releaseYear) === q.year;
      const seasonMatches = q.season == null || number(movie.season) === q.season;
      return {
        movie,
        score: primaryMatch ? 2 : alternateMatch ? 1 : 0,
        eligible: (primaryMatch || alternateMatch) && yearMatches && seasonMatches,
        id: number(movie.movieId) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((candidate) => candidate.eligible);
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  return scored[0]?.movie ?? null;
}

function movieIdConfirmed(q: SubSearchQuery, movie: SubsourceMovie): boolean {
  const requestedImdb = imdbTt(q.imdbId);
  if (requestedImdb) return imdbTt(text(movie.imdbId) ?? undefined) === requestedImdb;
  if (q.tmdbId) return text(movie.tmdbId) === String(q.tmdbId);
  return false;
}

function authorOf(row: SubsourceSubtitle): string | null {
  const contributors = Array.isArray(row.contributors)
    ? (row.contributors as SubsourceContributor[])
        .map((contributor) => text(contributor.displayname))
        .filter((name): name is string => name !== null)
    : [];
  return contributors.length ? contributors.join(", ") : text(row.uploaderId);
}

function providerMatchFor(exactRelease: boolean, idConfirmed: boolean): ProviderMatchEvidence {
  const matchedBy: NonNullable<ProviderMatchEvidence["matchedBy"]> = [];
  const reasons: string[] = [];
  if (idConfirmed) {
    matchedBy.push("id");
    reasons.push("SubSource matched the requested provider ID");
  } else {
    matchedBy.push("title");
    reasons.push("SubSource matched the title search");
  }
  if (exactRelease) {
    matchedBy.push("release");
    reasons.push("SubSource matched its exact release-info filter");
  }
  return {
    score: exactRelease ? 0.95 : idConfirmed ? 0.8 : 0.6,
    confidence: exactRelease ? "high" : idConfirmed ? "medium" : "low",
    matchedBy,
    reasons,
  };
}

function candidateFrom(
  row: SubsourceSubtitle,
  movie: SubsourceMovie,
  q: SubSearchQuery,
  wanted: Set<string>,
  exactRelease: boolean,
): SourceSubCandidate | null {
  const subtitleId = text(row.subtitleId);
  if (!subtitleId) return null;
  const lang = normalizeLang(text(row.language) ?? "");
  const productionType = text(row.productionType);
  const lowerProduction = productionType?.toLowerCase() ?? "";
  const idConfirmed = movieIdConfirmed(q, movie);
  const rating = ratingOf(row.rating);
  return {
    provider: "subsource",
    id: subtitleId,
    url: `${BASE}/subtitles/${encodeURIComponent(subtitleId)}/download`,
    pageUrl: null,
    lang,
    release: releaseOf(row.releaseInfo),
    format: "zip",
    hearingImpaired: bool(row.hearingImpaired),
    forced: lowerProduction === "forced",
    foreignOnly: bool(row.foreignParts) || lowerProduction === "forced",
    machineTranslated: lowerProduction === "machine" || /machine|\bai\b/i.test(lowerProduction),
    fps: number(row.framerate),
    downloads: number(row.downloads) ?? 0,
    fromTrusted: lowerProduction === "retail",
    hashMatched: false,
    langConfirmed: wanted.size === 0 || wanted.has(lang),
    episodeConfirmed: false,
    idConfirmed,
    matchScore: 0,
    providerMatch: providerMatchFor(exactRelease, idConfirmed),
    author: authorOf(row),
    uploadedAt: text(row.createdAt),
    rating,
    productionType,
    releaseType: text(row.releaseType),
    archive: true,
    rawFilename: null,
    fileSize: number(row.size),
    checksum: null,
    season: number(movie.season) ?? q.season ?? null,
    episode: null,
    downloadAuth: "subsource-api-key",
  };
}

function authHeaders(
  ctx: ProviderCtx,
  browserApiKey: string | undefined,
  managedHeaders?: Record<string, string>,
): HeadersInit {
  return {
    "User-Agent": ctx.userAgent,
    Accept: "application/json",
    ...(managedHeaders ?? (browserApiKey ? { "X-API-Key": browserApiKey } : {})),
  };
}

async function fetchJson(
  url: string,
  ctx: ProviderCtx,
  fetchImpl: SubtitleProviderFetch,
): Promise<FetchJsonResult> {
  let response: Response;
  try {
    const credential = ctx.credentialAuth?.subsource;
    const browserApiKey = browserSubtitleCredentialKey(ctx.subsourceApiKey);
    if (!credential && !browserApiKey) return { kind: "failed" };
    const managed = credential ? subtitleCredentialRequest(url, credential) : undefined;
    if (credential && !managed) return { kind: "failed" };
    response = await fetchImpl(managed?.url ?? url, {
      headers: authHeaders(ctx, browserApiKey, managed?.headers),
      redirect: "error",
    });
  } catch {
    // Do not log exception objects: some runtimes include request headers in network errors.
    return { kind: "failed" };
  }
  if (response.status === 429) {
    markRateLimited("subsource", rateLimitDelaySeconds(response));
    return { kind: "limited" };
  }
  if (!response.ok) {
    return { kind: "failed" };
  }
  const data = (await response.json().catch(() => null)) as SubsourceEnvelope | null;
  return data && data.success !== false ? { kind: "ok", data } : { kind: "failed" };
}

export function buildSubsourceMovieSearchUrl(q: SubSearchQuery): string | null {
  const params = new URLSearchParams();
  const tt = imdbTt(q.imdbId);
  if (tt) {
    params.set("searchType", "imdb");
    params.set("imdb", tt);
  } else if (q.title?.trim()) {
    params.set("searchType", "text");
    params.set("q", q.title.trim());
  } else {
    return null;
  }
  params.set("type", isSeries(q) ? "series" : "movie");
  if (q.year != null) params.set("year", String(q.year));
  if (q.season != null) params.set("season", String(q.season));
  return `${BASE}/movies/search?${params.toString()}`;
}

export function buildSubsourceSubtitleUrl(
  movieId: string,
  lang: string | null,
  releaseInfo?: string | null,
): string {
  const params = new URLSearchParams({ movieId, limit: "100", sort: "rating" });
  if (lang) params.set("language", subsourceLanguage(lang));
  if (releaseInfo) params.set("releaseInfo", releaseInfo);
  return `${BASE}/subtitles?${params.toString()}`;
}

export async function searchSubsource(
  q: SubSearchQuery,
  ctx: ProviderCtx,
  fetchImpl: SubtitleProviderFetch = safeFetch,
): Promise<SourceSubCandidate[] | null> {
  if (!ctx.credentialAuth?.subsource && !browserSubtitleCredentialKey(ctx.subsourceApiKey))
    return null;
  const movieUrl = buildSubsourceMovieSearchUrl(q);
  if (!movieUrl) return [];
  const movieResponse = await fetchJson(movieUrl, ctx, fetchImpl);
  if (movieResponse.kind !== "ok") return null;
  const movies = Array.isArray(movieResponse.data.data)
    ? (movieResponse.data.data as SubsourceMovie[])
    : [];
  const movie = chooseMovie(q, movies);
  const movieId = movie ? text(movie.movieId) : null;
  if (!movie || !movieId) return [];

  const wantedLanguages = wantedLangs(q);
  const languages: Array<string | null> = wantedLanguages.length ? wantedLanguages : [null];
  const wanted = new Set(wantedLanguages);
  const exactRelease = releaseSearchValue(q.filename);
  const requests: Array<{ url: string; exactRelease: boolean }> = [];
  for (const lang of languages) {
    if (exactRelease) {
      requests.push({
        url: buildSubsourceSubtitleUrl(movieId, lang, exactRelease),
        exactRelease: true,
      });
    }
    requests.push({ url: buildSubsourceSubtitleUrl(movieId, lang), exactRelease: false });
  }

  const responses = await Promise.all(
    requests.map(async (request) => ({
      request,
      response: await fetchJson(request.url, ctx, fetchImpl),
    })),
  );
  const out: SourceSubCandidate[] = [];
  const seen = new Set<string>();
  let succeeded = false;
  for (const { request, response } of responses) {
    if (response.kind !== "ok") continue;
    succeeded = true;
    const rows = Array.isArray(response.data.data)
      ? (response.data.data as SubsourceSubtitle[])
      : [];
    for (const row of rows) {
      const candidate = candidateFrom(row, movie, q, wanted, request.exactRelease);
      if (!candidate) continue;
      const key = `${candidate.id}|${candidate.lang}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }
  if (!succeeded) return null;
  return out;
}

export const subsourceSource: SubSource = {
  id: "subsource",
  cacheVersion: "subsource-v1-2026-09",
  supportsHash: false,
  supportsMovie: true,
  supportsTv: true,
  search: searchSubsource,
};
