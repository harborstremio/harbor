// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  DIRECT_EXPLICIT_HELD_OUT_PROVENANCE,
  DIRECT_HELD_OUT_PROVENANCE,
  TORRENT_EXPLICIT_HELD_OUT_PROVENANCE,
  directScoreInvokeArgs,
  directScoreMeasurement,
  nativeScoreMeasurement,
  torrentScoreInvokeArgs,
} from "../src/lib/subtitles/autosync/direct-validation.ts";
import type { PipelineContext } from "../src/lib/subtitles/autosync/pipeline.ts";

const CONTEXT: PipelineContext = {
  mediaUrl: "file:///movie.mkv",
  sourceKind: "local",
  durationSec: 5_400,
  cues: [
    [10, 12],
    [20, 22],
    [30, 32],
    [40, 42],
  ],
  languages: ["en"],
};
const IDENTITY = { kind: "affine" as const, offsetSec: 0, ratio: 1 };
const REQUEST = {
  purpose: "validation" as const,
  excludeWindowIds: ["fit-early", "fit-late"],
};
const NATIVE = {
  ncc: 0.7,
  coverage: 0.8,
  z: 4,
  windowIds: ["validation-middle-a", "validation-middle-b"],
  provenance: DIRECT_HELD_OUT_PROVENANCE,
};
const EXPLICIT_REQUEST = {
  purpose: "validation" as const,
  validationProvenance: "pivot-anchor-held-out-v1",
  validationWindows: [
    { id: "pivot-held-out-1", fromSec: 400, toSec: 416 },
    { id: "pivot-held-out-2", fromSec: 700, toSec: 716 },
    { id: "pivot-held-out-3", fromSec: 900, toSec: 916 },
  ],
};

test("direct validation request reaches native with excluded fit-window IDs", () => {
  const args = directScoreInvokeArgs(CONTEXT, IDENTITY, REQUEST);
  assert.equal(args.validation, true);
  assert.deepEqual(args.excludeWindowIds, ["fit-early", "fit-late"]);
  assert.deepEqual(args.validationWindows, []);
  assert.equal(args.durationSec, 5_400);
});

test("trusted native middle-window provenance becomes held-out measurement", () => {
  const measurement = directScoreMeasurement(NATIVE, REQUEST);
  assert.equal(measurement.status, "measured");
  assert.deepEqual(measurement.status === "measured" ? measurement.validation?.windowIds : null, [
    "validation-middle-a",
    "validation-middle-b",
  ]);
});

test("missing, overlapping, duplicate, or incomplete provenance remains unknown", () => {
  const cases = [
    { ...NATIVE, provenance: undefined },
    { ...NATIVE, windowIds: ["validation-middle-a"] },
    { ...NATIVE, windowIds: ["validation-middle-a", "validation-middle-a"] },
    { ...NATIVE, windowIds: ["validation-middle-c", "validation-middle-d"] },
    { ...NATIVE, windowIds: ["fit-early", "validation-middle-b"] },
  ];
  for (const native of cases) {
    assert.equal(directScoreMeasurement(native, REQUEST).status, "unknown");
  }
  assert.equal(
    directScoreMeasurement(NATIVE, {
      purpose: "validation",
      excludeWindowIds: ["validation-middle-a"],
    }).status,
    "unknown",
  );
  assert.equal(directScoreMeasurement(null, REQUEST).status, "unknown");
});

test("ordinary non-validation scoring stays measured without held-out claims", () => {
  const measurement = directScoreMeasurement(
    { ...NATIVE, provenance: "direct-analysis-windows-v1" },
    undefined,
  );
  assert.equal(measurement.status, "measured");
  assert.equal(measurement.status === "measured" ? measurement.validation : null, undefined);
});

test("explicit pivot ranges and provenance are preserved exactly", () => {
  const args = directScoreInvokeArgs(CONTEXT, IDENTITY, EXPLICIT_REQUEST);
  assert.deepEqual(args.validationWindows, EXPLICIT_REQUEST.validationWindows);
  assert.equal(args.validationProvenance, "pivot-anchor-held-out-v1");

  const native = {
    ncc: 0.82,
    coverage: 0.79,
    z: 7,
    windowIds: EXPLICIT_REQUEST.validationWindows.map((window) => window.id),
    windows: EXPLICIT_REQUEST.validationWindows,
    provenance: DIRECT_EXPLICIT_HELD_OUT_PROVENANCE,
    requestProvenance: EXPLICIT_REQUEST.validationProvenance,
  };
  const measurement = directScoreMeasurement(native, EXPLICIT_REQUEST);
  assert.equal(measurement.status, "measured");
  assert.deepEqual(
    measurement.status === "measured" ? measurement.validation?.windows : null,
    EXPLICIT_REQUEST.validationWindows,
  );
  assert.equal(
    directScoreMeasurement(
      {
        ...native,
        windows: [
          { ...EXPLICIT_REQUEST.validationWindows[0], fromSec: 401 },
          ...EXPLICIT_REQUEST.validationWindows.slice(1),
        ],
      },
      EXPLICIT_REQUEST,
    ).status,
    "unknown",
  );
});

test("torrent held-out measurements are trusted only with torrent provenance", () => {
  const args = torrentScoreInvokeArgs(
    { ...CONTEXT, sourceKind: "torrent", infoHash: "abcdef" },
    IDENTITY,
    "abcdef",
    2,
    123,
    EXPLICIT_REQUEST,
  );
  assert.equal(args.validation, true);
  assert.equal(args.infoHash, "abcdef");
  assert.deepEqual(args.validationWindows, EXPLICIT_REQUEST.validationWindows);
  const native = {
    ncc: 0.75,
    coverage: 0.72,
    z: 6,
    windowIds: EXPLICIT_REQUEST.validationWindows.map((window) => window.id),
    windows: EXPLICIT_REQUEST.validationWindows,
    provenance: TORRENT_EXPLICIT_HELD_OUT_PROVENANCE,
    requestProvenance: EXPLICIT_REQUEST.validationProvenance,
  };
  assert.equal(
    nativeScoreMeasurement(native, EXPLICIT_REQUEST, "torrent-score-transform", "torrent").status,
    "measured",
  );
  assert.equal(
    nativeScoreMeasurement(
      { ...native, provenance: DIRECT_EXPLICIT_HELD_OUT_PROVENANCE },
      EXPLICIT_REQUEST,
      "torrent-score-transform",
      "torrent",
    ).status,
    "unknown",
  );
});
