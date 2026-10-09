import type { CrowdResult, PipelineContext, TierPorts } from "./pipeline";
import type { PiecewiseSegment, SyncTransform } from "./fp-gate";
import { safeFetch } from "@/lib/safe-fetch";
import { dwarn, dinfo } from "@/lib/debug";
import { HARBOR_SYNC_BASE } from "@/lib/config/endpoints";

export type CrowdConfig = {
  baseUrl: string;
  optOut?: boolean;
  clientId?: string;
  appVersion?: string;
  userAgent?: string;
  netAllowed?: boolean;
  timeoutMs?: number;
};

export type CrowdReportExtra = { chromaprint?: string | null; subFileHash?: string | null };

export const DEFAULT_COMMUNITY_SYNC_URL = HARBOR_SYNC_BASE;

type LookupResponse = {
  offsetMs?: number;
  ratio?: number;
  anchors?: Array<[number, number]> | null;
  confidence?: number;
  tier?: string;
  votes?: number;
};

const MIN_CUES = 8;
const LOOKUP_TIMEOUT_MS = 4000;
const REPORT_TIMEOUT_MS = 8000;
const MIN_REPORT_CONFIDENCE = 0.85;
const MIN_DURATION_MS = 60000;
const MAX_OFFSET_MS = 60000;
const RATIO_LO = 0.8;
const RATIO_HI = 1.25;
const POS_TTL_MS = 10 * 60 * 1000;
const NEG_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { expires: number; value: CrowdResult | null };
const memCache = new Map<string, CacheEntry>();

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function apiUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + path;
}

function jsonHeaders(cfg: CrowdConfig, hasBody: boolean): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (hasBody) h["Content-Type"] = "application/json";
  if (cfg.userAgent) h["User-Agent"] = cfg.userAgent;
  return h;
}

async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), Math.max(1, timeoutMs));
  try {
    return await safeFetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    dwarn("[crowd-db] fetch failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function subTimelineHash(cues: Array<[number, number]>): Promise<string | null> {
  if (!Array.isArray(cues)) return null;
  const usable = cues.filter(
    (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
  );
  if (usable.length < MIN_CUES) return null;
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const norm = usable
    .map((c) => [Math.round(c[0] * 100) * 10, Math.round(c[1] * 100) * 10] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((c) => `${c[0]}-${c[1]}`)
    .join(";");
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    dwarn("[crowd-db] hash failed", e);
    return null;
  }
}

function toTier(v: unknown): "A" | "B" | "C" | null {
  return v === "A" || v === "B" || v === "C" ? v : null;
}

function anchorsToTransform(
  offsetMs: number,
  ratio: number,
  anchors: Array<[number, number]> | null,
): SyncTransform {
  const affine: SyncTransform = { kind: "affine", offsetSec: offsetMs / 1000, ratio };
  if (!Array.isArray(anchors) || anchors.length < 2) return affine;
  const pts = anchors
    .filter((a) => Array.isArray(a) && Number.isFinite(a[0]) && Number.isFinite(a[1]))
    .map((a) => [Number(a[0]), Number(a[1])] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) return affine;
  const segments: PiecewiseSegment[] = [];
  const first = pts[0];
  if (first[0] > 0)
    segments.push({ fromSec: 0, toSec: first[0] / 1000, offsetSec: first[1] / 1000, ratio: 1 });
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [ai, oi] = pts[i];
    const [aj, oj] = pts[i + 1];
    if (aj <= ai) continue;
    const slope = (oj - oi) / (aj - ai);
    segments.push({
      fromSec: ai / 1000,
      toSec: aj / 1000,
      offsetSec: (oi - slope * ai) / 1000,
      ratio: 1 + slope,
    });
  }
  const last = pts[pts.length - 1];
  segments.push({ fromSec: last[0] / 1000, toSec: Infinity, offsetSec: last[1] / 1000, ratio: 1 });
  return segments.length > 0 ? { kind: "piecewise", segments } : affine;
}

function toCrowdResult(b: LookupResponse | null): CrowdResult | null {
  if (!b) return null;
  const tier = toTier(b.tier);
  if (!tier) return null;
  const offsetMs = Number(b.offsetMs);
  const ratio = b.ratio == null ? 1 : Number(b.ratio);
  const confidence = clamp01(Number(b.confidence));
  if (!Number.isFinite(offsetMs) || !Number.isFinite(ratio) || !(confidence > 0)) return null;
  const votes = Math.max(0, Math.round(Number(b.votes ?? 0)));
  const transform = anchorsToTransform(offsetMs, ratio, b.anchors ?? null);
  return { transform, rawScore: confidence, votes, verified: true, tier };
}

export async function lookupCrowdSync(
  ctx: PipelineContext,
  cfg: CrowdConfig,
): Promise<CrowdResult | null> {
  if (cfg.optOut || !cfg.baseUrl || cfg.netAllowed === false) return null;
  const sub = await subTimelineHash(ctx.cues);
  if (!sub) return null;
  const durMs = Math.round(ctx.durationSec * 1000);
  const now = Date.now();
  const cacheKey = `${cfg.baseUrl}|${sub}|${durMs}|${ctx.moviehash ?? ""}`;
  const cached = memCache.get(cacheKey);
  if (cached && cached.expires > now) return cached.value;
  const params = new URLSearchParams({ sub });
  if (Number.isFinite(durMs) && durMs > 0) params.set("dur", String(durMs));
  if (ctx.moviehash) params.set("mh", ctx.moviehash);
  const res = await timedFetch(
    apiUrl(cfg.baseUrl, `/api/v1/lookup?${params.toString()}`),
    { method: "GET", headers: jsonHeaders(cfg, false) },
    cfg.timeoutMs ?? LOOKUP_TIMEOUT_MS,
  );
  if (!res) return null;
  let value: CrowdResult | null = null;
  if (res.status !== 204 && res.ok) {
    try {
      value = toCrowdResult((await res.json()) as LookupResponse);
    } catch {
      value = null;
    }
  }
  memCache.set(cacheKey, { expires: now + (value ? POS_TTL_MS : NEG_TTL_MS), value });
  if (value) dinfo(`[crowd-db] hit tier=${value.tier} votes=${value.votes}`);
  return value;
}

export function createCrowdDbPort(cfg: CrowdConfig): NonNullable<TierPorts["crowdDb"]> {
  return (ctx) => lookupCrowdSync(ctx, cfg);
}

export function crowdConfigFromSettings(
  settings: { communitySyncUrl?: string; communitySyncOptOut?: boolean },
  extra: { clientId?: string; appVersion?: string; userAgent?: string } = {},
): CrowdConfig | null {
  const baseUrl = (settings.communitySyncUrl ?? "").trim() || DEFAULT_COMMUNITY_SYNC_URL;
  if (!baseUrl) return null;
  return {
    baseUrl,
    optOut: settings.communitySyncOptOut === true,
    clientId: extra.clientId,
    appVersion: extra.appVersion,
    userAgent: extra.userAgent ?? "Harbor autosync",
  };
}

function affineForReport(t: SyncTransform): { offsetMs: number; ratio: number } | null {
  if (t.kind !== "affine") return null;
  const offsetMs = Math.round(t.offsetSec * 1000);
  if (!Number.isFinite(offsetMs) || Math.abs(offsetMs) > MAX_OFFSET_MS) return null;
  if (!Number.isFinite(t.ratio) || t.ratio < RATIO_LO || t.ratio > RATIO_HI) return null;
  return { offsetMs, ratio: t.ratio };
}

export async function reportVerifiedSync(
  ctx: PipelineContext,
  transform: SyncTransform,
  confidence: number,
  cfg: CrowdConfig,
  extra: CrowdReportExtra = {},
): Promise<boolean> {
  if (cfg.optOut || !cfg.baseUrl || cfg.netAllowed === false) return false;
  if (!Number.isFinite(confidence) || confidence < MIN_REPORT_CONFIDENCE) return false;
  const durationMs = Math.round(ctx.durationSec * 1000);
  if (!Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS) return false;
  const affine = affineForReport(transform);
  if (!affine) return false;
  const sub = await subTimelineHash(ctx.cues);
  if (!sub) return false;
  const body: Record<string, unknown> = {
    subTimelineHash: sub,
    durationMs,
    offsetMs: affine.offsetMs,
    ratio: affine.ratio,
    confidence: Math.min(1, confidence),
  };
  const mh = ctx.moviehash && /^[0-9a-f]{16}$/.test(ctx.moviehash) ? ctx.moviehash : null;
  if (mh) body.moviehash = mh;
  const imdb = ctx.meta?.imdbId && /^tt\d{6,9}$/.test(ctx.meta.imdbId) ? ctx.meta.imdbId : null;
  if (imdb) body.imdbId = imdb;
  if (extra.chromaprint) body.chromaprint = extra.chromaprint;
  if (extra.subFileHash && /^[0-9a-f]{16,128}$/.test(extra.subFileHash))
    body.subFileHash = extra.subFileHash;
  if (cfg.clientId) body.clientId = cfg.clientId;
  if (cfg.appVersion) body.appVersion = cfg.appVersion;
  const res = await timedFetch(
    apiUrl(cfg.baseUrl, "/api/v1/report"),
    { method: "POST", headers: jsonHeaders(cfg, true), body: JSON.stringify(body) },
    cfg.timeoutMs ?? REPORT_TIMEOUT_MS,
  );
  if (!res || !res.ok) return false;
  try {
    const j = (await res.json()) as { accepted?: boolean };
    if (j.accepted === true) {
      dinfo("[crowd-db] report accepted");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function reportCrowdFeedback(
  cues: Array<[number, number]>,
  good: boolean,
  cfg: CrowdConfig,
): Promise<boolean> {
  if (cfg.optOut || !cfg.baseUrl || cfg.netAllowed === false) return false;
  const sub = await subTimelineHash(cues);
  if (!sub) return false;
  const body: Record<string, unknown> = { subTimelineHash: sub, good };
  if (cfg.clientId) body.clientId = cfg.clientId;
  const res = await timedFetch(
    apiUrl(cfg.baseUrl, "/api/v1/feedback"),
    { method: "POST", headers: jsonHeaders(cfg, true), body: JSON.stringify(body) },
    cfg.timeoutMs ?? REPORT_TIMEOUT_MS,
  );
  if (!res || !res.ok) return false;
  try {
    const j = (await res.json()) as { ok?: boolean };
    return j.ok === true;
  } catch {
    return false;
  }
}
