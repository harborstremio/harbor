// @ts-nocheck Node-only hook harness is outside the browser tsconfig.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/views/play-picker/use-pipeline-result.ts", import.meta.url),
  "utf8",
);

// Run the actual hook with controlled effect scheduling and pipeline promises.
// This keeps the discovery race deterministic without a browser or real addons.
function harness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const calls = [];
  const writes = [];
  const cache = new Map();
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === "function" ? value(slots[index]) : value;
        },
      ];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[index] = { deps, value: factory() };
      }
      return slots[index].value;
    },
    useCallback(callback, deps) {
      return react.useMemo(() => callback, deps);
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const modules = {
    react,
    "@/lib/picker-cache": {
      buildPickerConfigHash: ({ addonTransportUrls }) => JSON.stringify(addonTransportUrls),
      getPickerCache: (_meta, _episode, hash) => cache.get(hash),
      setPickerCache: (_meta, _episode, result, hash, complete = true) => {
        writes.push({ hash, complete });
        cache.set(hash, { result, complete });
      },
      clearOnePickerCache: () => cache.clear(),
    },
    "@/lib/streams/pipeline": {
      runPipeline(input, signal) {
        return new Promise((resolve) => calls.push({ input, signal, resolve }));
      },
    },
    "@/lib/streams/episode-pipeline-input": { buildEpisodePipelineInput: (input) => input },
    "./picker-utils": { stampAddonOrder: () => {} },
  };
  const exports = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in modules, `Unexpected runtime dependency: ${name}`);
        return modules[name];
      },
      AbortController,
      performance,
    },
  );
  const input = {
    meta: { id: "test-movie", name: "Test movie", type: "movie" },
    streamIds: ["test-movie"],
    addons: [],
    discoveringAddons: true,
    debrids: [],
    settings: { preferredLanguages: [] },
    strictMode: false,
    filterDisabled: false,
  };
  function render(changes = {}) {
    Object.assign(input, changes);
    cursor = 0;
    const result = exports.usePipelineResult(input);
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
    return result;
  }
  return { render, calls, writes };
}

const empty = () => ({ picker: { all: [] }, raw: { addon: [], library: [] } });
const addon = { transportUrl: "https://example.org/manifest.json", manifest: { id: "test" } };
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("cold-start discovery cannot complete or cache a temporary empty search", async () => {
  const h = harness();
  let state = h.render();
  await flush();
  state = h.render();
  assert.equal(state.loading, true);
  assert.equal(state.pipelineDone, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.writes.length, 0);

  h.render({ addons: [addon], discoveringAddons: false });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].input.addons.length, 1);
  h.calls[0].resolve(empty());
  await flush();
  state = h.render();
  assert.equal(state.loading, false);
  assert.equal(state.pipelineDone, true);
  assert.equal(h.writes.length, 1);
});

test("a genuinely empty account still finishes after discovery settles", async () => {
  const h = harness();
  h.render();
  h.render({ discoveringAddons: false });
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(empty());
  await flush();
  assert.equal(h.render().pipelineDone, true);
});

test("rediscovery masks an old completion and defers cached reuse until settled", async () => {
  const h = harness();
  h.render({ addons: [addon], discoveringAddons: false });
  h.calls[0].resolve(empty());
  await flush();
  assert.equal(h.render().pipelineDone, true);
  const discovering = h.render({ discoveringAddons: true });
  assert.equal(discovering.loading, true);
  assert.equal(discovering.pipelineDone, false);
  assert.equal(h.calls.length, 1);
  h.render({ discoveringAddons: false });
  assert.equal(h.render().pipelineDone, true);
  assert.equal(h.calls.length, 1);
});

test("rediscovery aborts an in-flight search and ignores its late completion", async () => {
  const h = harness();
  h.render({ addons: [addon], discoveringAddons: false });
  h.render({ discoveringAddons: true });
  assert.equal(h.calls[0].signal.aborted, true);
  h.calls[0].resolve(empty());
  await flush();
  assert.equal(h.writes.length, 0);
  assert.equal(h.render().pipelineDone, false);
  h.render({ discoveringAddons: false });
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve(empty());
  await flush();
  assert.equal(h.render().pipelineDone, true);
  assert.equal(h.writes.length, 1);
});
