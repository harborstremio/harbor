// @ts-nocheck -- Node component-boundary tests are outside the browser tsconfig.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { experimentalReleaseNote } from "../src/lib/updater/experimental-notes.ts";
import { XrayRailCard, XrayTile } from "../src/components/player/xray/xray-actor-card.tsx";

// Execute production component logic with only hooks and external boundaries stubbed.
// No credentials, real player, network requests or persistent storage are used.
function component(path, overrides = {}) {
  let cursor = 0;
  const state = [];
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
      return [
        state[i],
        (value) => {
          state[i] = typeof value === "function" ? value(state[i]) : value;
        },
      ];
    },
    useEffect() {},
    useLayoutEffect() {},
    useRef: () => ({ current: null }),
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn(),
    useId: () => "notes-title",
    lazy: () => "LazyPanel",
    Suspense: "Suspense",
  };
  const modules = {
    react: hooks,
    "react/jsx-runtime": jsx,
    "@/lib/i18n": { useT: () => (s) => s },
    "@/lib/build-info": { APP_VERSION: "0.999.4" },
    "@/lib/updater/experimental-notes": { experimentalReleaseNote },
    "@/lib/queue": { useQueue: () => [] },
    ...overrides,
  };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  new Function("require", "exports", outputText)(
    (id) => modules[id] ?? new Proxy({}, { get: (_, key) => String(key) }),
    exports,
  );
  return {
    render(name, props) {
      cursor = 0;
      return exports[name](props);
    },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

test("installed experimental notes are exact-version, organized and offline", () => {
  const note = experimentalReleaseNote("0.999.4");
  assert.equal(note.title, "Harbor Experimental 0.0.4");
  assert.ok(note.sections.some((s) => s.heading === "Please test"));
  assert.match(JSON.stringify(note), /X-Ray/);
  for (const version of [
    null,
    undefined,
    "dev",
    "0.9.124",
    "0.9.125",
    "0.999.3",
    "0.999.5",
    "__proto__",
    "constructor",
  ]) {
    assert.equal(experimentalReleaseNote(version), null);
  }
});

test("installed notes open without an account or an available update", () => {
  const app = component("src/components/update/experimental-changelog.tsx");
  const before = nodes(app.render("ExperimentalChangelog"));
  const button = before.find((n) => n.type === "button");
  assert.equal(button.props.children, "View experimental changelog");
  button.props.onClick({ currentTarget: { focus() {} } });
  const dialog = nodes(app.render("ExperimentalChangelog")).find((n) => n.props?.note);
  assert.equal(dialog.props.note.title, "Harbor Experimental 0.0.4");
  dialog.props.onClose();
  assert.equal(
    nodes(app.render("ExperimentalChangelog")).some((n) => n.props?.note),
    false,
  );
  const beta = component("src/components/update/experimental-changelog.tsx", {
    "@/lib/build-info": { APP_VERSION: "0.9.125" },
  });
  assert.equal(beta.render("ExperimentalChangelog"), null);
});

test("experimental update notes remain visible during and after download", () => {
  const update = {
    channel: "experimental",
    version: "0.999.4",
    notes: "Tester notes",
    progress: 0,
    totalBytes: 0,
  };
  const app = component("src/components/update/update-card.tsx", {
    "@/lib/updater/use-update": { useUpdate: () => update },
  });
  for (const status of ["available", "downloading", "downloaded"]) {
    update.status = status;
    assert.ok(
      nodes(app.render("UpdateCard")).some((n) => n.props?.children === "Tester notes"),
      status,
    );
  }
});

for (const Card of [XrayRailCard, XrayTile]) {
  test(`${Card.name} opens the exact actor only on activation`, () => {
    const person = { id: 123, name: "Test Actor", sub: "Character", profilePath: null };
    const opened = [];
    const card = Card({ person, onOpenPerson: (p) => opened.push(p) });
    assert.equal(card.type, "button");
    assert.equal(card.props.type, "button");
    assert.match(card.props.className, /focus-visible/);
    assert.equal(card.props.onFocus, undefined);
    assert.deepEqual(opened, []);
    card.props.onClick();
    assert.deepEqual(opened, [person]);
  });
}

test("actor browser starts at selected person and browses titles within the player", () => {
  const app = component("src/components/player/cast-modal.tsx");
  const props = {
    open: true,
    meta: { id: "tt123", name: "Playing title" },
    initialPerson: { id: 42, name: "Actor" },
    tmdbKey: null,
    onClose() {},
  };
  let tree = nodes(app.render("CastModal", props));
  const person = tree.find((n) => n.type === "PersonPanel");
  assert.equal(person.props.personId, 42);
  assert.equal(tree.find((n) => n.props?.role === "dialog").props["aria-modal"], "true");
  person.props.onOpenTitle({ id: "tt456", name: "Other movie" });
  tree = nodes(app.render("CastModal", props));
  const title = tree.find((n) => n.type === "TitlePanel");
  assert.equal(title.props.meta.id, "tt456");
  assert.equal(title.props.onPlay, undefined);
  assert.equal(title.props.onOpenDetail, undefined);
  const normal = component("src/components/player/cast-modal.tsx");
  assert.ok(
    nodes(normal.render("CastModal", { ...props, initialPerson: undefined })).some(
      (n) => n.type === "TitlePanel",
    ),
  );
});

test("X-Ray rail, scene and cast grid all forward actor activation", () => {
  const source = (name) =>
    readFileSync(new URL(`../src/components/player/xray/${name}.tsx`, import.meta.url), "utf8");
  assert.equal((source("xray-overlay").match(/onOpenPerson=\{setPerson\}/g) ?? []).length, 2);
  for (const name of ["xray-rail", "xray-scene", "xray-browser"])
    assert.match(source(name), /onOpenPerson=\{onOpenPerson\}/);
  assert.match(source("xray-overlay"), /initialPerson=\{person\}/);
});

test("notes and actor browser register with Harbor's Back navigation", () => {
  for (const file of [
    "src/components/update/experimental-changelog.tsx",
    "src/components/player/cast-modal.tsx",
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /data-tv-focus-scope/);
    assert.match(source, /data-tv-modal-close/);
  }
  const updates = readFileSync(
    new URL("../src/views/settings/updates-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(
    updates.indexOf("<ExperimentalChangelog />") < updates.indexOf("{supportsInAppUpdates &&"),
  );
});
