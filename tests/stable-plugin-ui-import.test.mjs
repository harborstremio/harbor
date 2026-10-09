import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, globals = {}, dependencies = {}) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)(
    (name) => dependencies[name] ?? {},
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}

test("native Base64 fetch preserves bytes and forwards native policy limits", async () => {
  const calls = [];
  const dependencies = {
    "@tauri-apps/api/core": {
      invoke: async (command, payload) => {
        calls.push({ command, payload });
        return {
          status: 200,
          ok: true,
          body: "AP+A",
          contentType: "application/octet-stream",
          url: "https://example.com/final",
        };
      },
    },
    "./privacy/blocklist": { isBlockedUrl: () => false },
    "./subtitles/provider-url": {
      SUBTITLE_PUBLIC_NETWORK_HEADER: "x-public-only",
      isSafeProviderSubtitleUrl: (url) => !url.includes("127.0.0.1"),
    },
  };
  const { safeFetchBase64 } = load(
    "src/lib/safe-fetch.ts",
    {
      window: { __TAURI_INTERNALS__: {} },
      atob: () => {
        throw new Error("Base64 must not be decoded");
      },
    },
    dependencies,
  );
  const result = await safeFetchBase64(
    "https://example.com/data",
    {
      headers: { "x-public-only": "1" },
      redirect: "manual",
    },
    1500,
    4096,
  );
  assert.equal(result.body, "AP+A");
  assert.equal(result.url, "https://example.com/final");
  assert.equal(calls[0].command, "harbor_fetch");
  assert.equal(calls[0].payload.args.publicNetworkOnly, true);
  assert.equal(calls[0].payload.args.allowLocalNetwork, false);
  assert.equal(calls[0].payload.args.maxResponseBytes, 4096);
  assert.equal(calls[0].payload.args.timeoutMs, 1500);
  assert.equal(calls[0].payload.args.followRedirects, false);
  await assert.rejects(
    safeFetchBase64("http://127.0.0.1/data", { headers: { "x-public-only": "1" } }),
    /non-public/,
  );
  assert.equal(calls.length, 1);
  assert.equal(
    load("src/lib/safe-fetch.ts", { window: {} }, dependencies).safeFetchBase64(
      "https://example.com",
      {},
    ),
    null,
  );
});

test("plugin list identity ignores runtime health but changes with configuration", () => {
  const plugin = { id: "test", hash: "v1", enabled: true, listed: true, settingsValues: {} };
  const { pluginListKey } = load(
    "src/lib/streams/plugins/addon.ts",
    {},
    {
      "./store": { installedStreamPluginsSync: () => [plugin] },
      "./source": { settingsFingerprint: (p) => JSON.stringify(p.settingsValues) },
    },
  );
  const initial = pluginListKey();
  plugin.autoPaused = true;
  plugin.error = "temporary";
  assert.equal(pluginListKey(), initial);
  plugin.settingsValues = { language: "ar" };
  assert.notEqual(pluginListKey(), initial);
  plugin.enabled = false;
  assert.equal(pluginListKey(), "");
});

test("Discover animation is cancelled on unmount and respects reduced motion", () => {
  for (const reduce of [false, true]) {
    const effects = [];
    let cancelled = 0;
    let animations = 0;
    let refs = 0;
    const el = {
      style: {},
      animate: () => {
        animations++;
        return { cancel: () => cancelled++ };
      },
    };
    const { DiscoverIcon } = load(
      "src/components/icons/discover-icon.tsx",
      {},
      {
        react: {
          useRef: (value) => ({ current: refs++ === 0 ? el : value }),
          useEffect: (fn) => effects.push(fn),
        },
        "@/lib/use-reduced-motion": { useReducedMotion: () => reduce },
        "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
      },
    );
    // Ref order is needle, then animation; effects run after render.
    DiscoverIcon({ active: true });
    const cleanups = effects.map((fn) => fn());
    assert.equal(animations, reduce ? 0 : 1);
    cleanups.reverse().forEach((fn) => fn?.());
    assert.equal(cancelled, reduce ? 0 : 1);
  }
});

test("Lottie waits for loaded frames, pauses offscreen, and cleans up", () => {
  const effects = [];
  const listeners = new Map();
  const timers = new Map();
  const frames = [];
  let visibility;
  let stopped = false;
  let destroyed = false;
  let nextTimer = 0;
  let refs = 0;
  const anim = {
    isLoaded: false,
    totalFrames: 0,
    frameRate: 0,
    goToAndStop: (frame) => frames.push(frame),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    destroy: () => {
      destroyed = true;
    },
  };
  const document = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const { LottiePlayer } = load(
    "src/components/lottie-player.tsx",
    {
      document,
      window: {
        setInterval: (fn) => {
          timers.set(++nextTimer, fn);
          return nextTimer;
        },
        clearInterval: (id) => timers.delete(id),
      },
    },
    {
      react: {
        useRef: (value) => ({ current: refs++ === 0 ? {} : value }),
        useEffect: (fn) => effects.push(fn),
      },
      "lottie-web": { default: { loadAnimation: () => anim } },
      "@/lib/use-reduced-motion": { useReducedMotion: () => false },
      "@/lib/visibility": {
        observeWithin: (_el, _margin, fn) => {
          visibility = fn;
          return () => {
            stopped = true;
          };
        },
      },
      "react/jsx-runtime": { jsx: () => null },
    },
  );
  LottiePlayer({ data: {}, loop: false });
  const cleanup = effects[0]();
  visibility({ isIntersecting: true });
  assert.equal(timers.size, 0);
  anim.totalFrames = 3;
  anim.frameRate = 30;
  listeners.get("DOMLoaded")();
  assert.equal(timers.size, 1);
  timers.values().next().value();
  assert.equal(frames.at(-1), 1);
  visibility({ isIntersecting: false });
  assert.equal(timers.size, 0);
  visibility({ isIntersecting: true });
  timers.values().next().value();
  timers.values().next().value();
  assert.equal(timers.size, 0);
  visibility({ isIntersecting: true });
  assert.equal(timers.size, 0, "a completed non-looping animation must not restart");
  cleanup();
  assert.ok(stopped && destroyed);
  assert.equal(listeners.size, 0);
});

test("plugin HTTP slots are handed to queued work before new arrivals", async () => {
  const { PluginWorker } = load("src/lib/manga/plugins/worker-host.ts");
  const worker = new PluginWorker({}, {});
  await Promise.all(Array.from({ length: 6 }, () => worker.acquireHttp()));
  let admitted = 0;
  const queued = worker.acquireHttp().then(() => admitted++);
  worker.releaseHttp();
  const newcomer = worker.acquireHttp().then(() => admitted++);
  await queued;
  await Promise.resolve();
  assert.equal(admitted, 1, "a newcomer must not steal a queued worker's slot");
  assert.equal(worker.httpInflight, 6);
  worker.releaseHttp();
  await newcomer;
  for (let i = 0; i < 6; i++) worker.releaseHttp();
  assert.equal(worker.httpInflight, 0);
});

test("global plugin HTTP cap remains 16 across workers and queued arrivals", async () => {
  const { PluginWorker } = load("src/lib/manga/plugins/worker-host.ts");
  const workers = Array.from({ length: 18 }, () => new PluginWorker({}, {}));
  await Promise.all(workers.slice(0, 16).map((w) => w.acquireHttp()));
  let admitted = 0;
  const queued = workers[16].acquireHttp().then(() => admitted++);
  workers[0].releaseHttp();
  const newcomer = workers[17].acquireHttp().then(() => admitted++);
  await queued;
  await Promise.resolve();
  assert.equal(admitted, 1, "global admission must reserve the slot for the queue");
  workers[1].releaseHttp();
  await newcomer;
  workers.slice(2).forEach((w) => w.releaseHttp());
});

test("visibility observers pool by root/margin and release only the last subscriber", () => {
  const observers = [];
  class Observer {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.targets = new Set();
      observers.push(this);
    }
    observe(el) {
      this.targets.add(el);
    }
    unobserve(el) {
      this.targets.delete(el);
    }
  }
  const { observeWithin } = load("src/lib/visibility.ts", { IntersectionObserver: Observer });
  const el = {};
  const other = {};
  const seen = [];
  const stopA = observeWithin(el, "600px", (e) => seen.push(e.isIntersecting), null);
  const stopB = observeWithin(el, "600px", (e) => seen.push(e.isIntersecting), null);
  const stopC = observeWithin(other, "600px", () => {}, null);
  assert.equal(observers.length, 1);
  observers[0].callback([{ target: el, isIntersecting: true }]);
  assert.deepEqual(seen, [true, true]);
  stopA();
  stopA();
  assert.ok(observers[0].targets.has(el));
  stopB();
  assert.ok(!observers[0].targets.has(el));
  stopC();
  assert.equal(observers[0].targets.size, 0);
  const stopD = observeWithin(el, "100px", () => {}, null);
  const stopE = observeWithin(el, "600px", () => {}, other);
  assert.equal(observers.length, 3);
  stopD();
  stopE();
});
