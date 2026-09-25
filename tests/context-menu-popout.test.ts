import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  createMenuPopout,
  popoutOvershoot,
  retargetOriginTransform,
  settledMenuAnchor,
} from "../src/components/context-menu/menu-popout.ts";

test("changing an exit origin during scaling preserves the displayed position", () => {
  const oldOrigin = { x: 256, y: 97.5579 };
  const latestOrigin = { x: 256, y: 130 };
  const adjusted = retargetOriginTransform(
    "matrix(0.96, 0, 0, 0.96, 0, 0)",
    oldOrigin,
    latestOrigin,
  );
  const values = adjusted
    .match(/matrix\(([^)]+)\)/)![1]
    .split(",")
    .map(Number);
  for (const point of [
    { x: 0, y: 0 },
    { x: 180, y: 290 },
  ]) {
    const beforeY = (point.y - oldOrigin.y) * 0.96 + oldOrigin.y;
    const afterY = (point.y - latestOrigin.y) * 0.96 + latestOrigin.y + values[5];
    assert.ok(Math.abs(beforeY - afterY) < 0.000001);
  }
  assert.equal(retargetOriginTransform("none", oldOrigin, latestOrigin), "none");
});

test("a submenu uses its settled row geometry while the parent scales and scrolls", () => {
  const settled = { left: 100, top: 200, width: 250, height: 300 };
  const row = { left: 106, top: 245, right: 342, bottom: 281 };
  for (const scale of [0.9, 0.96, 1, 1.008]) {
    for (const zoom of [0.8, 1, 1.4]) {
      const surface = {
        left: 123 * zoom,
        top: 208 * zoom,
        width: 250 * scale * zoom,
        height: 300 * scale * zoom,
      };
      const visual = {
        left: surface.left + (row.left - settled.left) * scale * zoom,
        right: surface.left + (row.right - settled.left) * scale * zoom,
        top: surface.top + (row.top - settled.top) * scale * zoom,
        bottom: surface.top + (row.bottom - settled.top) * scale * zoom,
      };
      const result = settledMenuAnchor(visual, surface, {
        left: settled.left * zoom,
        top: settled.top * zoom,
        width: settled.width * zoom,
        height: settled.height * zoom,
      });
      for (const key of ["left", "right", "top", "bottom"] as const)
        assert.ok(Math.abs(result[key] - row[key] * zoom) < 0.0001);
    }
  }
});

test("elastic settling remains within the available viewport clearance", () => {
  assert.equal(
    popoutOvershoot(
      { left: 20, top: 20, width: 240, height: 300 },
      { x: 0, y: 0 },
      { width: 800, height: 600 },
    ),
    1.006,
  );
  assert.equal(
    popoutOvershoot(
      { left: 0, top: 0, width: 240, height: 300 },
      { x: 100, y: 100 },
      { width: 800, height: 600 },
    ),
    1,
  );
  assert.ok(
    popoutOvershoot(
      { left: 1, top: 1, width: 240, height: 300 },
      { x: 100, y: 100 },
      { width: 800, height: 600 },
    ) <= 1.00334,
  );
});

test("closing retargets the visible surface and stale completion cannot close a reopened menu", () => {
  const dom = new JSDOM("<div><div id='surface'></div></div>");
  const element = dom.window.document.getElementById("surface")!;
  const animations: { frames: Keyframe[]; onfinish: (() => void) | null; cancel(): void }[] = [];
  element.animate = ((frames: Keyframe[]) => {
    const animation = { frames, onfinish: null, cancel() {} };
    animations.push(animation);
    return animation;
  }) as typeof element.animate;
  let exited = 0;
  const motion = createMenuPopout(element);
  try {
    motion.update({ closing: false, reducedMotion: false, onExitComplete: () => exited++ });
    assert.equal(animations[0].frames[0].transform, "scale(0.92)");
    element.style.transform = "matrix(0.96, 0, 0, 0.96, 0, 0)";
    element.style.opacity = "0.62";
    motion.update({ closing: true, reducedMotion: false, onExitComplete: () => exited++ });
    assert.equal(animations[1].frames[0].transform, element.style.transform);
    assert.equal(Number(animations[1].frames[0].opacity), 0.62);
    const staleExit = animations[1].onfinish;
    motion.update({ closing: false, reducedMotion: false, onExitComplete: () => exited++ });
    staleExit?.();
    assert.equal(exited, 0);
    animations[2].onfinish?.();
    assert.equal(element.style.transform, "none");
    assert.equal(element.style.opacity, "1");
    motion.update({ closing: true, reducedMotion: false, onExitComplete: () => exited++ });
    const finalExit = animations[3].onfinish;
    finalExit?.();
    finalExit?.();
    assert.equal(exited, 1);
  } finally {
    motion.dispose();
    dom.window.close();
  }
});

test("reduced motion performs no scale animation and disposal invalidates queued exit", async () => {
  const dom = new JSDOM("<div id='surface'></div>");
  const element = dom.window.document.getElementById("surface")!;
  element.animate = (() => {
    throw new Error("reduced motion must not animate scale");
  }) as typeof element.animate;
  let exited = 0;
  const motion = createMenuPopout(element);
  motion.update({ closing: false, reducedMotion: true });
  assert.equal(element.style.transform, "none");
  motion.update({ closing: true, reducedMotion: true, onExitComplete: () => exited++ });
  motion.dispose();
  await Promise.resolve();
  assert.equal(exited, 0);
  dom.window.close();
});
