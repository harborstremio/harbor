import test from "node:test";
import assert from "node:assert/strict";
import { blankSkin, convertSkinModel, inferSkinModel, normalizeSkin, paintSkin, skinFaceRect, skinStroke, SKIN_FACES, SKIN_PARTS } from "../src/lib/games/minecraft-skin.ts";

test("all classic/slim faces and layers fit Minecraft's atlas without overlapping islands", () => {
  for (const model of ["classic", "slim"] as const) {
    const used = new Set();
    for (const outer of [false, true]) for (const part of SKIN_PARTS) for (const face of SKIN_FACES) {
      const r = skinFaceRect(part, face, outer, model);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 64 && r.y + r.height <= 64);
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const at = (r.y + y) * 64 + r.x + x; assert.ok(!used.has(at), `${model} ${part} ${face}`); used.add(at); }
    }
    assert.equal(skinFaceRect("leftArm", "front", false, model).width, model === "slim" ? 3 : 4);
  }
});
test("paint is immutable; fill stays inside the selected face and respects boundaries", () => {
  const original = blankSkin("classic"), face = skinFaceRect("head", "front", false, "classic");
  const line = new Uint8ClampedArray(original);
  for (let y = 0; y < 8; y++) line.set([0, 0, 0, 255], ((face.y + y) * 64 + face.x + 3) * 4);
  const filled = paintSkin(line, face, 0, 0, "fill", "#ff0000");
  assert.deepEqual([...filled.slice((face.y * 64 + face.x) * 4, (face.y * 64 + face.x) * 4 + 4)], [255, 0, 0, 255]);
  assert.deepEqual(filled.slice((face.y * 64 + face.x + 4) * 4, (face.y * 64 + face.x + 8) * 4), line.slice((face.y * 64 + face.x + 4) * 4, (face.y * 64 + face.x + 8) * 4));
  assert.deepEqual(filled.slice(0, face.y * 64 * 4), original.slice(0, face.y * 64 * 4));
  assert.notDeepEqual(line, filled);
  assert.equal(paintSkin(original, face, -1, 0, "brush", "#ff0000"), original);
  assert.equal(paintSkin(original, face, 2, 2, "pick", "#ff0000"), original);
});
test("legacy skins become complete 64x64 skins, preserving originals and mirroring left limbs", () => {
  const old = new Uint8ClampedArray(64 * 32 * 4);
  const source = skinFaceRect("rightArm", "front", false, "classic"), target = skinFaceRect("leftArm", "front", false, "classic");
  old.set([23, 45, 67, 255], (source.y * 64 + source.x) * 4);
  const normalized = normalizeSkin(old, 64, 32);
  assert.equal(normalized.length, 16384);
  const at = (target.y * 64 + target.x + 3) * 4;
  assert.deepEqual([...normalized.slice(at, at + 4)], [23, 45, 67, 255]);
  assert.equal(old.length, 8192);
  assert.throws(() => normalizeSkin(old, 128, 16));
});
test("fast pointer strokes fill every connecting pixel, including reversed and diagonal lines", () => {
  assert.deepEqual(skinStroke([0, 0], [3, 3]), [[0, 0], [1, 1], [2, 2], [3, 3]]);
  assert.deepEqual(skinStroke([3, 0], [0, 0]), [[3, 0], [2, 0], [1, 0], [0, 0]]);
});
test("arm model conversion preserves all other parts and survives PNG model inference", () => {
  const classic = blankSkin("classic"), slim = convertSkinModel(classic, "classic", "slim");
  assert.equal(inferSkinModel(classic), "classic"); assert.equal(inferSkinModel(slim), "slim");
  assert.deepEqual(classic.slice(0, 64 * 16 * 4), slim.slice(0, 64 * 16 * 4));
  const restored = convertSkinModel(slim, "slim", "classic"); assert.equal(inferSkinModel(restored), "classic");
  assert.deepEqual(restored, classic);
});
