import assert from "node:assert/strict";
import test from "node:test";
import { imageDataUrlToBlob } from "../src/lib/face/face-capture";

test("decodes base64 image data without a network fetch", async () => {
  const blob = imageDataUrlToBlob("data:image/jpeg;base64,AQIDBA==");

  assert.equal(blob.type, "image/jpeg");
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2, 3, 4]);
});

test("rejects non-image and empty data URLs", () => {
  assert.throws(
    () => imageDataUrlToBlob("data:text/plain;base64,SGVsbG8="),
    /unsupported image data/,
  );
  assert.throws(() => imageDataUrlToBlob("data:image/jpeg;base64,"), /empty image data/);
});
