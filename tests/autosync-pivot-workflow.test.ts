// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  evaluatePivotGate,
  rankPivotCandidates,
  runPivotWorkflow,
  type PivotCandidate,
  type PivotGateEvidence,
  type PivotWorkflowPorts,
} from "../src/lib/subtitles/autosync/pivot.ts";
import { PIVOT_CUES, TARGET_CUES } from "./fixtures/subtitle-p2-fixtures.ts";

const CORRECT: PivotCandidate = {
  id: "correct-release",
  language: "en",
  exactRelease: true,
  releaseScore: 0.98,
  popularity: 2,
};
const POPULAR_WRONG: PivotCandidate = {
  id: "popular-wrong-edition",
  language: "eng",
  exactRelease: false,
  releaseScore: 0.55,
  wrongEditionRisk: 0.8,
  popularity: 100_000,
};

function completeEvidence(overrides: Partial<PivotGateEvidence> = {}): PivotGateEvidence {
  return {
    pivotAudioValidated: true,
    pivotAudioScore: 0.88,
    pivotAudioCoverage: 0.82,
    pivotHealthy: true,
    targetHealthy: true,
    formatSafe: true,
    anchorCount: 18,
    targetCoverage: 0.84,
    regionCoverage: { beginning: 0.75, middle: 0.8, end: 0.72 },
    heldOutCount: 4,
    heldOutMedianResidualSec: 0.2,
    qualityBefore: 0.42,
    qualityAfter: 0.67,
    finalCoverage: 0.78,
    heldOutAudioMeasured: true,
    releaseAgreement: true,
    independentEvidenceGroups: 3,
    calibrationReady: true,
    bestEffort: false,
    ...overrides,
  };
}

function safePorts(candidates: PivotCandidate[] = [CORRECT]): PivotWorkflowPorts {
  return {
    searchPivotCandidates: async () => candidates,
    preparePivotCandidate: async (candidate) => ({
      cues: candidate.id === CORRECT.id ? PIVOT_CUES : PIVOT_CUES.slice().reverse(),
      healthy: true,
      formatSafe: true,
    }),
    validatePivotAgainstAudio: async (candidate) => ({
      validated: candidate.id === CORRECT.id,
      transform: { kind: "affine", offsetSec: 0, ratio: 1 },
      score: candidate.id === CORRECT.id ? 0.9 : 0.2,
      coverage: candidate.id === CORRECT.id ? 0.85 : 0.1,
      wrongCut: candidate.id !== CORRECT.id,
    }),
    validateTargetAgainstAudio: async () => ({
      qualityBefore: 0.4,
      qualityAfter: 0.7,
      coverage: 0.8,
      heldOutAudioMeasured: true,
    }),
  };
}

test("release compatibility outranks raw popularity", () => {
  assert.deepEqual(
    rankPivotCandidates([POPULAR_WRONG, CORRECT], "en").map((candidate) => candidate.id),
    [CORRECT.id, POPULAR_WRONG.id],
  );
});

test("pivot ranking ties are stable across input order and host locale", () => {
  const tied: PivotCandidate[] = [
    { id: "zeta", language: "en", exactRelease: false, releaseScore: 0.7 },
    { id: "alpha", language: "en", exactRelease: false, releaseScore: 0.7 },
  ];
  const forward = rankPivotCandidates(tied, "en").map((candidate) => candidate.id);
  const reverse = rankPivotCandidates([...tied].reverse(), "en").map((candidate) => candidate.id);

  assert.deepEqual(forward, ["alpha", "zeta"]);
  assert.deepEqual(reverse, forward);
});

test("pivot gate applies only with complete independent and held-out evidence", () => {
  assert.equal(evaluatePivotGate(completeEvidence()).decision, "apply");
  assert.equal(evaluatePivotGate(completeEvidence({ calibrationReady: false })).decision, "offer");
  assert.equal(evaluatePivotGate(completeEvidence({ bestEffort: true })).decision, "offer");
  assert.equal(
    evaluatePivotGate(completeEvidence({ heldOutMedianResidualSec: 2 })).decision,
    "refuse",
  );
  assert.equal(evaluatePivotGate(completeEvidence({ pivotWrongCut: true })).decision, "refuse");
  assert.equal(
    evaluatePivotGate(
      completeEvidence({ regionCoverage: { beginning: 0.8, middle: 0.8, end: 0.1 } }),
    ).decision,
    "refuse",
  );
  assert.equal(
    evaluatePivotGate(completeEvidence({ heldOutAudioMeasured: false })).decision,
    "offer",
  );
});

test("English audio can validate an English pivot and fit an Arabic target", async () => {
  let heldOutWindowCount = 0;
  const ports = safePorts([POPULAR_WRONG, CORRECT]);
  ports.validateTargetAgainstAudio = async (_targetCues, _transform, heldOutWindows) => {
    heldOutWindowCount = heldOutWindows.length;
    assert.ok(heldOutWindows.every((window) => window.toSec > window.fromSec));
    return {
      qualityBefore: 0.4,
      qualityAfter: 0.7,
      coverage: 0.8,
      heldOutAudioMeasured: true,
    };
  };
  const result = await runPivotWorkflow(
    {
      audioLanguage: "en",
      subtitleLanguage: "ar",
      targetCues: TARGET_CUES,
      targetHealthy: true,
      targetFormatSafe: true,
      calibrationReady: true,
    },
    ports,
  );
  assert.equal(result.candidate?.id, CORRECT.id);
  assert.equal(result.fit?.model, "offset");
  assert.equal(result.decision.decision, "apply");
  assert.ok(heldOutWindowCount >= 3);
  assert.ok(
    Math.abs((result.transform?.kind === "affine" ? result.transform.offsetSec : 0) - 2.4) < 0.2,
  );
});

test("missing pivot, provider timeout, and failed quality never auto-apply", async () => {
  const base = {
    audioLanguage: "ja",
    subtitleLanguage: "ar",
    targetCues: TARGET_CUES,
    targetHealthy: true,
    targetFormatSafe: true,
    calibrationReady: true,
  };
  const missing = await runPivotWorkflow(base, safePorts([]));
  assert.equal(missing.decision.decision, "refuse");

  const timeoutPorts = safePorts();
  timeoutPorts.searchPivotCandidates = async () => {
    throw new Error("provider timeout");
  };
  const timeout = await runPivotWorkflow({ ...base, audioLanguage: "en" }, timeoutPorts);
  assert.equal(timeout.decision.decision, "refuse");

  const unhealthyPorts = safePorts();
  unhealthyPorts.preparePivotCandidate = async () => ({
    cues: PIVOT_CUES,
    healthy: false,
    formatSafe: true,
  });
  const unhealthy = await runPivotWorkflow({ ...base, audioLanguage: "en" }, unhealthyPorts);
  assert.equal(unhealthy.decision.decision, "refuse");
});
