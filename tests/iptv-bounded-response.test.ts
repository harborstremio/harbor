import assert from "node:assert/strict";
import test from "node:test";
import { fetchBoundedText } from "../src/lib/iptv/bounded-response.ts";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("bounded reader preserves UTF-8 across network chunks", async () => {
  const data = new TextEncoder().encode("#EXTM3U\nSão Paulo · 日本\n");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of data) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  assert.equal(
    await fetchBoundedText(async () => new Response(stream)),
    "#EXTM3U\nSão Paulo · 日本\n",
  );
});

test("declared and streamed oversized bodies are cancelled before buffering the complete response", async () => {
  for (const declared of [true, false]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32));
      },
      cancel() {
        cancelled = true;
      },
    });
    await assert.rejects(
      fetchBoundedText(
        async () => new Response(stream, { headers: declared ? { "content-length": "32" } : {} }),
        { maxBytes: 16 },
      ),
      /exceeds/,
    );
    assert.equal(cancelled, true);
  }
});

test("a connected but silent body expires and cancels the underlying stream", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  const task = fetchBoundedText(async () => new Response(stream), { idleMs: 100, totalMs: 1000 });
  const rejected = assert.rejects(task, { name: "TimeoutError" });
  await flush();
  t.mock.timers.tick(100);
  await rejected;
  assert.equal(cancelled, true);
});

test("continued small packets reset inactivity but cannot exceed the total deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  const task = fetchBoundedText(async () => new Response(stream), { idleMs: 100, totalMs: 250 });
  const rejected = assert.rejects(task, /took too long/);
  await flush();
  for (let i = 0; i < 3; i++) {
    t.mock.timers.tick(75);
    controller.enqueue(Uint8Array.of(65));
    await flush();
  }
  t.mock.timers.tick(25);
  await rejected;
});

test("source cancellation rejects even when a transport ignores its signal and releases a late body", async () => {
  const controller = new AbortController();
  let response!: (value: Response) => void;
  let bodyCancelled = false;
  let transportSignal: AbortSignal | undefined;
  const held = new Promise<Response>((resolve) => {
    response = resolve;
  });
  const task = fetchBoundedText(
    async (signal) => {
      transportSignal = signal;
      return held;
    },
    { signal: controller.signal },
  );
  const rejected = assert.rejects(task, { name: "AbortError" });
  await flush();
  controller.abort();
  await rejected;
  assert.equal(transportSignal?.aborted, true);
  response(
    new Response(
      new ReadableStream({
        cancel() {
          bodyCancelled = true;
        },
      }),
    ),
  );
  await flush();
  assert.equal(bodyCancelled, true);
});
