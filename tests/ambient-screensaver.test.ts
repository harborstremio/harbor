// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

class FakeEvent {
  defaultPrevented = false;
  propagationStopped = false;

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
  }
}

type Listener = (event?: FakeEvent) => void;

interface IdleModule {
  startIdleScreensaver?: (options: {
    enabled: boolean;
    suppressed: boolean;
    delayMs: number;
    windowTarget: FakeEventTarget;
    documentTarget: FakeEventTarget;
    now: () => number;
    isVisible: () => boolean;
    setInterval: (callback: Listener, delayMs: number) => number;
    clearInterval: (id: number) => void;
    onActiveChange: (active: boolean) => void;
  }) => () => void;
}

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    const event = new FakeEvent();
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeClock {
  nowMs = 0;
  private nextId = 1;
  private readonly timers = new Map<
    number,
    { callback: Listener; intervalMs: number; nextAt: number }
  >();

  setInterval = (callback: Listener, intervalMs: number) => {
    const id = this.nextId++;
    this.timers.set(id, {
      callback,
      intervalMs,
      nextAt: this.nowMs + intervalMs,
    });
    return id;
  };

  clearInterval = (id: number) => {
    this.timers.delete(id);
  };

  advance(ms: number) {
    const target = this.nowMs + ms;
    while (true) {
      const next = [...this.timers.entries()].sort(
        ([, left], [, right]) => left.nextAt - right.nextAt,
      )[0];
      if (!next || next[1].nextAt > target) break;

      const [id, timer] = next;
      this.nowMs = timer.nextAt;
      timer.callback();
      if (this.timers.has(id)) timer.nextAt += timer.intervalMs;
    }
    this.nowMs = target;
  }
}

const idleModule = (await import("../src/lib/screensaver/use-idle-screensaver.ts").catch(
  () => ({}),
)) as IdleModule;

function readSource(path: string) {
  try {
    return readFileSync(new URL(path, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

test("idle screensaver exports its event-driven controller", () => {
  assert.equal(typeof idleModule.startIdleScreensaver, "function");
});

test("activates after the idle delay and dismisses on every activity source", () => {
  const start = idleModule.startIdleScreensaver;
  assert.equal(typeof start, "function");
  if (!start) return;

  for (const eventType of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) {
    const clock = new FakeClock();
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const states: boolean[] = [];
    const stop = start({
      enabled: true,
      suppressed: false,
      delayMs: 5_000,
      windowTarget,
      documentTarget,
      now: () => clock.nowMs,
      isVisible: () => true,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      onActiveChange: (active) => states.push(active),
    });

    clock.advance(5_000);
    assert.equal(states.at(-1), true, `${eventType}: activates`);

    windowTarget.emit(eventType);
    assert.equal(states.at(-1), false, `${eventType}: dismisses`);

    clock.advance(4_999);
    assert.equal(states.at(-1), false, `${eventType}: resets the delay`);
    clock.advance(1);
    assert.equal(states.at(-1), true, `${eventType}: reactivates after a fresh delay`);
    stop();
  }
});

test("the first keyboard event wakes the screensaver without reaching the focused UI", () => {
  const start = idleModule.startIdleScreensaver;
  assert.equal(typeof start, "function");
  if (!start) return;

  const clock = new FakeClock();
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  const states: boolean[] = [];
  const stop = start({
    enabled: true,
    suppressed: false,
    delayMs: 1_000,
    windowTarget,
    documentTarget,
    now: () => clock.nowMs,
    isVisible: () => true,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    onActiveChange: (active) => states.push(active),
  });

  clock.advance(1_000);
  const wakeEvent = windowTarget.emit("keydown");
  assert.equal(states.at(-1), false);
  assert.equal(wakeEvent.defaultPrevented, true);
  assert.equal(wakeEvent.propagationStopped, true);

  const nextEvent = windowTarget.emit("keydown");
  assert.equal(nextEvent.defaultPrevented, false);
  assert.equal(nextEvent.propagationStopped, false);
  stop();
});

test("hidden documents never activate and becoming visible restarts the delay", () => {
  const start = idleModule.startIdleScreensaver;
  assert.equal(typeof start, "function");
  if (!start) return;

  const clock = new FakeClock();
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  const states: boolean[] = [];
  let visible = false;
  const stop = start({
    enabled: true,
    suppressed: false,
    delayMs: 3_000,
    windowTarget,
    documentTarget,
    now: () => clock.nowMs,
    isVisible: () => visible,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    onActiveChange: (active) => states.push(active),
  });

  clock.advance(9_000);
  assert.notEqual(states.at(-1), true);

  visible = true;
  documentTarget.emit("visibilitychange");
  clock.advance(2_999);
  assert.notEqual(states.at(-1), true);
  clock.advance(1);
  assert.equal(states.at(-1), true);
  stop();
});

test("disabled or suppressed screensavers do not install timers or activity listeners", () => {
  const start = idleModule.startIdleScreensaver;
  assert.equal(typeof start, "function");
  if (!start) return;

  for (const options of [
    { enabled: false, suppressed: false },
    { enabled: true, suppressed: true },
  ]) {
    const clock = new FakeClock();
    const windowTarget = new FakeEventTarget();
    const documentTarget = new FakeEventTarget();
    const states: boolean[] = [];
    const stop = start({
      ...options,
      delayMs: 1_000,
      windowTarget,
      documentTarget,
      now: () => clock.nowMs,
      isVisible: () => true,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      onActiveChange: (active) => states.push(active),
    });

    clock.advance(5_000);
    assert.deepEqual(states, [false]);
    assert.equal(windowTarget.listenerCount("pointermove"), 0);
    assert.equal(documentTarget.listenerCount("visibilitychange"), 0);
    stop();
  }
});

test("cleanup removes activity, focus, visibility, and timer effects", () => {
  const start = idleModule.startIdleScreensaver;
  assert.equal(typeof start, "function");
  if (!start) return;

  const clock = new FakeClock();
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  const states: boolean[] = [];
  const stop = start({
    enabled: true,
    suppressed: false,
    delayMs: 1_000,
    windowTarget,
    documentTarget,
    now: () => clock.nowMs,
    isVisible: () => true,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    onActiveChange: (active) => states.push(active),
  });

  stop();
  assert.equal(windowTarget.listenerCount("pointermove"), 0);
  assert.equal(windowTarget.listenerCount("focus"), 0);
  assert.equal(documentTarget.listenerCount("visibilitychange"), 0);

  clock.advance(5_000);
  windowTarget.emit("pointerdown");
  assert.deepEqual(states, []);
});

test("app shell mounts one screensaver root without changing provider order", () => {
  const appSource = readSource("../src/App.tsx");
  assert.equal(appSource.match(/<ScreensaverRoot\s*\/>/g)?.length, 1);

  const settingsProvider = appSource.indexOf("<SettingsProvider>");
  const viewProvider = appSource.indexOf("<ViewProvider>");
  const screensaverRoot = appSource.indexOf("<ScreensaverRoot />");
  assert.ok(settingsProvider >= 0);
  assert.ok(viewProvider > settingsProvider);
  assert.ok(screensaverRoot > viewProvider);
});

test("screensaver root uses main featured feed and exact playback suppression policy", () => {
  const rootSource = readSource("../src/components/screensaver/screensaver-root.tsx");
  assert.match(
    rootSource,
    /!!player\s*\|\|\s*!!picker\s*\|\|\s*topKind === "live"\s*\|\|\s*topKind === "vod"/,
  );
  assert.match(rootSource, /import\("@\/lib\/feed\/featured"\)/);
  assert.match(rootSource, /buildFeaturedFast/);
  assert.doesNotMatch(rootSource, /hero-pool|heroFeed/);
  assert.match(rootSource, /items\.length > 0/);
});

test("ambient overlay honors reduced motion and never renders without a backdrop", () => {
  const rootSource = readSource("../src/components/screensaver/screensaver-root.tsx");
  const overlaySource = readSource("../src/components/screensaver/ambient-overlay.tsx");
  assert.match(rootSource, /prefers-reduced-motion: reduce/);
  assert.match(rootSource, /if \(!mounted \|\| suppressed\) return null/);
  assert.match(overlaySource, /reduce \? undefined/);
});

test("screensaver transitions avoid synchronous state updates inside effects", () => {
  const rootSource = readSource("../src/components/screensaver/screensaver-root.tsx");
  const overlaySource = readSource("../src/components/screensaver/ambient-overlay.tsx");
  assert.doesNotMatch(rootSource, /if \(wantShow\) \{\s*setMounted\(true\)/);
  assert.doesNotMatch(overlaySource, /if \(deepIdle\) setLayers\(\[\]\)/);
});

test("screensaver settings have defaults, controls, and appearance search terms", () => {
  const typesSource = readSource("../src/lib/settings/types.ts");
  const defaultsSource = readSource("../src/lib/settings/defaults.ts");
  const themeSource = readSource("../src/views/settings/theme-panel.tsx");
  const navSource = readSource("../src/views/settings/nav.tsx");

  assert.match(typesSource, /screensaver: boolean/);
  assert.match(typesSource, /screensaverDelayMin: number/);
  assert.match(defaultsSource, /screensaver: false/);
  assert.match(defaultsSource, /screensaverDelayMin: 5/);
  assert.match(themeSource, /settings\.screensaver/);
  assert.match(themeSource, /screensaverDelayMin/);
  assert.match(navSource, /"screensaver"/);
  assert.match(navSource, /"ambient"/);
});
