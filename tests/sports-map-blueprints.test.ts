import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { decodeMapBlueprints } from "../src/lib/sports/map-blueprints.ts";

test("blueprints decode only raster files and keep floor numbers in natural order", async () => {
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 1]);
  const bytes = zipSync({
    "layout-10.jpg": jpeg,
    "layout-2.jpg": jpeg,
    "notes.txt": strToU8("unused"),
    "fake.png": strToU8("not an image"),
    "__MACOSX/layout.jpg": jpeg,
  });
  const result = await decodeMapBlueprints(bytes, new AbortController().signal);
  assert.deepEqual(
    result.map((item) => item.name),
    ["layout-2.jpg", "layout-10.jpg"],
  );
  assert.ok(result.every((item) => item.mime === "image/jpeg"));
});
test("closing a blueprint before decoding cancels rather than returning stale images", () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => decodeMapBlueprints(new Uint8Array(), controller.signal), {
    name: "AbortError",
  });
});
