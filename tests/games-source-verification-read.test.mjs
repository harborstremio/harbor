import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const target = "https://catalog.example/feed.json";
const script = (
  await readFile(
    new URL("../src-tauri/src/games/source_verification_read.js", import.meta.url),
    "utf8",
  )
)
  .replace("__HARBOR_SOURCE_URL__", JSON.stringify(target))
  .replace("__HARBOR_SOURCE_MAX_BYTES__", "64");
const tick = () => new Promise((resolve) => setImmediate(resolve));
function browser(fetch) {
  const timers = new Map(),
    events = new Map(),
    calls = [];
  const window = { addEventListener: (name, callback) => events.set(name, callback) };
  const document = {
    title: "",
    querySelector: () => null,
    addEventListener: (name, callback) => events.set(name, callback),
  };
  vm.runInNewContext(script, {
    window,
    document,
    TextDecoder,
    AbortController,
    fetch: (...args) => {
      calls.push(args);
      return fetch(...args);
    },
    setInterval: (callback) => {
      timers.set(1, callback);
      return 1;
    },
    clearInterval: (id) => timers.delete(id),
    setTimeout: () => 2,
    clearTimeout: () => {},
  });
  return {
    window,
    document,
    calls,
    timers,
    read: () => events.get("load")(),
    retry: () => timers.get(1)?.(),
  };
}

test("delayed browser reads stay pending and use the exact catalog without remote IPC", async () => {
  let finish;
  const b = browser(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = b.read();
  b.retry();
  assert.equal(b.calls.length, 1);
  assert.equal(b.window.__harborSourceResult, undefined);
  assert.equal(b.timers.size, 1);
  assert.equal(b.calls[0][0], target);
  assert.equal(b.calls[0][1].credentials, "include");
  assert.equal(b.calls[0][1].redirect, "error");
  finish(new Response('{"name":"日本語"}'));
  await pending;
  assert.equal(b.window.__harborSourceResult.body, '{"name":"日本語"}');
  assert.equal(b.window.__harborSourceResult.status, "ready");
  b.retry();
  assert.equal(b.timers.size, 0);
});

test("a transient rejected or blocked read retries instead of clearing its interval", async () => {
  let attempts = 0;
  const b = browser(async () => {
    if (++attempts === 1) throw Error("temporary network failure");
    if (attempts === 2) return new Response("challenge", { status: 403 });
    return new Response("{}", { headers: { "content-type": "text/plain" } });
  });
  await b.read();
  assert.equal(b.timers.size, 1);
  b.retry();
  await tick();
  assert.equal(b.window.__harborSourceResult, undefined);
  b.retry();
  await tick();
  assert.equal(b.window.__harborSourceResult.body, "{}");
  assert.equal(b.calls.length, 3);
});

test("challenge pages are not read or accepted as catalogs even with status 200", async () => {
  const b = browser(async () => new Response("<title>Just a moment...</title>"));
  b.document.title = "Just a moment...";
  await b.read();
  assert.equal(b.calls.length, 0);
  b.document.title = "";
  await b.read();
  assert.equal(b.window.__harborSourceResult, undefined);
  assert.equal(b.timers.size, 1);
});

test("declared and streaming limits cancel the body before reporting oversized catalogs", async () => {
  for (const declared of [true, false]) {
    let canceled = false;
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(40));
      },
      cancel() {
        canceled = true;
      },
    });
    const b = browser(
      async () => new Response(stream, { headers: declared ? { "content-length": "100" } : {} }),
    );
    await b.read();
    assert.equal(b.window.__harborSourceResult.status, "error");
    assert.equal(b.window.__harborSourceResult.error, "source_limit");
    assert.equal(canceled, true);
  }
});

test("streaming UTF-8 chunks preserve multibyte text without accepting partial bodies", async () => {
  const bytes = new TextEncoder().encode('{"name":"日本語"}');
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1));
      controller.close();
    },
  });
  const b = browser(async () => new Response(stream));
  await b.read();
  assert.equal(b.window.__harborSourceResult.body, '{"name":"日本語"}');
});
