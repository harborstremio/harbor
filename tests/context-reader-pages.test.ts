// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { visibleReaderPages } from "../src/views/manga/manga-reader/reader-context.ts";
import { fetchImageObjectUrl } from "../src/views/manga/manga-reader/reader-utils.ts";

test("reader image choices use the renderer's exact reported page numbers", () => {
  const pages = ["blob:one", "blob:two", "blob:three", "blob:four"];
  assert.deepEqual(visibleReaderPages(pages, "2-3"), [
    { number: 2, src: "blob:two" },
    { number: 3, src: "blob:three" },
  ]);
  assert.deepEqual(visibleReaderPages(pages, "3-2"), [
    { number: 3, src: "blob:three" },
    { number: 2, src: "blob:two" },
  ]);
  assert.deepEqual(visibleReaderPages(pages, "1"), [{ number: 1, src: "blob:one" }]);
  for (const spread of ["", "0", "5", "2-5", "1-4", "undefined", "1.5"])
    assert.deepEqual(visibleReaderPages(pages, spread), []);
});

test("header-fetched manga image blobs preserve the actual format when the source omits content type", async () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        invoke: async () => ({ ok: true, status: 200, body: "iVBORw0KGgoAAAAA" }),
      },
    },
  });
  let url: string | undefined;
  try {
    url = await fetchImageObjectUrl("https://source.example/page", {
      Referer: "https://source.example/chapter",
    });
    assert.equal((await fetch(url)).headers.get("content-type"), "image/png");
  } finally {
    if (url) URL.revokeObjectURL(url);
    delete globalThis.window;
  }
});
