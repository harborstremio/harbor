import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import { renderToString } from "react-dom/server";

const require = createRequire(import.meta.url);
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
// Execute the production providers with real React. Only native/network edges
// and the visual shell are stubbed; provider nesting and hook contracts are real.
function load(file, modules = {}, globals = {}) {
  const output = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const dependency = (name) => modules[name] ?? (name.startsWith("react") ? require(name) : {});
  new Function("require", "exports", ...Object.keys(globals), output)(
    dependency,
    exports,
    ...Object.values(globals),
  );
  return exports;
}

test("HDR shell mounts with the actual profile, auth and navigation contexts", () => {
  const writes = [];
  const store = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({
        activeId: "selected",
        profiles: [
          { id: "primary", name: "Primary", isPrimary: true },
          { id: "selected", name: "Selected", isPrimary: false, shareStremioWith: null },
        ],
      }),
    ],
    ["harbor.settings.shared", JSON.stringify({ defaultProfileId: "primary" })],
  ]);
  const localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (...args) => writes.push(args),
  };
  const profiles = load(
    "src/lib/profiles.tsx",
    {
      "./avatars/catalog": { isRemovedBuiltinAvatar: () => false },
    },
    { localStorage },
  );
  const auth = load("src/lib/auth.tsx", { "./profiles": profiles }, { localStorage });
  const view = load("src/lib/view.tsx");
  const forwarded = [];
  const payload = {
    stageId: "test-stage",
    snap: {},
    src: { url: "test", meta: { id: "test", name: "Test" } },
  };
  const app = load("src/views/hdr-overlay-app.tsx", {
    react: {
      ...React,
      useState: (initial) => React.useState(initial === null ? payload : initial),
    },
    "@/lib/auth": auth,
    "@/lib/profiles": profiles,
    "@/lib/view": view,
    "@/lib/settings": { SettingsProvider: ({ children }) => children },
    "@/lib/player/mpv-forward": { createForwardingMpvBridge: () => ({}) },
    "./player/hooks/use-player-interaction-lock": { usePlayerInteractionBlocker: () => {} },
    "./player/drag-click-stage": { DragClickStage: () => null },
    "@/components/player/player-interaction-lock": { PlayerInteractionLockControls: () => null },
    "@/lib/hdr-overlay": { hdrOverlayEmitAction: (...args) => forwarded.push(args) },
    "./player/shell-layer": {
      ShellLayer: () => {
        const { activeId } = profiles.useProfiles();
        assert.equal(activeId, "selected", "must not reselect the primary/default profile");
        assert.equal(auth.useAuth().user, null);
        const nav = view.usePlayerNavigation();
        nav.exitPlayer();
        nav.openMeta({ id: "test" });
        nav.openPicker({ id: "next" });
        nav.replacePlayerSrc(payload.src);
        return React.createElement("span", null, "Player controls mounted");
      },
    },
  });
  assert.match(renderToString(React.createElement(app.HdrOverlayApp)), /Player controls mounted/);
  assert.deepEqual(writes, [], "companion mount must not write profile storage");
  assert.deepEqual(
    forwarded.map(([, request]) => request.action),
    ["exitPlayer", "openMeta", "openPicker", "replacePlayerSrc"],
  );
  assert.throws(
    () => renderToString(React.createElement(auth.AuthProvider)),
    /useProfiles outside ProfilesProvider/,
    "regression fixture detects the original missing-provider crash",
  );
});

test("provider failures are inside the HDR error boundary", () => {
  const source = read("src/views/hdr-overlay-app.tsx");
  assert.match(source, /<OverlayErrorBoundary>\s*<CompanionProfilesProvider>\s*<AuthProvider>/);
  assert.doesNotMatch(source, /requestAnimationFrame/);
  assert.match(source, /\}, \[payload\?\.stageId\]\)/);
  assert.match(source, /root\.inert = false/);
});

test("overlay subscribes before requesting props and cancels late listener registration", async () => {
  for (const cancelEarly of [false, true]) {
    const effects = [];
    const events = [];
    let registered;
    let unlistened = 0;
    const timers = new Set();
    const passthrough = ({ children }) => children;
    const window = {
      location: { search: "?stageId=test-stage" },
      addEventListener() {},
      removeEventListener() {},
      setInterval: (fn) => {
        timers.add(fn);
        return fn;
      },
      clearInterval: (id) => timers.delete(id),
    };
    const document = {
      documentElement: { style: {} },
      body: { style: {} },
      getElementById: () => null,
    };
    const app = load(
      "src/views/hdr-overlay-app.tsx",
      {
        react: { ...React, useEffect: (effect) => effects.push(effect) },
        "@/lib/profiles": { CompanionProfilesProvider: passthrough },
        "@/lib/auth": { AuthProvider: passthrough },
        "@/lib/settings": { SettingsProvider: passthrough },
        "@/lib/view": { PlayerNavigationProvider: passthrough },
        "@/lib/player/mpv-forward": { createForwardingMpvBridge: () => ({}) },
        "./player/hooks/use-player-interaction-lock": { usePlayerInteractionBlocker() {} },
        "@/lib/hdr-overlay": {
          onHdrStageProps: () =>
            new Promise((resolve) => {
              registered = resolve;
            }),
          hdrOverlayEmitAction: (event) => events.push(event),
        },
      },
      { window, document },
    );
    renderToString(React.createElement(app.HdrOverlayApp));
    const cleanups = effects.map((effect) => effect());
    assert.deepEqual(events, [], "no request may race ahead of listener registration");
    if (cancelEarly) for (const cleanup of cleanups) cleanup?.();
    registered(() => unlistened++);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(events, cancelEarly ? [] : ["hdr-stage://request"]);
    if (!cancelEarly) for (const cleanup of cleanups) cleanup?.();
    assert.equal(unlistened, 1);
    assert.equal(timers.size, 0);
  }
});

test("native handoff is hidden, correlated and uses physical client bounds", () => {
  const source = read("src-tauri/src/hdr_overlay.rs");
  assert.match(source, /\.visible\(false\)/);
  assert.doesNotMatch(source, /\.visible\(true\)/);
  assert.match(source, /\.inner_position\(\)/);
  assert.doesNotMatch(source, /to_logical|LogicalPosition|outer_position/);
  const show = source.split("pub async fn hdr_overlay_show")[1].split("#[tauri::command]")[0];
  assert.ok(show.indexOf("operation.as_deref()") < show.indexOf("window.show()"));
  assert.ok(show.indexOf("hdr_overlay_sync") < show.indexOf("window.show()"));
  const open = source.split("pub async fn hdr_overlay_open")[1].split("#[tauri::command]")[0];
  assert.doesNotMatch(open, /\.show\(\)/);
  assert.match(
    open,
    /w\.navigate\(url\)/,
    "retry must restart a failed renderer, not show it again",
  );
});
