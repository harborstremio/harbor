// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import {
  DEFAULT_BOUNDS,
  evaluateBestEffort,
  evaluateGate,
  measuredQuality,
  unknownQuality,
  type GateInputs,
  type QualityMeasurement,
} from "../src/lib/subtitles/autosync/fp-gate.ts";
import {
  DEFAULT_BUNDLE,
  isReleaseReady,
  type CalibrationBundle,
} from "../src/lib/subtitles/autosync/calibration.ts";
import {
  canUseLexicalAsr,
  escalateTryHarder,
  type EscalateArgs,
} from "../src/lib/subtitles/autosync/smart-layer.ts";
import type { SignalEvidence } from "../src/lib/subtitles/autosync/confidence.ts";
import {
  runAutoSync,
  type PipelineContext,
  type TierPorts,
} from "../src/lib/subtitles/autosync/pipeline.ts";
import { audioLanguageFromSnapshot } from "../src/views/player/hooks/use-auto-sync.helpers.ts";
import type { PlayerSnapshot } from "../src/lib/player/bridge.ts";
import { consensusLanguages } from "../src/lib/subtitles/autosync/language-context.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const confidence = {
  pCorrect: 0.99,
  logOdds: 4.6,
  conflictK: 0,
  agreeingSignals: 2,
  perTier: [],
};

function quality(
  ncc: number,
  coverage = 0.8,
  windowIds = ["validation-middle-a", "validation-middle-b"],
): QualityMeasurement {
  return measuredQuality({ ncc, coverage, z: 8 }, "test-held-out-score", {
    kind: "held-out",
    windowIds,
  });
}

const base: GateInputs = {
  transform: { kind: "affine", offsetSec: 1.25, ratio: 1 },
  confidence,
  qualityBefore: quality(0.5),
  qualityAfter: quality(0.8),
  bounds: DEFAULT_BOUNDS,
  exactIdentity: false,
  candidateKind: "structural",
  calibrationReady: true,
  structuralAutoApplyEnabled: true,
  subtitleFormat: "srt",
  fitWindowIds: ["fit-early", "fit-late"],
  inputAlreadyGood: false,
};

const decide = (over: Partial<GateInputs> = {}) => evaluateGate({ ...base, ...over });

test("consensus search keeps the selected subtitle language ahead of preferences", () => {
  assert.deepEqual(
    consensusLanguages({ subtitleLanguage: "ar", languages: ["ar", "en"] }, ["English"]),
    ["ar", "en"],
  );
});

test("unknown post-transform quality cannot promote a structural candidate", () => {
  const decision = decide({ qualityAfter: unknownQuality("timeout", "test-score") });
  assert.equal(decision.decision, "refuse");
  assert.equal(decision.bindingRule, "quality-measurement");
  assert.match(decision.reason, /post-sync quality is unknown \(timeout\)/);
});

test("non-finite quality is unknown rather than a fabricated numeric score", () => {
  const measurement = measuredQuality(
    { ncc: Number.NaN, coverage: 0.8, z: 8 },
    "invalid-test-score",
  );
  assert.deepEqual(measurement, {
    status: "unknown",
    reason: "insufficient-data",
    method: "invalid-test-score",
  });
});

test("an exact file/hash match with unknown post-quality is offer-only", () => {
  const decision = decide({
    qualityAfter: unknownQuality("ffmpeg-unavailable", "test-score"),
    candidateKind: "exact-file-hash",
    exactIdentity: true,
    calibrationReady: false,
    structuralAutoApplyEnabled: false,
  });
  assert.equal(decision.decision, "offer");
  assert.equal(decision.bindingRule, "quality-measurement");
});

test("pipeline preserves unknown quality end-to-end", async () => {
  const ctx = languageContext("en", "en");
  const identityQuality = quality(0.5);
  const measureQuality: TierPorts["measureQuality"] = async (_ctx, transform) =>
    transform.kind === "affine" && Math.abs(transform.offsetSec) < 1e-9
      ? identityQuality
      : unknownQuality("timeout", "mock-quality-port");

  const exact = await runAutoSync(
    ctx,
    {
      measureQuality,
      hashExact: async () => ({
        transform: { kind: "affine", offsetSec: 2, ratio: 1 },
        rawScore: 0.99,
      }),
    },
    { allowStructuralAutoApply: true },
  );
  assert.equal(exact.decision.decision, "offer");
  assert.equal(exact.decision.bindingRule, "quality-measurement");

  const structural = await runAutoSync(
    ctx,
    {
      measureQuality,
      vadAffine: async () => ({
        transform: { kind: "affine", offsetSec: 2, ratio: 1 },
        rawScore: 0.95,
        quality: { ncc: 0.95, coverage: 0.8, z: 8 },
      }),
    },
    { allowStructuralAutoApply: true },
  );
  assert.equal(structural.decision.decision, "refuse");
  assert.equal(structural.decision.bindingRule, "quality-measurement");
  assert.notEqual(structural.candidate, null);
});

test("an exact-file subtitle swap short-circuits structural correction", async () => {
  let structuralCalls = 0;
  const ctx: PipelineContext = {
    ...languageContext("en", "en"),
    cues: [
      [10, 12],
      [20, 22],
      [30, 32],
      [40, 42],
    ],
    cueText: ["current one", "current two", "current three", "current four"],
  };
  const outcome = await runAutoSync(ctx, {
    hashExact: async () => ({
      transform: { kind: "affine", offsetSec: 0, ratio: 1 },
      rawScore: 1,
      subSwap: { url: "https://example.test/exact.srt", format: "srt" },
    }),
    resolveSwapCues: async () => ({
      cues: [
        [10, 12],
        [20, 22],
        [30, 32],
        [40, 42],
      ],
      cueText: ["exact one", "exact two", "exact three", "exact four"],
    }),
    measureQuality: async (measurementCtx) =>
      quality(measurementCtx.cueText?.[0]?.startsWith("exact") ? 0.85 : 0.35),
    vadAffine: async () => {
      structuralCalls += 1;
      return {
        transform: { kind: "affine", offsetSec: 4, ratio: 1.02 },
        rawScore: 0.99,
        quality: { ncc: 0.9, coverage: 0.8, z: 8 },
      };
    },
  });

  assert.ok(outcome.subSwap);
  assert.equal(outcome.decision.decision, "offer");
  assert.equal(structuralCalls, 0);
});

test("held-out validation is required and may not overlap fit windows", () => {
  const unverified = decide({
    qualityBefore: measuredQuality({ ncc: 0.5, coverage: 0.8, z: 8 }, "in-sample"),
    qualityAfter: measuredQuality({ ncc: 0.8, coverage: 0.8, z: 8 }, "in-sample"),
  });
  assert.equal(unverified.decision, "offer");
  assert.equal(unverified.bindingRule, "held-out-validation");

  const overlapping = decide({
    qualityBefore: quality(0.5, 0.8, ["fit-early", "validation-middle-b"]),
    qualityAfter: quality(0.8, 0.8, ["fit-early", "validation-middle-b"]),
  });
  assert.equal(overlapping.decision, "refuse");
  assert.equal(overlapping.bindingRule, "held-out-validation");

  const differentWindows = decide({
    qualityBefore: quality(0.5, 0.8, ["validation-middle-a"]),
    qualityAfter: quality(0.8, 0.8, ["validation-middle-b"]),
  });
  assert.equal(differentWindows.decision, "refuse");

  const duplicateWindows = decide({
    qualityBefore: quality(0.5, 0.8, ["validation-middle-a", "validation-middle-b"]),
    qualityAfter: quality(0.8, 0.8, ["validation-middle-a", "validation-middle-a"]),
  });
  assert.equal(duplicateWindows.decision, "refuse");
  assert.equal(duplicateWindows.bindingRule, "held-out-validation");

  const missingFitProvenance = decide({ fitWindowIds: undefined });
  assert.equal(missingFitProvenance.decision, "offer");
  assert.equal(missingFitProvenance.bindingRule, "held-out-validation");
});

test("provisional calibration caps an otherwise valid structural decision at offer", () => {
  assert.equal(isReleaseReady(DEFAULT_BUNDLE), false);
  const decision = decide({ calibrationReady: isReleaseReady(DEFAULT_BUNDLE) });
  assert.equal(decision.decision, "offer");
  assert.equal(decision.bindingRule, "calibration-release");
  assert.equal(
    decide({
      calibrationReady: false,
      candidateKind: "exact-file-hash",
      exactIdentity: true,
    }).decision,
    "offer",
  );

  const ready: CalibrationBundle = {
    ...DEFAULT_BUNDLE,
    provisional: false,
    metrics: {
      n: 1000,
      eceBefore: 0.1,
      eceAfter: 0.01,
      brierBefore: 0.2,
      brierAfter: 0.05,
      falseApplyUpper: 0.001,
      appliedN: 500,
      falseApplies: 0,
    },
  };
  assert.equal(isReleaseReady(ready), true);
  assert.equal(decide({ calibrationReady: isReleaseReady(ready) }).decision, "apply");
});

test("best effort runs the complete gate and can never auto-apply", () => {
  const safe = evaluateBestEffort(base);
  assert.equal(safe.decision, "offer");
  assert.equal(safe.bindingRule, "best-effort-max-offer");

  const cases: Array<[string, Partial<GateInputs>]> = [
    ["confidence", { confidence: { ...confidence, pCorrect: 0.5, agreeingSignals: 0 } }],
    ["coverage", { qualityAfter: quality(0.8, 0.2) }],
    ["improvement", { qualityAfter: quality(0.52) }],
    ["wrong-content", { asrWordMatch: 0.1 }],
    ["conflict", { confidence: { ...confidence, conflictK: 0.7 } }],
    ["already-good", { inputAlreadyGood: true }],
    [
      "format-safety",
      {
        subtitleFormat: "ass",
        transform: { kind: "affine", offsetSec: 1, ratio: 25 / 24 },
      },
    ],
  ];
  for (const [name, over] of cases) {
    assert.equal(evaluateBestEffort({ ...base, ...over }).decision, "refuse", name);
  }
});

function escalationArgs(over: Partial<EscalateArgs> = {}): EscalateArgs {
  const positiveEvidence: SignalEvidence[] = [
    {
      tier: "vad_affine",
      rawScore: 0.99,
      calibrator: { kind: "identity" },
      reliability: 1,
      independenceGroup: "vad",
      clearedFloor: true,
    },
    {
      tier: "consensus",
      rawScore: 0.99,
      calibrator: { kind: "identity" },
      reliability: 1,
      independenceGroup: "consensus",
      clearedFloor: true,
    },
  ];
  return {
    ctx: {
      ...languageContext("en", "en"),
      cues: [
        [10, 12],
        [20, 22],
        [30, 32],
        [40, 42],
      ],
      cueText: ["one", "two", "three", "four"],
    },
    ports: { measureQuality: async () => quality(0.8) },
    lead: { kind: "affine", offsetSec: 2, ratio: 1 },
    leadNcc: 0.9,
    consensus: {
      verdict: "right",
      bestCandidate: null,
      agreement: 0.9,
      textAnchors: [
        [10, 12],
        [20, 22],
        [30, 32],
        [40, 42],
      ],
    },
    bounds: DEFAULT_BOUNDS,
    qualityBefore: quality(0.5),
    inputAlreadyGood: false,
    evidence: positiveEvidence,
    tiersRun: ["vad_affine", "consensus"],
    calibrationReady: true,
    structuralAutoApplyEnabled: true,
    subtitleFormat: "srt",
    ...over,
  };
}

test("production best-effort escalation preserves conflict, already-good, and wrong-content vetoes", async () => {
  const conflictEvidence: SignalEvidence[] = [
    {
      tier: "vad_affine",
      rawScore: 0.99,
      calibrator: { kind: "identity" },
      reliability: 1,
      independenceGroup: "vad",
      clearedFloor: true,
    },
    {
      tier: "asr_match",
      rawScore: 0.01,
      calibrator: { kind: "identity" },
      reliability: 1,
      independenceGroup: "asr",
      clearedFloor: true,
    },
  ];
  const conflicted = await escalateTryHarder(escalationArgs({ evidence: conflictEvidence }));
  assert.equal(conflicted?.decision.decision, "refuse");
  assert.equal(conflicted?.decision.bindingRule, "conflict");

  const alreadyGood = await escalateTryHarder(
    escalationArgs({
      qualityBefore: quality(0.9),
      inputAlreadyGood: true,
      ports: { measureQuality: async () => quality(0.99) },
    }),
  );
  assert.equal(alreadyGood?.decision.decision, "refuse");
  assert.equal(alreadyGood?.decision.bindingRule, "already-good");

  const wrongContent = await escalateTryHarder(
    escalationArgs({ wrongContentReason: "wrong content: subtitle exceeds video" }),
  );
  assert.equal(wrongContent?.decision.decision, "refuse");
  assert.equal(wrongContent?.decision.bindingRule, "metadata-hard-refuse");
});

test("production pipeline does not let an earlier offer outrank a metadata hard veto", async () => {
  const ctx: PipelineContext = {
    ...languageContext("en", "en"),
    durationSec: 100,
    cues: [
      [0, 5],
      [140, 150],
    ],
    cueText: ["first cue", "past the end"],
  };
  const outcome = await runAutoSync(
    ctx,
    {
      measureQuality: async (_ctx, transform) =>
        quality(transform.kind === "affine" && Math.abs(transform.offsetSec) < 1e-9 ? 0.5 : 0.8),
      hashExact: async () => ({
        transform: { kind: "affine", offsetSec: 2, ratio: 1 },
        rawScore: 0.99,
      }),
    },
    { tryHarder: true, allowStructuralAutoApply: true },
  );

  assert.equal(outcome.decision.decision, "refuse");
  assert.equal(outcome.decision.bindingRule, "metadata-hard-refuse");
});

test("ASS/SSA permits delay-only correction but blocks structural rewriting", () => {
  assert.equal(decide({ subtitleFormat: "ass" }).decision, "apply");
  assert.equal(
    decide({
      subtitleFormat: "ass",
      transform: { kind: "affine", offsetSec: 1, ratio: 1.002 },
    }).decision,
    "refuse",
  );
  assert.equal(
    decide({
      subtitleFormat: "ass",
      transform: { kind: "affine", offsetSec: 1, ratio: 25 / 24 },
    }).decision,
    "refuse",
  );
  assert.equal(
    decide({
      subtitleFormat: "ssa",
      transform: {
        kind: "piecewise",
        segments: [{ fromSec: 0, toSec: 100, offsetSec: 1, ratio: 1 }],
      },
    }).decision,
    "refuse",
  );
});

function languageContext(
  audioLanguage: string | null,
  subtitleLanguage: string | null,
): PipelineContext {
  return {
    mediaUrl: "file:///movie.mkv",
    sourceKind: "local",
    durationSec: 3600,
    cues: [[10, 12]],
    audioLanguage,
    subtitleLanguage,
    preferredSubtitleLanguages: subtitleLanguage ? [subtitleLanguage] : [],
    subtitleFormat: "srt",
    languages: subtitleLanguage ? [subtitleLanguage] : [],
  };
}

test("lexical ASR is same-language only", () => {
  assert.equal(canUseLexicalAsr(languageContext("en", "en")), true);
  assert.equal(canUseLexicalAsr(languageContext("en", "ar")), false);
  assert.equal(canUseLexicalAsr(languageContext("ja", "ar")), false);
  assert.equal(canUseLexicalAsr(languageContext(null, "ar")), false);
});

test("pipeline skips lexical ASR for English/Arabic and Japanese/Arabic", async () => {
  const run = async (audioLanguage: string, subtitleLanguage: string) => {
    let matchCalls = 0;
    let transcribeCalls = 0;
    const ctx: PipelineContext = {
      ...languageContext(audioLanguage, subtitleLanguage),
      cues: [
        [30, 32],
        [300, 303],
        [1200, 1203],
        [2400, 2403],
      ],
      cueText: ["subtitle one", "subtitle two", "subtitle three", "subtitle four"],
    };
    const ports: TierPorts = {
      measureQuality: async (_ctx, transform) =>
        quality(transform.kind === "affine" && Math.abs(transform.offsetSec) < 1e-9 ? 0.5 : 0.8),
      vadAffine: async () => ({
        transform: { kind: "affine", offsetSec: 2, ratio: 1 },
        rawScore: 0.95,
        quality: { ncc: 0.95, coverage: 0.8, z: 8 },
      }),
      asrMatch: async () => {
        matchCalls += 1;
        return { wordMatch: 0.01, supportsTransform: 0.9 };
      },
      asrTranscribe: async () => {
        transcribeCalls += 1;
        return {
          phrases: [{ start: 30, end: 32, text: "unrelated spoken words" }],
          detectedLanguage: audioLanguage,
        };
      },
    };
    const outcome = await runAutoSync(ctx, ports, {
      tryHarder: true,
      allowStructuralAutoApply: true,
    });
    return { matchCalls, transcribeCalls, outcome };
  };

  const englishArabic = await run("en", "ar");
  assert.equal(englishArabic.matchCalls, 0);
  assert.equal(englishArabic.transcribeCalls, 0);
  assert.doesNotMatch(englishArabic.outcome.decision.reason, /wrong content/i);

  const japaneseArabic = await run("ja", "ar");
  assert.equal(japaneseArabic.matchCalls, 0);
  assert.equal(japaneseArabic.transcribeCalls, 0);

  const englishEnglish = await run("en", "en");
  assert.equal(englishEnglish.matchCalls, 1);
  assert.equal(englishEnglish.transcribeCalls, 1);
});

test("selected audio metadata supplies audioLanguage independently of subtitle language", () => {
  const snap = {
    audioTracks: [
      { id: "ja", label: "Japanese", kind: "audio", lang: "jpn", selected: false, default: true },
      { id: "en", label: "English", kind: "audio", lang: "eng", selected: true },
    ],
  } as PlayerSnapshot;
  assert.equal(audioLanguageFromSnapshot(snap), "en");

  const single = {
    audioTracks: [{ id: "ja", label: "Japanese", kind: "audio", lang: "jpn", selected: false }],
  } as PlayerSnapshot;
  assert.equal(audioLanguageFromSnapshot(single), "ja");

  const selectedUnknown = {
    audioTracks: [
      { id: "ja", label: "Original", kind: "audio", selected: true },
      { id: "en", label: "English", kind: "audio", lang: "eng", selected: false, default: true },
    ],
  } as PlayerSnapshot;
  assert.equal(audioLanguageFromSnapshot(selectedUnknown), null);
});

test("ASR language and ASS application paths are wired conservatively", () => {
  const context = read("src/lib/subtitles/autosync/context.ts");
  assert.match(context, /subLang: ctx\.audioLanguage \|\| null/);
  assert.doesNotMatch(context, /subLang: ctx\.languages\[0\]/);
  assert.doesNotMatch(context, /NEUTRAL_QUALITY|TORRENT_BASELINE/);

  const torrent = read("src/lib/subtitles/autosync/torrent-sync.ts");
  assert.doesNotMatch(torrent, /UNVERIFIED_BASELINE_NCC|BASELINE_Z/);

  const hook = read("src/views/player/hooks/use-auto-sync.ts");
  const protection = hook.indexOf('if (fmt === "ass" || fmt === "ssa")');
  const rewrite = hook.indexOf("const finalCues = transformCues(cues, t);");
  assert.ok(
    protection >= 0 && rewrite > protection,
    "ASS/SSA must be rejected before cue serialization",
  );
  assert.match(hook, /formatOf\(b, activeSelected\)/);

  const driftPorts = read("src/lib/subtitles/autosync/drift-ports.ts");
  assert.doesNotMatch(driftPorts, /asr_confirm_window/);
  assert.doesNotMatch(hook, /enableAsr:/);
});
