import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { LocalEntry } from "../src/lib/local-library.ts";
import type { MediaServerConnection } from "../src/lib/media-server/types.ts";

const first = {
  id: "first",
  path: "C:/fixture/first.mkv",
  filename: "first.mkv",
  title: "Fixture",
  type: "movie",
  addedAt: 1,
  year: null,
} as LocalEntry;
const second = { ...first, id: "second", path: "C:/fixture/second.mkv" };
function load(file: string, mocks: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}
function storeHarness() {
  let persisted = [first, second];
  let accepted = true;
  let duringSave: (() => void) | undefined;
  const storage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  const api = load("../src/lib/local-library.ts", {
    react: {},
    "@/lib/episode-span": { parseEpisodeSpan: () => null },
    "@/lib/local-library/storage": {
      loadLocalLibraryStore: async () => persisted,
      saveLocalLibraryStore: async (entries: LocalEntry[]) => {
        const callback = duringSave;
        duringSave = undefined;
        callback?.();
        if (accepted) persisted = entries;
        return accepted;
      },
    },
  }) as typeof import("../src/lib/local-library.ts");
  return {
    api,
    saved: () => persisted,
    reject: () => {
      accepted = false;
    },
    duringSave: (fn: () => void) => {
      duringSave = fn;
    },
  };
}
test("local index removal waits for accepted storage and retains other copies", async () => {
  const h = storeHarness();
  await h.api.localLibraryReady();
  await h.api.removeLocalEntriesAcknowledged([first]);
  assert.deepEqual(
    h.saved().map((e) => e.id),
    ["second"],
  );
  assert.deepEqual(
    h.api.readLocalLibrary().map((e) => e.id),
    ["second"],
  );
});
test("local index failure preserves the visible entry and never uses a false fallback success", async () => {
  const h = storeHarness();
  await h.api.localLibraryReady();
  h.reject();
  await assert.rejects(() => h.api.removeLocalEntriesAcknowledged([first]), /saved/i);
  assert.equal(h.api.readLocalLibrary().length, 2);
});
test("concurrent local index writes do not resurrect an acknowledged removal", async () => {
  const h = storeHarness();
  await h.api.localLibraryReady();
  h.duringSave(() =>
    h.api.addLocalEntries([{ ...second, id: "third", path: "C:/fixture/third.mkv" }]),
  );
  await h.api.removeLocalEntriesAcknowledged([first]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(new Set(h.saved().map((e) => e.id)), new Set(["second", "third"]));
  assert.deepEqual(
    new Set(h.api.readLocalLibrary().map((e) => e.id)),
    new Set(["second", "third"]),
  );
});
test("a changed local path never inherits an older entry's removal permission", async () => {
  const h = storeHarness();
  await h.api.localLibraryReady();
  h.api.updateLocalEntry(first.id, { path: "C:/fixture/replaced.mkv" });
  await assert.rejects(() => h.api.removeLocalEntriesAcknowledged([first]), /changed/i);
  assert.equal(h.api.readLocalLibrary().length, 2);
});

test("local playback resolves the exact indexed copy and rechecks after file inspection", async () => {
  let entries = [first, second];
  let exists = true;
  let afterInspect: (() => void) | undefined;
  const revealed: string[] = [];
  const api = load("../src/lib/local-library/file-actions.ts", {
    "@tauri-apps/api/core": {
      invoke: async (_cmd: string, args: { path: string }) => {
        afterInspect?.();
        return { exists, isFile: exists, canonicalPath: args.path };
      },
    },
    "@tauri-apps/plugin-opener": {
      revealItemInDir: async (path: string) => {
        revealed.push(path);
      },
    },
    "@/lib/local-library": { localLibraryReady: async () => {}, readLocalLibrary: () => entries },
  }) as typeof import("../src/lib/local-library/file-actions.ts");
  assert.equal((await api.existingLocalEntry(second)).path, second.path);
  exists = false;
  await assert.rejects(() => api.revealLocalEntry(second), /missing/i);
  assert.deepEqual(revealed, []);
  exists = true;
  afterInspect = () => {
    entries = [first];
  };
  await assert.rejects(() => api.existingLocalEntry(second), /changed|available/i);
});

test("server copy resolution keeps connection/item/version identity and rejects replaced accounts", async () => {
  const expected = {
    id: "server",
    profileId: "fixture",
    userId: "user",
    origin: "https://fixture.invalid",
    provider: "jellyfin",
    enabled: true,
  } as MediaServerConnection;
  let current = expected;
  let afterRead: (() => void) | undefined;
  const api = load("../src/lib/media-server/context-copy.ts", {
    "./connections": { mediaServerConnections: () => [current] },
    "./index-store": {
      mediaServerItems: async () => {
        afterRead?.();
        return [
          { id: "movie", connectionId: "server", versions: [{ id: "first" }, { id: "second" }] },
        ];
      },
    },
  }) as typeof import("../src/lib/media-server/context-copy.ts");
  assert.equal((await api.resolveServerContextCopy(expected, "movie", "second")).item.id, "movie");
  await assert.rejects(() => api.resolveServerContextCopy(expected, "movie", "gone"), /version/i);
  await assert.rejects(
    () => api.resolveServerContextCopy(expected, "wrong-item", "first"),
    /version/i,
  );
  afterRead = () => {
    current = { ...expected, userId: "changed" };
  };
  await assert.rejects(
    () => api.resolveServerContextCopy(expected, "movie", "first"),
    /connection/i,
  );
});
