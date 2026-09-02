// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  DEFAULT_BUNDLE,
  type CalibrationBundle,
} from "../src/lib/subtitles/autosync/calibration.ts";
import {
  measuredQuality,
  unknownQuality,
  type QualityMeasurementRequest,
} from "../src/lib/subtitles/autosync/fp-gate.ts";
import {
  DIRECT_EXPLICIT_HELD_OUT_PROVENANCE,
  DIRECT_HELD_OUT_PROVENANCE,
} from "../src/lib/subtitles/autosync/direct-validation.ts";
import {
  PIVOT_HELD_OUT_PROVENANCE,
  PIVOT_VAD_HELD_OUT_PROVENANCE,
  isExperimentalPivotEligible,
  pivotHeldOutQualityRequest,
  preferAutoSyncOutcome,
  runExperimentalPivotAutoSync,
  type PivotRuntimeSettings,
} from "../src/lib/subtitles/autosync/pivot-runtime.ts";
import type {
  PipelineContext,
  PipelineOutcome,
  TierPorts,
} from "../src/lib/subtitles/autosync/pipeline.ts";
import type { PreparedSubtitle } from "../src/lib/subtitles/prepare.ts";
import type { SubResult, SubSearchQuery } from "../src/lib/subtitles/types.ts";
import type { PlayerSrc } from "../src/lib/view.tsx";
import { PIVOT_CUES, TARGET_CUES } from "./fixtures/subtitle-p2-fixtures.ts";

const SETTINGS: PivotRuntimeSettings = {
  subtitleAutoSyncPivot: true,
  autoSyncApplyStructural: true,
  subProvidersEnabled: {
    wyzie: false,
    opensubtitles: true,
    jimaku: false,
    addons: false,
    subdl: false,
    subsource: false,
  },
  subdlApiKey: "",
  subsourceApiKey: "",
};

const SOURCE: PlayerSrc = {
  meta: { id: "tt1234567", type: "movie", name: "Pivot Example" },
  imdbId: "tt1234567",
  url: "https://media.example/video.mkv",
  title: "Pivot Example",
  streamRef: {
    title: "Pivot.Example.1080p.WEB-DL-GROUP",
    source: "WEB-DL",
    resolution: "1080p",
    size: 1_000_000,
  },
};

const CONTEXT: PipelineContext = {
  mediaUrl: SOURCE.url,
  sourceKind: "http",
  durationSec: 100,
  cues: TARGET_CUES.map((cue) => [cue.start, cue.end]),
  cueText: TARGET_CUES.map((cue) => cue.text),
  moviebytesize: SOURCE.streamRef?.size ?? undefined,
  audioLanguage: "en",
  subtitleLanguage: "ar",
  preferredSubtitleLanguages: ["ar"],
  subtitleFormat: "srt",
  languages: ["ar"],
  meta: { imdbId: SOURCE.imdbId },
};

const RESULT: SubResult = {
  id: "release-match",
  url: "https://subs.example/pivot.srt",
  lang: "en",
  source: "opensubtitles",
  format: "srt",
  release: SOURCE.streamRef?.title ?? undefined,
  downloads: 400,
  providerMatch: { confidence: "exact", score: 1, matchedBy: ["release"] },
};

function prepared(cleanup: () => void): PreparedSubtitle {
  return {
    originalUrl: RESULT.url,
    playableUrl: "blob:pivot",
    format: "srt",
    cues: PIVOT_CUES,
    text: PIVOT_CUES.map((cue) => cue.text).join("\n"),
    encoding: "utf-8",
    encodingHealth: 1,
    encodingDiagnostics: [],
    release: RESULT.release,
    rawFilename: "pivot.srt",
    archive: false,
    cleanup,
  };
}

function releaseReadyCalibration(): CalibrationBundle {
  return {
    ...DEFAULT_BUNDLE,
    provisional: false,
    metrics: {
      n: 1_000,
      eceBefore: 0.02,
      eceAfter: 0.01,
      brierBefore: 0.03,
      brierAfter: 0.02,
      falseApplyUpper: 0.001,
      appliedN: 500,
      falseApplies: 0,
    },
  };
}

function measuredPorts(targetMeasured = true, observedTargetCueCounts: number[] = []): TierPorts {
  return {
    measureQuality: async (ctx, transform, request) => {
      if (ctx.subtitleLanguage === "en") {
        const validationWindows = request?.validationWindows;
        return measuredQuality(
          { ncc: 0.9, coverage: 0.85, z: 4 },
          "pivot-audio",
          request?.purpose === "validation"
            ? {
                kind: "held-out",
                windowIds: validationWindows?.map((window) => window.id) ?? [
                  "validation-middle-a",
                  "validation-middle-b",
                ],
                ...(validationWindows ? { windows: validationWindows } : {}),
                provenance: validationWindows
                  ? DIRECT_EXPLICIT_HELD_OUT_PROVENANCE
                  : DIRECT_HELD_OUT_PROVENANCE,
                ...(request.validationProvenance
                  ? { requestProvenance: request.validationProvenance }
                  : {}),
              }
            : undefined,
        );
      }
      observedTargetCueCounts.push(ctx.cues.length);
      if (!targetMeasured) return unknownQuality("insufficient-data", "held-out-target");
      const offset = transform.kind === "affine" ? Math.abs(transform.offsetSec) : 1;
      return measuredQuality(
        offset < 0.1 ? { ncc: 0.4, coverage: 0.8, z: 1 } : { ncc: 0.7, coverage: 0.8, z: 3 },
        "held-out-target",
        request?.validationWindows
          ? {
              kind: "held-out",
              windowIds: request.validationWindows.map((window) => window.id),
              windows: request.validationWindows,
              provenance: DIRECT_EXPLICIT_HELD_OUT_PROVENANCE,
              requestProvenance: request.validationProvenance,
            }
          : undefined,
      );
    },
  };
}

function dependencies(
  options: {
    cleanup?: () => void;
    calibration?: CalibrationBundle;
    onSearch?: (query: SubSearchQuery) => void;
  } = {},
) {
  return {
    searchSubtitles: async (query: SubSearchQuery) => {
      options.onSearch?.(query);
      return [RESULT];
    },
    gatherSubtitleAddons: async () => [],
    prepareSubtitle: async () => prepared(options.cleanup ?? (() => {})),
    calibration: options.calibration,
  };
}

function outcome(decision: "refuse" | "offer" | "apply", pCorrect: number): PipelineOutcome {
  const transform = { kind: "affine" as const, offsetSec: 0, ratio: 1 };
  return {
    decision: {
      decision,
      reason: "base",
      pCorrect,
      transform,
      bindingRule: "base",
    },
    candidate: transform,
    evidence: [],
    tiersRun: [],
  };
}

test("experimental pivot is off by default and never runs for a same-language track", async () => {
  let searches = 0;
  const deps = dependencies({ onSearch: () => searches++ });
  const disabled = await runExperimentalPivotAutoSync(
    {
      ctx: CONTEXT,
      ports: measuredPorts(),
      settings: { ...SETTINGS, subtitleAutoSyncPivot: false },
      src: SOURCE,
    },
    deps,
  );
  const sameLanguage = await runExperimentalPivotAutoSync(
    {
      ctx: { ...CONTEXT, subtitleLanguage: "eng" },
      ports: measuredPorts(),
      settings: SETTINGS,
      src: SOURCE,
    },
    deps,
  );
  assert.equal(disabled, null);
  assert.equal(sameLanguage, null);
  assert.equal(searches, 0);
  assert.equal(isExperimentalPivotEligible(CONTEXT, SETTINGS), true);
});

test("pivot held-out requests preserve the exact anchor-derived audio ranges", () => {
  const request = pivotHeldOutQualityRequest(
    [
      { sourceSec: 10, expectedTargetSec: 12, fromSec: 4, toSec: 20 },
      { sourceSec: 40, expectedTargetSec: 42, fromSec: 34, toSec: 50 },
      { sourceSec: 70, expectedTargetSec: 72, fromSec: 64, toSec: 80 },
    ],
    100,
  );
  assert.equal(request?.validationProvenance, PIVOT_HELD_OUT_PROVENANCE);
  assert.deepEqual(
    request?.validationWindows?.map(({ fromSec, toSec }) => [fromSec, toSec]),
    [
      [4, 20],
      [34, 50],
      [64, 80],
    ],
  );
  assert.equal(
    pivotHeldOutQualityRequest(
      [
        { sourceSec: 10, expectedTargetSec: 12, fromSec: 4, toSec: 20 },
        { sourceSec: 15, expectedTargetSec: 17, fromSec: 9, toSec: 25 },
        { sourceSec: 70, expectedTargetSec: 72, fromSec: 64, toSec: 80 },
      ],
      100,
    ),
    null,
  );
});

test("pivot VAD validation excludes every fit window", async () => {
  const pivotRequests: Array<{
    offsetSec: number;
    request: QualityMeasurementRequest | undefined;
  }> = [];
  const ports = measuredPorts();
  ports.vadAffine = async () => ({
    transform: { kind: "affine", offsetSec: 1.25, ratio: 1 },
    quality: { ncc: 0.82, coverage: 0.78, z: 3.2 },
    fitWindowIds: ["fit-early", "fit-late"],
  });
  const baseMeasure = ports.measureQuality;
  ports.measureQuality = async (ctx, transform, request) => {
    if (ctx.subtitleLanguage === "en" && transform.kind === "affine") {
      pivotRequests.push({ offsetSec: transform.offsetSec, request });
    }
    return baseMeasure(ctx, transform, request);
  };

  await runExperimentalPivotAutoSync(
    { ctx: CONTEXT, ports, settings: SETTINGS, src: SOURCE },
    dependencies(),
  );

  assert.deepEqual(
    pivotRequests.map(({ offsetSec }) => offsetSec),
    [0, 1.25],
  );
  assert.ok(
    pivotRequests.every(
      ({ request }) =>
        request?.validationProvenance === PIVOT_VAD_HELD_OUT_PROVENANCE &&
        request.excludeWindowIds?.join(",") === "fit-early,fit-late",
    ),
  );
});

test("pivot VAD requires a material improvement with trusted matching held-out evidence", async () => {
  const run = async ({
    fittedNcc,
    fittedCoverage = 0.85,
    identityNcc = 0.7,
    fittedProvenance = DIRECT_HELD_OUT_PROVENANCE,
    fittedRequestProvenance,
    fittedWindowIds = ["validation-middle-a", "validation-middle-b"],
    fitWindowIds = ["fit-early", "fit-late"],
  }: {
    fittedNcc: number;
    fittedCoverage?: number;
    identityNcc?: number;
    fittedProvenance?: string;
    fittedRequestProvenance?: string;
    fittedWindowIds?: string[];
    fitWindowIds?: string[] | null;
  }) => {
    const ports = measuredPorts();
    ports.vadAffine = async () => ({
      transform: { kind: "affine", offsetSec: 1.25, ratio: 1 },
      quality: { ncc: 0.82, coverage: 0.78, z: 3.2 },
      ...(fitWindowIds ? { fitWindowIds } : {}),
    });
    const baseMeasure = ports.measureQuality;
    ports.measureQuality = async (ctx, transform, request) => {
      if (ctx.subtitleLanguage !== "en" || transform.kind !== "affine") {
        return baseMeasure(ctx, transform, request);
      }
      const fitted = Math.abs(transform.offsetSec - 1.25) < 0.001;
      return measuredQuality(
        {
          ncc: fitted ? fittedNcc : identityNcc,
          coverage: fitted ? fittedCoverage : 0.85,
          z: fitted ? 4 : 3,
        },
        "pivot-audio",
        {
          kind: "held-out",
          windowIds: fitted ? fittedWindowIds : ["validation-middle-a", "validation-middle-b"],
          provenance: fitted ? fittedProvenance : DIRECT_HELD_OUT_PROVENANCE,
          requestProvenance:
            fitted && fittedRequestProvenance !== undefined
              ? fittedRequestProvenance
              : request?.validationProvenance,
        },
      );
    };
    return runExperimentalPivotAutoSync(
      { ctx: CONTEXT, ports, settings: SETTINGS, src: SOURCE },
      dependencies(),
    );
  };

  const marginal = await run({ fittedNcc: 0.77 });
  assert.ok(
    marginal?.candidate?.kind === "affine" && Math.abs(marginal.candidate.offsetSec - 2.4) < 0.2,
  );

  const material = await run({ fittedNcc: 0.8 });
  assert.ok(
    material?.candidate?.kind === "affine" && Math.abs(material.candidate.offsetSec - 3.65) < 0.2,
  );

  const exactThreshold = await run({ fittedNcc: 0.88, identityNcc: 0.8 });
  assert.ok(
    exactThreshold?.candidate?.kind === "affine" &&
      Math.abs(exactThreshold.candidate.offsetSec - 3.65) < 0.2,
  );

  const untrusted = await run({ fittedNcc: 0.95, fittedProvenance: "untrusted-held-out-v1" });
  assert.ok(
    untrusted?.candidate?.kind === "affine" && Math.abs(untrusted.candidate.offsetSec - 2.4) < 0.2,
  );

  const mismatched = await run({
    fittedNcc: 0.95,
    fittedWindowIds: ["validation-middle-a", "validation-middle-c"],
  });
  assert.ok(
    mismatched?.candidate?.kind === "affine" &&
      Math.abs(mismatched.candidate.offsetSec - 2.4) < 0.2,
  );

  const mismatchedRequestProvenance = await run({
    fittedNcc: 0.95,
    fittedRequestProvenance: "wrong-pivot-request-v1",
  });
  assert.ok(
    mismatchedRequestProvenance?.candidate?.kind === "affine" &&
      Math.abs(mismatchedRequestProvenance.candidate.offsetSec - 2.4) < 0.2,
  );

  const insufficientCoverage = await run({ fittedNcc: 0.95, fittedCoverage: 0.3 });
  assert.ok(
    insufficientCoverage?.candidate?.kind === "affine" &&
      Math.abs(insufficientCoverage.candidate.offsetSec - 2.4) < 0.2,
  );

  const invalidFitWindowSets: Array<string[] | null> = [["fit-early", "fit-early"], null];
  for (const fitWindowIds of invalidFitWindowSets) {
    const invalidFitWindows = await run({ fittedNcc: 0.95, fitWindowIds });
    assert.ok(
      invalidFitWindows?.candidate?.kind === "affine" &&
        Math.abs(invalidFitWindows.candidate.offsetSec - 2.4) < 0.2,
    );
  }
});

test("runtime searches in the audio language and validates only held-out target cues", async () => {
  let query: SubSearchQuery | null = null;
  let cleaned = 0;
  const targetCueCounts: number[] = [];
  const result = await runExperimentalPivotAutoSync(
    {
      ctx: CONTEXT,
      ports: measuredPorts(true, targetCueCounts),
      settings: SETTINGS,
      src: SOURCE,
    },
    dependencies({ cleanup: () => cleaned++, onSearch: (value) => (query = value) }),
  );
  assert.deepEqual(query?.langs, ["en"]);
  assert.equal(query?.imdbId, SOURCE.imdbId);
  assert.equal(result?.decision.decision, "offer");
  assert.equal(result?.decision.bindingRule, "pivot-safety-ceiling");
  assert.ok(result?.candidate?.kind === "affine");
  assert.ok(
    result?.candidate?.kind === "affine" && Math.abs(result.candidate.offsetSec - 2.4) < 0.2,
  );
  assert.ok(targetCueCounts.length >= 2);
  assert.ok(targetCueCounts.every((count) => count >= 3 && count < TARGET_CUES.length));
  assert.equal(cleaned, 1);
});

test("release-ready pivot applies only when held-out audio quality is measured", async () => {
  const calibration = releaseReadyCalibration();
  const measured = await runExperimentalPivotAutoSync(
    { ctx: CONTEXT, ports: measuredPorts(), settings: SETTINGS, src: SOURCE },
    dependencies({ calibration }),
  );
  const unknown = await runExperimentalPivotAutoSync(
    { ctx: CONTEXT, ports: measuredPorts(false), settings: SETTINGS, src: SOURCE },
    dependencies({ calibration }),
  );
  assert.equal(measured?.decision.decision, "apply");
  assert.notEqual(unknown?.decision.decision, "apply");
});

test("pivot outcome augments a refusal but never displaces an existing apply", async () => {
  const pivot = await runExperimentalPivotAutoSync(
    { ctx: CONTEXT, ports: measuredPorts(), settings: SETTINGS, src: SOURCE },
    dependencies(),
  );
  assert.equal(preferAutoSyncOutcome(outcome("refuse", 0.2), pivot).decision.decision, "offer");
  assert.equal(preferAutoSyncOutcome(outcome("apply", 0.99), pivot).decision.bindingRule, "base");
});

test("provider failure leaves the normal autosync outcome untouched", async () => {
  const pivot = await runExperimentalPivotAutoSync(
    { ctx: CONTEXT, ports: measuredPorts(), settings: SETTINGS, src: SOURCE },
    {
      ...dependencies(),
      searchSubtitles: async () => {
        throw new Error("provider timeout");
      },
    },
  );
  const base = outcome("refuse", 0.3);
  assert.equal(pivot, null);
  assert.equal(preferAutoSyncOutcome(base, pivot), base);
});

test("pivot addon discovery receives the signed-in auth key", async () => {
  let discoveredWith: string | null | undefined;
  const result = await runExperimentalPivotAutoSync(
    {
      ctx: CONTEXT,
      ports: measuredPorts(),
      settings: {
        ...SETTINGS,
        subProvidersEnabled: { ...SETTINGS.subProvidersEnabled, addons: true },
      },
      src: SOURCE,
      authKey: "signed-in-auth-key",
    },
    {
      ...dependencies(),
      gatherSubtitleAddons: async (authKey) => {
        discoveredWith = authKey;
        return [];
      },
    },
  );

  assert.ok(result);
  assert.equal(discoveredWith, "signed-in-auth-key");
});
