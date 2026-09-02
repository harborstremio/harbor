// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  applyTimeTransform,
  fitPreferredTimeTransform,
  type TimeAnchor,
} from "../src/lib/subtitles/autosync/alignment-fit.ts";
import { alignCuesMonotonically } from "../src/lib/subtitles/autosync/monotonic-align.ts";
import {
  PIVOT_CUES,
  PIVOT_WITH_EXTRA_RECAP,
  TARGET_CUES,
  TARGET_WITH_MISSING_INTRO,
} from "./fixtures/subtitle-p2-fixtures.ts";

function anchorsFor(transform: (source: number) => number, count = 12): TimeAnchor[] {
  return Array.from({ length: count }, (_, index) => {
    const sourceSec = index * 60;
    return { sourceSec, targetSec: transform(sourceSec) };
  });
}

test("fit preference keeps identity and offset models simple", () => {
  const identity = fitPreferredTimeTransform(anchorsFor((source) => source + 0.03));
  assert.equal(identity?.model, "identity");

  const offset = fitPreferredTimeTransform(anchorsFor((source) => source + 2.4));
  assert.equal(offset?.model, "offset");
  assert.ok(Math.abs(applyTimeTransform(offset!.transform, 300) - 302.4) < 0.01);
});

test("exact 23.976 to 25 drift selects an affine model", () => {
  const ratio = 25 / 23.976;
  const fit = fitPreferredTimeTransform(anchorsFor((source) => 1.25 + ratio * source));
  assert.equal(fit?.model, "affine");
  assert.ok(Math.abs(applyTimeTransform(fit!.transform, 500) - (1.25 + ratio * 500)) < 0.02);
});

test("a real discontinuity can earn a regularized piecewise model", () => {
  const anchors = Array.from({ length: 14 }, (_, index) => {
    const sourceSec = index * 45;
    return {
      sourceSec,
      targetSec: sourceSec + (index < 7 ? 2 : 6),
    };
  });
  const fit = fitPreferredTimeTransform(anchors);
  assert.equal(fit?.model, "piecewise");
  assert.ok(Math.abs(applyTimeTransform(fit!.transform, 90) - 92) < 0.2);
  assert.ok(Math.abs(applyTimeTransform(fit!.transform, 500) - 506) < 0.2);
  assert.ok(fit?.transform.kind === "piecewise");
  const secondSegment = fit.transform.segments[1];
  assert.equal(
    applyTimeTransform(fit.transform, secondSegment.fromSec),
    secondSegment.offsetSec + secondSegment.ratio * secondSegment.fromSec,
  );
});

test("piecewise fitting rejects a boundary that would move time backward", () => {
  const anchors = [0, 10, 20, 30, 50, 60, 70, 80].map((sourceSec) => ({
    sourceSec,
    targetSec: sourceSec <= 30 ? sourceSec * 1.2 : sourceSec * 0.8 + 5,
  }));
  for (let index = 1; index < anchors.length; index += 1) {
    assert.ok(anchors[index].sourceSec > anchors[index - 1].sourceSec);
    assert.ok(anchors[index].targetSec > anchors[index - 1].targetSec);
  }
  const fit = fitPreferredTimeTransform(anchors);

  assert.notEqual(fit?.model, "piecewise");
  assert.ok(fit?.diagnostics.includes("non-monotonic-piecewise-rejected"));
  let previous = applyTimeTransform(fit!.transform, 0);
  for (let sourceSec = 0.25; sourceSec <= 80; sourceSec += 0.25) {
    const current = applyTimeTransform(fit!.transform, sourceSec);
    assert.ok(current >= previous);
    previous = current;
  }
});

test("monotonic alignment creates ordered anchors across the full timeline", () => {
  const result = alignCuesMonotonically(TARGET_CUES, PIVOT_CUES);
  assert.ok(result.anchors.length >= 15);
  assert.ok(result.targetCoverage >= 0.8);
  assert.ok(result.regionCoverage.beginning > 0.5);
  assert.ok(result.regionCoverage.middle > 0.5);
  assert.ok(result.regionCoverage.end > 0.5);
  for (let index = 1; index < result.anchors.length; index += 1) {
    assert.ok(result.anchors[index].sourceSec > result.anchors[index - 1].sourceSec);
    assert.ok(result.anchors[index].targetSec > result.anchors[index - 1].targetSec);
  }
});

test("monotonic alignment handles 1:2 blocks, skips, and deterministic ties", () => {
  const pivot = [...PIVOT_CUES];
  const split = pivot[5];
  pivot.splice(
    5,
    1,
    { start: split.start, end: (split.start + split.end) / 2, text: "English 6 part one" },
    { start: (split.start + split.end) / 2, end: split.end, text: "English 6 part two" },
  );
  pivot.splice(0, 0, { start: 0, end: 0.8, text: "Previously" });
  const first = alignCuesMonotonically(TARGET_CUES, pivot, { bandFraction: 0.3 });
  const second = alignCuesMonotonically(TARGET_CUES, pivot, { bandFraction: 0.3 });
  assert.deepEqual(first, second);
  assert.ok(first.matches.some((match) => match.transition === "1:2"));
  assert.ok(first.targetCoverage >= 0.65);

  const splitTarget = [...TARGET_CUES];
  const targetCue = splitTarget[8];
  splitTarget.splice(
    8,
    1,
    {
      start: targetCue.start,
      end: (targetCue.start + targetCue.end) / 2,
      text: "الجملة 9 الجزء 1",
    },
    { start: (targetCue.start + targetCue.end) / 2, end: targetCue.end, text: "الجملة 9 الجزء 2" },
  );
  const merged = alignCuesMonotonically(splitTarget, PIVOT_CUES, { bandFraction: 0.3 });
  assert.ok(merged.matches.some((match) => match.transition === "2:1"));
});

test("missing intros and extra recaps are skipped without corrupting the fitted offset", () => {
  for (const [target, pivot] of [
    [TARGET_WITH_MISSING_INTRO, PIVOT_CUES],
    [TARGET_CUES, PIVOT_WITH_EXTRA_RECAP],
  ] as const) {
    const aligned = alignCuesMonotonically(target, pivot, { bandFraction: 0.35 });
    const fit = fitPreferredTimeTransform(aligned.anchors);
    assert.ok(aligned.targetCoverage >= 0.8);
    assert.equal(fit?.model, "offset");
    assert.ok(
      Math.abs((fit?.transform.kind === "affine" ? fit.transform.offsetSec : 0) - 2.4) < 0.2,
    );
  }
});
