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
const experimentalSource = readFileSync(
  new URL("../src/components/ExperimentalLiquidGlassSurface.tsx", import.meta.url),
  "utf8",
);
const settingsDefaults = readFileSync(
  new URL("../src/lib/settings/defaults.ts", import.meta.url),
  "utf8",
);

test("liquid glass does not ship the Three.js runtime or types", () => {
  assert.equal(packageJson.dependencies?.three, undefined);
  assert.equal(packageJson.devDependencies?.["@types/three"], undefined);
  assert.doesNotMatch(source, /from ["']three["']/);
});

test("liquid glass does not keep a GPU render loop alive", () => {
  assert.doesNotMatch(source, /getContext\("webgl/);
  assert.doesNotMatch(source, /requestAnimationFrame/);
  assert.doesNotMatch(source, /<canvas/);
  assert.match(source, /linear-gradient/);
  assert.match(settingsDefaults, /defaultLiquidGlassBlur: 2/);
  assert.match(settingsDefaults, /defaultLiquidGlassTint: 40/);
  assert.match(source, /Number\.isFinite\(value\)/);
  assert.match(source, /backdropBlur && normalizedBlur > 0/);
  assert.doesNotMatch(source, /WebkitBackdropFilter/);
});

test("liquid glass keeps its public compatibility props", () => {
  assert.doesNotMatch(source, /spectralStrength/);
  assert.match(source, /refractionStrength/);
  assert.match(source, /lensStrength/);
  assert.match(source, /alwaysActive/);
  assert.match(source, /surfaceClassName/);
  assert.match(source, /variant/);
  assert.match(source, /backdropBlur/);
});

test("experimental liquid glass is opt-in and does not animate continuously", () => {
  assert.match(settingsDefaults, /experimentalLiquidGlassEnabled: false/);
  assert.match(settingsDefaults, /experimentalLiquidGlassOpacity: 100/);
  assert.match(source, /settings\.experimentalLiquidGlassEnabled/);
  assert.doesNotMatch(experimentalSource, /useSettings/);
  assert.match(experimentalSource, /rendererOpacity/);
  assert.doesNotMatch(experimentalSource, /animationIterationCount:\s*"infinite"/);
  assert.doesNotMatch(experimentalSource, /requestAnimationFrame/);
  assert.doesNotMatch(experimentalSource, /<canvas/);
  assert.match(experimentalSource, /globalOpacity > 0 \? blurValue : undefined/);
});
