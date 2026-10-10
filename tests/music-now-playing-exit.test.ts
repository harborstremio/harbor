import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dock = readFileSync("src/components/music/music-dock.tsx", "utf8");
const sheet = readFileSync("src/components/music/music-now-playing.tsx", "utf8");
const css = readFileSync("src/components/music/music-now-playing.css", "utf8");
const shell = readFileSync("src/components/modal-shell.tsx", "utf8");

test("closing the pull-out runs an exit before it unmounts", () => {
  assert.match(dock, /useModalExit\(closeExpanded, expanded\)/);
  assert.match(dock, /onClose=\{nowExit\.close\}/);
  assert.match(dock, /closing=\{nowExit\.closing\}/);
});

test("the exit hook sits above the dock's early return, or the app white-screens", () => {
  const hook = dock.indexOf("useModalExit(closeExpanded");
  const guard = dock.indexOf("if (!visible || !current");
  assert.ok(hook > 0 && guard > 0, "anchors not found");
  assert.ok(hook < guard, "a hook below the early return throws Rendered fewer hooks");
});

test("the sheet reflects the closing state in the DOM", () => {
  assert.match(sheet, /closing\?: boolean/);
  assert.match(sheet, /data-closing=\{closing \? "1" : undefined\}/);
});

test("there is an exit animation, distinct from the entrance", () => {
  assert.match(css, /@keyframes music-now-fall/);
  assert.match(css, /\[data-closing="1"\][^}]*music-now-fall/);
  assert.match(css, /@keyframes music-now-rise/);
});

test("the exit animation is not slower than the entrance", () => {
  const rise = Number(/music-now-rise (\d+)ms/.exec(css)?.[1]);
  const fall = Number(/music-now-fall (\d+)ms/.exec(css)?.[1]);
  assert.ok(Number.isFinite(rise) && Number.isFinite(fall));
  assert.ok(fall <= rise, `exit ${fall}ms should not outlast entrance ${rise}ms`);
});

test("the css exit matches the unmount delay, so it is never cut off", () => {
  const exitMs = Number(/const EXIT_MS = (\d+)/.exec(shell)?.[1]);
  const fall = Number(/music-now-fall (\d+)ms/.exec(css)?.[1]);
  assert.equal(fall, exitMs);
});

test("reduced motion suppresses the exit too", () => {
  const at = css.indexOf("prefers-reduced-motion");
  assert.match(css.slice(at, at + 160), /\[data-closing="1"\]/);
});
