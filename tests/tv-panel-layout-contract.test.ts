// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import { readTvContract, type TvContract } from "./_tv-panel-kotlin.ts";
import type { TvRow } from "../src/views/settings/tv-panel/model.ts";
import {
  SUB_LOOK_GROUP,
  SUB_LOOK_ROWS,
  SUB_PRESETS,
  SUB_TINTS,
} from "../src/views/settings/tv-panel/model-look.ts";

const SPANS: Record<string, [string, string, string]> = {
  subLookSize: ["SUB_SIZE_MIN", "SUB_SIZE_MAX", "SUB_SIZE_STEP"],
  subLookOpacity: ["SUB_OPACITY_MIN", "SUB_OPACITY_MAX", "SUB_OPACITY_STEP"],
  subLookOutline: ["SUB_OUTLINE_MIN", "SUB_OUTLINE_MAX", "SUB_OUTLINE_STEP"],
  subLookBoxOpacity: ["SUB_BOX_OPACITY_MIN", "SUB_BOX_OPACITY_MAX", "SUB_BOX_OPACITY_STEP"],
  subLookBottom: ["SUB_BOTTOM_MIN", "SUB_BOTTOM_MAX", "SUB_BOTTOM_STEP"],
  subLookGap: ["SUB_GAP_MIN", "SUB_GAP_MAX", "SUB_GAP_STEP"],
};

const NAMED: Record<string, string> = {
  subLookTint: "SubTint",
  subLookEdgeTint: "SubTint",
  subLookBoxTint: "SubTint",
  subLookEdge: "SubEdge",
  subLookAlign: "SubAlign",
  subLookFamily: "SubFamily",
};

const OFF_GRID_THE_TV_SNAPS = [
  "cinema.subLookOpacity 96 becomes 95",
  "cinema.subLookSize 115 becomes 110",
  "clear.subLookGap 10 becomes 8",
  "default.subLookGap 6 becomes 4",
  "minimal.subLookBottom 5 becomes 4",
  "minimal.subLookOpacity 88 becomes 85",
  "minimal.subLookSize 85 becomes 80",
  "row.subLookGap 6 becomes 4",
];

const hasTvSource = existsSync(
  new URL("../android-native/app/src/main/java/com/harbor/tv/SettingsPage.kt", import.meta.url),
);
const contractTest = hasTvSource ? test : test.skip;
const kt: TvContract = hasTvSource
  ? readTvContract()
  : {
      items: [],
      settingsWire: new Map(),
      layoutWire: new Map(),
      numbers: new Map(),
      enums: new Map(),
    };
const byKey = new Map<string, TvRow>(SUB_LOOK_ROWS.map((r) => [r.key, r]));

function span(key: string): { min: number; max: number; step: number } {
  const names = SPANS[key];
  assert.ok(names, `${key} is a step row with no Kotlin span to check it against`);
  const read = (n: string) => {
    const held = kt.numbers.get(n);
    assert.ok(held !== undefined, `${n} is gone from the TV source`);
    return held as number;
  };
  return { min: read(names[0]), max: read(names[1]), step: read(names[2]) };
}

function snapped(value: number, min: number, max: number, step: number): number {
  const held = Math.min(max, Math.max(min, value));
  return Math.min(max, Math.max(min, min + Math.trunc((held - min) / step) * step));
}

contractTest("the layout wire and the desktop subtitle rows carry the same keys", () => {
  assert.equal(byKey.size, SUB_LOOK_ROWS.length, "model-look.ts declares the same key twice");
  assert.deepEqual(
    SUB_LOOK_ROWS.map((r) => r.key).filter((k) => !kt.layoutWire.has(k)),
    [],
    "model-look.ts pushes keys the TV layout wire drops on the floor",
  );
  assert.deepEqual(
    [...kt.layoutWire.keys()].filter((k) => !byKey.has(k)),
    [],
    "the TV layout wire carries keys the desktop panel never offers",
  );
  assert.equal(SUB_LOOK_GROUP.wire, "playerlayout", "the subtitle group writes to the wrong doc");
});

contractTest("layout kinds agree with the wire", () => {
  for (const row of SUB_LOOK_ROWS) {
    const letter = kt.layoutWire.get(row.key);
    if (letter === "b") {
      assert.equal(row.kind, "toggle", `${row.key} is a boolean on the wire`);
      continue;
    }
    assert.equal(letter, "s", `${row.key} is ${letter} on the wire, which the TV cannot store`);
    assert.ok(
      row.kind === "step" || row.kind === "choice",
      `${row.key} is ${row.kind}, which does not serialise to a string`,
    );
  }
});

contractTest("layout keys never leak onto the settings wire", () => {
  for (const row of SUB_LOOK_ROWS) {
    assert.ok(!kt.settingsWire.has(row.key), `${row.key} is on both wires`);
  }
});

contractTest("step rows match the Kotlin span and stride", () => {
  for (const row of SUB_LOOK_ROWS) {
    if (row.kind !== "step") continue;
    const want = span(row.key);
    assert.equal(row.min, want.min, `${row.key} min drifted`);
    assert.equal(row.max, want.max, `${row.key} max drifted`);
    assert.equal(row.step, want.step, `${row.key} step drifted`);
    assert.ok(
      row.def >= want.min && row.def <= want.max,
      `${row.key} defaults to ${row.def}, outside ${want.min}..${want.max}`,
    );
  }
});

contractTest("choice rows match the Kotlin enum, values and labels", () => {
  for (const row of SUB_LOOK_ROWS) {
    if (row.kind !== "choice") continue;
    const name = NAMED[row.key];
    assert.ok(name, `${row.key} is a choice row with no Kotlin enum behind it`);
    const entries = kt.enums.get(name);
    assert.ok(entries, `enum ${name} is gone`);
    assert.deepEqual(
      row.options.map((o) => o.value),
      entries.map((e) => e.value),
      `${row.key} option values drifted from ${name}`,
    );
    assert.deepEqual(
      row.options.map((o) => o.label),
      entries.map((e) => e.label),
      `${row.key} option labels drifted from ${name}`,
    );
    assert.ok(
      row.options.some((o) => o.value === row.def),
      `${row.key} defaults to ${row.def}, which it never offers`,
    );
  }
});

contractTest("tint swatches keep every enum name", () => {
  const entries = kt.enums.get("SubTint");
  assert.ok(entries, "enum SubTint is gone");
  assert.deepEqual(
    SUB_TINTS.map((t) => t.value),
    entries.map((e) => e.value),
    "the desktop swatch list drifted from SubTint",
  );
});

contractTest("no new value lands off the stride the TV snaps to", () => {
  const found: string[] = [];
  const note = (owner: string, key: string, raw: number) => {
    const want = span(key);
    const landed = snapped(raw, want.min, want.max, want.step);
    if (landed !== raw) found.push(`${owner}.${key} ${raw} becomes ${landed}`);
  };
  for (const row of SUB_LOOK_ROWS) if (row.kind === "step") note("row", row.key, row.def);
  for (const preset of SUB_PRESETS) {
    for (const [key, held] of Object.entries(preset.values)) {
      if (byKey.get(key)?.kind !== "step") continue;
      note(preset.id, key, Number(held));
    }
  }
  assert.deepEqual(
    found.sort(),
    OFF_GRID_THE_TV_SNAPS,
    "the TV floors every subtitle number to its stride, so these render as something else " +
      "than the desktop shows and the ack still says applied. Fix the value on both sides, " +
      "then delete it from OFF_GRID_THE_TV_SNAPS.",
  );
});

contractTest("model-look.ts stays ASCII", () => {
  const raw = readFileSync(
    new URL("../src/views/settings/tv-panel/model-look.ts", import.meta.url),
  ) as Uint8Array;
  const bad = [...raw].findIndex((b) => b > 126);
  assert.equal(bad, -1, `model-look.ts has a non-ASCII byte at ${bad}`);
});
