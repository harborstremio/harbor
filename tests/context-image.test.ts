// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  imageFilename,
  publicContextImageUrl,
  readImageResponse,
  writeImageResource,
} from "../src/lib/context-image-policy.ts";
import { loadContextImage } from "../src/lib/context-image.ts";

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test("image sharing requires a separately declared public URL", () => {
  assert.equal(publicContextImageUrl({ src: "https://cdn.example/poster.png" }), null);
  assert.equal(
    publicContextImageUrl({
      src: "blob:private",
      publicUrl: "https://cdn.example/poster.png?w=800",
    }),
    "https://cdn.example/poster.png?w=800",
  );
  for (const url of [
    "file:///C:/private.png",
    "blob:private",
    "data:image/png;base64,eA==",
    "https://user:secret@cdn.example/p.png",
    "http://127.0.0.1/p.png",
    "https://[::1]/p.png",
    "http://192.168.1.4/p.png",
    "https://media.local/p.png",
    "https://cdn.example/p.png?token=secret",
    "https://cdn.example/p.png?X-Amz-Signature=secret",
    "https://cdn.example/p.png#secret",
  ]) {
    assert.equal(publicContextImageUrl({ src: url, publicUrl: url }), null);
  }
});

test("image save keeps original bytes and derives format from content rather than a URL extension", async () => {
  const loaded = await readImageResponse(
    new Response(png, { headers: { "content-type": "image/png" } }),
  );
  assert.deepEqual(loaded.bytes, png);
  assert.equal(loaded.mime, "image/png");
  assert.equal(loaded.extension, "png");
  assert.equal(imageFilename("../poster.jpg", loaded.extension), "poster.png");
  assert.equal(imageFilename("CON", "png"), "image-CON.png");
});

test("HTTP errors and non-image or mismatched payloads are not saved as images", async () => {
  await assert.rejects(readImageResponse(new Response("missing", { status: 404 })), /404/);
  await assert.rejects(
    readImageResponse(
      new Response("<html>error</html>", { headers: { "content-type": "image/png" } }),
    ),
    /image/i,
  );
  await assert.rejects(
    readImageResponse(new Response(png, { headers: { "content-type": "text/html" } })),
    /image/i,
  );
  await assert.rejects(
    readImageResponse(new Response(png, { headers: { "content-type": "image/jpeg" } })),
    /match/i,
  );
});

test("image stream enforces the byte limit even when content-length is missing or false", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(png);
      controller.enqueue(new Uint8Array(20));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readImageResponse(
      new Response(body, { headers: { "content-type": "image/png", "content-length": "1" } }),
      16,
    ),
    /large/i,
  );
  assert.equal(cancelled, true);
});

test("native clipboard image resources close after success and failure without hiding failure", async () => {
  let closes = 0;
  const resource = {
    close: async () => {
      closes += 1;
    },
  };
  await writeImageResource(resource, async () => {});
  await assert.rejects(
    writeImageResource(resource, async () => {
      throw new Error("clipboard denied");
    }),
    /clipboard denied/,
  );
  assert.equal(closes, 2);
});

test("image loading uses the explicitly intended original and supports app-owned blobs", async () => {
  const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const original = await loadContextImage({
    src: "data:image/png;base64,invalid",
    originalSrc: gif,
  });
  assert.equal(original.extension, "gif");
  const url = URL.createObjectURL(original.blob);
  try {
    assert.deepEqual((await loadContextImage({ src: url })).bytes, original.bytes);
  } finally {
    URL.revokeObjectURL(url);
  }
});

test("unsupported sources and cancelled requests do not produce an image", async () => {
  await assert.rejects(loadContextImage({ src: "javascript:alert(1)" }), /not supported/i);
  await assert.rejects(loadContextImage({ src: "data:text/html,<html>" }), /not an image/i);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadContextImage(
      { src: "data:image/png;base64,iVBORw0KGgoAAAAA" },
      { signal: controller.signal },
    ),
    /cancelled/i,
  );
});

test("inline image decoding does not require a CSP-blocked data URL fetch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("CSP denied data fetch");
  };
  try {
    const loaded = await loadContextImage({
      src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    });
    assert.equal(loaded.extension, "gif");
    const svg = await loadContextImage({
      src: "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/svg%3E",
    });
    assert.equal(svg.extension, "svg");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
