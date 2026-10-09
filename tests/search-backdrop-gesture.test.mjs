import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/components/search/search-overlay.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function harness(t, options = {}) {
  const settings = { dragAnywhere: true, aiSearchKey: "", aiGroqKey: "", ...options.settings };
  let fullscreen = options.fullscreen ?? false;
  let nativeFullscreen = options.nativeFullscreen ?? Promise.resolve(false);
  const calls = { closes: 0, drags: 0, fullscreenReads: 0 };
  const search = {
    open: true,
    query: "",
    results: null,
    status: "idle",
    setAiHold() {},
    setOpen(value) {
      search.open = value;
      if (!value) calls.closes++;
    },
    recordRecent() {},
  };
  const listeners = new Map();
  const win = new EventTarget();
  const add = win.addEventListener.bind(win);
  const remove = win.removeEventListener.bind(win);
  win.addEventListener = (type, callback) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
    add(type, callback);
  };
  win.removeEventListener = (type, callback) => {
    listeners.get(type)?.delete(callback);
    remove(type, callback);
  };
  win.setTimeout = () => 0;
  win.clearTimeout = () => {};
  const hooks = [];
  const effects = new Map();
  let cursor = 0;
  let pending = [];
  const react = {
    useRef(initial) {
      const index = cursor++;
      return (hooks[index] ??= { current: initial });
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [
        hooks[index],
        (value) => {
          hooks[index] = typeof value === "function" ? value(hooks[index]) : value;
        },
      ];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = effects.get(index);
      if (
        previous &&
        deps?.length === previous.deps?.length &&
        deps.every((value, i) => Object.is(value, previous.deps[i]))
      )
        return;
      pending.push(() => {
        previous?.cleanup?.();
        effects.set(index, { deps, cleanup: effect() });
      });
    },
  };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol("fragment") },
    "react-dom": { createPortal: (tree) => tree },
    "@/lib/search-context": { useSearch: () => search },
    "@/lib/settings": { useSettings: () => ({ settings, update() {} }) },
    "@/lib/view": { useView: () => ({}) },
    "@/lib/i18n": { useT: () => (value) => value },
    "@/lib/use-exit-presence": {
      useExitPresence: () => ({ mounted: search.open, closing: false }),
    },
    "@/lib/use-window-fullscreen": { useWindowFullscreen: () => fullscreen },
    "@/lib/search-display-state": {
      getSearchDisplayState: () => ({
        currentResults: null,
        hasResults: false,
        noResults: false,
        tmdbUnavailable: false,
      }),
    },
    "./use-collection-hits": { useCollectionHits: () => [] },
    "./person-top-match": { matchPersonForQuery: () => null },
    "@tauri-apps/api/core": { isTauri: () => options.native !== false },
    "@tauri-apps/api/window": {
      getCurrentWindow: () => ({
        isFullscreen: () => {
          calls.fullscreenReads++;
          return nativeFullscreen;
        },
        startDragging: async () => {
          calls.drags++;
        },
      }),
    },
  };
  const componentImports = new Proxy({}, { get: () => () => null });
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    "window",
    "document",
    "HTMLElement",
    "Node",
    compiled,
  )(
    (name) => mocks[name] ?? componentImports,
    module,
    module.exports,
    win,
    { activeElement: null, body: { style: {}, contains: () => false } },
    class {},
    class {},
  );
  function findBackdrop(tree) {
    if (!tree || typeof tree !== "object") return null;
    if (tree.props?.className?.includes("harbor-search-backdrop")) return tree;
    for (const child of [tree.props?.children].flat()) {
      const found = findBackdrop(child);
      if (found) return found;
    }
    return null;
  }
  let backdrop;
  function render() {
    cursor = 0;
    pending = [];
    const tree = module.exports.SearchOverlay();
    pending.forEach((effect) => effect());
    backdrop = findBackdrop(tree);
  }
  function unmount() {
    for (const effect of effects.values()) effect.cleanup?.();
    effects.clear();
  }
  t.after(unmount);
  render();
  return {
    calls,
    settings,
    render,
    unmount,
    setFullscreen: (value) => {
      fullscreen = value;
      render();
    },
    setNativeFullscreen: (value) => {
      nativeFullscreen = value;
    },
    close: () => {
      search.open = false;
      render();
    },
    down({ button = 0, child = false } = {}) {
      const target = {};
      backdrop.props.onMouseDown({
        button,
        target: child ? {} : target,
        currentTarget: target,
        clientX: 30,
        clientY: 30,
        preventDefault() {},
      });
    },
    move(x, y = 30, buttons = 1) {
      const event = new Event("mousemove");
      Object.assign(event, { clientX: x, clientY: y, buttons });
      win.dispatchEvent(event);
    },
    up(button = 0) {
      const event = new Event("mouseup");
      Object.assign(event, { button });
      win.dispatchEvent(event);
    },
    blur() {
      win.dispatchEvent(new Event("blur"));
    },
    escape() {
      const event = new Event("keydown");
      Object.assign(event, { key: "Escape" });
      win.dispatchEvent(event);
    },
    gestureListeners: () =>
      ["mousemove", "mouseup", "blur"].reduce(
        (count, type) => count + (listeners.get(type)?.size ?? 0),
        0,
      ),
  };
}

test("a backdrop click closes search, while right-clicks and child controls do not", (t) => {
  const h = harness(t);
  h.down({ button: 2 });
  h.up(2);
  h.down({ child: true });
  h.up();
  assert.equal(h.calls.closes, 0);
  h.down();
  h.move(34);
  h.up();
  assert.equal(h.calls.closes, 1);
  assert.equal(h.calls.drags, 0);
  assert.equal(h.gestureListeners(), 0);
});

test("native drag starts once after the threshold and does not dismiss search", async (t) => {
  const h = harness(t);
  h.down();
  h.move(35);
  await flush();
  assert.equal(h.calls.drags, 0);
  h.move(40);
  h.move(50);
  await flush();
  h.up();
  assert.equal(h.calls.drags, 1);
  assert.equal(h.calls.closes, 0);
  assert.equal(h.gestureListeners(), 0);
});

for (const [name, options] of Object.entries({
  disabled: { settings: { dragAnywhere: false } },
  browser: { native: false },
  fullscreen: { fullscreen: true },
})) {
  test(`${name}: moving out and back neither drags nor closes search`, async (t) => {
    const h = harness(t, options);
    h.down();
    h.move(50);
    h.move(30);
    h.up();
    await flush();
    assert.deepEqual(h.calls, { closes: 0, drags: 0, fullscreenReads: 0 });
    assert.equal(h.gestureListeners(), 0);
    h.down();
    h.up();
    assert.equal(h.calls.closes, 1, "ordinary clicks still dismiss");
  });
}

for (const reason of [
  "release",
  "close",
  "unmount",
  "blur",
  "escape",
  "setting",
  "fullscreen",
  "lost-button",
]) {
  test(`a delayed native response cannot drag after ${reason}`, async (t) => {
    const pending = deferred();
    const h = harness(t, { nativeFullscreen: pending.promise });
    h.down();
    h.move(50);
    await flush();
    assert.equal(h.calls.fullscreenReads, 1);
    if (reason === "release") h.up();
    if (reason === "close") h.close();
    if (reason === "unmount") h.unmount();
    if (reason === "blur") h.blur();
    if (reason === "escape") h.escape();
    if (reason === "setting") {
      h.settings.dragAnywhere = false;
      h.render();
    }
    if (reason === "fullscreen") h.setFullscreen(true);
    if (reason === "lost-button") h.move(55, 30, 0);
    pending.resolve(false);
    await flush();
    assert.equal(h.calls.drags, 0);
    assert.equal(h.gestureListeners(), 0);
    assert.equal(h.calls.closes, reason === "escape" ? 1 : 0);
  });
}

test("native fullscreen and failed window queries reject dragging without dismissing", async (t) => {
  for (const outcome of [true, new Error("window unavailable")]) {
    const pending = deferred();
    const h = harness(t, { nativeFullscreen: pending.promise });
    h.down();
    h.move(50);
    await flush();
    if (outcome instanceof Error) pending.reject(outcome);
    else pending.resolve(outcome);
    await flush();
    h.up();
    assert.equal(h.calls.drags, 0);
    assert.equal(h.calls.closes, 0);
    assert.equal(h.gestureListeners(), 0);
  }
});
