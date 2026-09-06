import assert from "node:assert/strict";
import test from "node:test";

test("book image measurement falls back when an image never settles", async () => {
  const originalImage = globalThis.Image;
  const originalWindow = globalThis.window;
  class PendingImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalHeight = 0;
    naturalWidth = 0;
    src = "";
  }
  globalThis.Image = PendingImage as unknown as typeof Image;
  globalThis.window = {
    setTimeout: (callback: TimerHandler) => setTimeout(callback, 0),
    clearTimeout,
  } as unknown as Window & typeof globalThis;

  try {
    const { measureAspect } = await import("../src/views/manga/manga-reader/reader-utils.ts");
    assert.equal(await measureAspect("https://example.invalid/pending.jpg"), 1.4);
  } finally {
    globalThis.Image = originalImage;
    globalThis.window = originalWindow;
  }
});
