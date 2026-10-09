// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const fill = read("src/views/player/hooks/use-video-fill.ts");
const hotkeys = read("src/views/player/hooks/use-player-hotkeys.ts");

const bound = (name: string) => Number(new RegExp(`${name} = (-?[\\d.]+)`).exec(fill)?.[1]);

test("zoom can go below 1x, not only above it", () => {
  // A 21:9 screen needs the crop dialled in from both directions.
  assert.ok(bound("ZOOM_MIN") < 0, `ZOOM_MIN is ${bound("ZOOM_MIN")}`);
  assert.ok(bound("ZOOM_MAX") > 0);
});

test("one step moves the picture by a couple of percent, not seven", () => {
  // video-zoom is a power of two, so 0.1 was 7.2% a press and overshot the fit.
  const step = bound("ZOOM_STEP");
  const percent = (Math.pow(2, step) - 1) * 100;
  assert.ok(percent > 0.5 && percent < 3, `a step moves ${percent.toFixed(2)}%`);
});

test("the step survives rounding", () => {
  // Rounding to two places turned a 0.025 step into 0.03 and drifted.
  const step = bound("ZOOM_STEP");
  const places = Number(/Math\.round\(\(zoom\.current \+ delta\) \* (\d+)\)/.exec(fill)?.[1]);
  assert.ok(places >= 1 / step, `rounding to ${places} cannot hold a ${step} step`);
  let acc = 0;
  for (let i = 0; i < 20; i += 1) acc = Math.round((acc + step) * places) / places;
  assert.equal(acc, Math.round(step * 20 * places) / places, "steps drifted while accumulating");
});

test("the fill for a 16:9 picture on a 21:9 screen is reachable", () => {
  const needed = Math.log2(3440 / 1440 / (16 / 9));
  assert.ok(needed <= bound("ZOOM_MAX"), "cannot zoom far enough to clear the pillarbox");
  const presses = Math.ceil(needed / bound("ZOOM_STEP"));
  assert.ok(presses <= 30, `${presses} presses to fill the screen`);
});

test("the hotkeys use the shared step instead of their own number", () => {
  assert.match(hotkeys, /videoFill\.step\(ZOOM_STEP\)/);
  assert.match(hotkeys, /videoFill\.step\(-ZOOM_STEP\)/);
  assert.doesNotMatch(hotkeys, /videoFill\.step\(-?0\.\d+\)/, "a literal step drifted from the clamp");
});

test("the readout appears when zoomed out, not only when zoomed in", () => {
  assert.match(fill, /mode\.id === "zoom" && zoomLevel !== 0/);
});
