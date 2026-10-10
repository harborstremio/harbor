import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as formats from "../src/lib/player/sub-format.ts";
import { pickBestTrack } from "../src/lib/subtitles/language.ts";

function load(relativePath, dependencies) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
  );
  return module.exports;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function nativeStyle(handler = async () => {}) {
  const calls = [];
  const style = load("../src/lib/player/sub-style.ts", {
    "@tauri-apps/api/core": {
      async invoke(command, args) {
        assert.equal(command, "mpv_set_property");
        calls.push(args);
        return handler(args);
      },
    },
  });
  return { apply: style.applySecondarySubNative, calls };
}

test("HDR secondary positioning is applied before enabling, and disabling preserves decoding", async () => {
  const h = nativeStyle();
  await h.apply(true, "top", 5);
  await h.apply(false, "top", 5);
  assert.deepEqual(h.calls, [
    { name: "secondary-sub-pos", value: 0 },
    { name: "secondary-sub-visibility", value: true },
    { name: "secondary-sub-visibility", value: false },
  ]);
});

test("bottom placement remains above the primary and clamps malformed saved margins", async () => {
  for (const [margin, expected] of [
    [4, 88],
    [200, 0],
    [-100, 100],
    [NaN, 92],
  ]) {
    const h = nativeStyle();
    await h.apply(true, "bottom", margin);
    assert.deepEqual(h.calls[0], { name: "secondary-sub-pos", value: expected });
  }
});

test("leaving HDR while positioning is pending prevents the stale enable", async () => {
  const gate = deferred();
  const h = nativeStyle(({ name }) => (name === "secondary-sub-pos" ? gate.promise : undefined));
  const enable = h.apply(true, "top", 0);
  await tick();
  const disable = h.apply(false, "top", 0);
  gate.resolve();
  await Promise.all([enable, disable]);
  assert.deepEqual(h.calls, [
    { name: "secondary-sub-pos", value: 0 },
    { name: "secondary-sub-visibility", value: false },
  ]);
});

test("a pending native enable completes before the subsequent disable", async () => {
  const gate = deferred();
  const h = nativeStyle(({ name, value }) =>
    name === "secondary-sub-visibility" && value ? gate.promise : undefined,
  );
  const enable = h.apply(true, "top", 0);
  await tick();
  const disable = h.apply(false, "top", 0);
  await tick();
  assert.equal(h.calls.filter((call) => call.value === false).length, 0);
  gate.resolve();
  await Promise.all([enable, disable]);
  assert.deepEqual(h.calls.at(-1), { name: "secondary-sub-visibility", value: false });
});

test("rapid settings changes skip superseded queued styles and recover from native failures", async () => {
  const h = nativeStyle(async () => {
    throw new Error("mpv not started");
  });
  await Promise.all([
    h.apply(true, "top", 0),
    h.apply(false, "top", 0),
    h.apply(true, "bottom", 5),
  ]);
  assert.deepEqual(h.calls, [
    { name: "secondary-sub-pos", value: 87 },
    { name: "secondary-sub-visibility", value: true },
  ]);
  await h.apply(false, "bottom", 5);
  assert.equal(h.calls.at(-1).value, false);
});

function hookHarness() {
  const calls = [],
    refs = [],
    effects = [];
  let refIndex = 0,
    effectIndex = 0,
    pending = [];
  const { useSecondarySub } = load("../src/views/player/hooks/use-secondary-sub.ts", {
    react: {
      useRef(value) {
        return (refs[refIndex++] ??= { current: value });
      },
      useEffect(run, deps) {
        const index = effectIndex++;
        const previous = effects[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          pending.push(() => {
            previous?.cleanup?.();
            effects[index] = { deps, cleanup: run() };
          });
        }
      },
    },
    "@/lib/player/secondary-sub": { resetSecondarySub() {}, useSecondarySubChoice: () => "auto" },
    "@/lib/player/sub-format": formats,
    "@/lib/subtitles/language": { pickBestTrack },
    "@/lib/player/sub-style": {
      applySecondarySubNative: async (...args) => {
        calls.push(args);
      },
    },
  });
  const base = {
    bridgeRef: { current: { setSecondarySubtitleTrack() {} } },
    snap: { subtitleTracks: [] },
    sourceUrl: "one.mkv",
    lang: "en",
    nativeReady: true,
    nativeRender: true,
    bridgeKey: 1,
    placement: "top",
    marginY: 4,
  };
  return {
    calls,
    render(changes = {}) {
      refIndex = 0;
      effectIndex = 0;
      pending = [];
      useSecondarySub({ ...base, ...changes });
      pending.forEach((run) => run());
    },
    unmount() {
      effects.forEach((effect) => effect.cleanup?.());
    },
  };
}

test("native styling waits for a ready mpv bridge/media and is not repeated by playback ticks", () => {
  const h = hookHarness();
  h.render({ nativeReady: false });
  assert.deepEqual(h.calls, []);
  h.render();
  h.render({ snap: { subtitleTracks: [], positionSec: 20 } });
  assert.deepEqual(h.calls, [[true, "top", 4]]);
});

test("HDR to SDR and unmount both turn native secondary rendering off", () => {
  const h = hookHarness();
  h.render();
  h.render({ nativeRender: false });
  assert.equal(h.calls.at(-1)[0], false);
  h.render();
  assert.equal(h.calls.at(-1)[0], true);
  h.unmount();
  assert.equal(h.calls.at(-1)[0], false);
});

test("a new media source or recreated player reapplies the same HDR settings", () => {
  const h = hookHarness();
  h.render();
  h.render({ sourceUrl: "two.mkv" });
  h.render({ sourceUrl: "two.mkv", bridgeKey: 2 });
  assert.equal(h.calls.filter(([enabled]) => enabled).length, 3);
  h.render({ sourceUrl: "two.mkv", bridgeKey: 2, nativeReady: false });
  assert.equal(h.calls.at(-1)[0], false);
});

test("placement changes apply during playback without changing subtitle selection", () => {
  const h = hookHarness();
  h.render();
  h.render({ placement: "bottom", marginY: 12 });
  assert.deepEqual(h.calls.at(-1), [true, "bottom", 12]);
});
