import type { Bounds } from "./fp-gate";
import { DEFAULT_PRIOR, type SignalEvidence } from "./confidence";
import type { MediaMeta } from "./pipeline";
import { safeFetch } from "@/lib/safe-fetch";

export type RuntimeScope = "episode" | "series";
export type RuntimeSource = "tvdb" | "tmdb" | "anilist" | "kitsu" | "simkl";
export type RuntimeFact = { runtimeSec: number; source: RuntimeSource; scope: RuntimeScope; weight: number };
export type EpisodeRef = {
  kind: "movie" | "episode";
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
  anilistId?: number;
  malId?: number;
  kitsuId?: number;
  simklId?: number;
  season?: number;
  episode?: number;
  absoluteEpisode?: number;
  isAnime?: boolean;
  numbering?: "seasonal" | "absolute";
};
export type SubtitleShape = {
  firstCueStart: number;
  lastCueEnd: number;
  cueCount: number;
  sampleText: string;
  declaredLang?: string;
};
export type RuntimePrior = {
  expectedSec: number | null;
  tolSec: number;
  sources: RuntimeSource[];
  videoOk?: boolean;
  multipleOfVideo?: number;
};
export type LangGuess = { lang: string | null; script: string; confidence: number };
export type ClassCVerdict = {
  rawCorrect: number;
  supportsWrong: number;
  priorRuntimeOk?: boolean;
  hardRefuse: boolean;
  demandAsr: boolean;
  episodeAmbiguous: boolean;
  candidates: EpisodeRef[];
  reasons: string[];
};
export type MetaContext = { meta?: MediaMeta; durationSec: number; languages?: string[] };
export type MetaProviders = {
  tvdb?: (ref: EpisodeRef) => Promise<RuntimeFact[]>;
  tmdb?: (ref: EpisodeRef) => Promise<RuntimeFact[]>;
  anilist?: (ref: EpisodeRef) => Promise<RuntimeFact[]>;
  kitsu?: (ref: EpisodeRef) => Promise<RuntimeFact[]>;
  simkl?: (ref: EpisodeRef) => Promise<RuntimeFact[]>;
};
export type ProviderConfig = { tmdbApiKey?: string; netAllowed?: boolean };
const SOURCE_WEIGHT: Record<RuntimeSource, number> = {
  tvdb: 0.9,
  tmdb: 0.85,
  anilist: 0.6,
  kitsu: 0.6,
  simkl: 0.5,
};
const AUTHORING_FPS = [23.976, 24, 25, 29.97, 30];
const METADATA_RELIABILITY = 0.4;
const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "you", "that", "with", "this", "have", "what"],
  es: ["que", "los", "una", "por", "con", "para", "esta", "como"],
  fr: ["les", "vous", "est", "pas", "une", "des", "que", "pour"],
  de: ["und", "die", "der", "das", "ist", "nicht", "sie", "ein"],
  it: ["che", "non", "per", "una", "sono", "come", "questo", "delle"],
  pt: ["que", "nao", "uma", "voce", "com", "para", "isso", "esta"],
};
function weightedMedian(facts: RuntimeFact[]): number {
  const sorted = [...facts].sort((a, b) => a.runtimeSec - b.runtimeSec);
  const total = sorted.reduce((s, f) => s + f.weight, 0);
  let acc = 0;
  for (const f of sorted) {
    acc += f.weight;
    if (acc >= total / 2) return f.runtimeSec;
  }
  return sorted[sorted.length - 1]?.runtimeSec ?? 0;
}
export function consensusRuntime(facts: RuntimeFact[]): { expectedSec: number; tolSec: number } | null {
  const usable = facts.filter((f) => Number.isFinite(f.runtimeSec) && f.runtimeSec > 60);
  if (usable.length === 0) return null;
  const episodeScoped = usable.filter((f) => f.scope === "episode");
  const pool = episodeScoped.length > 0 ? episodeScoped : usable;
  const expectedSec = weightedMedian(pool);
  const tolSec = Math.min(360, Math.max(75, expectedSec * 0.12));
  return { expectedSec, tolSec };
}
export function runtimePrior(videoDurationSec: number, facts: RuntimeFact[]): RuntimePrior {
  const consensus = consensusRuntime(facts);
  const sources = [...new Set(facts.map((f) => f.source))];
  if (!consensus || videoDurationSec <= 0) {
    return { expectedSec: consensus?.expectedSec ?? null, tolSec: consensus?.tolSec ?? 0, sources };
  }
  const { expectedSec, tolSec } = consensus;
  const diff = Math.abs(videoDurationSec - expectedSec);
  let multiple: number | undefined;
  for (const m of [2, 3, 0.5, 1 / 3]) {
    if (Math.abs(videoDurationSec - expectedSec * m) <= Math.max(tolSec, expectedSec * m * 0.12)) multiple = m;
  }
  let videoOk: boolean | undefined;
  if (diff <= tolSec) videoOk = true;
  else if (diff <= expectedSec * 0.3 || multiple !== undefined) videoOk = undefined;
  else videoOk = false;
  return { expectedSec, tolSec, sources, videoOk, multipleOfVideo: multiple };
}
export function subtitleShapeFromCues(cues: Array<[number, number]>, cueText?: string[]): SubtitleShape {
  const starts = cues.map((c) => c[0]).filter((n) => Number.isFinite(n));
  const ends = cues.map((c) => c[1]).filter((n) => Number.isFinite(n));
  const sampleText = (cueText ?? []).join(" ").replace(/<[^>]*>/g, " ").slice(0, 4000);
  return {
    firstCueStart: starts.length ? Math.min(...starts) : 0,
    lastCueEnd: ends.length ? Math.max(...ends) : 0,
    cueCount: cues.length,
    sampleText,
  };
}
function scriptProfile(text: string): { script: string; frac: number } {
  const counts: Record<string, number> = { latin: 0, cjk: 0, cyrillic: 0, arabic: 0, hangul: 0, greek: 0, hebrew: 0 };
  let letters = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) counts.latin += 1;
    else if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x9fff)) counts.cjk += 1;
    else if (c >= 0xac00 && c <= 0xd7af) counts.hangul += 1;
    else if (c >= 0x400 && c <= 0x4ff) counts.cyrillic += 1;
    else if (c >= 0x600 && c <= 0x6ff) counts.arabic += 1;
    else if (c >= 0x370 && c <= 0x3ff) counts.greek += 1;
    else if (c >= 0x590 && c <= 0x5ff) counts.hebrew += 1;
    else continue;
    letters += 1;
  }
  let script = "latin";
  let max = 0;
  for (const [k, v] of Object.entries(counts)) if (v > max) { max = v; script = k; }
  return { script, frac: letters ? max / letters : 0 };
}
function latinLanguage(text: string): { lang: string | null; margin: number } {
  const words = text.toLowerCase().match(/[a-zà-ÿ]{2,}/g) ?? [];
  if (words.length < 20) return { lang: null, margin: 0 };
  const set = new Set(words);
  const score: Record<string, number> = {};
  for (const [lang, list] of Object.entries(STOPWORDS)) score[lang] = list.reduce((s, w) => s + (set.has(w) ? 1 : 0), 0);
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top[1] < 3) return { lang: null, margin: 0 };
  return { lang: top[0], margin: top[1] - (second?.[1] ?? 0) };
}
const SCRIPT_BY_LANG: Record<string, string> = {
  en: "latin", es: "latin", fr: "latin", de: "latin", it: "latin", pt: "latin", nl: "latin",
  ja: "cjk", zh: "cjk", ko: "hangul", ru: "cyrillic", uk: "cyrillic", ar: "arabic", el: "greek", he: "hebrew",
};
export function detectSubLanguage(sampleText: string): LangGuess {
  const text = sampleText.trim();
  if (text.length < 40) return { lang: null, script: "unknown", confidence: 0 };
  const prof = scriptProfile(text);
  if (prof.script !== "latin" && prof.frac >= 0.4) return { lang: null, script: prof.script, confidence: prof.frac };
  const lat = latinLanguage(text);
  if (lat.lang) return { lang: lat.lang, script: "latin", confidence: Math.min(1, 0.4 + lat.margin * 0.15) };
  return { lang: null, script: prof.script, confidence: 0 };
}
function langScriptMismatch(declared: string | undefined, guess: LangGuess): boolean {
  const want = SCRIPT_BY_LANG[(declared ?? "").slice(0, 2).toLowerCase()];
  if (!want || guess.script === "unknown") return false;
  return guess.confidence >= 0.4 && guess.script !== want;
}
export function episodeCandidates(ref: EpisodeRef, priorSeasonEpisodeCount?: number): EpisodeRef[] {
  if (ref.kind !== "episode") return [ref];
  const out: EpisodeRef[] = [{ ...ref, numbering: "seasonal" }];
  if (!ref.isAnime) return out;
  if (ref.absoluteEpisode !== undefined && ref.absoluteEpisode !== ref.episode)
    out.push({ ...ref, episode: ref.absoluteEpisode, numbering: "absolute" });
  if (priorSeasonEpisodeCount !== undefined && ref.episode !== undefined) {
    const abs = priorSeasonEpisodeCount + ref.episode;
    if (abs !== ref.episode) out.push({ ...ref, absoluteEpisode: abs, numbering: "absolute" });
  }
  if (ref.season !== undefined && ref.season > 1 && ref.episode !== undefined && ref.absoluteEpisode === undefined)
    out.push({ ...ref, numbering: "absolute" });
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.season}|${c.episode}|${c.absoluteEpisode}|${c.numbering}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function snapToGrid(ratio: number, grid: number[], tol: number): number | null {
  let best: number | null = null;
  let bestD = tol;
  for (const g of grid) {
    const d = Math.abs(ratio - g);
    if (d <= bestD) { bestD = d; best = g; }
  }
  return best;
}
export function fpsPrior(base: Bounds, opts: { videoFps?: number; subFps?: number }): Bounds {
  const { videoFps, subFps } = opts;
  if (!videoFps && !subFps) return base;
  const tol = Math.max(base.ratioSnapTol, 0.01);
  if (videoFps && subFps) {
    const expected = snapToGrid(videoFps / subFps, base.knownRatios, tol) ?? 1;
    if (Math.abs(expected - 1) <= base.ratioSnapTol)
      return { ...base, knownRatios: [1], maxFramerateDev: base.ratioSnapTol };
    return { ...base, knownRatios: [...new Set([1, expected])], maxFramerateDev: Math.abs(expected - 1) + base.ratioSnapTol };
  }
  const known = (videoFps ?? subFps) as number;
  const plausible = new Set<number>([1]);
  for (const a of AUTHORING_FPS) {
    const r = videoFps ? known / a : a / known;
    const snapped = snapToGrid(r, base.knownRatios, tol);
    if (snapped !== null) plausible.add(snapped);
  }
  const ratios = [...plausible];
  return { ...base, knownRatios: ratios.length > 1 ? ratios : base.knownRatios };
}
export function metadataBounds(ctx: MetaContext, base: Bounds, opts?: { subFps?: number }): Bounds {
  let bounds = fpsPrior(base, { videoFps: ctx.meta?.fps, subFps: opts?.subFps });
  const exp = ctx.meta?.expectedRuntimeSec;
  if (exp && ctx.durationSec > 0) {
    const diff = Math.abs(ctx.durationSec - exp);
    if (diff < exp * 0.02) bounds = { ...bounds, maxOffsetSec: Math.min(bounds.maxOffsetSec, 20) };
    else if (diff < exp * 0.08) bounds = { ...bounds, maxOffsetSec: Math.min(bounds.maxOffsetSec, 30) };
  }
  return bounds;
}
export function classifyContent(input: {
  videoDurationSec: number;
  sub: SubtitleShape;
  facts: RuntimeFact[];
  wantLangs?: string[];
  ref?: EpisodeRef;
}): ClassCVerdict {
  const { videoDurationSec, sub, facts } = input;
  const reasons: string[] = [];
  const prior = runtimePrior(videoDurationSec, facts);
  const candidates = input.ref ? episodeCandidates(input.ref) : [];
  const episodeAmbiguous = candidates.length > 1;
  const isAnime = input.ref?.isAnime === true;

  let wrong = 0;
  let hardRefuse = false;

  const span = Math.max(0, sub.lastCueEnd - sub.firstCueStart);
  const videoSpan = videoDurationSec > 0 ? videoDurationSec : prior.expectedSec ?? 0;
  if (span > 0 && videoSpan > 0) {
    const spanRatio = span / videoSpan;
    if (spanRatio > 1.15) {
      wrong = Math.max(wrong, Math.min(0.95, 0.6 + (spanRatio - 1.15)));
      hardRefuse = spanRatio > 1.35;
      reasons.push(`sub span ${span.toFixed(0)}s exceeds video ${videoSpan.toFixed(0)}s`);
    } else if (spanRatio < 0.55 && sub.cueCount >= 6) {
      const near = [0.5, 1 / 3].some((m) => Math.abs(spanRatio - m) < 0.08);
      wrong = Math.max(wrong, near ? 0.55 : 0.3 * (0.55 - spanRatio) * 4);
      reasons.push(near ? "sub spans a fraction of the video (split-episode pattern)" : "sub covers little of the video");
    }
  }

  if (sub.lastCueEnd > videoDurationSec + 30 && videoDurationSec > 0) {
    wrong = Math.max(wrong, 0.85);
    hardRefuse = hardRefuse || sub.lastCueEnd > videoDurationSec * 1.25;
    reasons.push(`last cue ${sub.lastCueEnd.toFixed(0)}s past video end ${videoDurationSec.toFixed(0)}s`);
  }

  const guess = detectSubLanguage(sub.sampleText);
  const want = (input.wantLangs ?? []).map((l) => l.slice(0, 2).toLowerCase());
  if (langScriptMismatch(sub.declaredLang, guess)) {
    wrong = Math.max(wrong, 0.8);
    hardRefuse = hardRefuse || guess.script !== "latin";
    reasons.push(`declared ${sub.declaredLang} but text looks ${guess.script}`);
  } else if (guess.lang && want.length > 0 && !want.includes(guess.lang) && guess.confidence >= 0.6) {
    wrong = Math.max(wrong, 0.45);
    reasons.push(`text looks ${guess.lang}, requested ${want.join("/")}`);
  }

  if (prior.videoOk === false) {
    wrong = Math.max(wrong, 0.35);
    reasons.push(`video ${videoDurationSec.toFixed(0)}s vs expected ${prior.expectedSec?.toFixed(0)}s`);
  }

  const demandAsr = isAnime || episodeAmbiguous || (wrong > 0.2 && wrong < 0.8);
  const rawCorrect = prior.videoOk === false ? 0.2 : prior.videoOk === true ? 0.6 : 0.5;
  return { rawCorrect, supportsWrong: Math.min(1, wrong), priorRuntimeOk: prior.videoOk, hardRefuse, demandAsr, episodeAmbiguous, candidates, reasons };
}
export function metadataEvidence(verdict: ClassCVerdict): SignalEvidence {
  return {
    tier: "metadata_prior",
    rawScore: Math.min(DEFAULT_PRIOR, verdict.rawCorrect),
    calibrator: { kind: "identity" },
    reliability: METADATA_RELIABILITY,
    independenceGroup: "meta",
    clearedFloor: false,
    supportsWrong: verdict.supportsWrong,
  };
}
function minutesToSec(m: unknown): number | null {
  const n = Number(m);
  return Number.isFinite(n) && n > 0 ? n * 60 : null;
}
async function getJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await safeFetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function tmdbFacts(ref: EpisodeRef, key: string): Promise<RuntimeFact[]> {
  const base = "https://api.themoviedb.org/3";
  const k = encodeURIComponent(key);
  const out: RuntimeFact[] = [];
  let tmdbId = ref.tmdbId;
  if (!tmdbId && ref.imdbId) {
    const found = await getJson(`${base}/find/${ref.imdbId}?api_key=${k}&external_source=imdb_id`);
    tmdbId = found?.movie_results?.[0]?.id ?? found?.tv_results?.[0]?.id;
  }
  if (!tmdbId) return out;
  if (ref.kind === "movie") {
    const m = await getJson(`${base}/movie/${tmdbId}?api_key=${k}`);
    const sec = minutesToSec(m?.runtime);
    if (sec) out.push({ runtimeSec: sec, source: "tmdb", scope: "episode", weight: SOURCE_WEIGHT.tmdb });
    return out;
  }
  if (ref.season !== undefined && ref.episode !== undefined) {
    const e = await getJson(`${base}/tv/${tmdbId}/season/${ref.season}/episode/${ref.episode}?api_key=${k}`);
    const sec = minutesToSec(e?.runtime);
    if (sec) out.push({ runtimeSec: sec, source: "tmdb", scope: "episode", weight: SOURCE_WEIGHT.tmdb });
  }
  if (out.length === 0) {
    const s = await getJson(`${base}/tv/${tmdbId}?api_key=${k}`);
    const arr = Array.isArray(s?.episode_run_time) ? s.episode_run_time : [];
    const sec = minutesToSec(arr.length ? arr[Math.floor(arr.length / 2)] : null);
    if (sec) out.push({ runtimeSec: sec, source: "tmdb", scope: "series", weight: SOURCE_WEIGHT.tmdb * 0.8 });
  }
  return out;
}
async function anilistFacts(ref: EpisodeRef): Promise<RuntimeFact[]> {
  if (!ref.anilistId && !ref.malId) return [];
  const query = "query($id:Int,$mal:Int){Media(id:$id,idMal:$mal,type:ANIME){duration format}}";
  const body = JSON.stringify({ query, variables: { id: ref.anilistId ?? null, mal: ref.malId ?? null } });
  const j = await getJson("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  const sec = minutesToSec(j?.data?.Media?.duration);
  return sec ? [{ runtimeSec: sec, source: "anilist", scope: "series", weight: SOURCE_WEIGHT.anilist }] : [];
}
export function defaultProviders(cfg: ProviderConfig): MetaProviders {
  const providers: MetaProviders = {};
  if (cfg.tmdbApiKey) providers.tmdb = (ref) => tmdbFacts(ref, cfg.tmdbApiKey as string);
  providers.anilist = (ref) => anilistFacts(ref);
  return providers;
}
export async function resolveRuntimeFacts(
  ref: EpisodeRef,
  providers: MetaProviders,
  cfg: ProviderConfig = {},
): Promise<RuntimeFact[]> {
  if (cfg.netAllowed === false) return [];
  const jobs: Array<Promise<RuntimeFact[]>> = [];
  const anime = ref.isAnime === true;
  if (providers.tvdb) jobs.push(providers.tvdb(ref).catch(() => []));
  if (providers.tmdb) jobs.push(providers.tmdb(ref).catch(() => []));
  if (anime && providers.anilist) jobs.push(providers.anilist(ref).catch(() => []));
  if (anime && providers.kitsu) jobs.push(providers.kitsu(ref).catch(() => []));
  if (providers.simkl) jobs.push(providers.simkl(ref).catch(() => []));
  const settled = await Promise.all(jobs);
  return settled.flat().filter((f) => Number.isFinite(f.runtimeSec) && f.runtimeSec > 60);
}
