// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const source = readFileSync(
  new URL("../src/components/ThreeLiquidGlassSurface.tsx", import.meta.url),
  "utf8",
);

test("liquid glass does not ship the Three.js runtime or types", () => {
  assert.equal(packageJson.dependencies?.three, undefined);
  assert.equal(packageJson.devDependencies?.["@types/three"], undefined);
  assert.doesNotMatch(source, /from ["']three["']/);
});

test("liquid glass uses portable WebGL 1 with lifecycle and CSS fallback guards", () => {
  assert.match(source, /getContext\("webgl"/);
  assert.doesNotMatch(source, /getContext\("webgl2"/);
  assert.match(source, /webglcontextlost/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /return null/);
  assert.match(source, /backdropFilter/);
});
