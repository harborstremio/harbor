import assert from "node:assert/strict";
import test from "node:test";
import { heroBoxFor } from "../src/lib/hero-dock-box.ts";

test("the hero spans the content area below the top bar", () => {
  const box = heroBoxFor({ left: 72, top: 0, width: 1848 }, 1080, 80);
  assert.equal(box.left, 72);
  assert.equal(box.top, 80);
  assert.equal(box.width, 1848);
  // 46% of a 1080px window caps it before 16:9 or the 560px ceiling.
  assert.equal(box.height, 497);
});

test("a narrow window keeps the video 16:9, with a floor for tiny windows", () => {
  assert.equal(heroBoxFor({ left: 0, top: 0, width: 640 }, 1000, 0).height, 360);
  assert.equal(heroBoxFor({ left: 0, top: 0, width: 300 }, 1000, 0).height, 220);
});

test("tall windows stop at the ceiling", () => {
  assert.equal(heroBoxFor({ left: 0, top: 0, width: 3840 }, 2160, 80).height, 560);
});
