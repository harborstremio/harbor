import { normalizeLang } from "@/lib/subtitles/language";
import type { ProviderMatchEvidence, SubSearchQuery, SubtitleRating } from "@/lib/subtitles/types";
import type { SubtitleDownloadAuth, SubtitleDownloadAuthKind } from "@/lib/subtitles/provider-auth";

export type SubProviderId = "podnapisi" | "subdl" | "gestdown" | "subsource";
export type SubFormat = "srt" | "vtt" | "ass" | "ssa" | "sub" | "zip" | "unknown";
export type SubtitleProviderFetch = typeof fetch;

export type ProviderCtx = {
  userAgent: string;
  subdlApiKey?: string | null;
  subsourceApiKey?: string | null;
  credentialAuth?: Partial<Record<"subdl" | "subsource", SubtitleDownloadAuth>>;
  enabled?: Partial<Record<SubProviderId, boolean>>;
  netAllowed?: boolean;
  timeoutMs?: number;
  bypassCache?: boolean;
};

export type SourceSubCandidate = {
  provider: SubProviderId;
  id: string;
  url: string | null;
  pageUrl: string | null;
  lang: string;
  release: string | null;
  format: SubFormat;
  hearingImpaired: boolean;
  forced?: boolean;
  foreignOnly: boolean;
  machineTranslated: boolean;
  fps: number | null;
  downloads: number;
  fromTrusted: boolean;
  hashMatched: boolean;
  langConfirmed: boolean;
  episodeConfirmed: boolean;
  idConfirmed: boolean;
  matchScore: number;
  providerMatch?: ProviderMatchEvidence;
  author?: string | null;
  uploadedAt?: string | null;
  rating?: SubtitleRating;
  productionType?: string | null;
  releaseType?: string | null;
  archive?: boolean;
  rawFilename?: string | null;
  fileSize?: number | null;
  checksum?: string | null;
  season?: number | null;
  episode?: number | null;
  downloadAuth?: SubtitleDownloadAuthKind;
};

export interface SubSource {
  id: SubProviderId;
  cacheVersion?: string;
  supportsHash: boolean;
  supportsMovie: boolean;
  supportsTv: boolean;
  search(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null>;
}

const rateLimitedUntil = new Map<SubProviderId, number>();

export function wantedLangs(q: SubSearchQuery): string[] {
  return (q.langs ?? []).map(normalizeLang).filter(Boolean);
}

export function isSeries(q: SubSearchQuery): boolean {
  return q.type === "series" || (q.season != null && q.episode != null);
}

export function imdbTt(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/^tt/i, "").replace(/\D/g, "");
  return digits ? `tt${digits.padStart(7, "0")}` : null;
}

export function detectFormat(url: string | null, hint?: string | null): SubFormat {
  const hinted = hint?.trim().toLowerCase() ?? "";
  if (/\bzip\b/.test(hinted)) return "zip";
  if (/\b(?:vtt|webvtt)\b/.test(hinted)) return "vtt";
  if (/\bass\b/.test(hinted)) return "ass";
  if (/\bssa\b/.test(hinted)) return "ssa";
  if (/\b(?:srt|subrip)\b/.test(hinted)) return "srt";
  if (/\bsub\b/.test(hinted)) return "sub";
  const path = (url ?? "").split(/[?#]/, 1)[0].toLowerCase();
  const extension = path.match(/\.([a-z0-9]+)$/)?.[1];
  if (extension && ["zip", "vtt", "ass", "ssa", "srt", "sub"].includes(extension)) {
    return extension as SubFormat;
  }
  return "unknown";
}

export function isRateLimited(id: SubProviderId): boolean {
  return Date.now() < (rateLimitedUntil.get(id) ?? 0);
}

export function markRateLimited(id: SubProviderId, seconds: number): void {
  rateLimitedUntil.set(id, Date.now() + Math.max(1, seconds) * 1000);
}

function cacheText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

export function subtitleSourceQueryKey(q: SubSearchQuery, providerVersion = "generic-v1"): string {
  return JSON.stringify({
    schema: 2,
    providerVersion,
    videoHash: cacheText(q.videoHash),
    videoSize: q.videoSize ?? null,
    imdbId: imdbTt(q.imdbId) ?? "",
    tmdbId: cacheText(q.tmdbId),
    stremioId: cacheText(q.stremioId),
    candidateIds: [...(q.candidateIds ?? [])].map(cacheText).filter(Boolean).sort(),
    type: q.type ?? "",
    title: cacheText(q.title),
    year: q.year ?? null,
    season: q.season ?? null,
    episode: q.episode ?? null,
    langs: wantedLangs(q).sort(),
    filename: cacheText(q.filename),
  });
}

export function subtitleSourceCacheKey(source: SubSource, q: SubSearchQuery): string {
  const version = source.cacheVersion ?? `${source.id}-v1`;
  return `${source.id}|${subtitleSourceQueryKey(q, version)}`;
}

export function rateLimitDelaySeconds(response: Response, fallback = 30): number {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }

  const reset =
    response.headers.get("ratelimit-reset") ?? response.headers.get("x-ratelimit-reset");
  if (reset) {
    const value = Number(reset);
    if (Number.isFinite(value) && value >= 0) {
      const epochSeconds = value > 10_000_000_000 ? value / 1000 : value;
      if (epochSeconds > 1_000_000_000) {
        return Math.max(1, Math.ceil(epochSeconds - Date.now() / 1000));
      }
      return Math.max(1, Math.ceil(value));
    }
  }
  return Math.max(1, fallback);
}
