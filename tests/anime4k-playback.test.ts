import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as modes from "../src/lib/player/anime4k-modes";
import * as anime from "../src/lib/player/anime-src";
import * as general from "../src/lib/player/shader-chain";
import type { Settings } from "../src/lib/settings";
import type { PlayerSrc } from "../src/lib/view";

const ALL_MODES: Array<Parameters<typeof modes.anime4kChain>[1]> = ["A", "B", "C", "AA", "BB", "CA"];
const ALL_TIERS: Array<Parameters<typeof modes.anime4kChain>[2]> = ["hq", "fast"];

/** Local shader names the Rust download manifest installs. */
function manifestFiles(): Set<string> {
  const rust = readFileSync(new URL("../src-tauri/src/anime4k.rs", import.meta.url), "utf8");
  const names = new Set<string>();
  for (const m of rust.matchAll(/\(\s*"[^"]*"\s*,\s*"([^"]+\.glsl)"\s*,?\s*\)/g)) names.add(m[1]);
  assert.ok(names.size > 0, "manifest parses");
  return names;
}

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
    render(ready = true, width = 1920, sourceWidth = 1280) {
      const result = api.useAnime4k(
        bridgeRef as never,
        source.url,
        source,
        width,
        sourceWidth,
        ready,
      );
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

test("a source that fits the window keeps its secondary mode", () => {
  const h = fixture();
  const src = { ...h.source, meta: { ...h.source.meta, id: "kitsu:123" } };
  // 1080p presented on a 1080p window has no headroom left, so A+A falls back
  // to A.
  assert.deepEqual(
    h.api.anime4kShadersFor(h.settings, src, "AA", { srcWidth: 1920, displayWidth: 1920 }),
    modes.anime4kChain(h.settings.playerAnime4kFolder, "A", "hq"),
  );
  // Presented larger than the source, the doubler has something to resolve.
  assert.deepEqual(
    h.api.anime4kShadersFor(h.settings, src, "AA", { srcWidth: 1080, displayWidth: 3840 }),
    modes.anime4kChain(h.settings.playerAnime4kFolder, "AA", "hq"),
  );
});

test("the runtime gate uses the decoded size, not the display width", () => {
  const h = fixture();
  h.source.meta.id = "kitsu:123";
  // Fullscreen 1080p: source and window both 1920, which used to compare 1920
  // against the screen and quietly drop the second restore pass.
  h.render(true, 1920, 1920);
  assert.equal(
    h.calls.at(-1)?.filter(p => p.includes("Restore_CNN")).length,
    modes.anime4kChain("D:/shaders", "A", "hq").filter(p => p.includes("Restore_CNN")).length,
  );
  // A small source on a large display keeps the requested AA chain.
  h.settings.playerAnime4kOverride = "AA";
  h.render(true, 3840, 1280);
  assert.deepEqual(h.calls.at(-1), modes.anime4kChain("D:/shaders", "AA", "hq"));
});

test("upstream chain order is used for every mode", () => {
  const h = fixture();
  const files = (mode: Parameters<typeof modes.anime4kChain>[1], tier: "hq" | "fast") =>
    modes.anime4kChain("D:/shaders", mode, tier).map(p => p.split("/").pop()!);
  const clamp = "Anime4K_Clamp_Highlights.glsl";
  const d2 = "Anime4K_AutoDownscalePre_x2.glsl";
  const d4 = "Anime4K_AutoDownscalePre_x4.glsl";
  // The soft restore belongs after both downscale probes.
  assert.deepEqual(files("BB", "hq"), [
    clamp,
    "Anime4K_Restore_CNN_Soft_VL.glsl",
    "Anime4K_Upscale_CNN_x2_VL.glsl",
    d2,
    d4,
    "Anime4K_Restore_CNN_Soft_S.glsl",
    "Anime4K_Upscale_CNN_x2_M.glsl",
  ]);
  // Upstream's low-end preset uses the light kernels for the second pass.
  assert.ok(files("A", "fast").includes("Anime4K_Upscale_CNN_x2_S.glsl"));
  assert.ok(files("AA", "fast").includes("Anime4K_Restore_CNN_S.glsl"));
  assert.equal(h.settings.playerAnime4kFolder, "D:/shaders");
});

test("every kernel a preset names is in the download manifest", () => {
  const installed = manifestFiles();
  const missing: string[] = [];
  for (const mode of ALL_MODES) {
    for (const tier of ALL_TIERS) {
      for (const path of modes.anime4kChain("D:/shaders", mode, tier)) {
        const name = path.split("/").pop()!;
        if (!installed.has(name)) missing.push(`${tier}/${mode}: ${name}`);
      }
    }
  }
  // mpv drops a shader file it cannot open, so a name the manifest never
  // installs degrades the chain with no visible error.
  assert.deepEqual(missing, []);
});

test("the pack is topped up once per run and only when it is incomplete", async () => {
  const calls: string[] = [];
  const mods: Record<string, unknown> = {
    "@tauri-apps/api/core": {
      invoke: (cmd: string, args?: { force?: boolean }) => {
        calls.push(cmd);
        if (cmd === "anime4k_dir") return Promise.resolve(null);
        assert.equal(args?.force, false, "top-up never re-downloads what exists");
        return Promise.resolve("D:/shaders");
      },
    },
  };
  const compiled = ts.transpileModule(
    readFileSync(new URL("../src/lib/anime4k.ts", import.meta.url), "utf8"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const api = {} as typeof import("../src/lib/anime4k");
  new Function("require", "exports", compiled)(
    (id: string) => { assert.ok(id in mods, id); return mods[id]; },
    api,
  );
  assert.equal(await api.anime4kPackComplete(), false);
  await api.repairAnime4kPack();
  // Both are memoized, so later players reuse the answer instead of re-probing.
  assert.equal(await api.anime4kPackComplete(), false);
  await api.repairAnime4kPack();
  assert.deepEqual(calls, ["anime4k_dir", "anime4k_download"]);
});

test("catalog shaders that feed an upscale run before Anime4K", () => {
  const h = fixture();
  h.settings.playerAnime4kFolder = "D:/shaders";
  h.settings.playerAnime4kOverride = "A";
  h.settings.playerShaders = {
    fsrcnnx: { enabled: true, dir: "D:/fsrcnnx" },
    ssimsuperres: { enabled: true, dir: "D:/ssim" },
    cas: { enabled: true, dir: "D:/cas" },
  } as Settings["playerShaders"];
  const chain = h.api.fullShaderChain(h.settings, h.source, "A", {
    srcWidth: 1080,
    displayWidth: 3840,
  });
  const idx = (needle: string) => chain.findIndex(p => p.includes(needle));
  const clamp = idx("Clamp_Highlights");
  assert.ok(clamp > -1, `Anime4K is present: ${JSON.stringify(chain)}`);
  assert.ok(idx("FSRCNNX") < clamp, `prescale upscaler runs first: ${JSON.stringify(chain)}`);
  assert.ok(idx("SSimSuperRes") < clamp, `restore runs before Anime4K: ${JSON.stringify(chain)}`);
  assert.ok(idx("CAS.glsl") > clamp, `sharpen runs after Anime4K: ${JSON.stringify(chain)}`);
});
