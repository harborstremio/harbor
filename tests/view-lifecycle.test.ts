// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const viewSource = readFileSync(new URL("../src/lib/view.tsx", import.meta.url), "utf8");

test("an active idle-evicted page mounts on the first navigation render", () => {
  assert.doesNotMatch(appSource, /if \(\(active \|\| pin\) && !alive\) setAlive\(true\)/);
  assert.match(appSource, /return alive \|\| active \|\| pin;/);
});

test("every frame kind has an explicit root-view policy", () => {
  assert.match(viewSource, /Record<Frame\["kind"\], View \| null>/);
  assert.match(viewSource, /const candidate = ROOT_VIEW_BY_KIND\[stack\[i\]\.kind\]/);
});
