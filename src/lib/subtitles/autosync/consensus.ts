import { dinfo, dwarn } from "@/lib/debug";
import { searchSubtitles } from "@/lib/subtitles/search";
import type { SubCue } from "@/lib/subtitles/parser";
import { prepareSubtitle } from "@/lib/subtitles/prepare";
import { providerSubtitleDownloadHeaders } from "@/lib/subtitles/provider-auth";
import { normalizeLang } from "@/lib/subtitles/language";
import { normalizeArabicForMatch } from "@/lib/subtitles/arabic-normalize";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import type { SubResult, SubSearchQuery } from "@/lib/subtitles/types";
import type { Addon } from "@/lib/addons";
import type { PipelineContext, ConsensusResult } from "./pipeline";

export type { ConsensusResult };

export type ConsensusConfig = {
  providers?: { wyzie?: boolean; addons?: boolean; opensubtitles?: boolean };
  addons?: Addon[];
  preferredLangs?: string[];
  netAllowed?: boolean;
  maxCandidates?: number;
  fetchTimeoutMs?: number;
  authKey?: string | null;
  gatherAddons?: typeof gatherSubtitleAddons;
};

export type ConsensusPort = (ctx: PipelineContext) => Promise<ConsensusResult | null>;

const MIN_LINE_LEN = 3;
const SHINGLE_K = 3;
const MIN_LINES = 20;
const CLUSTER_THRESHOLD = 0.2;
const MIN_ANCHORS = 6;
const MAX_ANCHORS = 200;
const ANCHOR_MAD_TOL = 0.6;
const MAX_ANCHOR_DELTA = 90;
const DEFAULT_MAX_CANDIDATES = 10;
const FETCH_TIMEOUT_MS = 9000;

const TAG_RX = /<[^>]+>|\{[^}]*\}/g;
const HI_RX = /\[[^\]]*\]|\([^)]*\)/g;
const SPEAKER_RX = /^[\p{Lu}0-9][\p{Lu}0-9 .,'#/-]{0,28}:\s/u;
const URL_RX = /https?:\/\/\S+|www\.\S+/g;
const LEAD_DASH_RX = /^\s*[-–—>]+\s*/;
const PUNCT_RX = /[^\p{L}\p{N}\s]/gu;

export function normalizeLine(raw: string, language?: string): string {
  let s = raw.replace(/\r/g, " ").replace(TAG_RX, " ").replace(HI_RX, " ");
  s = s.replace(URL_RX, " ").replace(/^\s+/, "");
  s = s.replace(LEAD_DASH_RX, "");
  s = s.replace(SPEAKER_RX, "");
  if (normalizeLang(language ?? "") === "ar") return normalizeArabicForMatch(s);
  s = s.toLowerCase();
  s = s.replace(PUNCT_RX, " ");
  return s.replace(/\s+/g, " ").trim();
}

export type DialogueSequence = { lines: string[]; times: number[] };

export function dialogueSequence(cues: SubCue[], language?: string): DialogueSequence {
  const lines: string[] = [];
  const times: number[] = [];
  for (const c of cues) {
    if (!Number.isFinite(c.start)) continue;
    const n = normalizeLine(String(c.text ?? "").replace(/\n+/g, " "), language);
    if (n.length >= MIN_LINE_LEN) {
      lines.push(n);
      times.push(c.start);
    }
  }
  return { lines, times };
}

export function wordShingles(lines: string[]): Set<string> {
  const words = lines.join(" ").split(" ").filter(Boolean);
  const set = new Set<string>();
  if (words.length < SHINGLE_K) {
    for (const w of words) set.add(w);
    return set;
  }
  for (let i = 0; i + SHINGLE_K <= words.length; i += 1) {
    set.add(words.slice(i, i + SHINGLE_K).join(" "));
  }
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (big.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

type Candidate = {
  url: string;
  lang: string;
  source: string;
  format?: SubResult["format"];
  downloads: number;
  hashMatch: boolean;
  isUser: boolean;
  seq: DialogueSequence;
  shingles: Set<string>;
};

type Cluster = { members: Candidate[]; sources: Set<string> };

function trustScore(c: Candidate): number {
  const src = c.source === "opensubtitles" || c.source === "addon" ? 2 : 1;
  return (c.hashMatch ? 1_000_000 : 0) + c.downloads + src;
}

function clusterCandidates(cands: Candidate[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const cand of cands) {
    let joined: Cluster | null = null;
    for (const cl of clusters) {
      if (cl.members.some((m) => jaccard(m.shingles, cand.shingles) >= CLUSTER_THRESHOLD)) {
        joined = cl;
        break;
      }
    }
    if (joined) {
      joined.members.push(cand);
      if (!cand.isUser) joined.sources.add(cand.source);
    } else {
      clusters.push({ members: [cand], sources: cand.isUser ? new Set() : new Set([cand.source]) });
    }
  }
  return clusters;
}

function pickMajority(clusters: Cluster[]): Cluster | null {
  let best: Cluster | null = null;
  for (const cl of clusters) {
    if (!best) {
      best = cl;
      continue;
    }
    const dv = cl.sources.size - best.sources.size;
    if (dv > 0 || (dv === 0 && cl.members.length > best.members.length)) best = cl;
  }
  return best;
}

function uniqueLineTimes(c: Candidate): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of c.seq.lines) counts.set(l, (counts.get(l) ?? 0) + 1);
  const map = new Map<string, number>();
  c.seq.lines.forEach((l, i) => {
    if (counts.get(l) === 1) map.set(l, c.seq.times[i]);
  });
  return map;
}

function medianAbsDev(xs: number[]): { median: number; mad: number } {
  if (xs.length === 0) return { median: 0, mad: Infinity };
  const sorted = [...xs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const dev = sorted.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  return { median, mad: dev[Math.floor(dev.length / 2)] };
}

function sharedDeltas(a: Map<string, number>, b: Map<string, number>): number[] {
  const out: number[] = [];
  for (const [line, ta] of a) {
    const tb = b.get(line);
    if (tb !== undefined && Math.abs(ta - tb) <= MAX_ANCHOR_DELTA) out.push(ta - tb);
  }
  return out;
}

function corroboratedReference(peers: Candidate[], requireCrossSource: boolean): Candidate | null {
  const ranked = [...peers].sort((x, y) => trustScore(y) - trustScore(x));
  const times = new Map<Candidate, Map<string, number>>();
  const timesOf = (c: Candidate) => {
    let t = times.get(c);
    if (!t) {
      t = uniqueLineTimes(c);
      times.set(c, t);
    }
    return t;
  };
  for (const ref of ranked) {
    const refTimes = timesOf(ref);
    for (const other of ranked) {
      if (other === ref) continue;
      if (requireCrossSource && other.source === ref.source) continue;
      if (!requireCrossSource && other.url === ref.url) continue;
      const deltas = sharedDeltas(refTimes, timesOf(other));
      if (deltas.length >= MIN_ANCHORS && medianAbsDev(deltas).mad <= ANCHOR_MAD_TOL) return ref;
    }
  }
  return null;
}

function buildAnchors(user: Candidate, ref: Candidate): Array<[number, number]> | null {
  const refTimes = uniqueLineTimes(ref);
  const userTimes = uniqueLineTimes(user);
  const raw: Array<[number, number]> = [];
  for (const [line, ut] of userTimes) {
    const rt = refTimes.get(line);
    if (rt !== undefined) raw.push([ut, rt]);
  }
  if (raw.length < MIN_ANCHORS) return null;
  raw.sort((p, q) => p[0] - q[0]);
  const step = raw.length > MAX_ANCHORS ? raw.length / MAX_ANCHORS : 1;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < raw.length; i += step) out.push(raw[Math.floor(i)]);
  return out.length >= MIN_ANCHORS ? out : null;
}

function unknown(agreement = 0): ConsensusResult {
  return { verdict: "unknown", bestCandidate: null, agreement, textAnchors: null };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function buildQuery(ctx: PipelineContext, langs: string[]): SubSearchQuery {
  const isSeries = ctx.meta?.season !== undefined && ctx.meta?.episode !== undefined;
  return {
    imdbId: ctx.meta?.imdbId,
    tmdbId: ctx.meta?.tmdbId != null ? String(ctx.meta.tmdbId) : undefined,
    type: isSeries ? "series" : "movie",
    season: ctx.meta?.season,
    episode: ctx.meta?.episode,
    langs,
    videoHash: ctx.moviehash,
    videoSize: ctx.moviebytesize,
  };
}

export async function prepareConsensusCandidate(
  r: SubResult,
  timeoutMs: number,
  ctx: PipelineContext,
): Promise<Candidate | null> {
  if (!r.url) return null;
  return withTimeout(
    (async () => {
      const prepared = await prepareSubtitle({
        url: r.url,
        format: r.format,
        encoding: r.encoding,
        language: r.lang,
        season: ctx.meta?.season,
        episode: ctx.meta?.episode,
        release: r.release ?? undefined,
        filename: r.rawFilename ?? undefined,
        durationSec: ctx.durationSec,
        requestHeaders: providerSubtitleDownloadHeaders(r.downloadAuth, r.url),
      });
      try {
        if (prepared.cues.length < MIN_LINES) return null;
        const seq = dialogueSequence(prepared.cues, r.lang);
        if (seq.lines.length < MIN_LINES) return null;
        return {
          url: r.url,
          lang: r.lang,
          source: r.source,
          format: prepared.format,
          downloads: r.downloads ?? 0,
          hashMatch: typeof r.hash === "string" && r.hash.length > 0,
          isUser: false,
          seq,
          shingles: wordShingles(seq.lines),
        };
      } finally {
        prepared.cleanup();
      }
    })(),
    timeoutMs,
  );
}

function userCandidate(ctx: PipelineContext): Candidate | null {
  const text = ctx.cueText;
  if (!Array.isArray(text) || text.length < MIN_LINES) return null;
  const cues: SubCue[] = ctx.cues.map((c, i) => ({ start: c[0], end: c[1], text: text[i] ?? "" }));
  const language = ctx.subtitleLanguage ?? ctx.languages[0] ?? "";
  const seq = dialogueSequence(cues, language);
  if (seq.lines.length < MIN_LINES) return null;
  return {
    url: "",
    lang: ctx.languages[0] ?? "",
    source: "user",
    downloads: 0,
    hashMatch: false,
    isUser: true,
    seq,
    shingles: wordShingles(seq.lines),
  };
}

async function gatherCandidates(ctx: PipelineContext, cfg: ConsensusConfig): Promise<SubResult[]> {
  const providers = cfg.providers ?? {};
  const langs =
    cfg.preferredLangs && cfg.preferredLangs.length > 0 ? cfg.preferredLangs : ctx.languages;
  let addons = cfg.addons;
  if (!addons && providers.addons !== false) {
    const gather = cfg.gatherAddons ?? gatherSubtitleAddons;
    addons = (await withTimeout(gather(cfg.authKey ?? null), FETCH_TIMEOUT_MS)) ?? [];
  }
  const results = await withTimeout(
    searchSubtitles(buildQuery(ctx, langs), {
      providers,
      addons: addons ?? [],
      preferredLangs: langs,
    }),
    cfg.fetchTimeoutMs ?? FETCH_TIMEOUT_MS,
  );
  return results ?? [];
}

export async function runConsensus(
  ctx: PipelineContext,
  cfg: ConsensusConfig,
): Promise<ConsensusResult | null> {
  if (cfg.netAllowed === false) return null;
  const user = userCandidate(ctx);
  if (!user) return null;
  const targetLang = normalizeLang(ctx.languages[0] ?? "");

  let results: SubResult[];
  try {
    results = await gatherCandidates(ctx, cfg);
  } catch (e) {
    dwarn("[consensus] search failed", e);
    return unknown();
  }

  const filtered = results.filter((r) => !targetLang || normalizeLang(r.lang) === targetLang);
  const capped = filtered.slice(0, cfg.maxCandidates ?? DEFAULT_MAX_CANDIDATES);
  const timeoutMs = cfg.fetchTimeoutMs ?? FETCH_TIMEOUT_MS;
  const settled = await Promise.all(
    capped.map((result) => prepareConsensusCandidate(result, timeoutMs, ctx).catch(() => null)),
  );
  const externals = settled.filter((c): c is Candidate => c !== null);

  const answeringSources = new Set(externals.map((c) => c.source));
  if (answeringSources.size < 2) {
    if (externals.length >= 2) {
      const soloClusters = clusterCandidates([user, ...externals]);
      const soloMajority = pickMajority(soloClusters);
      const soloPeers = soloMajority ? soloMajority.members.filter((m) => !m.isUser) : [];
      if (soloMajority && soloMajority.members.includes(user) && soloPeers.length >= 2) {
        const ref = corroboratedReference(soloPeers, false);
        const textAnchors = ref ? buildAnchors(user, ref) : null;
        const agreement = soloPeers.length / externals.length;
        dinfo(
          `[consensus] single-source fallback agreement=${agreement.toFixed(2)} peers=${soloPeers.length} anchors=${textAnchors?.length ?? 0}`,
        );
        return { verdict: "right", bestCandidate: null, agreement, textAnchors };
      }
    }
    dinfo(`[consensus] only ${answeringSources.size} source(s) answered, unknown`);
    return unknown();
  }

  const clusters = clusterCandidates([user, ...externals]);
  const majority = pickMajority(clusters);
  if (!majority || majority.sources.size < 2) {
    dinfo("[consensus] no majority with >=2 sources, unknown");
    return unknown();
  }

  const agreement = majority.sources.size / answeringSources.size;
  const userInMajority = majority.members.includes(user);
  const peers = majority.members.filter((m) => !m.isUser);

  if (!userInMajority) {
    const best = [...peers].sort((a, b) => trustScore(b) - trustScore(a))[0] ?? null;
    dinfo(
      `[consensus] verdict=wrong agreement=${agreement.toFixed(2)} sources=${majority.sources.size}`,
    );
    return {
      verdict: "wrong",
      bestCandidate: best
        ? { url: best.url, lang: best.lang, source: best.source, format: best.format }
        : null,
      agreement,
      textAnchors: null,
    };
  }

  const ref = corroboratedReference(peers, true);
  const textAnchors = ref ? buildAnchors(user, ref) : null;
  dinfo(
    `[consensus] verdict=right agreement=${agreement.toFixed(2)} sources=${majority.sources.size} anchors=${textAnchors?.length ?? 0}`,
  );
  return { verdict: "right", bestCandidate: null, agreement, textAnchors };
}

export function createConsensusPort(cfg: ConsensusConfig): ConsensusPort {
  return (ctx) => runConsensus(ctx, cfg);
}
