import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { LocalEntry } from "../src/lib/local-library.ts";

function load(path: string, mocks: Record<string, unknown>, storage: unknown) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", "localStorage", output)(
    (name: string) => {
      assert.ok(name in mocks, `unexpected import ${name}`);
      return mocks[name];
    }, module, module.exports, storage,
  );
  return module.exports;
}

function entry(path: string, folder = "/movies"): LocalEntry {
  return { id: path, path, filename: path.split("/").pop()!, title: path,
    type: "movie", year: null, folder, addedAt: 1 };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function harness() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  let persisted: LocalEntry[] = [];
  const createLibrary = () => {
    const removals = load("src/lib/local-library/removals.ts", {}, storage);
    const library = load("src/lib/local-library.ts", {
      react: {},
      "@/lib/episode-span": { parseEpisodeSpan: () => null },
      "@/lib/local-library/removals": removals,
      "@/lib/local-library/storage": {
        loadLocalLibraryStore: async () => persisted,
        saveLocalLibraryStore: async (entries: LocalEntry[]) => { persisted = entries; return true; },
      },
    }, storage);
    return { library, removals };
  };
  return { ...createLibrary(), createLibrary, storage };
}

test("removed files stay excluded after new files arrive and after restart", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const removed = entry("/movies/removed.mkv");
  const kept = entry("/movies/kept.mkv");
  const added = entry("/movies/new.mkv");
  h.library.addLocalEntries([removed, kept]);
  h.library.removeLocalEntry(removed.id);
  assert.equal(h.library.addLocalEntries([removed, kept, added]), 2);
  assert.deepEqual(h.library.readLocalLibrary().map((e: LocalEntry) => e.path), [kept.path, added.path]);
  await settle();
  const restarted = h.createLibrary().library;
  await restarted.localLibraryReady();
  restarted.addLocalEntries([removed]);
  assert.deepEqual(restarted.readLocalLibrary().map((e: LocalEntry) => e.path), [kept.path, added.path]);
});

test("explicit import restores only its files and folder removal blocks overlapping scans", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const a = entry("/movies/a.mkv"), b = entry("/elsewhere/b.mkv", "/elsewhere");
  h.library.addLocalEntries([a, b]);
  h.library.removeLocalFolder("/movies");
  h.library.removeLocalEntry(b.id);
  assert.equal(h.library.addLocalEntries([{ ...a, folder: "/" }, b]), 0);
  assert.equal(h.library.addLocalEntries([a], true), 1);
  assert.equal(h.library.addLocalEntries([b]), 0);
  assert.deepEqual(h.library.readLocalLibrary().map((e: LocalEntry) => e.path), [a.path]);
});

test("durable removals hide an old IndexedDB snapshot if shutdown interrupted its write", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const a = entry("/movies/a.mkv");
  h.library.addLocalEntries([a]);
  await settle();
  h.removals.rememberLocalRemovals([a.path]);
  const restarted = h.createLibrary().library;
  await restarted.localLibraryReady();
  assert.deepEqual(restarted.readLocalLibrary(), []);
});

test("Windows aliases match removals without hiding distinct Unix files", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const win = entry("D:\\Movies\\A.mkv"), unix = entry("/movies/A.mkv");
  h.library.addLocalEntries([win, unix]);
  h.library.removeLocalEntry(win.id);
  h.library.removeLocalEntry(unix.id);
  assert.equal(h.library.addLocalEntries([entry("d:/movies/a.mkv")]), 0);
  assert.equal(h.library.addLocalEntries([entry("/movies/a.mkv")]), 1);
});

test("explicit backup restore makes restored entries usable and clear resets exclusions", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const a = entry("/movies/a.mkv");
  h.library.addLocalEntries([a]);
  h.library.removeLocalEntry(a.id);
  assert.equal(h.library.restoreLocalLibrary(JSON.stringify([a])), true);
  assert.equal(h.library.addLocalEntries([a]), 1);
  h.library.removeLocalEntry(a.id);
  h.library.clearLocalLibrary();
  assert.equal(h.library.addLocalEntries([a]), 1);
});

function scanHarness(h: ReturnType<typeof harness>, files: LocalEntry[]) {
  const slots: any[] = [];
  let cursor = 0;
  const matched: string[] = [];
  const toasts: string[] = [];
  let picker: string | null = "/movies";
  const build = async (file: LocalEntry) => { matched.push(file.path); return file; };
  const { useLocalScan } = load("src/views/library/local-tab/use-local-scan.ts", {
    react: {
      useCallback: (fn: unknown) => fn,
      useMemo: (fn: () => unknown) => fn(),
      useEffect: (fn: () => void) => fn(),
      useRef: (initial: unknown) => {
        const i = cursor++;
        return slots[i] ??= { current: initial };
      },
      useState: (initial: unknown) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [slots[i], (value: unknown) => { slots[i] = value; }];
      },
    },
    "@/lib/local-library": h.library,
    "@/lib/local-library/removals": h.removals,
    "@/lib/local-library/sidecars": { clearSidecarCache() {}, countNfoFor: async () => 0 },
    "@/lib/settings": { useSettings: () => ({ settings: {}, update() {} }) },
    "@/lib/i18n": { useT: () => (text: string) => text },
    "./scan": { buildNfoEntry: build, buildTmdbEntry: build },
    "@tauri-apps/api/core": { invoke: async () => files },
    "@tauri-apps/plugin-dialog": { open: async () => picker },
  }, h.storage);
  return {
    matched, toasts,
    cancelPicker: () => { picker = null; },
    render: () => { cursor = 0; return useLocalScan({ items: h.library.readLocalLibrary(), setToast: (text: string) => toasts.push(text) }); },
  };
}

test("refresh and auto-scan skip removed files before metadata fetch; Add folder can restore", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const removed = entry("/movies/removed.mkv"), kept = entry("/movies/kept.mkv"), fresh = entry("/movies/new.mkv");
  h.library.addLocalEntries([removed, kept]);
  h.library.removeLocalEntry(removed.id);
  const scan = scanHarness(h, [removed, kept, fresh]);
  await scan.render().autoScan();
  assert.deepEqual(scan.matched, [fresh.path]);
  await scan.render().rescanFolder("/movies");
  let current = scan.render();
  assert.deepEqual(current.pending.files.map((e: LocalEntry) => e.path), [kept.path, fresh.path]);
  current.onPickMode("tmdb");
  await settle();
  assert.equal(h.library.readLocalLibrary().some((e: LocalEntry) => e.id === removed.id), false);

  await scan.render().onAddFolder();
  current = scan.render();
  assert.equal(current.pending.restoreRemoved, true);
  assert.equal(h.removals.removedLocalPaths().has(removed.path), true, "opening import must not clear removals");
  current.setPending(null);
  await scan.render().autoScan();
  assert.equal(h.removals.removedLocalPaths().has(removed.path), true, "cancel keeps removals");
  await scan.render().onAddFolder();
  scan.render().onPickMode("nfo");
  await settle();
  assert.equal(h.library.readLocalLibrary().some((e: LocalEntry) => e.id === removed.id), true);
});

test("removing an entry while refresh metadata is pending cannot resurrect it", async () => {
  const h = harness();
  await h.library.localLibraryReady();
  const a = entry("/movies/a.mkv"), b = entry("/movies/b.mkv");
  h.library.addLocalEntries([a, b]);
  const scan = scanHarness(h, [a, b]);
  await scan.render().rescanFolder("/movies");
  scan.render().onPickMode("tmdb");
  h.library.removeLocalEntry(a.id);
  await settle();
  assert.deepEqual(h.library.readLocalLibrary().map((e: LocalEntry) => e.path), [b.path]);
});
