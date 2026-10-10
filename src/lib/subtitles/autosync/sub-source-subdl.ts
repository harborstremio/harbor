import { safeFetch } from "@/lib/safe-fetch";
import { normalizeLang } from "@/lib/subtitles/language";
import {
  browserSubtitleCredentialKey,
  subtitleCredentialRequest,
} from "@/lib/subtitles/provider-auth";
import type {
  ProviderMatchConfidence,
  ProviderMatchEvidence,
  SubtitleRating,
  SubSearchQuery,
} from "@/lib/subtitles/types";
import {
  imdbTt,
  isSeries,
  wantedLangs,
  detectFormat,
  markRateLimited,
  rateLimitDelaySeconds,
  type ProviderCtx,
  type SourceSubCandidate,
  type SubtitleProviderFetch,
  type SubSource,
} from "./sub-source-contract";
import { resolveSubtitleDownloadUrl } from "./download-url";

const BASE = "https://api.subdl.com/api/v1";
const DL = "https://dl.subdl.com";
const LANG_OVERRIDES: Record<string, string> = { "pt-br": "BR", "es-419": "ES", zh: "ZH" };

type SubdlMatch = {
  match_score?: unknown;
  matchScore?: unknown;
  match_confidence?: unknown;
  confidence?: unknown;
  match_type?: unknown;
  matchType?: unknown;
  match_reasons?: unknown;
  reasons?: unknown;
  degraded?: unknown;
};

type SubdlFile = SubdlMatch & {
  file_n_id?: unknown;
  name?: unknown;
  release_name?: unknown;
  season?: unknown;
  episode?: unknown;
  language?: unknown;
  lang?: unknown;
  hi?: unknown;
  forced?: unknown;
  format?: unknown;
  size?: unknown;
  md5?: unknown;
  url?: unknown;
};

type SubdlRow = SubdlMatch & {
  n_id?: unknown;
  release_name?: unknown;
  releases?: unknown;
  name?: unknown;
  lang?: unknown;
  language?: unknown;
  url?: unknown;
  subtitlePage?: unknown;
  subtitle_page?: unknown;
  season?: unknown;
  episode?: unknown;
  hi?: unknown;
  forced?: unknown;
  format?: unknown;
  framerate?: unknown;
  fps?: unknown;
  full_season?: unknown;
  unpack_files?: unknown;
  downloads?: unknown;
  author?: unknown;
  uploader?: unknown;
  uploaded_at?: unknown;
  created_at?: unknown;
  rating?: unknown;
  production_type?: unknown;
  quality?: unknown;
  trusted?: unknown;
  machine_translated?: unknown;
  size?: unknown;
  md5?: unknown;
};

type SubdlResult = {
  imdb_id?: unknown;
  tmdb_id?: unknown;
};

type SubdlResponse = {
  status?: unknown;
  error?: unknown;
  results?: unknown;
  subtitles?: unknown;
};

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

function subdlLangCode(code: string): string {
  const normalized = normalizeLang(code);
  return (LANG_OVERRIDES[normalized] ?? normalized.split("-")[0]).toUpperCase();
}

function ratingOf(value: unknown): SubtitleRating | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return { score: value };
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const good = number(raw.good) ?? undefined;
  const bad = number(raw.bad) ?? undefined;
  const total =
    number(raw.total) ?? (good != null || bad != null ? (good ?? 0) + (bad ?? 0) : undefined);
  const explicitScore = number(raw.score);
  const score = explicitScore ?? (total && good != null ? good / total : undefined);
  return score != null || good != null || bad != null || total != null
    ? { score, good, bad, total }
    : undefined;
}

function productionTypeOf(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const labels: Record<string, string> = {
    "0": "standard",
    "1": "translation",
    "2": "original",
    "3": "machine-translated",
  };
  return labels[raw] ?? raw;
}

function fpsOf(row: SubdlRow): number | null {
  const explicit = number(row.fps);
  if (explicit != null) return explicit;
  const byCode: Record<number, number> = {
    2: 23.976,
    6: 23.98,
    5: 24,
    3: 25,
    4: 29.97,
    7: 30,
  };
  const code = number(row.framerate);
  return code == null ? null : (byCode[code] ?? null);
}

function providerMatchOf(value: SubdlMatch): ProviderMatchEvidence | undefined {
  const rawScore = number(value.match_score ?? value.matchScore);
  const score = rawScore == null ? undefined : rawScore > 1 ? rawScore / 100 : rawScore;
  const rawConfidence = text(value.match_confidence ?? value.confidence)?.toLowerCase();
  const confidence = (
    rawConfidence && ["exact", "high", "medium", "low", "unknown"].includes(rawConfidence)
      ? rawConfidence
      : undefined
  ) as ProviderMatchConfidence | undefined;
  const matchType = text(value.match_type ?? value.matchType)?.toLowerCase();
  const matchedBy =
    matchType && ["hash", "filename", "id", "episode", "title", "release"].includes(matchType)
      ? ([matchType] as ProviderMatchEvidence["matchedBy"])
      : undefined;
  const rawReasons = value.match_reasons ?? value.reasons;
  const reason = text(rawReasons);
  const reasons = Array.isArray(rawReasons)
    ? rawReasons.map(text).filter((item): item is string => item !== null)
    : reason
      ? [reason]
      : undefined;
  const degraded = typeof value.degraded === "boolean" ? value.degraded : undefined;
  return score != null || confidence || matchedBy || reasons || degraded != null
    ? { score, confidence, matchedBy, reasons, degraded }
    : undefined;
}

function releaseOf(row: SubdlRow, file?: SubdlFile): string | null {
  const direct = text(file?.release_name) ?? text(file?.name) ?? text(row.release_name);
  if (direct) return direct;
  if (Array.isArray(row.releases)) {
    const releases = row.releases
      .map(text)
      .filter((release): release is string => release !== null);
    if (releases.length) return releases.join(" ");
  }
  return text(row.name);
}

function returnedIdConfirmed(q: SubSearchQuery, results: SubdlResult[]): boolean {
  const first = results[0];
  if (!first) return false;
  const requestedImdb = imdbTt(q.imdbId);
  if (requestedImdb) return imdbTt(text(first.imdb_id) ?? undefined) === requestedImdb;
  if (q.tmdbId) return text(first.tmdb_id) === String(q.tmdbId);
  return false;
}

function effectiveEpisode(
  row: SubdlRow,
  file?: SubdlFile,
): { season: number | null; episode: number | null } {
  return {
    season: number(file?.season) ?? number(row.season),
    episode: number(file?.episode) ?? number(row.episode),
  };
}

function exactRequestedEpisode(row: SubdlRow, file: SubdlFile, q: SubSearchQuery): boolean {
  if (q.episode == null) return true;
  const episode = effectiveEpisode(row, file);
  if (episode.episode !== q.episode) return false;
  return q.season == null || episode.season === q.season;
}

function withConfirmedProviderEvidence(
  reported: ProviderMatchEvidence | undefined,
  idConfirmed: boolean,
  episodeConfirmed: boolean,
): ProviderMatchEvidence | undefined {
  const matchedBy = [...(reported?.matchedBy ?? [])];
  const reasons = [...(reported?.reasons ?? [])];
  if (idConfirmed && !matchedBy.includes("id")) {
    matchedBy.push("id");
    reasons.push("SubDL returned the requested provider ID");
  }
  if (episodeConfirmed && !matchedBy.includes("episode")) {
    matchedBy.push("episode");
    reasons.push("SubDL unpack metadata matched the requested episode");
  }
  if (!reported && matchedBy.length === 0) return undefined;
  return {
    ...reported,
    score: reported?.score ?? (episodeConfirmed && idConfirmed ? 0.85 : idConfirmed ? 0.7 : 0.6),
    confidence:
      reported?.confidence ??
      (episodeConfirmed && idConfirmed ? "high" : idConfirmed ? "medium" : "low"),
    matchedBy,
    reasons,
  };
}

function candidateFrom(
  row: SubdlRow,
  q: SubSearchQuery,
  wanted: Set<string>,
  idConfirmed: boolean,
  file?: SubdlFile,
): SourceSubCandidate | null {
  const rawUrl = text(file?.url) ?? text(row.url);
  const url = resolveSubtitleDownloadUrl(rawUrl, `${DL}/`);
  if (!url) return null;
  const lang = normalizeLang(
    text(file?.language) ?? text(file?.lang) ?? text(row.language) ?? text(row.lang) ?? "",
  );
  const episode = effectiveEpisode(row, file);
  const formatHint = text(file?.format) ?? text(row.format);
  const format = detectFormat(url, formatHint);
  const rawFilename = text(file?.name) ?? text(row.name);
  const productionType = productionTypeOf(row.production_type);
  const reportedMatch = providerMatchOf(file ?? row) ?? providerMatchOf(row);
  const page = text(row.subtitlePage) ?? text(row.subtitle_page);
  const author = text(row.author) ?? text(row.uploader);
  const archive = file == null && (format === "zip" || bool(row.full_season));
  const machineTranslated = bool(row.machine_translated) || productionType === "machine-translated";
  const episodeConfirmed =
    q.episode != null &&
    episode.episode === q.episode &&
    (q.season == null || episode.season === q.season);
  const providerMatch = withConfirmedProviderEvidence(reportedMatch, idConfirmed, episodeConfirmed);
  return {
    provider: "subdl",
    id:
      text(file?.file_n_id) ??
      text(file?.md5) ??
      text(row.n_id) ??
      rawUrl ??
      rawFilename ??
      `${lang}:${episode.season ?? 0}:${episode.episode ?? 0}`,
    url,
    pageUrl: page ? resolveSubtitleDownloadUrl(page, "https://subdl.com/") : null,
    lang,
    release: releaseOf(row, file),
    format,
    hearingImpaired: bool(file?.hi ?? row.hi),
    forced: bool(file?.forced ?? row.forced),
    foreignOnly: false,
    machineTranslated,
    fps: fpsOf(row),
    downloads: number(row.downloads) ?? 0,
    fromTrusted: bool(row.trusted),
    hashMatched: false,
    langConfirmed: wanted.size === 0 || wanted.has(lang),
    episodeConfirmed,
    idConfirmed,
    matchScore: 0,
    providerMatch,
    author,
    uploadedAt: text(row.uploaded_at) ?? text(row.created_at),
    rating: ratingOf(row.rating),
    productionType,
    releaseType: text(row.quality),
    archive,
    rawFilename,
    fileSize: number(file?.size) ?? number(row.size),
    checksum: text(file?.md5) ?? text(row.md5),
    season: episode.season,
    episode: episode.episode,
  };
}

export function buildSubdlSearchUrl(
  q: SubSearchQuery,
  apiKey: string | null | undefined,
): string | null {
  const params = new URLSearchParams({
    subs_per_page: "30",
    comment: "1",
    releases: "1",
    hi: "1",
    unpack: "1",
    client: "stremio",
  });
  if (apiKey?.trim()) params.set("api_key", apiKey.trim());
  const tt = imdbTt(q.imdbId);
  if (q.filename?.trim()) params.set("file_name", q.filename.trim());
  if (tt) params.set("imdb_id", tt);
  else if (q.tmdbId) params.set("tmdb_id", String(q.tmdbId));
  else if (q.title) params.set("film_name", q.title);
  else if (!q.filename?.trim()) return null;
  params.set("type", isSeries(q) ? "tv" : "movie");
  const langs = wantedLangs(q);
  if (langs.length) params.set("languages", langs.map(subdlLangCode).join(","));
  if (q.season != null) params.set("season_number", String(q.season));
  if (q.episode != null) params.set("episode_number", String(q.episode));
  if (q.year != null) params.set("year", String(q.year));
  return `${BASE}/subtitles?${params.toString()}`;
}

export async function searchSubdl(
  q: SubSearchQuery,
  ctx: ProviderCtx,
  fetchImpl: SubtitleProviderFetch = safeFetch,
): Promise<SourceSubCandidate[] | null> {
  const credential = ctx.credentialAuth?.subdl;
  const browserApiKey = browserSubtitleCredentialKey(ctx.subdlApiKey);
  if (!credential && !browserApiKey) return null;
  const url = buildSubdlSearchUrl(q, credential ? null : browserApiKey);
  if (!url) return [];
  const managed = credential ? subtitleCredentialRequest(url, credential) : undefined;
  if (credential && !managed) return null;

  let response: Response;
  try {
    response = await fetchImpl(managed?.url ?? url, {
      headers: {
        "User-Agent": ctx.userAgent,
        Accept: "application/json",
        ...managed?.headers,
      },
    });
  } catch {
    // The v1 key is a required query parameter; never log a fetch error that may echo the URL.
    return null;
  }
  if (response.status === 429) {
    markRateLimited("subdl", rateLimitDelaySeconds(response));
    return null;
  }
  if (!response.ok) {
    return null;
  }

  const data = (await response.json().catch(() => null)) as SubdlResponse | null;
  if (!data || data.status === false) return data?.error ? null : [];
  const rows = Array.isArray(data.subtitles) ? (data.subtitles as SubdlRow[]) : [];
  const results = Array.isArray(data.results) ? (data.results as SubdlResult[]) : [];
  const wanted = new Set(wantedLangs(q));
  const idConfirmed = returnedIdConfirmed(q, results);
  const out: SourceSubCandidate[] = [];

  for (const row of rows) {
    const unpacked = Array.isArray(row.unpack_files) ? (row.unpack_files as SubdlFile[]) : [];
    const matchingFiles = unpacked.filter((file) => exactRequestedEpisode(row, file, q));
    if (matchingFiles.length > 0) {
      for (const file of matchingFiles) {
        const candidate = candidateFrom(row, q, wanted, idConfirmed, file);
        if (candidate) out.push(candidate);
      }
      continue;
    }
    const candidate = candidateFrom(row, q, wanted, idConfirmed);
    if (candidate) out.push(candidate);
  }
  return out;
}

export const subdlSource: SubSource = {
  id: "subdl",
  cacheVersion: "subdl-v1-2026-09",
  supportsHash: false,
  supportsMovie: true,
  supportsTv: true,
  search: searchSubdl,
};
