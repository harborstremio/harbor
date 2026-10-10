// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(new URL("../src/components/row.tsx", import.meta.url), "utf8");
const edge = source.slice(source.indexOf("function EdgeArrow("));
const plain = edge.slice(edge.indexOf("  const enter ="));

test("standard row arrows retain beta's standalone chevron design", () => {
  assert.match(plain, /<NavChevron dir=\{side\} size=\{54\}/);
  assert.match(plain, /start-\[-40px\]/);
  assert.match(plain, /end-\[-40px\]/);
  assert.match(plain, /group-hover\/edge:opacity-100/);
  assert.doesNotMatch(plain, /rounded-full|bg-elevated|bg-gradient/);
});

test("arrow restoration preserves glass controls and navigation safeguards", () => {
  assert.match(edge, /if \(settings\.liquidGlass\)/);
  assert.match(edge, /<ThreeLiquidGlassSurface/);
  assert.match(plain, /onClick=\{onClick\}/);
  assert.match(plain, /aria-label=\{label\}/);
  assert.match(plain, /tabIndex=\{visible \? 0 : -1\}/);
  assert.match(plain, /data-tv-skip="true"/);
  assert.match(plain, /visible \? "pointer-events-auto" : "pointer-events-none"/);
});
