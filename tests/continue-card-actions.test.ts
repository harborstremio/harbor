// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const continueCardSource = readFileSync(
  new URL("../src/components/continue-card.tsx", import.meta.url),
  "utf8",
);

test("Continue Watching keeps source selection, direct play, and details as separate actions", () => {
  assert.match(
    continueCardSource,
    /const onChooseSource[\s\S]*?openPicker\(meta, episode, \{ autoPlay: false, resume: false \}\)/,
  );
  assert.match(
    continueCardSource,
    /playStream: \(\) => openPicker\(meta, episode, \{ autoPlay: true, resume: true \}\)/,
  );
  assert.match(continueCardSource, /onClick=\{onOpenDetails\}/);
});
