import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function deferred() {
  let resolve!: (page: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const counts = { total: 300, movie: 100, series: 120, anime: 60, manga: 20 };
const page = (ids: string[], nextCursor?: string, totals = counts) => ({
  items: ids.map((itemKey) => ({ itemKey, title: itemKey, mediaType: "movie", score: 8, at: "2026-01-01" })),
  nextCursor, counts: totals, avg: 8,
});

function ratingsHarness() {
  const states: any[] = [], refs: any[] = [], memos: any[] = [];
  const effects: Array<{ deps: any[]; cleanup?: () => void }> = [];
  let si = 0, ri = 0, mi = 0, ei = 0, dirty = false, mounted = true, writesAfterUnmount = 0;
  let pending: Array<{ i: number; deps: any[]; run: () => any }> = [];
  const same = (a: any[], b: any[]) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial: any) {
      const i = si++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (value: any) => {
        if (!mounted) writesAfterUnmount++;
        const next = typeof value === "function" ? value(states[i]) : value;
        if (!Object.is(next, states[i])) { states[i] = next; dirty = true; }
      }];
    },
    useRef(initial: any) { return refs[ri++] ?? (refs[ri - 1] = { current: initial }); },
    useCallback(fn: any, deps: any[]) {
      const i = mi++;
      if (!memos[i] || !same(memos[i].deps, deps)) memos[i] = { fn, deps };
      return memos[i].fn;
    },
    useEffect(run: () => any, deps: any[]) {
      const i = ei++;
      if (!effects[i] || !same(effects[i].deps, deps)) pending.push({ i, deps, run });
    },
  };
  const requests: Array<{ handle: string; opts: any; signal?: AbortSignal; job: ReturnType<typeof deferred> }> = [];
  const jsx = (type: any, props: any, key: any) => ({ type, props, key });
  const mocks: Record<string, any> = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-dom": { createPortal: (child: any) => child },
    "lucide-react": { Eye: "eye", Loader2: "loader", X: "x" },
    "@/lib/ratings/poster": {}, "@/components/poster": {}, "@/components/ratings/rating-stars": {},
    "@/views/profile/profile-bits": {}, "@/views/profile/use-profile-title": {},
    "@/lib/i18n": { useT: () => (value: string) => value },
    "@/lib/social/ratings-api": {
      fetchUserRatings(handle: string, opts: any, signal?: AbortSignal) {
        const job = deferred(); requests.push({ handle, opts, signal, job }); return job.promise;
      },
    },
  };
  const source = readFileSync(new URL("../src/views/ratings/user-ratings.tsx", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports: any = {};
  new Function("require", "exports", "window", "document", output)(
    (id: string) => { assert.ok(id in mocks, `unexpected import ${id}`); return mocks[id]; }, exports,
    { addEventListener() {}, removeEventListener() {} }, { body: { style: { overflow: "" } } },
  );
  let props = { handle: "alice", alias: "Alice", onClose() {} }, tree: any;
  function render(patch = {}) {
    props = { ...props, ...patch };
    let loops = 0;
    do {
      assert.ok(++loops < 10, "render should settle");
      dirty = false; si = ri = mi = ei = 0; pending = [];
      tree = exports.UserRatings(props);
      for (const effect of pending) effects[effect.i]?.cleanup?.();
      for (const effect of pending) effects[effect.i] = { deps: effect.deps, cleanup: effect.run() };
    } while (dirty);
  }
  function nodes(value: any): any[] {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap((child) => nodes(child));
    return [value, ...nodes(value.props?.children ?? null)];
  }
  function text(value: any): string {
    if (value == null || typeof value === "boolean") return "";
    if (Array.isArray(value)) return value.map(text).join("");
    return typeof value === "object" ? text(value.props?.children) : String(value);
  }
  function button(label: string) {
    const found = nodes(tree).find((n) => n.type === "button" && text(n.props.children).startsWith(label));
    assert.ok(found, `missing button ${label}`); return found;
  }
  async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); }
  async function resolve(index: number, value: any) { requests[index].job.resolve(value); await settle(); }
  render();
  return {
    requests, render, resolve, settle, button,
    click(label: string) { const result = button(label).props.onClick(); render(); return result; },
    ids: () => nodes(tree).filter((n) => n.props?.r).map((n) => n.props.r.itemKey),
    buttons: () => nodes(tree).filter((n) => n.type === "button").map((n) => text(n.props.children)),
    unmount() { mounted = false; effects.forEach((effect) => effect.cleanup?.()); },
    writesAfterUnmount: () => writesAfterUnmount,
  };
}

test("ratings append every server page without a 240-item client limit", async () => {
  const h = ratingsHarness();
  for (let i = 0; i < 6; i++) {
    await h.resolve(i, page(Array.from({ length: 50 }, (_, n) => `title-${i * 50 + n}`), i < 5 ? `cursor-${i + 1}` : undefined));
    if (i < 5) h.click("Load more");
  }
  assert.equal(h.ids().length, 300);
  assert.equal(new Set(h.ids()).size, 300);
  assert.ok(!h.buttons().includes("Load more"));
  assert.deepEqual(h.requests.map((r) => r.opts.cursor), [undefined, "cursor-1", "cursor-2", "cursor-3", "cursor-4", "cursor-5"]);
});

for (const finishFirst of [false, true]) {
  test(`old pagination cannot contaminate another tab (${finishFirst ? "before" : "after"} its first page)`, async () => {
    const h = ratingsHarness(); await h.resolve(0, page(["all-1"], "all-next"));
    h.click("Load more"); h.click("Movies");
    if (finishFirst) await h.resolve(1, page(["all-2"], "wrong-cursor"));
    await h.resolve(2, page(["movie-1"], "movie-next"));
    if (!finishFirst) await h.resolve(1, page(["all-2"], "wrong-cursor"));
    assert.deepEqual(h.ids(), ["movie-1"]);
    assert.equal(h.requests[1].signal?.aborted, true);
    h.click("Load more");
    assert.deepEqual(h.requests[3].opts, { type: "movie", cursor: "movie-next" });
  });
}

test("new tab pagination proceeds while its cancelled predecessor remains pending", async () => {
  const h = ratingsHarness(); await h.resolve(0, page(["all-1"], "all-next"));
  h.click("Load more"); h.click("Movies"); await h.resolve(2, page(["movie-1"], "movie-next"));
  assert.equal(h.button("Load more").props.disabled, false);
  h.click("Load more");
  await h.resolve(1, page(["old"], "wrong"));
  assert.equal(h.button("Load more").props.disabled, true, "old completion cannot unlock the active request");
  await h.resolve(3, page(["movie-2"]));
  assert.deepEqual(h.ids(), ["movie-1", "movie-2"]);
});

test("repeated activation before a rerender requests the cursor once", async () => {
  const h = ratingsHarness(); await h.resolve(0, page(["one"], "next"));
  const click = h.button("Load more").props.onClick;
  click(); click();
  assert.equal(h.requests.length, 2);
  await h.resolve(1, page(["two"]));
  assert.deepEqual(h.ids(), ["one", "two"]);
});

test("changing profile resets counts and ignores the old profile's next page", async () => {
  const h = ratingsHarness(); await h.resolve(0, page(["alice-all"], "next"));
  h.click("Movies"); await h.resolve(1, page(["alice-movie"], "movie-next")); h.click("Load more");
  h.render({ handle: "bob", alias: "Bob" });
  const bobCounts = { total: 9, movie: 9, series: 0, anime: 0, manga: 0 };
  await h.resolve(3, page(["bob-movie"], undefined, bobCounts));
  await h.resolve(2, page(["alice-old"]));
  assert.deepEqual(h.ids(), ["bob-movie"]);
  assert.ok(h.buttons().includes("All9"));
  assert.ok(h.buttons().includes("Movies9"));
  assert.ok(!h.buttons().some((name) => name.startsWith("TV")));
});

test("closing ratings cancels pagination and prevents late state writes", async () => {
  const h = ratingsHarness(); await h.resolve(0, page(["one"], "next")); h.click("Load more");
  h.unmount(); h.requests[1].job.resolve(page(["two"]));
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(h.requests[1].signal?.aborted, true);
  assert.equal(h.writesAfterUnmount(), 0);
});

test("failed pagination retains its items/cursor and can be retried", async () => {
  const h = ratingsHarness(); await h.resolve(0, page(["one"], "next"));
  const pending = h.click("Load more");
  h.requests[1].job.reject(new Error("fixture offline"));
  await pending; await h.settle();
  assert.deepEqual(h.ids(), ["one"]);
  assert.equal(h.button("Load more").props.disabled, false);
  h.click("Load more");
  assert.deepEqual(h.requests[2].opts, { type: "all", cursor: "next" });
  await h.resolve(2, page(["two"]));
  assert.deepEqual(h.ids(), ["one", "two"]);
});
