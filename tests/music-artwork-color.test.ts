import assert from "node:assert/strict";
import test from "node:test";
import { musicArtworkColor, readMusicArtworkBlob } from "../src/lib/music/appearance.ts";

test("artwork reader cancels at the byte limit without relying on Content-Length", async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(6));
      controller.enqueue(new Uint8Array(6));
    },
    cancel() {
      canceled = true;
    },
  });
  assert.equal(
    await readMusicArtworkBlob(
      new Response(stream, { headers: { "content-type": "image/jpeg" } }),
      10,
    ),
    null,
  );
  assert.equal(canceled, true);
});

test("artwork reader accepts an exact-size image and cancels advertised oversize before reading", async () => {
  const image = await readMusicArtworkBlob(
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }),
    3,
  );
  assert.equal(image?.size, 3);
  assert.equal(image?.type, "image/png");
  let canceled = false;
  const stream = new ReadableStream({
    cancel() {
      canceled = true;
    },
  });
  assert.equal(
    await readMusicArtworkBlob(
      new Response(stream, { headers: { "content-type": "image/jpeg", "content-length": "500" } }),
      10,
    ),
    null,
  );
  assert.equal(canceled, true);
});

test("transparent pixels and unusable extremes do not invent an artwork accent", () => {
  assert.equal(musicArtworkColor([255, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255]), null);
  assert.equal(musicArtworkColor([]), null);
});

test("actual colored pixels determine the accent and light/dark control foreground", () => {
  assert.deepEqual(musicArtworkColor([224, 190, 48, 255]), {
    color: "rgb(224 190 48)",
    ink: "#111111",
  });
  assert.deepEqual(musicArtworkColor([48, 64, 160, 255]), {
    color: "rgb(48 64 160)",
    ink: "#ffffff",
  });
  assert.deepEqual(musicArtworkColor([220, 40, 40, 255, 220, 40, 40, 255, 40, 40, 180, 255]), {
    color: "rgb(220 40 40)",
    ink: "#ffffff",
  });
});

test("foreground maintains readable contrast across the supported RGB gamut for control icons", () => {
  const linear = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  for (let r = 0; r <= 255; r += 17)
    for (let g = 0; g <= 255; g += 17)
      for (let b = 0; b <= 255; b += 17) {
        const result = musicArtworkColor([r, g, b, 255]);
        if (!result) continue;
        const background = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
        const foreground = result.ink === "#ffffff" ? 1 : linear(17);
        const contrast =
          (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        assert.ok(contrast >= 3, `${result.color} / ${result.ink}: ${contrast}`);
      }
});
