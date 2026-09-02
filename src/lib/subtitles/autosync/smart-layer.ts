import { robustMedian, mad, clamp } from "./drift-dsp";
import {
  DEFAULT_PRIOR,
  fuseConfidence as fuseSignalConfidence,
  toLogOdds,
  type Calibrator,
  type FusedConfidence,
  type SignalEvidence,
  type TierId,
} from "./confidence";
import { normalizeLang } from "@/lib/subtitles/language";
import { normalizeArabicForMatch } from "@/lib/subtitles/arabic-normalize";
import {
  evaluateBestEffort,
  type AffineTransform,
  type Bounds,
  type QualityMeasurement,
  type SubtitleFormat,
  type SyncTransform,
} from "./fp-gate";
import type {
  AsrPhrase,
  AsrTranscript,
  AsrWindowSpec,
  ConsensusResult,
  PipelineContext,
  PipelineOutcome,
  TierPorts,
} from "./pipeline";

const ASR_WINDOW_SEC = 25;
const MAX_WINDOWS = 8;
const MIN_JACCARD = 0.34;
const MIN_SHARED_TOKENS = 2;
const MIN_ANCHORS = 3;
const RATIO_LO = 0.8;
const RATIO_HI = 1.25;
const RATIO_SNAP = 0.004;
const RESIDUAL_KEEP_SEC = 1.5;
const CONSENSUS_TOL_SEC = 0.7;
const CONSENSUS_CAL: Calibrator = { kind: "platt", a: 6, b: -3 };
const IDENTITY: AffineTransform = { kind: "affine", offsetSec: 0, ratio: 1 };

type Anchor = [number, number];
type Estimate = { offsetSec: number; ratio: number; wOff: number; wRatio: number; source: string };
type Fit = { offsetSec: number; ratio: number; residualSec: number; n: number };

export function canUseLexicalAsr(ctx: PipelineContext): boolean {
  const audio = normalizeLang(ctx.audioLanguage ?? "");
  const subtitle = normalizeLang(ctx.subtitleLanguage ?? "");
  return audio.length > 0 && subtitle.length > 0 && audio === subtitle;
}

export function denseAsrWindows(durationSec: number): AsrWindowSpec[] {
  if (!(durationSec > 0)) return [];
  const len = Math.min(ASR_WINDOW_SEC, durationSec);
  const lo = Math.max(5, durationSec * 0.06);
  const hi = Math.max(lo, durationSec * 0.94 - len);
  const count = Math.round(clamp(durationSec / 600 + 4, 3, MAX_WINDOWS));
  if (hi <= lo || count <= 1) return [{ startSec: lo, lenSec: len }];
  const step = (hi - lo) / (count - 1);
  return Array.from({ length: count }, (_, k) => ({ startSec: lo + step * k, lenSec: len }));
}

function affineOf(t: SyncTransform): { offsetSec: number; ratio: number } {
  if (t.kind === "affine") return { offsetSec: t.offsetSec, ratio: t.ratio };
  const s = t.segments[0];
  return s ? { offsetSec: s.offsetSec, ratio: s.ratio } : { offsetSec: 0, ratio: 1 };
}

function applyAffine(t: SyncTransform, timeSec: number): number {
  const a = affineOf(t);
  return a.offsetSec + a.ratio * timeSec;
}

export function anchorsAgree(anchors: Anchor[], lead: SyncTransform, tolSec: number): boolean {
  if (anchors.length < MIN_ANCHORS) return false;
  const residuals = anchors.map(([subTime, correctTime]) =>
    Math.abs(applyAffine(lead, subTime) - correctTime),
  );
  return robustMedian(residuals) <= tolSec;
}

function snapRatio(ratio: number): number {
  const r = clamp(ratio, RATIO_LO, RATIO_HI);
  return Math.abs(r - 1) < RATIO_SNAP ? 1 : r;
}

function fitAnchors(anchors: Anchor[]): Fit | null {
  const n = anchors.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (const [x, y] of anchors) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of anchors) {
    sxx += (x - mx) * (x - mx);
    sxy += (x - mx) * (y - my);
  }
  const ratio = n >= MIN_ANCHORS && sxx > 1 ? snapRatio(sxy / sxx) : 1;
  const offsetSec = my - ratio * mx;
  const residuals = anchors.map(([x, y]) => Math.abs(offsetSec + ratio * x - y));
  return { offsetSec, ratio, residualSec: robustMedian(residuals), n };
}

function robustFit(anchors: Anchor[]): Fit | null {
  const first = fitAnchors(anchors);
  if (!first) return null;
  const spread = mad(anchors.map(([x, y]) => y - (first.offsetSec + first.ratio * x)));
  const keepBand = Math.max(RESIDUAL_KEEP_SEC, 2.5 * spread);
  const kept = anchors.filter(
    ([x, y]) => Math.abs(first.offsetSec + first.ratio * x - y) <= keepBand,
  );
  if (kept.length < MIN_ANCHORS) return kept.length >= 2 ? fitAnchors(kept) : first;
  return fitAnchors(kept) ?? first;
}

function tokenize(text: string, language?: string): string[] {
  const normalized =
    normalizeLang(language ?? "") === "ar" ? normalizeArabicForMatch(text) : text.toLowerCase();
  return normalized
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function jaccard(a: Set<string>, b: Set<string>): { j: number; shared: number } {
  if (a.size === 0 || b.size === 0) return { j: 0, shared: 0 };
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return { j: inter / (a.size + b.size - inter), shared: inter };
}

export function alignSubToAsr(
  cues: Array<[number, number]>,
  cueText: string[] | undefined,
  phrases: AsrPhrase[],
  language?: string,
): Estimate | null {
  if (!cueText || cues.length === 0 || phrases.length === 0) return null;
  const cueSets = cueText.map((t) => new Set(tokenize(t, language)));
  const anchors: Anchor[] = [];
  let eligible = 0;
  for (const phrase of phrases) {
    const pset = new Set(tokenize(phrase.text, language));
    if (pset.size < MIN_SHARED_TOKENS) continue;
    eligible += 1;
    let bestJ = MIN_JACCARD;
    let bestIdx = -1;
    for (let i = 0; i < cueSets.length; i += 1) {
      const { j, shared } = jaccard(pset, cueSets[i]);
      if (shared >= MIN_SHARED_TOKENS && j > bestJ) {
        bestJ = j;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) anchors.push([cues[bestIdx][0], phrase.start]);
  }
  if (anchors.length < MIN_ANCHORS) return null;
  const fit = robustFit(anchors);
  if (!fit || fit.residualSec > RESIDUAL_KEEP_SEC * 2) return null;
  const coverage = eligible > 0 ? fit.n / eligible : 0;
  const w = clamp(coverage, 0, 1) * clamp(1 - fit.residualSec / 3, 0.2, 1);
  return { offsetSec: fit.offsetSec, ratio: fit.ratio, wOff: w, wRatio: w * 0.7, source: "asr" };
}

function weightedMean(pairs: Array<[number, number]>, fallback: number): number {
  let sw = 0;
  let sv = 0;
  for (const [v, w] of pairs) {
    sw += w;
    sv += v * w;
  }
  return sw > 0 ? sv / sw : fallback;
}

function fuse(
  estimates: Estimate[],
): { transform: AffineTransform; spread: number; sources: number } | null {
  const offs = estimates.filter((e) => e.wOff > 0);
  if (offs.length === 0) return null;
  const offVals = offs.map((e) => e.offsetSec);
  const offMed = robustMedian(offVals);
  const offSpread = mad(offVals);
  const offKeep = offs.filter((e) => Math.abs(e.offsetSec - offMed) <= 2.5 * offSpread + 0.5);
  const offsetSec = weightedMean(
    offKeep.map((e) => [e.offsetSec, e.wOff]),
    offMed,
  );

  const rats = estimates.filter((e) => e.wRatio > 0);
  const ratMed = rats.length ? robustMedian(rats.map((e) => e.ratio)) : 1;
  const ratKeep = rats.filter((e) => Math.abs(e.ratio - ratMed) <= 0.03);
  const ratio = snapRatio(
    weightedMean(
      ratKeep.map((e) => [e.ratio, e.wRatio]),
      1,
    ),
  );

  return {
    transform: { kind: "affine", offsetSec, ratio },
    spread: offSpread,
    sources: new Set(offKeep.map((e) => e.source)).size,
  };
}

const FAST_MIN_ANCHORS = 8;
const FAST_MAX_RESIDUAL = 0.6;

export function consensusAnchorFit(
  res: ConsensusResult,
): { offsetSec: number; ratio: number } | null {
  if (res.verdict !== "right" || !res.textAnchors) return null;
  if (res.textAnchors.length < FAST_MIN_ANCHORS) return null;
  const fit = robustFit(res.textAnchors);
  if (!fit || fit.n < FAST_MIN_ANCHORS || fit.residualSec > FAST_MAX_RESIDUAL) return null;
  return { offsetSec: fit.offsetSec, ratio: fit.ratio };
}

export function consensusSignal(res: ConsensusResult, lead: SyncTransform | null): SignalEvidence {
  const agrees =
    res.verdict === "right" &&
    lead != null &&
    res.textAnchors != null &&
    anchorsAgree(res.textAnchors, lead, CONSENSUS_TOL_SEC);
  const raw =
    res.verdict === "wrong"
      ? clamp(0.5 - res.agreement * 0.5, 0, 0.5)
      : res.verdict === "right"
        ? clamp(0.5 + res.agreement * 0.5, 0.5, 1)
        : 0.5;
  const supportsWrong =
    res.verdict === "wrong"
      ? Math.max(0.6, 1 - res.agreement)
      : res.verdict === "unknown"
        ? 0.15
        : 0;
  return {
    tier: "consensus",
    rawScore: raw,
    calibrator: CONSENSUS_CAL,
    reliability: agrees ? 0.7 : 0.45,
    independenceGroup: agrees ? "consensus" : "content",
    clearedFloor: agrees,
    supportsWrong,
  };
}

export function wrongContentOutcome(
  res: ConsensusResult,
  pCorrect: number,
  evidence: SignalEvidence[],
  tiersRun: TierId[],
): PipelineOutcome {
  const cand = res.bestCandidate;
  if (cand) {
    return {
      decision: {
        decision: "offer",
        reason: "subtitle looks like a different version",
        bindingRule: "consensus-wrong-content",
        pCorrect,
        transform: IDENTITY,
      },
      candidate: IDENTITY,
      subSwap: {
        url: cand.url,
        format: cand.format === "vtt" ? "vtt" : "srt",
        lang: cand.lang,
        source: cand.source,
      },
      evidence,
      tiersRun,
    };
  }
  return {
    decision: {
      decision: "refuse",
      reason: "wrong content, no better subtitle found",
      bindingRule: "consensus-wrong-content",
      pCorrect,
      transform: IDENTITY,
    },
    candidate: null,
    evidence,
    tiersRun,
  };
}

function bestEffortConfidence(
  pCorrect: number,
  agreeing: number,
  conflictK: number,
): FusedConfidence {
  const p = clamp(pCorrect, 0.3, 0.85);
  return { pCorrect: p, logOdds: toLogOdds(p), conflictK, agreeingSignals: agreeing, perTier: [] };
}

export type EscalateArgs = {
  ctx: PipelineContext;
  ports: TierPorts;
  lead: SyncTransform | null;
  leadNcc: number;
  consensus: ConsensusResult | null;
  bounds: Bounds;
  qualityBefore: QualityMeasurement;
  inputAlreadyGood: boolean;
  wrongContentReason?: string;
  evidence: SignalEvidence[];
  tiersRun: TierId[];
  calibrationReady: boolean;
  structuralAutoApplyEnabled: boolean;
  subtitleFormat: SubtitleFormat;
};

export async function escalateTryHarder(args: EscalateArgs): Promise<PipelineOutcome | null> {
  const { ctx, ports, lead, consensus, bounds, qualityBefore, evidence, tiersRun } = args;
  if (args.wrongContentReason) {
    const transform = lead ?? IDENTITY;
    return {
      decision: {
        decision: "refuse",
        reason: args.wrongContentReason,
        bindingRule: "metadata-hard-refuse",
        pCorrect: DEFAULT_PRIOR,
        transform,
      },
      candidate: lead,
      evidence,
      tiersRun,
      bestEffort: true,
    };
  }
  const contentWrong = consensus?.verdict === "wrong";
  const estimates: Estimate[] = [];

  if (lead && !contentWrong) {
    const a = affineOf(lead);
    const w = clamp(args.leadNcc, 0, 1) * 0.8;
    if (w > 0)
      estimates.push({ offsetSec: a.offsetSec, ratio: a.ratio, wOff: w, wRatio: w, source: "vad" });
  }

  let asrMatched = false;
  if (ports.asrTranscribe && (!ctx.audioLanguage || canUseLexicalAsr(ctx))) {
    const transcript = await ports
      .asrTranscribe(ctx, denseAsrWindows(ctx.durationSec))
      .catch(() => ({ phrases: [], detectedLanguage: null }) satisfies AsrTranscript);
    const lexicalContext = ctx.audioLanguage
      ? ctx
      : { ...ctx, audioLanguage: transcript.detectedLanguage };
    const asrEst = canUseLexicalAsr(lexicalContext)
      ? alignSubToAsr(
          ctx.cues,
          ctx.cueText,
          transcript.phrases,
          ctx.subtitleLanguage ?? lexicalContext.audioLanguage ?? undefined,
        )
      : null;
    if (asrEst) {
      asrMatched = true;
      estimates.push(asrEst);
    }
  }

  if (contentWrong && !asrMatched) return null;

  if (consensus?.textAnchors && consensus.textAnchors.length >= MIN_ANCHORS && !contentWrong) {
    const fit = robustFit(consensus.textAnchors);
    if (fit && fit.residualSec <= RESIDUAL_KEEP_SEC * 2) {
      const w = clamp(consensus.agreement, 0, 1) * 0.7;
      estimates.push({
        offsetSec: fit.offsetSec,
        ratio: fit.ratio,
        wOff: w,
        wRatio: w,
        source: "consensus",
      });
    }
  }

  const runtime = ctx.meta?.expectedRuntimeSec;
  const subSpan = ctx.cues.length ? ctx.cues[ctx.cues.length - 1][1] - ctx.cues[0][0] : 0;
  if (runtime && subSpan > 60) {
    estimates.push({
      offsetSec: 0,
      ratio: snapRatio(runtime / subSpan),
      wOff: 0,
      wRatio: 0.3,
      source: "meta",
    });
  }

  const fused = fuse(estimates);
  if (!fused) return null;

  const qualityAfter = await ports.measureQuality(ctx, fused.transform, { purpose: "validation" });
  const pCorrect = 0.4 + 0.15 * fused.sources - fused.spread * 0.1;
  const signalConflict = fuseSignalConfidence(evidence, DEFAULT_PRIOR).conflictK;
  const estimateConflict = clamp(fused.spread / 3, 0, 1);
  const confidence = bestEffortConfidence(
    pCorrect,
    fused.sources,
    Math.max(signalConflict, estimateConflict),
  );
  const decision = evaluateBestEffort({
    transform: fused.transform,
    confidence,
    qualityBefore,
    qualityAfter,
    bounds,
    exactIdentity: false,
    candidateKind: "structural",
    calibrationReady: args.calibrationReady,
    structuralAutoApplyEnabled: args.structuralAutoApplyEnabled,
    subtitleFormat: args.subtitleFormat,
    inputAlreadyGood: args.inputAlreadyGood,
  });

  return { decision, candidate: fused.transform, evidence, tiersRun, bestEffort: true };
}
