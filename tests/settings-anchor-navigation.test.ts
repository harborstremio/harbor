import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture() {
  let now = 0;
  let nextId = 0;
  const jobs = new Map<number, { at: number; run: () => void }>();
  const schedule = (run: () => void, delay: number) => {
    const id = ++nextId;
    jobs.set(id, { at: now + delay, run });
    return id;
  };
  let cleanup: (() => void) | undefined;
  let reduced = false;
  const mockWindow = {
    setTimeout: schedule,
    clearTimeout: (id: number) => jobs.delete(id),
    matchMedia: () => ({ matches: reduced }),
  };
  const source = readFileSync(new URL("../src/views/settings/anchor-navigation.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", "window", "performance", "requestAnimationFrame", "cancelAnimationFrame", compiled)(
    () => ({ useEffect: (effect: () => (() => void) | undefined) => { cleanup = effect(); } }),
    exports, mockWindow, { now: () => now },
    (fn: (at: number) => void) => schedule(() => fn(now), 16), mockWindow.clearTimeout,
  );
  const candidates: any[] = [];
  const scrollRef = { current: { querySelectorAll: () => candidates } };
  const changes: string[] = [];
  const tabsRef = { current: {
    section: "player", value: "general", tabs: [{ id: "general" }, { id: "quality" }],
    onChange: (id: string) => { changes.push(id); tabsRef.current.value = id; },
  } };
  let completed = 0;
  function element(id: string, visible = true) {
    const calls: any[] = [];
    const el = { id, calls, getClientRects: () => visible ? [{}] : [], offsetWidth: 300,
      scrollIntoView: (opts: unknown) => calls.push(opts), classList: { add() {}, remove() {} } };
    candidates.push(el);
    return el;
  }
  function advance(ms: number) {
    const until = now + ms;
    for (;;) {
      const first = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first || first[1].at > until) break;
      jobs.delete(first[0]); now = first[1].at; first[1].run();
    }
    now = until;
  }
  return {
    element, advance, candidates, changes, tabsRef, exports,
    start: (anchor: string, tab?: string) => exports.useSettingsAnchor(scrollRef, tabsRef, { anchor, tab }, "player", () => completed++),
    cleanup: () => cleanup?.(), setReduced: () => { reduced = true; },
    get completed() { return completed; },
  };
}

test("waits for the requested tab before matching a shared anchor", () => {
  const h = fixture();
  const old = h.element("set-output");
  h.start("set-output", "quality"); h.advance(100);
  assert.equal(old.calls.length, 0);
  h.candidates.length = 0;
  const destination = h.element("set-output");
  h.tabsRef.current.value = "quality"; h.advance(100);
  assert.equal(destination.calls.length, 1);
  assert.equal(h.completed, 1);
});

test("only visible exact anchors in this settings root are eligible", () => {
  const h = fixture();
  const prefix = h.element("set-output-colors");
  const hidden = h.element("set-output", false);
  const target = h.element("set-output");
  h.start("set-output", "general"); h.advance(100);
  assert.equal(prefix.calls.length, 0);
  assert.equal(hidden.calls.length, 0);
  assert.equal(target.calls.length, 1);
});

test("a missing explicit destination times out without selecting unrelated tabs", () => {
  const h = fixture();
  const prefix = h.element("set-output-colors");
  h.start("set-output", "general"); h.advance(2000);
  assert.equal(prefix.calls.length, 0);
  assert.deepEqual(h.changes, []);
  assert.equal(h.completed, 1);
});

test("legacy entries without a tab can still locate an exact anchor in another tab", () => {
  const h = fixture();
  h.start("set-output"); h.advance(60);
  assert.deepEqual(h.changes, ["quality"]);
  const target = h.element("set-output"); h.advance(100);
  assert.equal(target.calls.length, 1);
});

test("leaving or replacing a pending search cancels its delayed jump", () => {
  const h = fixture();
  const target = h.element("set-output");
  h.start("set-output", "general"); h.cleanup(); h.advance(2000);
  assert.equal(target.calls.length, 0);
  assert.equal(h.completed, 0);
});

test("a new search can cancel a prior glide so it cannot overwrite the destination", () => {
  const h = fixture();
  const el = { scrollTop: 700 };
  const cancel = h.exports.glideSettingsToTop(el);
  h.advance(64);
  assert.ok(el.scrollTop < 700);
  cancel(); el.scrollTop = 420; h.advance(600);
  assert.equal(el.scrollTop, 420);
});

test("reduced motion uses instant search scrolling and no glide frames", () => {
  const h = fixture(); h.setReduced();
  const target = h.element("set-output");
  h.start("set-output", "general"); h.advance(100);
  assert.equal(target.calls[0].behavior, "instant");
  const el = { scrollTop: 700, scrollTo({ top }: { top: number }) { this.scrollTop = top; } };
  h.exports.glideSettingsToTop(el); h.advance(600);
  assert.equal(el.scrollTop, 0);
});
