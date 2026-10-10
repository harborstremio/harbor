import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleWithMocks(path: string, mocks: Record<string, any>, window: any = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  new Function("require", "exports", "window", output)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`); return mocks[id];
  }, exports, window);
  return exports;
}
function deferred() {
  let resolve!: (value: any) => void, reject!: (error: Error) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const page = (start: number, count: number, nextCursor: string | null = null) => ({
  collections: Array.from({ length: count }, (_, i) => ({ handle: "alice", id: `c${start + i}`, name: `Collection ${start + i}` })), nextCursor,
});

function harness(initialActive = true) {
  const slots: any[] = [], effects: any[] = [], listeners = new Map();
  let index = 0, dirty = false, pending: any[] = [], active = initialActive, value: any, mounted = true, writesAfterUnmount = 0;
  const same = (a: any[], b: any[]) => a?.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const requests: Array<{ cursor: any; signal: AbortSignal; job: ReturnType<typeof deferred> }> = [];
  const react = {
    useState(initial: any) {
      const i = index++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (next: any) => {
        if (!mounted) writesAfterUnmount++;
        slots[i] = typeof next === "function" ? next(slots[i]) : next; dirty = true;
      }];
    },
    useRef(initial: any) { const i = index++; return slots[i] ?? (slots[i] = { current: initial }); },
    useCallback(fn: any, deps: any[]) {
      const i = index++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn;
    },
    useEffect(fn: any, deps: any[]) { const i = index++; if (!effects[i] || !same(effects[i].deps, deps)) pending.push({ i, fn, deps }); },
  };
  const { useCommunityCollections } = moduleWithMocks("../src/views/collections/use-community-collections.ts", {
    react,
    "@/lib/social/collections-sync": {
      COMMUNITY_COLLECTION_PAGE_SIZE: 24, COMMUNITY_COLLECTIONS_EVENT: "changed",
      fetchCommunityCollectionsPage(cursor: any, signal: AbortSignal) {
        const job = deferred(); requests.push({ cursor, signal, job }); return job.promise;
      },
    },
  }, { addEventListener: (key: string, fn: any) => listeners.set(key, fn), removeEventListener: (key: string) => listeners.delete(key) });
  function render(nextActive = active) {
    active = nextActive; let loops = 0;
    do {
      assert.ok(++loops < 10, "render should settle"); index = 0; dirty = false; pending = [];
      value = useCommunityCollections(active);
      for (const effect of pending) effects[effect.i]?.cleanup?.();
      for (const effect of pending) effects[effect.i] = { deps: effect.deps, cleanup: effect.fn() };
    } while (dirty);
  }
  async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); }
  render();
  return {
    requests, render, settle, get value() { return value; },
    resolve: async (i: number, data: any) => { requests[i].job.resolve(data); await settle(); },
    reject: async (i: number) => { requests[i].job.reject(new Error("offline")); await settle(); },
    changed: () => { listeners.get("changed")?.(); render(); },
    unmount: () => { mounted = false; effects.forEach((effect) => effect?.cleanup?.()); },
    writes: () => writesAfterUnmount,
  };
}

test("continues beyond 60 and deduplicates overlapping pages; stops at the end", async () => {
  const h = harness();
  for (let i = 0; i < 5; i++) {
    await h.resolve(i, page(i * 23, 24, i < 4 ? `cursor${i}` : null));
    if (i < 4) { void h.value.loadMore(); h.render(); }
  }
  assert.equal(h.value.collections.length, 116);
  assert.equal(new Set(h.value.collections.map((c: any) => c.id)).size, 116);
  assert.equal(h.value.hasMore, false);
  await h.value.loadMore(); assert.equal(h.requests.length, 5);
});
test("old servers progressively reveal their complete response without re-fetching page one", async () => {
  const h = harness(); await h.resolve(0, page(0, 60));
  assert.equal(h.value.collections.length, 24);
  await h.value.loadMore(); h.render(); assert.equal(h.value.collections.length, 48);
  await h.value.loadMore(); h.render(); assert.equal(h.value.collections.length, 60);
  assert.equal(h.value.hasMore, false); assert.equal(h.requests.length, 1);
});
test("in-flight guards prevent duplicate requests and failed pages preserve earlier cards", async () => {
  const h = harness(); await h.resolve(0, page(0, 24, "next"));
  void h.value.loadMore(); void h.value.loadMore(); h.render(); assert.equal(h.requests.length, 2);
  await h.reject(1); assert.equal(h.value.failed, true); assert.equal(h.value.collections.length, 24);
  void h.value.retry(); h.render(); assert.equal(h.requests[2].cursor, "next");
  await h.resolve(2, page(24, 10)); assert.equal(h.value.collections.length, 34); assert.equal(h.value.failed, false);
});
test("refresh aborts stale pagination and replaces the feed", async () => {
  const h = harness(); await h.resolve(0, page(0, 24, "next"));
  void h.value.loadMore(); h.render(); void h.value.refresh(); h.render();
  assert.equal(h.requests[1].signal.aborted, true);
  await h.resolve(2, page(100, 12)); await h.resolve(1, page(24, 24));
  assert.equal(h.value.collections[0].id, "c100"); assert.equal(h.value.collections.length, 12);
});
test("failed refresh retries page one, without discarding existing cards before success", async () => {
  const h = harness(); await h.resolve(0, page(0, 24, "next"));
  void h.value.refresh(); h.render(); await h.reject(1);
  assert.equal(h.value.collections.length, 24);
  void h.value.retry(); h.render(); assert.equal(h.requests[2].cursor, null);
  await h.resolve(2, page(50, 5)); assert.equal(h.value.collections[0].id, "c50");
});
test("inactive hubs do not fetch, retain loaded pages, and refresh deferred community changes", async () => {
  const h = harness(false); assert.equal(h.requests.length, 0);
  h.render(true); await h.resolve(0, page(0, 24, "next"));
  h.render(false); h.render(true); assert.equal(h.requests.length, 1);
  h.render(false); h.changed(); assert.equal(h.requests.length, 1);
  h.render(true); assert.equal(h.requests.length, 2); assert.equal(h.requests[1].cursor, null);
});
test("hiding or unmounting cancels pending work; late replies cannot update the feed", async () => {
  const h = harness(); h.render(false); assert.equal(h.requests[0].signal.aborted, true);
  await h.resolve(0, page(0, 24)); assert.equal(h.value.collections.length, 0);
  h.render(true); h.unmount(); assert.equal(h.requests[1].signal.aborted, true);
  h.requests[1].job.resolve(page(0, 24)); for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(h.writes(), 0);
});

test("page adapter forwards cursor, abort signal and auth; normalizes artwork and rejects bad envelopes", async () => {
  const requests: any[] = []; let response: any = { collections: [{ handle: "alice", id: "c1", name: "One", coverImage: "/cover.png" }], nextCursor: "next" };
  const api = moduleWithMocks("../src/lib/social/collections-sync.ts", {
    "@tauri-apps/api/core": {},
    "@/lib/safe-fetch": { safeFetch: async (...args: any[]) => { requests.push(args); return { ok: true, json: async () => response }; } },
    "@/lib/theme-auth": { authToken: () => "fixture-token" },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://harbor.site" },
    "@/lib/collections": { absCollectionImage: (path: string) => path ? `https://harbor.site${path}` : undefined },
  });
  const controller = new AbortController();
  const result = await api.fetchCommunityCollectionsPage("previous", controller.signal);
  assert.equal(new URL(requests[0][0]).searchParams.get("limit"), "24");
  assert.equal(new URL(requests[0][0]).searchParams.get("cursor"), "previous");
  assert.equal(requests[0][1].signal, controller.signal);
  assert.equal(requests[0][1].headers.authorization, "Bearer fixture-token");
  assert.equal(result.collections[0].coverImage, "https://harbor.site/cover.png");
  response = { collections: [], nextCursor: "previous" };
  await assert.rejects(api.fetchCommunityCollectionsPage("previous"), /did not advance/);
  response = { error: "unavailable" }; await assert.rejects(api.fetchCommunityCollectionsPage(), /Invalid/);
  response = { collections: [] }; assert.equal((await api.fetchCommunityCollectionsPage()).nextCursor, null);
});
