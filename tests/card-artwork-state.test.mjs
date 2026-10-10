import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, mocks) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => mocks[name] ?? {}, exports);
  return exports;
}

// Exercise production hook state and effect cleanup without network or a user profile.
function hooks() {
  const state = [];
  const effects = [];
  let cursor = 0;
  let pending = [];
  return {
    react: {
      memo: (component) => component,
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (value) => (state[index] = value)];
      },
      useEffect(effect, deps) {
        const index = cursor++;
        if (effects[index]?.deps.every((dep, i) => Object.is(dep, deps[i]))) return;
        pending.push(() => {
          effects[index]?.cleanup?.();
          effects[index] = { deps, cleanup: effect() };
        });
      },
    },
    render(component, props) {
      cursor = 0;
      return component(props);
    },
    flush() {
      const jobs = pending;
      pending = [];
      jobs.forEach((job) => job());
    },
  };
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx, Fragment: "fragment" };
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const meta = (id, extra = {}) => ({
  id,
  name: id,
  type: "series",
  poster: `${id}-poster`,
  ...extra,
});

function artworkFixture() {
  const h = hooks();
  const cached = new Map();
  const pending = new Map();
  const { TvCardArtwork } = load("src/components/tv-card.tsx", {
    react: h.react,
    "react/jsx-runtime": runtime,
    "@/lib/settings": { useSettings: () => ({ settings: {} }) },
    "@/lib/img-size": { sizeImageUrl: (url) => url },
    "@/lib/providers/anime-hero-art-static": {
      peekStaticHeroArt: (id) => cached.get(id),
      ensureStaticHeroArt: async () => {},
    },
    "@/lib/expanding-card-artwork": {
      prepareExpandingCardArtwork: (m) => new Promise((resolve) => pending.set(m.id, resolve)),
    },
  });
  return {
    ...h,
    cached,
    pending,
    image(m) {
      return h.render(TvCardArtwork, { meta: m, posterSrc: m.poster }).props.children[0].props;
    },
  };
}

test("reused anime card never displays the preceding title while artwork resolves", async () => {
  const f = artworkFixture();
  const a = meta("kitsu:1");
  const b = meta("kitsu:2");
  f.cached.set(a.id, { bg: "a-wide" });
  assert.equal(f.image(a).src, "a-wide");
  f.flush();
  await tick();
  assert.equal(f.image(b).src, b.poster);
  f.flush();
  await tick();
  f.pending.get(b.id)("b-wide");
  await tick();
  assert.equal(f.image(b).src, "b-wide");
});

test("late results from a previous title cannot replace current artwork", async () => {
  const f = artworkFixture();
  const a = meta("kitsu:1");
  const b = meta("kitsu:2");
  f.image(a);
  f.flush();
  await tick();
  f.image(b);
  f.flush();
  await tick();
  f.pending.get(b.id)("b-wide");
  await tick();
  f.pending.get(a.id)("a-wide");
  await tick();
  assert.equal(f.image(b).src, "b-wide");
});

test("a failed backdrop falls back but does not suppress a replacement URL", () => {
  const f = artworkFixture();
  const a = meta("tt1", { background: "broken" });
  f.image(a).onError();
  assert.equal(f.image(a).src, a.poster);
  const updated = { ...a, background: "working" };
  assert.equal(f.image(updated).src, "working");
});

test("poster-only fallback results stay blurred rather than posing as a wide backdrop", async () => {
  const f = artworkFixture();
  const a = meta("kitsu:1");
  f.image(a);
  f.flush();
  await tick();
  f.pending.get(a.id)(a.poster);
  await tick();
  assert.match(f.image(a).className, /blur/);
});

const addon = (id, resources = ["meta"]) => ({
  manifest: { id, resources },
  transportUrl: `https://example.invalid/${id}/manifest.json`,
});
function metadataFixture(remote = async () => [], local = []) {
  return load("src/lib/meta-resource.ts", {
    "./addons": {
      userAddons: remote,
      addonAccepts: (a, resource) => a.manifest.resources.includes(resource),
    },
    "./addon-store": { loadInstalled: () => local },
  });
}

test("metadata detection considers account-only and local providers", async () => {
  const remote = metadataFixture(async () => [addon("account-provider")]);
  assert.equal(remote.hasCustomMetaAddon(), false);
  assert.equal(await remote.hasCustomMetaAddonAsync("fixture-account"), true);
  const local = metadataFixture(async () => [], [addon("local-provider")]);
  assert.equal(await local.hasCustomMetaAddonAsync(null), true);
});

test("Cinemeta and non-metadata providers do not satisfy custom metadata detection", async () => {
  const f = metadataFixture(async () => [addon("cinemeta"), addon("catalogs", ["catalog"])]);
  assert.equal(await f.hasCustomMetaAddonAsync("fixture-account"), false);
});

test("account lookup failure still permits locally installed metadata", async () => {
  const f = metadataFixture(async () => {
    throw new Error("offline");
  }, [addon("local-provider")]);
  assert.equal(await f.hasCustomMetaAddonAsync("fixture-account"), true);
});

test("provider warning does not retain a previous account result during a switch", async () => {
  const h = hooks();
  let authKey = "fixture-a";
  const pending = new Map();
  const { ProvidersTab } = load("src/views/settings/library-panel/providers-tab.tsx", {
    react: h.react,
    "react/jsx-runtime": runtime,
    "@/lib/settings": { useSettings: () => ({ settings: { cinemetaEnabled: false } }) },
    "@/lib/auth": { useAuth: () => ({ authKey }) },
    "@/lib/i18n": { useT: () => (text) => text },
    "./provider-keys": { useProviderKeys: () => ({ keyRow: () => null }) },
    "@/lib/meta-resource": {
      hasCustomMetaAddon: () => false,
      hasCustomMetaAddonAsync: (key) => new Promise((resolve) => pending.set(key, resolve)),
    },
  });
  const warning = () => {
    const tree = h.render(ProvidersTab, {});
    const titlesSection = tree.props.children[3];
    return titlesSection.props.children.props.children[0].props.warn;
  };
  assert.ok(warning());
  h.flush();
  pending.get(authKey)(true);
  await tick();
  assert.equal(warning(), undefined);
  authKey = "fixture-b";
  assert.ok(warning());
  h.flush();
  pending.get(authKey)(false);
  await tick();
  assert.ok(warning());
});
