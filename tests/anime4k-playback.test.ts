import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as modes from "../src/lib/player/anime4k-modes";
import * as anime from "../src/lib/player/anime-src";
import * as general from "../src/lib/player/shader-chain";
import type { Settings } from "../src/lib/settings";
import type { PlayerSrc } from "../src/lib/view";

function fixture() {
  const settings = {
    playerAnime4k: true, playerAnime4kAnimeOnly: true, playerAnime4kFolder: "D:/shaders",
    playerAnime4kMode: "A", playerAnime4kTier: "hq", playerAnime4kOverride: "auto",
    mpvQuality: "balanced", playerShaders: {},
  } as Settings;
  let effectDeps: unknown[] | undefined;
  const pending: Array<() => void> = [];
  const calls: string[][] = [];
  const bridgeRef = { current: {
    setAnime4kShaders: (paths: string[]) => calls.push(paths), setShaderProps: () => {},
  } };
  const mocks: Record<string, unknown> = {
    react: { useEffect: (fn: () => void, deps: unknown[]) => {
      if (effectDeps?.length === deps.length && deps.every((v, i) => Object.is(v, effectDeps![i]))) return;
      effectDeps = deps;
      pending.push(fn);
    } },
    "@/lib/player/anime4k-modes": modes,
    "@/lib/player/anime-src": anime,
    "@/lib/player/shader-chain": general,
    "@/lib/settings": { useSettings: () => ({ settings, update: (patch: Partial<Settings>) => Object.assign(settings, patch) }) },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/views/player/hooks/use-anime4k.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const api = {} as typeof import("../src/views/player/hooks/use-anime4k");
  new Function("require", "exports", "window", compiled)(
    (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, api,
    { screen: { width: 2560 }, devicePixelRatio: 1 },
  );
  const source = { url: "fixture:anime", isAnime: true, meta: { id: "tt123", genres: [] } } as PlayerSrc;
  return {
    api, settings, source, calls, bridgeRef,
    render(ready = true, width = 1920) {
      const result = api.useAnime4k(bridgeRef as never, source.url, source, width, ready);
      pending.splice(0).forEach(fn => fn());
      return result;
    },
  };
}

test("an explicit anime source uses shaders even when its catalog has no anime genre", () => {
  const h = fixture();
  assert.ok(h.api.anime4kShadersFor(h.settings, h.source, "auto").length > 0);
  h.source.isAnime = false;
  assert.deepEqual(h.api.anime4kShadersFor(h.settings, h.source, "auto"), []);
  h.source.meta.id = "anilist:123";
  assert.ok(h.api.anime4kShadersFor(h.settings, h.source, "auto").length > 0);
});

test("tier, folder and off/on changes replace the active shader chain without changing the source", () => {
  const h = fixture();
  h.source.meta.id = "kitsu:123";
  h.render();
  assert.ok(h.calls.at(-1)?.some(path => path.includes("_VL.glsl")));
  h.settings.playerAnime4kTier = "fast";
  h.render();
  assert.ok(h.calls.at(-1)?.every(path => !path.includes("_VL.glsl")));
  h.settings.playerAnime4kFolder = "E:/new shaders";
  h.render();
  assert.ok(h.calls.at(-1)?.every(path => path.startsWith("E:/new shaders/")));
  h.settings.playerAnime4k = false;
  h.render();
  assert.deepEqual(h.calls.at(-1), []);
  h.settings.playerAnime4k = true;
  h.render();
  assert.ok(h.calls.at(-1)?.length);
});

test("external override and performance changes refresh playback, unrelated settings do not", () => {
  const h = fixture();
  h.source.meta.id = "kitsu:123";
  h.render();
  h.settings.playerAnime4kOverride = "off";
  h.render();
  assert.deepEqual(h.calls.at(-1), []);
  h.settings.playerAnime4kOverride = "B";
  h.render();
  assert.ok(h.calls.at(-1)?.some(path => path.includes("Restore_CNN_Soft_VL")));
  h.settings.mpvQuality = "performance";
  h.render();
  assert.ok(h.calls.at(-1)?.some(path => path.includes("Restore_CNN_Soft_M")));
  const count = h.calls.length;
  h.settings.playerAnime4kIndicator = false;
  h.render();
  h.render();
  assert.equal(h.calls.length, count);
});

test("shader commands wait for the bridge and reapply after replacing it", () => {
  const h = fixture();
  h.render(false);
  assert.equal(h.calls.length, 0);
  h.render(true);
  assert.equal(h.calls.length, 1);
  h.render(false);
  assert.equal(h.calls.length, 1);
  h.render(true);
  assert.equal(h.calls.length, 2);
});

test("turning Anime4K off preserves other shader effects and avoids duplicate mode applications", () => {
  const h = fixture();
  h.settings.playerShaders = { fsr: { enabled: true, dir: "D:/fsr" } } as Settings["playerShaders"];
  const otherShaders = general.generalShaderChain(h.settings);
  assert.ok(otherShaders.length, "fixture uses a real catalog shader");
  const controls = h.render();
  const before = h.calls.length;
  controls.setMode("off");
  h.render();
  assert.deepEqual(h.calls.at(-1), otherShaders);
  assert.equal(h.calls.length, before + 1);
});

test("secondary-mode downscale protection is retained", () => {
  const h = fixture();
  const src = { ...h.source, meta: { ...h.source.meta, id: "kitsu:123" } };
  assert.deepEqual(
    h.api.anime4kShadersFor(h.settings, src, "AA", { srcWidth: 3840, displayWidth: 2560 }),
    modes.anime4kChain(h.settings.playerAnime4kFolder, "A", "hq"),
  );
});
