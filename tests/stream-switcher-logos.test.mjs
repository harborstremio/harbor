import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { repoKey } from "../src/lib/streams/plugins/manifest.ts";

function loadSource(path, dependencies) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => dependencies[id] ?? (id.startsWith("@/assets/") ? { default: id } : {}),
    module,
    module.exports,
  );
  return module.exports;
}

function switcher({
  installed = [],
  stremio = [],
  plugins = [],
  loading = Promise.resolve(),
} = {}) {
  const effects = [];
  const maps = [];
  const listeners = new Set();
  const react = {
    useEffect: (effect) => effects.push(effect),
    useMemo: (fn) => fn(),
    useState: (initial) => [
      typeof initial === "function" ? initial() : initial,
      (value) => {
        if (value instanceof Map) maps.push(value);
      },
    ],
  };
  const jsx = (type, props) => ({ type, props });
  const logo = loadSource("components/addon-logo.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
  });
  const addons = loadSource("lib/streams/plugins/addon.ts", {
    "./runnable": { runnableStreamPlugins: () => plugins },
    "./manifest": { repoKey },
  });
  const component = loadSource("components/player/stream-switcher.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/addon-logo": logo,
    "@/lib/addon-store": { fetchInstalledAddons: async () => installed },
    "@/lib/addons": { userAddons: async () => stremio },
    "@/lib/auth": { useAuth: () => ({ authKey: "fixture" }) },
    "@/lib/settings": { useSettings: () => ({ settings: {} }) },
    "@/lib/i18n": { useT: () => (s) => s },
    "@/lib/profiles": { useActiveKid: () => null },
    "@/lib/picker-cache": { peekPickerCache: () => null },
    "@/lib/streams/mode": { filterStreamsByMode: (streams) => streams },
    "@/lib/streams/plugins": {
      ...addons,
      loadStreamPlugins: () => loading,
      subscribeStreamPluginList: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    },
    "@/views/play-picker/picker-utils": { buildAddonOptions: () => [] },
    "./stream-switcher/quality": { QUALITY_ORDER: [] },
    "./stream-switcher/use-switcher-refresh": { useSwitcherRefresh: () => ({ refreshing: false }) },
  });
  component.StreamSwitcher({ open: true, meta: { id: "tt1" }, debridSlugs: [] });
  const cleanup = effects[1]();
  return {
    maps,
    logo,
    cleanup,
    listeners,
    notify: () => listeners.forEach((cb) => cb()),
    ready: () => new Promise((resolve) => setImmediate(resolve)),
  };
}

const addon = (id, logo) => ({
  manifest: { id, logo },
  transportUrl: "https://addon.example/manifest.json",
});
const plugin = (icon) => ({
  id: "plugin:fixture.provider",
  name: "Fixture",
  icon,
  repoUrl: "https://repo.example/manifest.json",
  repoName: "Fixture repo",
  types: ["movie"],
  idPrefixes: ["tt"],
});

test("installed and Stremio logos keep relative URL resolution and last-addon precedence", async () => {
  const h = switcher({
    installed: [addon("installed", "/installed.png"), addon("duplicate", "/old.png")],
    stremio: [addon("stremio", "https://stremio.example/icon.png"), addon("duplicate", "/new.png")],
  });
  await h.ready();
  assert.equal(h.maps[0].get("installed"), "https://addon.example/installed.png");
  assert.equal(h.maps[0].get("stremio"), "https://stremio.example/icon.png");
  assert.equal(h.maps[0].get("duplicate"), "https://addon.example/new.png");
  h.cleanup();
});

test("plugin icons resolve for individual and grouped stream IDs", async () => {
  const p = plugin("https://plugin.example/icon.png");
  const h = switcher({ plugins: [p] });
  await h.ready();
  assert.equal(h.maps[0].get(p.id), p.icon);
  assert.equal(h.maps[0].get(`plugin-repo:${repoKey(p.repoUrl)}`), p.icon);
  assert.equal(
    h.logo.AddonLogo({ addonId: p.id, addonName: p.name, manifestLogo: h.maps[0].get(p.id) }).props
      .src,
    p.icon,
  );
  h.cleanup();
});

test("a plugin without an icon still renders the initial-letter avatar", async () => {
  const p = plugin(undefined);
  const h = switcher({ plugins: [p] });
  await h.ready();
  assert.equal(h.maps[0].get(p.id), null);
  const avatar = h.logo.AddonLogo({
    addonId: p.id,
    addonName: p.name,
    manifestLogo: h.maps[0].get(p.id),
  });
  assert.equal(avatar.type, "span");
  assert.equal(avatar.props.children, "F");
  h.cleanup();
});

test("plugin metadata wins a colliding addon ID and refreshes without mutating prior maps", async () => {
  const p = plugin("https://plugin.example/first.png");
  const h = switcher({ installed: [addon(p.id, "/addon.png")], plugins: [p] });
  await h.ready();
  p.icon = "data:image/png;base64,aWNvbg==";
  h.notify();
  assert.equal(h.maps[0].get(p.id), "https://plugin.example/first.png");
  assert.equal(h.maps[1].get(p.id), p.icon);
  h.cleanup();
  assert.equal(h.listeners.size, 0);
  h.notify();
  assert.equal(h.maps.length, 2);
});

test("closing while plugin metadata loads prevents state updates and subscriptions", async () => {
  let finish;
  const h = switcher({
    loading: new Promise((resolve) => {
      finish = resolve;
    }),
  });
  await h.ready();
  h.cleanup();
  finish();
  await h.ready();
  assert.equal(h.maps.length, 0);
  assert.equal(h.listeners.size, 0);
});
