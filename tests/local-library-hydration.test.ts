import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { LocalEntry } from "../src/lib/local-library.ts";

const KEY = "harbor.library.local.v1";

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

function entry(name: string, folder = "/movies"): LocalEntry {
  return { id: name, path: `${folder}/${name}.mkv`, filename: `${name}.mkv`,
    title: name, type: "movie", year: null, folder, addedAt: 1 };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function harness(initial: LocalEntry[], legacy?: LocalEntry[]) {
  let persisted = structuredClone(initial);
  const values = new Map(legacy ? [[KEY, JSON.stringify(legacy)]] : []);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const writes: LocalEntry[][] = [];
  const createLibrary = () => {
    let release!: () => void;
    const snapshot = structuredClone(persisted);
    const pending = new Promise<LocalEntry[]>((resolve) => { release = () => resolve(snapshot); });
    const removals = load("src/lib/local-library/removals.ts", {}, storage);
    const library = load("src/lib/local-library.ts", {
      react: {},
      "@/lib/episode-span": { parseEpisodeSpan: () => null },
      "@/lib/local-library/removals": removals,
      "@/lib/local-library/storage": {
        loadLocalLibraryStore: () => pending,
        saveLocalLibraryStore: async (entries: LocalEntry[]) => {
          persisted = structuredClone(entries);
          writes.push(persisted);
          return true;
        },
      },
    }, storage);
    return {
      library, removals,
      ready: async () => { release(); await library.localLibraryReady(); await settle(); },
    };
  };
  return { ...createLibrary(), createLibrary, writes, storage };
}

const names = (library: any) => library.readLocalLibrary().map((e: LocalEntry) => e.id).sort();

test("startup imports preserve older folders and never persist the incomplete snapshot", async () => {
  const old = entry("old", "/old-folder"), fresh = entry("fresh", "/new-folder");
  const h = harness([old]);
  assert.equal(h.library.addLocalEntries([fresh]), 1);
  assert.deepEqual(names(h.library), ["fresh"], "keep the import visible while loading");
  await settle();
  assert.equal(h.writes.length, 0, "must not overwrite disk until its snapshot has loaded");
  await h.ready();
  assert.deepEqual(names(h.library), ["fresh", "old"]);
  assert.equal(h.writes.length, 1);
  const restart = h.createLibrary();
  await restart.ready();
  assert.deepEqual(names(restart.library), ["fresh", "old"]);
});

test("a refresh replaces the matching path while preserving other folders", async () => {
  const old = entry("old"), other = entry("other", "/other");
  const h = harness([old, other]);
  h.library.addLocalEntries([{ ...old, title: "New NFO title" }]);
  await h.ready();
  assert.deepEqual(names(h.library), ["old", "other"]);
  assert.equal(h.library.readLocalLibrary().find((e: LocalEntry) => e.id === "old").title, "New NFO title");
});

test("early corrections apply to entries still loading", async () => {
  const h = harness([entry("old"), entry("other")]);
  h.library.updateLocalEntry("old", { title: "Corrected title" });
  await h.ready();
  assert.equal(h.library.readLocalLibrary().find((e: LocalEntry) => e.id === "old").title, "Corrected title");
  assert.equal(h.writes.length, 1);
});

test("early folder removal preserves other folders and blocks overlapping rescans", async () => {
  const old = entry("old"), other = entry("other", "/other");
  const h = harness([old, other]);
  h.library.removeLocalFolder("/movies");
  h.library.addLocalEntries([old]);
  await h.ready();
  assert.deepEqual(names(h.library), ["other"]);
  assert.equal(h.removals.removedLocalPaths().has(old.path), true);
  const restart = h.createLibrary();
  await restart.ready();
  assert.equal(restart.library.addLocalEntries([old]), 0);
});

test("explicit reimport after an early removal restores only the selected file", async () => {
  const old = entry("old"), other = entry("other", "/other");
  const h = harness([old, other]);
  h.library.removeLocalEntry(old.id);
  h.library.addLocalEntries([old], true);
  await h.ready();
  assert.deepEqual(names(h.library), ["old", "other"]);
  assert.equal(h.removals.removedLocalPaths().has(old.path), false);
});

test("clear before the first read replaces both legacy and IndexedDB entries", async () => {
  const h = harness([entry("stored")], [entry("legacy")]);
  h.library.clearLocalLibrary();
  h.library.addLocalEntries([entry("fresh")]);
  await h.ready();
  assert.deepEqual(names(h.library), ["fresh"]);
  const restart = h.createLibrary();
  await restart.ready();
  assert.deepEqual(names(restart.library), ["fresh"]);
});

test("backup restore before the first read is a replacement, followed by later edits", async () => {
  const h = harness([entry("stored")], [entry("legacy")]);
  assert.equal(h.library.restoreLocalLibrary(JSON.stringify([entry("restored")])), true);
  h.library.updateLocalEntry("restored", { title: "Edited restore" });
  h.library.addLocalEntries([entry("fresh")]);
  await h.ready();
  assert.deepEqual(names(h.library), ["fresh", "restored"]);
  assert.equal(h.library.readLocalLibrary().find((e: LocalEntry) => e.id === "restored").title, "Edited restore");
});

test("legacy migration merges early imports and removes legacy only after saving", async () => {
  const h = harness([], [entry("legacy")]);
  h.library.addLocalEntries([entry("fresh")]);
  await settle();
  assert.notEqual(h.storage.getItem(KEY), null);
  assert.equal(h.writes.length, 0);
  await h.ready();
  assert.deepEqual(names(h.library), ["fresh", "legacy"]);
  assert.equal(h.storage.getItem(KEY), null);
});

test("clear and restore retain ordering across earlier mutations and exclusion changes", async () => {
  const h = harness([entry("old")]);
  h.library.removeLocalEntry("old");
  h.library.clearLocalLibrary();
  h.library.addLocalEntries([entry("old")]);
  h.library.restoreLocalLibrary(JSON.stringify([entry("backup")]));
  h.library.removeLocalEntry("backup");
  h.library.addLocalEntries([entry("last")]);
  await h.ready();
  assert.deepEqual(names(h.library), ["last"]);
  assert.equal(h.removals.removedLocalPaths().has(entry("old").path), false);
  assert.equal(h.removals.removedLocalPaths().has(entry("backup").path), true);
});
