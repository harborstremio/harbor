import type { SignalEvidence } from "./confidence";
import type { GateDecision, Outcome } from "./fp-gate";

export type AdversarialScenario =
  | "laugh_track" | "musical_score" | "silent_film" | "sports_crowd"
  | "sparse_dialog" | "anime_numbering" | "dub_mismatch" | "crowd_poison";

export type AcousticFeatures = {
  speechFrac: number; gatedFrac: number; intervalCount: number;
  windowSec: number; meanFlatness?: number; meanHarmonicity?: number;
};
export type CorrelationFeatures = { ncc: number; z: number; dominance: number; coverage: number };
export type SubtitleTextFeatures = {
  cueCount: number; spanSec: number; laughMarkerCount: number;
  musicNoteFrac: number; sdhMarkerFrac: number; cueDensityPerMin: number;
};
export type MetaFeatures = {
  genres?: string[]; year?: number; isAnime?: boolean; season?: number; episodeAmbiguous?: boolean;
};
export type AudioMismatchFeatures = {
  risky: boolean; hasInLanguageVerifier: boolean; kind: "none" | "translated-sub" | "unknown-language";
};
export type CrowdObservation = {
  present: boolean; tier: "A" | "B" | "C"; votes: number; dispersionMs: number;
  offsetMs: number; independentRan: boolean; independentOffsetMs?: number;
};
export type AdversarialContext = {
  acoustic?: AcousticFeatures; correlation?: CorrelationFeatures; subtitle?: SubtitleTextFeatures;
  meta?: MetaFeatures; audio?: AudioMismatchFeatures; crowd?: CrowdObservation;
};

export type GuardEffect = {
  ceiling: Outcome; reliabilityMul: number; affectsGroups: string[]; supportsWrongAdd: number;
  requireIndependentAgreement: boolean; requireMlVad: boolean; demandAsr: boolean;
};
export type GuardVerdict = GuardEffect & {
  scenario: AdversarialScenario; fired: boolean; severity: number; reason: string;
};
export type AdversarialAssessment = {
  verdicts: GuardVerdict[]; fired: AdversarialScenario[]; ceiling: Outcome;
  reliabilityMulByGroup: Record<string, number>; supportsWrongByGroup: Record<string, number>;
  requireIndependentAgreement: boolean; requireMlVad: boolean; demandAsr: boolean; reasons: string[];
};
export type GuardObservations = {
  agreeingSignals: number; exactIdentity: boolean; asrRan: boolean; asrWordMatch?: number;
};

export const GUARD_LIMITS = {
  laughSpeechFrac: 0.62, laughDominanceFloor: 1.6, laughMarkerMin: 3,
  musicalSpeechFrac: 0.7, musicalDominanceFloor: 1.8, musicNoteFracMin: 0.15,
  gatedElevated: 0.14, gatedMusic: 0.2, flatnessTonal: 0.5, flatnessNoisy: 0.55, harmonicityLow: 0.25,
  silentSpeechFrac: 0.06, minSupportIntervals: 12, sportsSpeechFrac: 0.85, sportsZWeak: 8, sparseCueDensity: 5,
  crowdMinVotesClient: 4, crowdDispersionWarnMs: 180, crowdAgreeTolMs: 500, crowdGrossMs: 2000,
};

const RANK: Record<Outcome, number> = { refuse: 0, offer: 1, apply: 2 };
const lower = (a: Outcome, b: Outcome): Outcome => (RANK[b] < RANK[a] ? b : a);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const pct = (v: number): number => Math.round(clamp01(v) * 100);

function hasGenre(meta: MetaFeatures | undefined, needles: string[]): boolean {
  if (!meta?.genres) return false;
  const g = meta.genres.map((x) => x.toLowerCase());
  return needles.some((n) => g.some((x) => x.includes(n)));
}

const LAUGH_RE = /(\(|\[)\s*(laugh|chuckl|applau|cheer|audience|crowd laugh)/i;
const MUSIC_RE = /[♪♫♬♩]|(\(|\[)\s*(music|singing|sings|song|theme|instrumental|band playing|humming|vocaliz)/i;
const SDH_RE = /(\(|\[)[^)\]]{1,48}(\)|\])/;

export function subtitleTextFeatures(
  cues: Array<[number, number]>,
  cueText?: string[],
): SubtitleTextFeatures {
  const texts = cueText ?? [];
  const starts = cues.map((c) => c[0]).filter(Number.isFinite);
  const ends = cues.map((c) => c[1]).filter(Number.isFinite);
  const spanSec = starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : 0;
  let laugh = 0, music = 0, sdh = 0;
  for (const raw of texts) {
    const t = raw ?? "";
    if (LAUGH_RE.test(t)) laugh += 1;
    if (MUSIC_RE.test(t)) music += 1;
    if (SDH_RE.test(t)) sdh += 1;
  }
  const denom = Math.max(1, texts.length || cues.length);
  return {
    cueCount: cues.length, spanSec, laughMarkerCount: laugh,
    musicNoteFrac: music / denom, sdhMarkerFrac: sdh / denom,
    cueDensityPerMin: spanSec > 0 ? cues.length / (spanSec / 60) : 0,
  };
}

function none(scenario: AdversarialScenario): GuardVerdict {
  return {
    scenario, fired: false, severity: 0, reason: "", ceiling: "apply", reliabilityMul: 1,
    affectsGroups: [], supportsWrongAdd: 0, requireIndependentAgreement: false, requireMlVad: false, demandAsr: false,
  };
}

function fire(scenario: AdversarialScenario, score: number, why: string[], effect: Partial<GuardEffect>): GuardVerdict {
  const severity = clamp01(score);
  return {
    ...none(scenario), fired: true, severity, reason: why.join("; "),
    ceiling: effect.ceiling ?? "apply", reliabilityMul: effect.reliabilityMul ?? 1,
    affectsGroups: effect.affectsGroups ?? [], supportsWrongAdd: effect.supportsWrongAdd ?? 0,
    requireIndependentAgreement: effect.requireIndependentAgreement ?? false,
    requireMlVad: effect.requireMlVad ?? false, demandAsr: effect.demandAsr ?? false,
  };
}

export function detectLaughTrack(ctx: AdversarialContext): GuardVerdict {
  const { subtitle: sub, acoustic: ac, correlation: co, meta } = ctx;
  const why: string[] = [];
  let s = 0;
  if (sub && sub.laughMarkerCount >= GUARD_LIMITS.laughMarkerMin) { s += 0.5; why.push(`${sub.laughMarkerCount} laughter/applause captions`); }
  if (hasGenre(meta, ["comedy", "sitcom", "stand-up", "stand up"])) { s += 0.2; why.push("comedy genre"); }
  if (ac && ac.speechFrac >= GUARD_LIMITS.laughSpeechFrac && ac.gatedFrac >= GUARD_LIMITS.gatedElevated) { s += 0.25; why.push(`speech ${pct(ac.speechFrac)}% with ${pct(ac.gatedFrac)}% gated bursts`); }
  if (co && co.dominance < GUARD_LIMITS.laughDominanceFloor) { s += 0.2; why.push(`weak peak dominance ${co.dominance.toFixed(2)}`); }
  if (s < 0.5) return none("laugh_track");
  return fire("laugh_track", s, why, {
    reliabilityMul: 1 - 0.35 * clamp01(s), affectsGroups: ["vad"], supportsWrongAdd: 0.1 * clamp01(s),
    requireIndependentAgreement: true, requireMlVad: true,
  });
}

export function detectMusicalScore(ctx: AdversarialContext): GuardVerdict {
  const { subtitle: sub, acoustic: ac, correlation: co, meta } = ctx;
  const why: string[] = [];
  let s = 0;
  if (sub && sub.musicNoteFrac >= GUARD_LIMITS.musicNoteFracMin) { s += 0.4 + Math.min(0.2, sub.musicNoteFrac); why.push(`${pct(sub.musicNoteFrac)}% lyric/music captions`); }
  if (hasGenre(meta, ["music", "musical"])) { s += 0.2; why.push("musical genre"); }
  if (ac && ac.speechFrac >= GUARD_LIMITS.musicalSpeechFrac && ac.gatedFrac >= GUARD_LIMITS.gatedMusic) { s += 0.25; why.push(`near-continuous speech ${pct(ac.speechFrac)}% with ${pct(ac.gatedFrac)}% tonal gating`); }
  if (ac && ac.meanFlatness !== undefined && ac.meanFlatness >= GUARD_LIMITS.flatnessTonal) { s += 0.1; why.push("tonal spectral profile"); }
  if (co && co.dominance < GUARD_LIMITS.musicalDominanceFloor) { s += 0.2; why.push(`periodic-score peak ambiguity ${co.dominance.toFixed(2)}`); }
  if (s < 0.5) return none("musical_score");
  return fire("musical_score", s, why, {
    reliabilityMul: 1 - 0.45 * clamp01(s), affectsGroups: ["vad"], supportsWrongAdd: 0.1 * clamp01(s),
    requireIndependentAgreement: true, requireMlVad: true, demandAsr: true,
  });
}

export function detectSilentFilm(ctx: AdversarialContext): GuardVerdict {
  const { acoustic: ac, correlation: co, meta } = ctx;
  const why: string[] = [];
  let s = 0;
  if (ac && ac.speechFrac <= GUARD_LIMITS.silentSpeechFrac) { s += 0.5; why.push(`only ${pct(ac.speechFrac)}% speech in window`); }
  if (ac && ac.intervalCount < GUARD_LIMITS.minSupportIntervals) { s += 0.3; why.push(`${ac.intervalCount} speech intervals underdetermine the fit`); }
  if (co && co.coverage < 0.4) { s += 0.2; why.push(`cue-on-speech coverage ${pct(co.coverage)}%`); }
  if (meta?.year !== undefined && meta.year > 0 && meta.year < 1930) { s += 0.2; why.push(`pre-1930 title (${meta.year})`); }
  if (s < 0.5) return none("silent_film");
  return fire("silent_film", s, why, {
    ceiling: s >= 0.7 ? "offer" : "apply", reliabilityMul: 1 - 0.6 * clamp01(s),
    affectsGroups: ["vad"], requireIndependentAgreement: true,
  });
}

export function detectSportsCrowd(ctx: AdversarialContext): GuardVerdict {
  const { acoustic: ac, correlation: co, meta } = ctx;
  const why: string[] = [];
  let s = 0;
  if (ac && ac.speechFrac >= GUARD_LIMITS.sportsSpeechFrac) { s += 0.5; why.push(`saturated speech mask ${pct(ac.speechFrac)}% carries little timing`); }
  if (ac && ac.meanHarmonicity !== undefined && ac.meanHarmonicity < GUARD_LIMITS.harmonicityLow && ac.meanFlatness !== undefined && ac.meanFlatness >= GUARD_LIMITS.flatnessNoisy) { s += 0.2; why.push("broadband crowd noise (low harmonicity, high flatness)"); }
  if (co && (co.z < GUARD_LIMITS.sportsZWeak || co.dominance < 1.4)) { s += 0.2; why.push(`flat correlation (z ${co.z.toFixed(1)}, dom ${co.dominance.toFixed(2)})`); }
  if (hasGenre(meta, ["sport"])) { s += 0.2; why.push("sport genre"); }
  if (s < 0.5) return none("sports_crowd");
  return fire("sports_crowd", s, why, {
    ceiling: s >= 0.7 ? "offer" : "apply", reliabilityMul: 1 - 0.45 * clamp01(s),
    affectsGroups: ["vad"], requireIndependentAgreement: true, requireMlVad: true,
  });
}

export function detectSparseDialog(ctx: AdversarialContext): GuardVerdict {
  const { subtitle: sub, acoustic: ac, correlation: co, meta } = ctx;
  const why: string[] = [];
  let s = 0;
  if (sub && sub.cueDensityPerMin > 0 && sub.cueDensityPerMin < GUARD_LIMITS.sparseCueDensity) { s += 0.4; why.push(`${sub.cueDensityPerMin.toFixed(1)} cues/min is sparse`); }
  const support = Math.min(ac?.intervalCount ?? Infinity, sub?.cueCount ?? Infinity);
  if (Number.isFinite(support) && support < GUARD_LIMITS.minSupportIntervals * 1.5) { s += 0.2; why.push(`${support} shared anchors`); }
  if (hasGenre(meta, ["documentary"])) { s += 0.25; why.push("documentary genre"); }
  if (co && co.coverage < 0.5) { s += 0.15; why.push(`low coverage ${pct(co.coverage)}%`); }
  if (s < 0.5) return none("sparse_dialog");
  return fire("sparse_dialog", s, why, {
    reliabilityMul: 1 - 0.35 * clamp01(s), affectsGroups: ["vad"],
    requireIndependentAgreement: true, demandAsr: true,
  });
}

export function detectAnimeNumbering(ctx: AdversarialContext): GuardVerdict {
  const { meta } = ctx;
  if (!meta) return none("anime_numbering");
  const why: string[] = [];
  let s = 0;
  if (meta.episodeAmbiguous) { s += 0.6; why.push("absolute-vs-seasonal episode ambiguity"); }
  if (meta.isAnime && (meta.season ?? 0) > 1) { s += 0.3; why.push(`anime season ${meta.season} (off-by-one risk)`); }
  else if (meta.isAnime) { s += 0.1; why.push("anime numbering"); }
  if (s < 0.4) return none("anime_numbering");
  return fire("anime_numbering", s, why, {
    affectsGroups: ["meta"], supportsWrongAdd: 0.1 * clamp01(s),
    requireIndependentAgreement: true, demandAsr: true,
  });
}

export function detectDubMismatch(ctx: AdversarialContext): GuardVerdict {
  const a = ctx.audio;
  if (!a || !a.risky) return none("dub_mismatch");
  const why: string[] = [];
  let s = a.kind === "translated-sub" ? 0.7 : 0.5;
  why.push(a.kind === "translated-sub" ? "sub translates a different-language audio track" : "audio language unknown with multiple tracks");
  if (!a.hasInLanguageVerifier) { s += 0.2; why.push("no in-language ASR verifier"); }
  return fire("dub_mismatch", s, why, {
    ceiling: a.hasInLanguageVerifier ? "apply" : "offer", reliabilityMul: 1 - 0.25 * clamp01(s),
    affectsGroups: ["vad"], requireIndependentAgreement: true, demandAsr: a.hasInLanguageVerifier,
  });
}

export function detectCrowdPoison(ctx: AdversarialContext): GuardVerdict {
  const cr = ctx.crowd;
  if (!cr || !cr.present) return none("crowd_poison");
  const why: string[] = [];
  let s = 0, gross = false;
  const strongLock = cr.tier === "A";
  if (cr.tier === "C") { s += 0.35; why.push("tier-C consensus (sub-hash + duration only, no byte/audio lock)"); }
  if (cr.votes <= GUARD_LIMITS.crowdMinVotesClient) { s += 0.25; why.push(`only ${cr.votes} distinct-IP votes`); }
  if (cr.dispersionMs >= GUARD_LIMITS.crowdDispersionWarnMs) { s += 0.15; why.push(`vote dispersion ${Math.round(cr.dispersionMs)}ms`); }
  if (cr.independentRan && cr.independentOffsetMs !== undefined) {
    const tol = Math.max(GUARD_LIMITS.crowdAgreeTolMs, 3 * cr.dispersionMs);
    const gap = Math.abs(cr.offsetMs - cr.independentOffsetMs);
    if (gap > GUARD_LIMITS.crowdGrossMs) { gross = true; s = 1; why.push(`crowd offset contradicts local measurement by ${Math.round(gap)}ms`); }
    else if (gap > tol) { s += 0.5; why.push(`crowd offset disagrees with local by ${Math.round(gap)}ms`); }
  }
  if (strongLock && cr.votes > GUARD_LIMITS.crowdMinVotesClient && !gross && cr.dispersionMs < GUARD_LIMITS.crowdDispersionWarnMs && s < 0.3) return none("crowd_poison");
  if (s < 0.3) return none("crowd_poison");
  return fire("crowd_poison", s, why, {
    ceiling: gross ? "refuse" : "offer", reliabilityMul: gross ? 0.1 : 1 - 0.5 * clamp01(s),
    affectsGroups: ["crowd"], supportsWrongAdd: gross ? 0.6 : 0.2 * clamp01(s),
    requireIndependentAgreement: !strongLock,
  });
}

const DETECTORS = [
  detectLaughTrack, detectMusicalScore, detectSilentFilm, detectSportsCrowd,
  detectSparseDialog, detectAnimeNumbering, detectDubMismatch, detectCrowdPoison,
];

export function assessAdversarial(ctx: AdversarialContext): AdversarialAssessment {
  const verdicts = DETECTORS.map((d) => d(ctx)).filter((v) => v.fired);
  const reliabilityMulByGroup: Record<string, number> = {};
  const supportsWrongByGroup: Record<string, number> = {};
  let ceiling: Outcome = "apply";
  let requireIndependentAgreement = false, requireMlVad = false, demandAsr = false;
  const reasons: string[] = [];
  for (const v of verdicts) {
    ceiling = lower(ceiling, v.ceiling);
    requireIndependentAgreement = requireIndependentAgreement || v.requireIndependentAgreement;
    requireMlVad = requireMlVad || v.requireMlVad;
    demandAsr = demandAsr || v.demandAsr;
    reasons.push(`${v.scenario}: ${v.reason}`);
    for (const g of v.affectsGroups) {
      reliabilityMulByGroup[g] = (reliabilityMulByGroup[g] ?? 1) * v.reliabilityMul;
      supportsWrongByGroup[g] = Math.max(supportsWrongByGroup[g] ?? 0, v.supportsWrongAdd);
    }
  }
  return {
    verdicts, fired: verdicts.map((v) => v.scenario), ceiling,
    reliabilityMulByGroup, supportsWrongByGroup,
    requireIndependentAgreement, requireMlVad, demandAsr, reasons,
  };
}

export function applyGuardsToEvidence(evidence: SignalEvidence[], a: AdversarialAssessment): SignalEvidence[] {
  return evidence.map((s) => {
    const mul = a.reliabilityMulByGroup[s.independenceGroup];
    const add = a.supportsWrongByGroup[s.independenceGroup];
    if (mul === undefined && add === undefined) return s;
    return {
      ...s,
      reliability: mul !== undefined ? clamp01(s.reliability * mul) : s.reliability,
      supportsWrong: add !== undefined ? clamp01((s.supportsWrong ?? 0) + add) : s.supportsWrong,
    };
  });
}

export function resolveAdversarialCeiling(a: AdversarialAssessment, obs: GuardObservations): Outcome {
  let c = a.ceiling;
  if (a.requireIndependentAgreement && !obs.exactIdentity && obs.agreeingSignals < 2) c = lower(c, "offer");
  if (a.demandAsr && !obs.exactIdentity && !obs.asrRan) c = lower(c, "offer");
  return c;
}

export function adversarialRule(a: AdversarialAssessment, obs: GuardObservations): { name: string; ceiling: Outcome; reason: string } {
  const ceiling = resolveAdversarialCeiling(a, obs);
  return {
    name: "adversarial-guard", ceiling,
    reason: ceiling === "apply" ? "no adversarial scenario binds" : a.reasons[0] ?? "adversarial scenario detected",
  };
}

export function applyAdversarialCeiling(decision: GateDecision, a: AdversarialAssessment, obs: GuardObservations): GateDecision {
  const ceiling = resolveAdversarialCeiling(a, obs);
  if (RANK[ceiling] >= RANK[decision.decision]) return decision;
  return { ...decision, decision: ceiling, reason: a.reasons[0] ?? decision.reason, bindingRule: "adversarial-guard" };
}
