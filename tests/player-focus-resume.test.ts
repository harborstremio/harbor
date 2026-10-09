// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(
  new URL("../src/views/player/hooks/use-pause-on-inactive.ts", import.meta.url),
  "utf8",
);

test("returning focus resumes playback that Harbor auto-paused", () => {
  const focusBranch = source.match(/else if \(autoPausedRef\.current\) \{[\s\S]*?\n\s{8}\}/);

  assert.ok(focusBranch, "auto-pause focus-return branch is missing");
  assert.match(focusBranch[0], /autoPausedRef\.current = false;/);
  assert.match(focusBranch[0], /void bridge\.play\(\);/);
  assert.doesNotMatch(
    focusBranch[0],
    /snapRef\.current\.status/,
    "resume must not depend on a WebView snapshot that may lag behind mpv after focus returns",
  );
});
