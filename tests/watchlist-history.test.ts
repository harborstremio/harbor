// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ts from "typescript";
import type { LibraryItem } from "../src/lib/stremio.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path: string, mocks: Record<string, unknown>): any {
  const code = ts.transpileModule(read(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)((id: string) => mocks[id] ?? {}, exports);
  return exports;
}

function item(type = "movie", state: Partial<NonNullable<LibraryItem["state"]>> = {}): LibraryItem {
  return {
    _id: "tt1", type, name: "Fixture title", removed: false, temp: false,
    _ctime: "2026-01-01T00:00:00Z", _mtime: "2026-01-02T00:00:00Z",
    state: { duration: 100_000, timeOffset: 100_000, timesWatched: 1, flaggedWatched: 1,
      lastWatched: "2026-01-02T00:00:00Z", video_id: type === "movie" ? "tt1" : "tt1:2:3", ...state },
  };
}

function fixture(initial: LibraryItem | null) {
  let stored = initial;
  let failedRead = false;
  const writes: LibraryItem[] = [];
  const api = load("src/lib/stremio.ts", {
    "./jl/local-library": {
      readJlLibrary: (scope: string) => {
        assert.equal(scope, "fixture-auth");
        if (failedRead) throw new Error("offline");
        return stored ? [stored] : [];
      },
      putJlLibraryItem: (scope: string, item: LibraryItem) => {
        assert.equal(scope, "fixture-auth");
        stored = item;
        writes.push(item);
      },
    },
    "@/lib/resume": { readResumeEntry: () => null, readResumeSource: () => undefined },
  });
  const history = load("src/views/library/history-merge.ts", {
    "@/lib/stremio": api, "./shared": { parseTs: Date.parse },
  });
  const tab = load("src/views/library/watchlist-tab.tsx", { "@/lib/stremio": api });
  return {
    api, tab, history, writes,
    stored: () => stored!,
    failRead: () => { failedRead = true; },
    removeBookmark: () => api.removeStremioBookmark("fixture-auth", "tt1"),
    removeHistory: () => api.removeStremioLibraryItem("fixture-auth", "tt1"),
  };
}

for (const type of ["movie", "series"]) {
  test(`unbookmarking a watched ${type} preserves its History and playback state`, async () => {
    const initial = item(type);
    const f = fixture(initial);
    await f.removeBookmark();
    const current = f.stored();
    assert.deepEqual(current.state, initial.state);
    assert.equal(current._ctime, initial._ctime);
    assert.equal(f.history.filterHistory([current]).length, 1);
    for (const mode of ["library", "watchlist"]) {
      assert.deepEqual(f.tab.filterLibrary([current], false, mode), []);
      assert.deepEqual(f.tab.filterLibrary([current], true, mode), []);
    }
    const merged = f.history.mergeHistory([current], []);
    assert.equal(merged[0].watched, true);
    assert.equal(merged[0].watchedAt, Date.parse(initial.state!.lastWatched!));
  });
}

test("unbookmarking retains in-progress Continue Watching but not completed movie playback", async () => {
  const f = fixture(item("movie", { timeOffset: 50_000, timesWatched: 0, flaggedWatched: 0 }));
  await f.removeBookmark();
  assert.equal(f.api.isCwMember(f.stored()), true);
  const finished = fixture(item());
  await finished.removeBookmark();
  assert.equal(finished.api.isCwMember(finished.stored()), false);
});

test("unplayed bookmarks do not acquire history or Continue Watching", async () => {
  const f = fixture(item("movie", { timeOffset: 0, timesWatched: 0, flaggedWatched: 0, lastWatched: undefined }));
  await f.removeBookmark();
  assert.equal(f.history.filterHistory([f.stored()]).length, 0);
  assert.equal(f.api.isCwMember(f.stored()), false);
});

test("explicit History removal still hides an unbookmarked watched entry", async () => {
  const f = fixture(item());
  await f.removeBookmark();
  assert.equal(f.history.filterHistory([f.stored()]).length, 1);
  await f.removeHistory();
  assert.equal(f.history.filterHistory([f.stored()]).length, 0);
  assert.equal(f.api.isCwMember(f.stored()), false);
  assert.equal(f.stored().state?.timesWatched, 1);
});

test("repeated bookmark removal cannot resurrect intentionally removed history", async () => {
  const f = fixture({ ...item(), removed: true, temp: false });
  await f.removeBookmark();
  assert.equal(f.writes.length, 0);
  assert.equal(f.history.filterHistory([f.stored()]).length, 0);
});

test("adding the bookmark again retains watched data and restores Library membership", async () => {
  const initial = item();
  const f = fixture(initial);
  await f.removeBookmark();
  await f.api.saveStremioBookmark("fixture-auth", "tt1", { type: "movie", name: "Fixture title" });
  assert.deepEqual(f.stored().state, initial.state);
  assert.equal(f.tab.filterLibrary([f.stored()], true, "library").length, 1);
  assert.equal(f.history.filterHistory([f.stored()]).length, 1);
});

test("failed reads reject for caller recovery and missing titles make no writes", async () => {
  const f = fixture(item());
  f.failRead();
  await assert.rejects(f.removeBookmark(), /offline/);
  assert.equal(f.writes.length, 0);
  const absent = fixture(null);
  await absent.removeBookmark();
  assert.equal(absent.writes.length, 0);
});

test("Library tab removal uses the bookmark operation and preserves History", async () => {
  const f = fixture(item());
  const source = ts.createSourceFile("watchlist-tab.tsx", read("src/views/library/watchlist-tab.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleRemove") {
      callback = `const ${node.getText(source)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(callback);
  const code = ts.transpileModule(callback, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const scope = {
    useCallback: (fn: unknown) => fn, authKey: "fixture-auth", guardSeq: { current: 0 }, pendingRemovals: { current: 0 },
    readLocalEntries: () => [], filmClosure: (ids: string[]) => new Set(ids), evictWatchlistAggregate() {},
    setStremio() {}, setLocalEntries() {}, setTrakt() {}, setRawCount() {}, setRefreshSeq() {},
    stremioIdToTraktTarget: () => ({ ok: false }), simklConnected: () => false,
    removeStremioLibraryItem: f.api.removeStremioLibraryItem, removeStremioBookmark: f.api.removeStremioBookmark,
    removeFromWatchlist() {}, refreshWatchlistAggregates: async () => [],
    settings: {}, mode: "library", stremio: [f.stored()], trakt: [], traktConnected: false,
  };
  const remove = new Function(...Object.keys(scope), `${code}\nreturn handleRemove;`)(...Object.values(scope));
  await remove("tt1");
  assert.equal(f.history.filterHistory([f.stored()]).length, 1);
  assert.equal(f.tab.filterLibrary([f.stored()], true, "library").length, 0);
});
