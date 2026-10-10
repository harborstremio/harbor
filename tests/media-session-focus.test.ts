import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type Session = typeof import("../src/lib/media-session");
type Call = { command: string; args?: Record<string, unknown> };
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(options: {
  focused?: boolean;
  windows?: boolean;
  native?: boolean;
  focusQuery?: Promise<boolean>;
  registration?: Promise<void>;
  invoke?: (call: Call) => Promise<unknown>;
} = {}) {
  const calls: Call[] = [];
  const events = new Set<(event: { payload: { focused: boolean; minimized: boolean } }) => void>();
  let locked = false;
  let now = 1000;
  const mocks: Record<string, unknown> = {
    "@tauri-apps/api/core": { invoke: (command: string, args?: Record<string, unknown>) => {
      const call = { command, args };
      calls.push(call);
      return options.invoke?.(call) ?? Promise.resolve();
    } },
    "@tauri-apps/api/event": { listen: async (_name: string, handler: (event: any) => void) => {
      await options.registration;
      events.add(handler);
      return () => events.delete(handler);
    } },
    "@tauri-apps/api/window": { getCurrentWindow: () => ({
      isFocused: () => options.focusQuery ?? Promise.resolve(options.focused ?? true),
    }) },
    "@/lib/platform": { isWindowsDesktop: () => options.windows ?? true },
    "@/lib/player/interaction-lock": { isPlayerInteractionLocked: () => locked },
  };
  const source = readFileSync(new URL("../src/lib/media-session.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {} as Session;
  new Function("require", "exports", "window", "document", "Date", compiled)(
    (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, exports,
    options.native === false ? {} : { __TAURI_INTERNALS__: {} },
    { hasFocus: () => options.focused ?? true }, { now: () => now },
  );
  return {
    ...exports, calls,
    focus: (focused: boolean, minimized = false) => {
      for (const handler of events) handler({ payload: { focused, minimized } });
    },
    advance: (ms = 1000) => { now += ms; },
    lock: (value: boolean) => { locked = value; },
    listeners: () => events.size,
  };
}

test("paused Windows sessions withdraw on blur and restore the latest track/seek on focus", async () => {
  const h = fixture();
  h.startMediaSessionWindowTracking();
  await settle();
  h.updateMediaControls(false, "Video", "Episode", null, 180, 12, .6);
  await settle();
  h.focus(false);
  h.focus(false);
  h.updateMediaControls(false, "Music", "Artist", null, 200, 20, .7);
  h.notifyMediaSeeked(35);
  await settle();
  assert.deepEqual(h.calls.map(call => call.command), ["media_controls_update", "media_controls_clear"]);
  assert.equal(h.mediaKeyGate(), false, "a queued OS play event cannot resume withdrawn media");
  h.focus(true);
  await settle();
  assert.equal(h.calls.at(-1)?.args?.title, "Music");
  assert.equal(h.calls.at(-1)?.args?.positionSec, 35);
  assert.equal(h.mediaKeyGate(), true);
});

test("playing in the background retains media keys, pausing/minimizing yields them", async () => {
  const h = fixture();
  h.startMediaSessionWindowTracking();
  await settle();
  h.updateMediaControls(true, "Track", "Artist", null, 180, 12);
  h.focus(false, true);
  await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.mediaKeyGate(), true);
  h.advance();
  h.updateMediaControls(false, "Track", "Artist", null, 180, 13);
  await settle();
  assert.equal(h.calls.at(-1)?.command, "media_controls_clear");
  assert.equal(h.mediaKeyGate(), false);
  h.updateMediaControls(true, "Track", "Artist", null, 180, 13);
  await settle();
  assert.equal(h.calls.at(-1)?.args?.playing, true, "explicit playback can reclaim keys in background");
  assert.equal(h.mediaKeyGate(), true);
  h.advance();
  h.lock(true);
  assert.equal(h.mediaKeyGate(), false, "the existing player lock still applies");
});

test("the first paused track loaded while unfocused is remembered without registering it", async () => {
  const h = fixture({ focused: false });
  h.startMediaSessionWindowTracking();
  await settle();
  h.updateMediaControls(false, "Restored session", "", null, 90, 25);
  await settle();
  assert.equal(h.calls.length, 0);
  h.focus(true);
  await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].args?.title, "Restored session");
});

test("closing a withdrawn session prevents focus from resurrecting it", async () => {
  const h = fixture();
  h.startMediaSessionWindowTracking();
  await settle();
  h.updateMediaControls(false, "Old session", "");
  h.focus(false);
  h.clearMediaControls();
  h.focus(true);
  await settle();
  assert.deepEqual(h.calls.map(call => call.command), ["media_controls_update", "media_controls_clear"]);
});

test("clear waits for an in-flight update and a rejected command does not block future updates", async () => {
  const first = deferred<void>();
  let count = 0;
  const h = fixture({ invoke: () => ++count === 1 ? first.promise : Promise.resolve() });
  h.startMediaSessionWindowTracking();
  await settle();
  h.updateMediaControls(false, "Old", "");
  await settle();
  h.focus(false);
  await settle();
  assert.equal(h.calls.length, 1);
  first.reject(new Error("Native update failed"));
  await settle();
  assert.equal(h.calls[1].command, "media_controls_clear");
  h.focus(true);
  await settle();
  assert.equal(h.calls[2].command, "media_controls_update");
});

test("initial native focus query cannot overwrite a newer blur event", async () => {
  const query = deferred<boolean>();
  const h = fixture({ focusQuery: query.promise });
  h.startMediaSessionWindowTracking();
  await settle();
  h.updateMediaControls(false, "Paused", "");
  h.focus(false);
  query.resolve(true);
  await settle();
  assert.equal(h.mediaKeyGate(), false);
  assert.equal(h.calls.at(-1)?.command, "media_controls_clear");
});

test("tracking cleans up both registered and late-registering native listeners", async () => {
  const registration = deferred<void>();
  const h = fixture({ registration: registration.promise });
  const stop = h.startMediaSessionWindowTracking();
  stop();
  registration.resolve();
  await settle();
  assert.equal(h.listeners(), 0);
  const stopAgain = h.startMediaSessionWindowTracking();
  await settle();
  assert.equal(h.listeners(), 1);
  stopAgain();
  assert.equal(h.listeners(), 0);
});

test("Linux/macOS paused session behavior and web controls remain unchanged", async () => {
  const h = fixture({ windows: false, focused: false });
  h.startMediaSessionWindowTracking();
  h.updateMediaControls(false, "Track", "");
  await settle();
  assert.equal(h.listeners(), 0);
  assert.equal(h.calls[0].command, "media_controls_update");
  assert.equal(h.mediaKeyGate(), true);
  const web = fixture({ native: false, focused: false });
  web.updateMediaControls(false, "Track", "");
  await settle();
  assert.equal(web.calls.length, 0);
  assert.equal(web.mediaKeyGate(), true);
});

test("metadata/clock deduplication and media-key debounce survive focus handling", async () => {
  const h = fixture();
  h.updateMediaControls(true, "Track", "", null, 180, 10);
  h.advance();
  h.updateMediaControls(true, "Track", "", null, 180, 11);
  await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.mediaKeyGate(), true);
  assert.equal(h.mediaKeyGate(), false);
  h.advance();
  h.updateMediaControls(true, "Track", "", null, 180, 50);
  await settle();
  assert.equal(h.calls.length, 2, "a seek still updates the native position");
});

test("terminal video snapshots clear the session and late clock ticks cannot reopen it", () => {
  const source = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("player.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") {
      const callback = node.arguments[0];
      if (ts.isArrowFunction(callback) && callback.body.getText(tree).includes("updateMediaControls(")) effect = callback;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(effect);
  const output = ts.transpileModule(`exports.run = ${effect.getText(tree)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const status of ["idle", "ended", "error", "paused", "playing"]) {
    const snap = { status, firstFrameReady: true, positionSec: 20, volume: .8, durationSec: 100 };
    const updates: unknown[][] = [];
    let clears = 0;
    let tick: (() => void) | undefined;
    const scope = {
      snap, snapRef: { current: snap }, src: { meta: { name: "Film" } },
      clearMediaControls: () => { clears++; },
      updateMediaControls: (...args: unknown[]) => updates.push(args),
      getPlaybackPosition: () => 20,
      subscribePlaybackClock: (callback: () => void) => { tick = callback; return () => {}; },
    };
    const exports = {} as { run: () => void };
    new Function(...Object.keys(scope), "exports", output)(...Object.values(scope), exports);
    exports.run();
    if (["idle", "ended", "error"].includes(status)) {
      assert.equal(clears, 1);
      assert.equal(updates.length, 0);
      assert.equal(tick, undefined);
    } else {
      assert.equal(updates.length, 1);
      snap.status = "ended";
      tick?.();
      assert.equal(clears, 1);
      assert.equal(updates.length, 1);
    }
  }
});
