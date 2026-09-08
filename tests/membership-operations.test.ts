// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { registerHooks } from "node:module";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";

// Supply Vite's environment only at the configuration boundary when running in Node.
const endpointsUrl = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const environmentHook = registerHooks({
  load(url, context, nextLoad) {
    return url === endpointsUrl
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : nextLoad(url, context);
  },
});

class MemoryStorage {
  values = new Map<string, string>();
  writes: string[] = [];
  removals: string[] = [];
  failure: Error | null = null;
  readFailure = false;

  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    if (this.readFailure) throw new Error("Storage unavailable");
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes.push(key);
    if (this.failure) throw this.failure;
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.removals.push(key);
    this.values.delete(key);
  }
}

let storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
const collections = await import("../src/lib/collections.ts");
const lists = await import("../src/lib/custom-lists.ts");
const defaultList = await import("../src/lib/local-watchlist.tsx");
const { captureMembershipProfile } = await import("../src/lib/membership-operations.ts");
environmentHook.deregister();
const profile = { activeId: "profile-a", settingsLinked: false };
const profilesKey = "harbor.profiles.v1";
const profiles = {
  activeId: "profile-a",
  profiles: [
    { id: "profile-a", settingsLinked: false },
    { id: "profile-b", settingsLinked: false },
  ],
};

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  storage.values.set(profilesKey, JSON.stringify(profiles));
});

const item = { id: "tt1", type: "movie" as const, name: "One", poster: "one.jpg" };
const savedItem = {
  ...item,
  addedAt: 123,
  addonOrigin: { id: "addon.one", name: "Addon One", logo: "addon.jpg" },
  videos: [{ id: "episode-one", title: "First episode", season: 1, episode: 1 }],
  futureMetadata: { label: "keep me" },
};
const otherItem = { id: "tt2", type: "series" as const, name: "Two", addedAt: 456 };

test("collection Add and display reads preserve safe addon identity and episode metadata", () => {
  storage.values.set(
    "harbor.collections.profile-a",
    JSON.stringify([{ id: "destination", name: "Destination", items: [] }]),
  );
  const result = collections.addToCollection("destination", savedItem, profile);
  assert.equal(result.status, "added");
  const read = collections.readCollections()[0].items[0];
  assert.deepEqual(read.addonOrigin, savedItem.addonOrigin);
  assert.deepEqual(read.videos, savedItem.videos);
});

function container(id: string, items: object[]) {
  return {
    id,
    name: id,
    description: `${id} description`,
    items,
    createdAt: 10,
    updatedAt: 20,
    order: id === "source" ? 4 : 2,
    coverImage: "/themes/api/images/cover.jpg",
    bgImage: "background.jpg",
    bgMode: "custom",
    shared: true,
    numbered: true,
    sourceHandle: "original-author",
    sourceId: "original-id",
    tags: ["One", "Two"],
    futureContainerMetadata: { preserve: true },
  };
}

const stores = [
  {
    name: "collection",
    key: "harbor.collections.profile-a",
    baseKey: "harbor.collections.v1",
    otherKey: "harbor.collections.profile-b",
    maxItems: collections.MAX_COLLECTION_ITEMS,
    add: collections.addToCollection,
    create: collections.createCollection,
    remove: (request: object) => {
      assert.equal(typeof collections.removeCollectionMembership, "function", "Remove API exists");
      return collections.removeCollectionMembership(request);
    },
    move: (request: object) => {
      assert.equal(typeof collections.moveBetweenCollections, "function", "Move API exists");
      return collections.moveBetweenCollections(request);
    },
    subscribe: collections.subscribeCollections,
    read: collections.readCollections,
  },
  {
    name: "custom list",
    key: "harbor.customlists.profile-a",
    baseKey: "harbor.customlists.v1",
    otherKey: "harbor.customlists.profile-b",
    maxItems: lists.MAX_ITEMS,
    add: lists.addToList,
    create: lists.createList,
    remove: (request: object) => {
      assert.equal(typeof lists.removeListMembership, "function", "Remove API exists");
      return lists.removeListMembership(request);
    },
    move: (request: object) => {
      assert.equal(typeof lists.moveBetweenLists, "function", "Move API exists");
      return lists.moveBetweenLists(request);
    },
    subscribe: lists.subscribeLists,
    read: lists.readLists,
  },
];

test("context list creation persists the initial item in one write and preserves existing metadata", () => {
  const key = "harbor.customlists.profile-a";
  storage.values.set(key, JSON.stringify([container("existing", [savedItem])]));
  const created = lists.createListWithItem("New list", item, profile);
  assert.equal(created.result.status, "added");
  assert.equal(typeof created.id, "string");
  const after = JSON.parse(storage.values.get(key)!);
  assert.deepEqual(after[0], container("existing", [savedItem]));
  assert.equal(after[1].id, created.id);
  assert.equal(after[1].items[0].id, "tt1");
  assert.deepEqual(storage.writes, [key]);
});

test("failed context list creation preserves existing lists and returns no new list ID", () => {
  const key = "harbor.customlists.profile-a";
  const before = JSON.stringify([container("existing", [savedItem])]);
  storage.values.set(key, before);
  storage.failure = new DOMException("Full", "QuotaExceededError");
  assert.deepEqual(lists.createListWithItem("New list", item, profile), {
    result: { status: "error", reason: "storage-failed" },
  });
  assert.equal(storage.values.get(key), before);
  assert.deepEqual(storage.removals, []);
});

test("saving a community collection reports persistence failure without deleting existing collections", () => {
  const key = "harbor.collections.profile-a";
  const before = JSON.stringify([container("existing", [savedItem])]);
  storage.values.set(key, before);
  storage.failure = new DOMException("Full", "QuotaExceededError");
  assert.equal(
    typeof collections.saveCommunityCollectionWithResult,
    "function",
    "Safe save API exists",
  );
  const saved = collections.saveCommunityCollectionWithResult(
    { handle: "author", id: "public", name: "Public", items: [item] },
    profile,
  );
  assert.deepEqual(saved, { result: { status: "error", reason: "storage-failed" } });
  assert.equal(storage.values.get(key), before);
  assert.deepEqual(storage.removals, []);
});

test("saving a community collection is acknowledged, idempotent at capacity, and retains original provenance", () => {
  const key = "harbor.collections.profile-a";
  storage.values.set(key, "[]");
  assert.equal(
    typeof collections.saveCommunityCollectionWithResult,
    "function",
    "Safe save API exists",
  );
  const source = {
    handle: "author",
    id: "public",
    name: "Public",
    numbered: true,
    items: [savedItem],
  };
  const saved = collections.saveCommunityCollectionWithResult(source, profile);
  assert.equal(saved.result.status, "added");
  const stored = JSON.parse(storage.values.get(key)!);
  assert.equal(stored[0].sourceHandle, "author");
  assert.equal(stored[0].sourceId, "public");
  assert.equal(stored[0].numbered, true);
  assert.deepEqual(stored[0].items, [savedItem]);
  assert.equal(stored[0].shared, undefined);
  while (stored.length < collections.MAX_COLLECTIONS)
    stored.push(container(`extra${stored.length}`, []));
  storage.values.set(key, JSON.stringify(stored));
  const duplicate = collections.saveCommunityCollectionWithResult(source, profile);
  assert.equal(duplicate.id, saved.id);
  assert.equal(duplicate.result.status, "already-present");
  assert.deepEqual(
    collections.saveCommunityCollectionWithResult({ ...source, id: "different" }, profile),
    {
      result: { status: "error", reason: "destination-full" },
    },
  );
});

for (const store of stores) {
  const seed = (containers: object[]) => storage.values.set(store.key, JSON.stringify(containers));
  const snapshot = () => JSON.parse(storage.values.get(store.key)!);
  const move = (sourceId = "source", destinationId = "destination", itemId = item.id) =>
    store.move({ sourceId, destinationId, itemId, profile });

  test(`${store.name}: Add reports a persisted addition and is idempotent`, () => {
    seed([container("destination", [otherItem])]);
    const first = store.add("destination", item, profile);
    assert.deepEqual(first, { status: "added" });
    const afterAdd = storage.values.get(store.key);
    assert.deepEqual(
      snapshot()[0].items.map((entry: { id: string }) => entry.id),
      ["tt2", "tt1"],
    );
    assert.deepEqual(store.add("destination", { ...item, name: "Replacement" }, profile), {
      status: "already-present",
    });
    assert.equal(storage.values.get(store.key), afterAdd);
    assert.deepEqual(storage.writes, [store.key]);
  });

  test(`${store.name}: Add recognizes duplicates before checking capacity`, () => {
    const fullItems = Array.from({ length: store.maxItems }, (_, i) => ({ ...item, id: `tt${i}` }));
    seed([container("destination", fullItems)]);
    assert.deepEqual(store.add("destination", item, profile), { status: "already-present" });
    assert.deepEqual(store.add("destination", { ...item, id: "another" }, profile), {
      status: "error",
      reason: "destination-full",
    });
    assert.equal(storage.writes.length, 0);
  });

  test(`${store.name}: Add rejects malformed item input without throwing or writing`, () => {
    seed([container("destination", [])]);
    for (const invalid of [
      null,
      { id: 42 },
      { id: "" },
      { ...item, name: 42 },
      { ...item, type: false },
    ]) {
      assert.deepEqual(store.add("destination", invalid, profile), {
        status: "error",
        reason: "invalid-data",
      });
    }
    assert.equal(storage.writes.length, 0);
  });

  test(`${store.name}: existing two-argument Add calls use the current profile`, () => {
    seed([container("destination", [])]);
    assert.deepEqual(store.add("destination", item), { status: "added" });
    assert.deepEqual(storage.writes, [store.key]);
  });

  test(`${store.name}: Move preserves complete metadata, order, and unrelated containers`, () => {
    const before = [
      container("unrelated", [otherItem]),
      container("source", [otherItem, savedItem, { ...otherItem, id: "tt3" }]),
      container("destination", [{ ...otherItem, id: "tt4" }]),
    ];
    seed(before);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    try {
      assert.deepEqual(move(), { status: "moved" });
      const after = snapshot();
      assert.deepEqual(after[0], before[0]);
      assert.deepEqual(after[1], {
        ...before[1],
        items: [otherItem, { ...otherItem, id: "tt3" }],
        updatedAt: after[1].updatedAt,
      });
      assert.deepEqual(after[2], {
        ...before[2],
        items: [{ ...otherItem, id: "tt4" }, savedItem],
        updatedAt: after[2].updatedAt,
      });
      assert.ok(after[1].updatedAt > 20);
      assert.equal(after[1].updatedAt, after[2].updatedAt);
      assert.deepEqual(storage.writes, [store.key]);
      assert.equal(notifications, 1);
    } finally {
      unsubscribe();
    }
  });

  test(`${store.name}: Move into a full destination containing the item removes only source membership`, () => {
    const fullItems = Array.from({ length: store.maxItems }, (_, i) => ({ ...item, id: `tt${i}` }));
    seed([container("source", [savedItem]), container("destination", fullItems)]);
    const beforeDestination = snapshot()[1];
    assert.deepEqual(move(), { status: "moved" });
    assert.deepEqual(snapshot()[0].items, []);
    assert.deepEqual(snapshot()[1], beforeDestination);
  });

  test(`${store.name}: Move rejects full destinations without modifying the source`, () => {
    const fullItems = Array.from({ length: store.maxItems }, (_, i) => ({
      ...item,
      id: `other${i}`,
    }));
    seed([container("source", [savedItem]), container("destination", fullItems)]);
    const before = storage.values.get(store.key);
    assert.deepEqual(move(), { status: "error", reason: "destination-full" });
    assert.equal(storage.values.get(store.key), before);
    assert.equal(storage.writes.length, 0);
  });

  test(`${store.name}: Move to the same container is a validated no-op`, () => {
    seed([container("source", [savedItem])]);
    const before = storage.values.get(store.key);
    assert.deepEqual(move("source", "source"), { status: "unchanged" });
    assert.equal(storage.values.get(store.key), before);
    assert.equal(storage.writes.length, 0);
    assert.deepEqual(move("source", "source", "missing"), {
      status: "error",
      reason: "missing-item",
    });
  });

  test(`${store.name}: Move revalidates source, destination, and item from storage`, () => {
    seed([container("source", [savedItem]), container("destination", [])]);
    assert.deepEqual(move("deleted"), { status: "error", reason: "missing-source" });
    assert.deepEqual(move("source", "deleted"), {
      status: "error",
      reason: "missing-destination",
    });
    assert.deepEqual(move("source", "destination", "removed"), {
      status: "error",
      reason: "missing-item",
    });
    assert.equal(storage.writes.length, 0);
  });

  test(`${store.name}: membership writes reject stale profile and linkage contexts`, () => {
    seed([container("source", [savedItem]), container("destination", [])]);
    storage.values.set(store.otherKey, JSON.stringify([container("source", [savedItem])]));
    const before = new Map(storage.values);
    storage.values.set(profilesKey, JSON.stringify({ ...profiles, activeId: "profile-b" }));
    assert.deepEqual(move(), { status: "error", reason: "profile-changed" });
    assert.deepEqual(store.add("destination", item, profile), {
      status: "error",
      reason: "profile-changed",
    });
    storage.values.set(
      profilesKey,
      JSON.stringify({
        activeId: "profile-a",
        profiles: [{ id: "profile-a", settingsLinked: true }],
      }),
    );
    assert.deepEqual(move(), { status: "error", reason: "profile-changed" });
    assert.equal(storage.values.get(store.key), before.get(store.key));
    assert.equal(storage.values.get(store.otherKey), before.get(store.otherKey));
    assert.equal(storage.writes.length, 0);
  });

  test(`${store.name}: profile-local first write uses the inherited snapshot without changing shared data`, () => {
    const inherited = JSON.stringify([
      container("source", [savedItem]),
      container("destination", []),
    ]);
    storage.values.set(store.baseKey, inherited);
    assert.deepEqual(move(), { status: "moved" });
    assert.equal(storage.values.get(store.baseKey), inherited);
    assert.deepEqual(snapshot()[1].items, [savedItem]);
    assert.deepEqual(storage.writes, [store.key]);
  });

  for (const failure of [
    new DOMException("Full", "QuotaExceededError"),
    new DOMException("Unavailable", "SecurityError"),
  ]) {
    test(`${store.name}: ${failure.name} preserves persisted membership without recovery or notification`, () => {
      seed([container("source", [savedItem]), container("destination", [])]);
      const before = storage.values.get(store.key);
      let notifications = 0;
      const unsubscribe = store.subscribe(() => notifications++);
      storage.failure = failure;
      try {
        assert.deepEqual(move(), { status: "error", reason: "storage-failed" });
        assert.equal(storage.values.get(store.key), before);
        assert.deepEqual(storage.writes, [store.key]);
        assert.deepEqual(storage.removals, []);
        assert.equal(notifications, 0);
        assert.equal(store.read().find((entry) => entry.id === "source")?.items[0]?.id, "tt1");
        assert.deepEqual(store.add("destination", item, profile), {
          status: "error",
          reason: "storage-failed",
        });
        assert.equal(storage.values.get(store.key), before);
        assert.deepEqual(storage.removals, []);
        assert.equal(notifications, 0);
      } finally {
        unsubscribe();
      }
    });
  }

  for (const malformed of [
    "not-json",
    JSON.stringify({}),
    JSON.stringify([
      container("source", [savedItem]),
      { id: "destination", name: "Broken", items: null },
    ]),
    JSON.stringify([container("source", [savedItem, savedItem]), container("destination", [])]),
    JSON.stringify([
      container("source", [savedItem]),
      container("source", []),
      container("destination", []),
    ]),
  ]) {
    test(`${store.name}: malformed or ambiguous stored memberships are never overwritten: ${malformed.slice(0, 24)}`, () => {
      storage.values.set(store.key, malformed);
      assert.deepEqual(move(), { status: "error", reason: "invalid-data" });
      assert.equal(storage.values.get(store.key), malformed);
      assert.equal(storage.writes.length, 0);
    });
  }

  test(`${store.name}: unavailable storage returns an explicit failure`, () => {
    storage.readFailure = true;
    assert.deepEqual(move(), { status: "error", reason: "storage-failed" });
    assert.equal(storage.writes.length, 0);
  });

  test(`${store.name}: explicit Remove commits only the named source membership`, () => {
    seed([container("source", [savedItem, otherItem]), container("destination", [savedItem])]);
    const before = snapshot();
    assert.deepEqual(store.remove({ sourceId: "source", itemId: item.id, profile }), {
      status: "removed",
    });
    const after = snapshot();
    assert.deepEqual(after[0], { ...before[0], items: [otherItem], updatedAt: after[0].updatedAt });
    assert.deepEqual(after[1], before[1]);
    assert.deepEqual(storage.writes, [store.key]);
  });

  test(`${store.name}: explicit Remove rejects failed persistence and stale profiles`, () => {
    seed([container("source", [savedItem])]);
    const before = storage.values.get(store.key);
    storage.failure = new DOMException("Full", "QuotaExceededError");
    assert.deepEqual(store.remove({ sourceId: "source", itemId: item.id, profile }), {
      status: "error",
      reason: "storage-failed",
    });
    assert.equal(storage.values.get(store.key), before);
    assert.deepEqual(storage.removals, []);
    storage.failure = null;
    storage.values.set(profilesKey, JSON.stringify({ ...profiles, activeId: "profile-b" }));
    assert.deepEqual(store.remove({ sourceId: "source", itemId: item.id, profile }), {
      status: "error",
      reason: "profile-changed",
    });
    assert.equal(storage.values.get(store.key), before);
  });

  test(`${store.name}: membership changes cannot overwrite pending legacy in-memory edits`, (t) => {
    t.mock.method(console, "warn", () => {});
    t.mock.method(console, "error", () => {});
    const persisted = JSON.stringify([
      container("source", [savedItem]),
      container("destination", []),
    ]);
    storage.values.set(store.key, persisted);
    storage.failure = new DOMException("Full", "QuotaExceededError");
    store.create("Pending legacy creation");
    storage.failure = null;
    // Legacy recovery can fail to restore its previous value. Restore only this isolated fixture.
    storage.values.set(store.key, persisted);
    storage.writes = [];
    assert.deepEqual(move(), { status: "error", reason: "unsaved-changes" });
    assert.deepEqual(store.add("destination", item, profile), {
      status: "error",
      reason: "unsaved-changes",
    });
    assert.equal(storage.values.get(store.key), persisted);
    assert.equal(storage.writes.length, 0);
    assert.ok(store.read().some((entry) => entry.name === "Pending legacy creation"));
  });
}

test("profile capture distinguishes shared, independent, and invalid profile contexts", () => {
  assert.deepEqual(captureMembershipProfile(), { activeId: "profile-a", settingsLinked: false });
  storage.values.set(
    profilesKey,
    JSON.stringify({
      activeId: "profile-a",
      profiles: [{ id: "profile-a" }],
    }),
  );
  assert.deepEqual(captureMembershipProfile(), { activeId: "profile-a", settingsLinked: true });
  storage.values.delete(profilesKey);
  assert.deepEqual(captureMembershipProfile(), { activeId: null, settingsLinked: true });
  storage.values.set(profilesKey, "malformed");
  assert.equal(captureMembershipProfile(), null);
  storage.readFailure = true;
  assert.equal(captureMembershipProfile(), null);
});

test("default My List Add is additive and preserves existing stored metadata", () => {
  const key = "harbor.localwatchlist.v1.profile-a";
  storage.values.set(key, JSON.stringify(["legacy-id", savedItem]));
  assert.equal(typeof defaultList.addLocalWatchlistItem, "function", "Default list Add API exists");
  assert.deepEqual(defaultList.addLocalWatchlistItem(profile, item), { status: "already-present" });
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(defaultList.addLocalWatchlistItem(profile, otherItem), { status: "added" });
  const after = JSON.parse(storage.values.get(key)!);
  assert.equal(after[0], "legacy-id");
  assert.deepEqual(after[1], savedItem);
  assert.equal(after[2].id, "tt2");
});

test("default My List Add reports storage failure and rejects a switched profile", () => {
  const key = "harbor.localwatchlist.v1.profile-a";
  storage.values.set(key, JSON.stringify([savedItem]));
  const before = storage.values.get(key);
  assert.equal(typeof defaultList.addLocalWatchlistItem, "function", "Default list Add API exists");
  storage.failure = new DOMException("Full", "QuotaExceededError");
  assert.deepEqual(defaultList.addLocalWatchlistItem(profile, otherItem), {
    status: "error",
    reason: "storage-failed",
  });
  assert.equal(storage.values.get(key), before);
  assert.deepEqual(storage.removals, []);
  storage.failure = null;
  storage.values.set(profilesKey, JSON.stringify({ ...profiles, activeId: "profile-b" }));
  assert.deepEqual(defaultList.addLocalWatchlistItem(profile, otherItem), {
    status: "error",
    reason: "profile-changed",
  });
  assert.equal(storage.values.get(key), before);
});
