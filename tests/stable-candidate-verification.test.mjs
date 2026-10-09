import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)(
    (name) => {
      if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}

async function fullscreenHarness(mode, maximized = false) {
  const calls = [];
  const settings = {
    fullscreenMode: mode,
    fullscreenRestorePosition: true,
    useNativeTitleBar: true,
  };
  const win = {
    isFullscreen: async () => false,
    isMaximized: async () => maximized,
    toggleMaximize: async () => {
      maximized = !maximized;
      calls.push(["maximize", maximized]);
    },
    outerPosition: async () => ({ x: 120, y: 80 }),
    innerSize: async () => ({ width: 960, height: 540 }),
    setPosition: async (p) => calls.push(["position", p.x, p.y]),
    setSize: async (s) => calls.push(["size", s.width, s.height]),
    setDecorations: async (v) => calls.push(["decorations", v]),
  };
  const api = load(
    "src/lib/fullscreen-state.ts",
    {
      "@/lib/settings/load": { loadStoredSettings: () => settings },
      "@tauri-apps/api/core": { invoke: async (command) => calls.push(["invoke", command]) },
      "@tauri-apps/api/window": {
        getCurrentWindow: () => win,
        currentMonitor: async () => ({
          position: { x: 1920, y: 0 },
          size: { width: 1920, height: 1080 },
        }),
        PhysicalPosition: class {
          constructor(x, y) {
            this.x = x;
            this.y = y;
          }
        },
        PhysicalSize: class {
          constructor(width, height) {
            this.width = width;
            this.height = height;
          }
        },
      },
    },
    { window: { __TAURI_INTERNALS__: {} }, document: {} },
  );
  await new Promise((resolve) => setImmediate(resolve));
  return { api, calls, settings };
}

test("borderless exit executes restoration even through exitAnyFullscreen", async () => {
  const { api, calls } = await fullscreenHarness("borderless");
  await api.enterWindowFullscreen();
  assert.equal(api.isBorderlessFullscreen(), true);
  assert.ok(calls.some((c) => c[0] === "size" && c[1] === 1920 && c[2] === 1080));
  await api.exitAnyFullscreen();
  assert.equal(api.isBorderlessFullscreen(), false);
  assert.equal(api.getWindowFullscreen(), false);
  assert.ok(calls.some((c) => c[0] === "position" && c[1] === 120 && c[2] === 80));
  assert.ok(calls.some((c) => c[0] === "size" && c[1] === 960 && c[2] === 540));
  assert.ok(calls.some((c) => c[0] === "decorations" && c[1] === true));
});

test("borderless restores maximized state without restoring unsafe geometry", async () => {
  const { api, calls } = await fullscreenHarness("borderless", true);
  await api.enterWindowFullscreen();
  await api.exitAnyFullscreen();
  assert.deepEqual(
    calls.filter((c) => c[0] === "maximize"),
    [
      ["maximize", false],
      ["maximize", true],
    ],
  );
  assert.equal(calls.filter((c) => c[0] === "size").length, 1);
});

test("closing the player obeys the stay-fullscreen preference", async () => {
  const { api, settings } = await fullscreenHarness("borderless");
  await api.enterWindowFullscreen();
  settings.keepFullscreenOnExit = true;
  await api.exitWindowFullscreenOnPlayerClose();
  assert.equal(api.isBorderlessFullscreen(), true);
  settings.keepFullscreenOnExit = false;
  await api.exitWindowFullscreenOnPlayerClose();
  assert.equal(api.isBorderlessFullscreen(), false);
});

test("true fullscreen enter/exit calls the native lifecycle", async () => {
  const { api, calls } = await fullscreenHarness("fullscreen");
  await api.enterWindowFullscreen();
  await api.exitAnyFullscreen();
  assert.deepEqual(
    calls.filter((c) => c[0] === "invoke"),
    [
      ["invoke", "window_fullscreen_enter"],
      ["invoke", "window_fullscreen_exit"],
    ],
  );
  assert.equal(api.getWindowFullscreen(), false);
});
