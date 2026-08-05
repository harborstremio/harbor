import { dinfo } from "@/lib/debug";
import { normalizeLang, languageName, langScore } from "@/lib/subtitles/language";
import type { SubResult, SubSearchQuery } from "@/lib/subtitles/types";
import { podnapisiSource } from "./sub-source-podnapisi";
import { subdlSource } from "./sub-source-subdl";
import { gestdownSource } from "./sub-source-gestdown";
import { subsourceSource } from "./sub-source-subsource";

export type SubProviderId = "podnapisi" | "subdl" | "gestdown" | "subsource";
export type SubFormat = "srt" | "vtt" | "ass" | "ssa" | "sub" | "zip" | "unknown";

export type ProviderCtx = {
  userAgent: string;
  subdlApiKey?: string | null;
  subsourceApiKey?: string | null;
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
};

export interface SubSource {
  id: SubProviderId;
  supportsHash: boolean;
  supportsMovie: boolean;
  supportsTv: boolean;
  search(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null>;
}

export type AggregateSubResult = {
  exact: SourceSubCandidate[];
  ambiguous: SourceSubCandidate[];
  all: SourceSubCandidate[];
  degraded: SubProviderId[];
};

const POS_TTL_MS = 30 * 24 * 3600 * 1000;
const NEG_TTL_MS = 6 * 3600 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;

type CacheEntry = { expires: number; value: SourceSubCandidate[] };
type PersistHooks = {
  load?: (key: string) => Promise<CacheEntry | null>;
  save?: (key: string, entry: CacheEntry) => Promise<void>;
};

const memCache = new Map<string, CacheEntry>();
const rateLimitedUntil = new Map<SubProviderId, number>();
let persist: PersistHooks = {};

export function configureSubSourceCache(hooks: PersistHooks): void {
  persist = hooks;
}

export function wantedLangs(q: SubSearchQuery): string[] {
  return (q.langs ?? []).map(normalizeLang).filter(Boolean);
}

export function isSeries(q: SubSearchQuery): boolean {
  return q.type === "series" || (q.season != null && q.episode != null);
}

export function imdbTt(raw?: string): string | null {
  if (!raw) return null;
  const d = raw.replace(/^tt/i, "").replace(/\D/g, "");
  return d ? `tt${d.padStart(7, "0")}` : null;
}

export function detectFormat(url: string | null, hint?: string | null): SubFormat {
  const s = `${url ?? ""} ${hint ?? ""}`.toLowerCase();
  if (s.includes(".zip")) return "zip";
  if (s.includes(".vtt")) return "vtt";
  if (s.includes(".ass")) return "ass";
  if (s.includes(".ssa")) return "ssa";
  if (s.includes(".sub")) return "sub";
  if (s.includes("srt")) return "srt";
  return "unknown";
}

export function isRateLimited(id: SubProviderId): boolean {
  return Date.now() < (rateLimitedUntil.get(id) ?? 0);
}

export function markRateLimited(id: SubProviderId, seconds: number): void {
  rateLimitedUntil.set(id, Date.now() + Math.max(1, seconds) * 1000);
}

function queryKey(q: SubSearchQuery): string {
  return [
    q.videoHash ?? "",
    imdbTt(q.imdbId) ?? "",
    q.tmdbId ?? "",
    q.title ?? "",
    q.season ?? "",
    q.episode ?? "",
    wantedLangs(q).sort().join(","),
  ].join("|");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    const settle = (v: T | null) => {
      clearTimeout(t);
      resolve(v);
    };
    p.then(settle, () => settle(null));
  });
}

async function cachedSearch(
  source: SubSource,
  q: SubSearchQuery,
  ctx: ProviderCtx,
): Promise<SourceSubCandidate[] | null> {
  const key = `${source.id}|${queryKey(q)}`;
  const now = Date.now();
  if (!ctx.bypassCache) {
    const mem = memCache.get(key);
    if (mem && mem.expires > now) return mem.value;
    if (persist.load) {
      const p = await persist.load(key).catch(() => null);
      if (p && p.expires > now) {
        memCache.set(key, p);
        return p.value;
      }
    }
  }
  if (ctx.netAllowed === false) return null;
  if (isRateLimited(source.id)) return null;
  const fresh = await source.search(q, ctx).catch(() => null);
  if (fresh === null) return null;
  const entry: CacheEntry = { expires: now + (fresh.length ? POS_TTL_MS : NEG_TTL_MS), value: fresh };
  memCache.set(key, entry);
  if (persist.save) void persist.save(key, entry).catch(() => {});
  return fresh;
}

function scoreCandidate(c: SourceSubCandidate, preferred: string[]): number {
  let s = 0;
  if (c.hashMatched) s += 1000;
  if (c.idConfirmed) s += 200;
  if (c.episodeConfirmed) s += 150;
  if (c.langConfirmed) s += 100;
  s += langScore(c.lang, preferred) * 20;
  if (c.fromTrusted) s += 40;
  s += Math.min(c.downloads, 5000) * 0.01;
  if (c.hearingImpaired) s -= 4;
  if (c.foreignOnly) s -= 300;
  if (c.machineTranslated) s -= 200;
  return s;
}

function isExact(c: SourceSubCandidate): boolean {
  return (
    c.hashMatched &&
    c.langConfirmed &&
    c.lang.length > 0 &&
    !c.machineTranslated &&
    !c.foreignOnly
  );
}

function dedupCandidates(list: SourceSubCandidate[]): SourceSubCandidate[] {
  const seen = new Set<string>();
  const out: SourceSubCandidate[] = [];
  for (const c of list) {
    const key = `${c.provider}|${c.lang}|${c.url ?? c.id}|${c.release ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function partitionForGate(
  list: SourceSubCandidate[],
  preferred: string[],
): { exact: SourceSubCandidate[]; ambiguous: SourceSubCandidate[] } {
  const exact: SourceSubCandidate[] = [];
  const ambiguous: SourceSubCandidate[] = [];
  for (const c of list) {
    c.matchScore = scoreCandidate(c, preferred);
    (isExact(c) ? exact : ambiguous).push(c);
  }
  const byScore = (a: SourceSubCandidate, b: SourceSubCandidate) => b.matchScore - a.matchScore;
  exact.sort(byScore);
  ambiguous.sort(byScore);
  return { exact, ambiguous };
}

const ALL_SOURCES: SubSource[] = [podnapisiSource, subdlSource, gestdownSource, subsourceSource];

export function pickSources(q: SubSearchQuery, ctx: ProviderCtx): SubSource[] {
  const series = isSeries(q);
  return ALL_SOURCES.filter((s) => {
    if (ctx.enabled && ctx.enabled[s.id] === false) return false;
    if (s.id === "subdl" && !ctx.subdlApiKey) return false;
    if (s.id === "subsource" && !ctx.subsourceApiKey) return false;
    return series ? s.supportsTv : s.supportsMovie;
  });
}

export async function searchExtraSubSources(
  q: SubSearchQuery,
  ctx: ProviderCtx,
  sources?: SubSource[],
): Promise<AggregateSubResult> {
  const chosen = sources ?? pickSources(q, ctx);
  const timeout = ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tasks = chosen.map((s) => ({ id: s.id, p: withTimeout(cachedSearch(s, q, ctx), timeout) }));
  const settled = await Promise.all(tasks.map((t) => t.p));
  const all: SourceSubCandidate[] = [];
  const degraded: SubProviderId[] = [];
  settled.forEach((value, i) => {
    if (value === null) degraded.push(tasks[i].id);
    else all.push(...value);
  });
  const deduped = dedupCandidates(all);
  const { exact, ambiguous } = partitionForGate(deduped, wantedLangs(q));
  dinfo(`[sub-src] exact=${exact.length} ambiguous=${ambiguous.length} degraded=${degraded.join(",") || "none"}`);
  return { exact, ambiguous, all: deduped, degraded };
}

type ExtraSource = SubResult["source"] | SubProviderId;
export type ExtraSubResult = Omit<SubResult, "source"> & { source: ExtraSource };

export function toSubResult(c: SourceSubCandidate): ExtraSubResult {
  return {
    id: `${c.provider}:${c.id}`,
    url: c.url ?? "",
    lang: c.lang,
    langName: languageName(c.lang),
    source: c.provider,
    format: c.format === "zip" || c.format === "unknown" ? undefined : c.format,
    fps: c.fps ?? undefined,
    hearingImpaired: c.hearingImpaired || undefined,
    release: c.release ?? undefined,
    downloads: c.downloads || undefined,
    hash: c.hashMatched ? "moviehash" : undefined,
  };
}

export { podnapisiSource, subdlSource, gestdownSource, subsourceSource };
