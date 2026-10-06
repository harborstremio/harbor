// @ts-nocheck Node-only hook harness is outside the browser tsconfig.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const SOURCE_A = { url: "https://example.org/a.mkv", meta: { id: "tt123", type: "movie" } };
const SOURCE_B = { ...SOURCE_A, url: "https://example.org/b.mkv" };

function hookHarness({ resumeMs = 0, libraryGetOne = async () => null } = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useRef(value) {
      const i = cursor++;
      slots[i] ??= { current: value };
      return slots[i];
    },
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = value;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useEffect(callback, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) {
        effects.push({ i, previous, callback, deps });
      }
    },
  };
  const modules = {
    react,
    "@/lib/resume": { readResumeMs: () => resumeMs, saveResumeMs() {} },
    "@/lib/stremio": {
      cloudWriteId: (id) => id,
      episodeFromVideoId: () => null,
      libraryGetOne,
    },
    "./use-stremio-sync": { videoIdFor: () => null },
    "@/lib/settings": {
      useSettings: () => ({ settings: { resumePlayback: true, resumePrompt: false } }),
    },
  };
  const exports = {};
  const source = readFileSync(
    new URL("../src/views/player/hooks/use-bridge-load.ts", import.meta.url),
    "utf8",
  );
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name) {
        assert.ok(name in modules, name);
        return modules[name];
      },
      console,
    },
  );
  return {
    render(params) {
      cursor = 0;
      effects = [];
      const result = exports.useBridgeLoad({
        inRoomRef: { current: false },
        isHostRef: { current: false },
        bridgeReady: true,
        bridgeKey: "mpv|first",
        src: SOURCE_A,
        activeSrc: SOURCE_A,
        transcodedUrl: null,
        authKey: null,
        ...params,
      });
      for (const effect of effects) effect.previous?.cleanup?.();
      for (const effect of effects) {
        slots[effect.i] = { deps: effect.deps, cleanup: effect.callback() };
      }
      return result;
    },
  };
}

function bridgeFixture(durationSec = 200) {
  const loads = [];
  const seeks = [];
  const subscribers = new Set();
  let plays = 0;
  const emit = () => {
    for (const callback of subscribers) callback({ durationSec });
  };
  const bridge = {
    async load(source) {
      loads.push(source);
    },
    async play() {
      plays++;
    },
    pause() {},
    seek(position) {
      seeks.push(position);
      emit();
    },
    subscribe(callback) {
      subscribers.add(callback);
      callback({ durationSec });
      return () => subscribers.delete(callback);
    },
  };
  return { bridge, loads, seeks, subscribers, emit, plays: () => plays };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("synchronous resume subscription that emits during seek runs the seek only once", async () => {
  const hook = hookHarness({ resumeMs: 190_000 });
  const fixture = bridgeFixture(200);
  hook.render({ bridgeRef: { current: fixture.bridge } });
  await settle();
  assert.equal(fixture.loads.length, 1);
  assert.deepEqual(fixture.seeks, [0]);
  assert.equal(fixture.subscribers.size, 0);
  fixture.emit();
  assert.deepEqual(fixture.seeks, [0]);
  assert.equal(fixture.plays(), 1);
});

test("a delayed resume lookup cannot reload the original URL after an in-place source switch", async () => {
  let finishLookup;
  const remote = new Promise((resolve) => {
    finishLookup = resolve;
  });
  const hook = hookHarness({ libraryGetOne: () => remote });
  const fixture = bridgeFixture();
  const bridgeRef = { current: fixture.bridge };
  hook.render({ bridgeRef, authKey: "test-auth" });
  assert.equal(fixture.loads.length, 0);
  await fixture.bridge.load(SOURCE_B);
  hook.render({ bridgeRef, activeSrc: SOURCE_B, authKey: "test-auth" });
  finishLookup(null);
  await settle();
  assert.deepEqual(
    fixture.loads.map((source) => source.url),
    [SOURCE_B.url],
  );
  assert.equal(fixture.plays(), 0);
});

test("recreating the bridge after an in-place switch loads the active source exactly once", async () => {
  const hook = hookHarness();
  const first = bridgeFixture();
  const bridgeRef = { current: first.bridge };
  hook.render({ bridgeRef });
  await settle();
  await first.bridge.load(SOURCE_B);
  hook.render({ bridgeRef, activeSrc: SOURCE_B });
  await settle();
  assert.deepEqual(
    first.loads.map((source) => source.url),
    [SOURCE_A.url, SOURCE_B.url],
  );

  const recreated = bridgeFixture();
  bridgeRef.current = recreated.bridge;
  const params = { bridgeRef, activeSrc: SOURCE_B, bridgeKey: "mpv|recreated" };
  hook.render(params);
  await settle();
  hook.render(params);
  await settle();
  assert.deepEqual(
    recreated.loads.map((source) => source.url),
    [SOURCE_B.url],
  );
  assert.equal(recreated.plays(), 1);
});
