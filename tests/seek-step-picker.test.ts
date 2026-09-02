// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { SEEK_STEP_OPTIONS, sanitizeSeekStep } from "../src/lib/seek-step.ts";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const btn = readFileSync(at("src/components/player/transport/seek-step-btn.tsx"), "utf8");
const keys = readFileSync(at("src/views/player/hooks/use-keyboard-shortcuts.ts"), "utf8");

test("the picker offers both seek steps, not just the arrow one", () => {
  assert.match(btn, /const shortSeconds = sanitizeSeekStep\(/);
  assert.match(btn, /settings\.seekBackStepShortSec : settings\.seekForwardStepShortSec/);
  assert.equal(btn.match(/<SeekGroup/g)?.length, 2);
  assert.match(btn, /label=\{t\("Arrows"\)\}/);
  assert.match(btn, /label=\{t\("Shift \+ Arrows"\)\}/);
});

test("each column writes the setting its own shortcut reads", () => {
  assert.match(btn, /update\(\{ seekBackStepSec: s \}\)/);
  assert.match(btn, /update\(\{ seekForwardStepSec: s \}\)/);
  assert.match(btn, /update\(\{ seekBackStepShortSec: s \}\)/);
  assert.match(btn, /update\(\{ seekForwardStepShortSec: s \}\)/);
  assert.match(keys, /seekStep\(-seekBackStepShortSec\)/);
  assert.match(keys, /seekStep\(seekForwardStepShortSec\)/);
});

test("both columns offer the same sanitized option set", () => {
  assert.deepEqual([...SEEK_STEP_OPTIONS], [1, 3, 5, 10, 15, 30, 60, 90]);
  for (const s of SEEK_STEP_OPTIONS) assert.equal(sanitizeSeekStep(s, 10), s);
  assert.equal(sanitizeSeekStep(7, 10), 10, "an off-scale value falls back");
  assert.equal(sanitizeSeekStep(undefined, 3), 3);
});

test("the short column falls back to the shipped default", () => {
  const defaults = readFileSync(at("src/lib/settings/defaults.ts"), "utf8");
  assert.match(defaults, /seekBackStepShortSec: 3/);
  assert.match(defaults, /seekForwardStepShortSec: 3/);
  assert.match(btn, /const DEFAULT_SHORT_SEC = 3;/);
});
