// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are outside browser config.
import { registerHooks } from "node:module";
// @ts-expect-error Node test types are outside browser config.
import { readFileSync } from "node:fs";
const endpoint = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const themeAuth = new URL("../src/lib/theme-auth.ts", import.meta.url).href;
const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url === themeAuth)
      return {
        format: "module",
        shortCircuit: true,
        source:
          "export const authToken = () => globalThis.fixtureToken; export const currentAuthor = () => ({handle: 'fixture-owner'});",
      };
    return url === endpoint
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : nextLoad(url, context);
  },
});
const publication = await import("../src/lib/collection-publication.ts").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const sync = await import("../src/lib/social/collections-sync.ts");
const collections = await import("../src/lib/collections.ts");
hook.deregister();
let values: Map<string, string>;
let failStorage = false;
let failNetwork = false;
let beforeReply = () => {};
let requests = 0;
const key = "harbor.collections.a";
const profile = { activeId: "a", settingsLinked: false };
const mirrorResponse = () =>
  new Response(
    JSON.stringify({
      isOwner: true,
      handle: "fixture-owner",
      collections: JSON.parse(values.get(key) ?? "[]"),
    }),
  );
beforeEach(() => {
  globalThis.fixtureToken = "fixture";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { hostname: "fixture.invalid", origin: "https://fixture.invalid" },
      dispatchEvent: () => true,
    },
  });
  values = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "a", profiles: [{ id: "a", settingsLinked: false }] }),
    ],
    [
      key,
      JSON.stringify([
        {
          id: "c",
          name: "Collection",
          items: [{ id: "tt1", custom: true }],
          custom: { keep: true },
        },
      ]),
    ],
  ]);
  failStorage = false;
  failNetwork = false;
  requests = 0;
  beforeReply = () => {};
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failStorage) throw new Error("full");
        values.set(key, value);
      },
    },
  });
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== "PATCH") return mirrorResponse();
    requests++;
    assert.equal(
      JSON.parse(values.get(key)!)[0].shared,
      undefined,
      "No optimistic publication state",
    );
    const body = JSON.parse(String(init?.body));
    assert.equal(body.collections[0]?.custom, undefined, "Private local metadata is not published");
    assert.equal(body.collections[0]?.items[0]?.custom, undefined);
    beforeReply();
    if (failNetwork) return new Response("failure", { status: 500 });
    return new Response(String(init?.body));
  };
});
const publish = () => {
  assert.equal(typeof publication.setCollectionPublication, "function");
  return publication.setCollectionPublication({
    collectionId: "c",
    shared: true,
    profile,
    token: "fixture",
  });
};
test("publication commits local state only after remote acknowledgement and preserves metadata", async () => {
  await publish();
  assert.equal(requests, 1);
  const saved = JSON.parse(values.get(key)!)[0];
  assert.equal(saved.shared, true);
  assert.deepEqual(saved.custom, { keep: true });
  assert.equal(saved.items[0].custom, true);
});
test("failed publication leaves local shared state unchanged", async () => {
  const before = values.get(key);
  failNetwork = true;
  await assert.rejects(publish(), /publish/i);
  assert.equal(values.get(key), before);
});
test("acknowledged publication with failed local storage reports the partial outcome", async () => {
  const before = values.get(key);
  failStorage = true;
  await assert.rejects(publish(), /server.*accepted.*local/i);
  assert.equal(values.get(key), before);
});
test("publication refuses saved copies, switched accounts, and concurrent local edits", async () => {
  values.set(
    key,
    JSON.stringify([
      { id: "c", name: "Copy", sourceHandle: "other", sourceId: "origin", items: [] },
    ]),
  );
  await assert.rejects(publish(), /original|saved/i);
  assert.equal(requests, 0);
  values.set(key, JSON.stringify([{ id: "c", name: "Collection", items: [] }]));
  globalThis.fixtureToken = "other";
  await assert.rejects(publish(), /account|profile/i);
  assert.equal(requests, 0);
  globalThis.fixtureToken = "fixture";
  beforeReply = () => values.set(key, JSON.stringify([{ id: "c", name: "New name", items: [] }]));
  await assert.rejects(publish(), /server.*accepted.*local/i);
  assert.equal(JSON.parse(values.get(key)!)[0].name, "New name");
});

test("deleting a shared collection acknowledges unpublication before local deletion", async () => {
  values.set(key, JSON.stringify([{ id: "c", name: "Published", shared: true, items: [] }]));
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== "PATCH") return mirrorResponse();
    requests++;
    assert.equal(JSON.parse(values.get(key)!)[0].shared, true);
    assert.deepEqual(JSON.parse(String(init?.body)), { collections: [], clearCollections: true });
    return new Response(JSON.stringify({ collections: [] }));
  };
  assert.equal(typeof publication.deleteCollectionAcknowledged, "function");
  failStorage = true;
  await assert.rejects(
    publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" }),
    /unpublished.*local/i,
  );
  assert.equal(JSON.parse(values.get(key)!).length, 1);
  failStorage = false;
  await publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" });
  assert.equal(values.get(key), "[]");
  assert.equal(requests, 2);
});

test("deleting a saved copy preserves its original publication without a network request", async () => {
  values.set(
    key,
    JSON.stringify([
      {
        id: "c",
        name: "Saved",
        sourceHandle: "original",
        sourceId: "original-id",
        shared: true,
        items: [],
      },
    ]),
  );
  await publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: null });
  assert.equal(values.get(key), "[]");
  assert.equal(requests, 0);
});

test("overlapping publish and delete read fresh state after the account queue lock", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: Array<{ collections: Array<{ id: string; shared?: boolean }> }> = [];
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== "PATCH") return mirrorResponse();
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    if (bodies.length === 1) await gate;
    return new Response(JSON.stringify(body));
  };
  const first = publish();
  await new Promise((resolve) => setImmediate(resolve));
  const second = publication.deleteCollectionAcknowledged({
    collectionId: "c",
    profile,
    token: "fixture",
  });
  const completed = Promise.allSettled([first, second]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bodies.length, 1, "No overlapping full-array publication");
  release();
  const result = await completed;
  assert.ok(
    result.every((item) => item.status === "fulfilled"),
    JSON.stringify(result),
  );
  assert.equal(values.get(key), "[]");
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[1].collections, []);
});

test("queued editor synchronization reads after publication, never sending its older shared flag", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: Array<{ collections: Array<{ shared?: boolean }> }> = [];
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== "PATCH") return mirrorResponse();
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    if (bodies.length === 1) await gate;
    return new Response(JSON.stringify(body));
  };
  const first = publish();
  await new Promise((resolve) => setImmediate(resolve));
  const editor = sync.publishCollections();
  const completed = Promise.allSettled([first, editor]);
  release();
  assert.ok((await completed).every((item) => item.status === "fulfilled"));
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1].collections[0].shared, true);
});

test("an already-saved community source remains idempotent after its remote item count grows past the cap", () => {
  values.set(
    key,
    JSON.stringify([
      { id: "saved", name: "Saved", sourceHandle: "creator", sourceId: "original", items: [] },
    ]),
  );
  const before = values.get(key);
  const result = collections.saveCommunityCollectionWithResult(
    {
      handle: "creator",
      id: "original",
      name: "Larger now",
      items: Array.from({ length: collections.MAX_COLLECTION_ITEMS + 1 }, (_, i) => ({
        id: `tt${i}`,
        name: "Fixture",
        type: "movie",
      })),
    },
    profile,
  );
  assert.equal(result.result.status, "already-present");
  assert.equal(result.id, "saved");
  assert.equal(values.get(key), before);
});

test("HTTP success cannot acknowledge a stale shared flag or a missing collection echo", async () => {
  const before = values.get(key);
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        collections: [{ id: "c", name: "Collection", shared: false, items: [{ id: "tt1" }] }],
      }),
    );
  await assert.rejects(publish(), /confirm/i);
  assert.equal(values.get(key), before);
  globalThis.fetch = async () => new Response("{}");
  await assert.rejects(publish(), /confirm/i);
  assert.equal(values.get(key), before);
});

test("a clear response retaining the deleted collection never removes its local copy", async () => {
  const retained = [{ id: "c", name: "Published", shared: true, items: [] }];
  values.set(key, JSON.stringify(retained));
  globalThis.fetch = async (_url, init) =>
    init?.method !== "PATCH"
      ? mirrorResponse()
      : new Response(JSON.stringify({ collections: retained }));
  await assert.rejects(
    publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" }),
    /confirm/i,
  );
  assert.equal(values.get(key), JSON.stringify(retained));
});

test("an account switch rejects a queued publication before any further network write", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== "PATCH") return mirrorResponse();
    writes++;
    await gate;
    return new Response(String(init?.body));
  };
  const first = publish();
  await new Promise((resolve) => setImmediate(resolve));
  const second = sync.publishCollections();
  const completed = Promise.allSettled([first, second]);
  globalThis.fixtureToken = "changed";
  release();
  const outcomes = await completed;
  assert.ok(outcomes.every((item) => item.status === "rejected"));
  assert.equal(writes, 1);
  assert.equal(JSON.parse(values.get(key)!)[0].shared, undefined);
});

test("verified owner absence allows local deletion without publishing local private collections", async () => {
  let patches = 0;
  let reads = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "PATCH") patches++;
    else reads++;
    return new Response(
      JSON.stringify({ isOwner: true, handle: "fixture-owner", collections: [] }),
    );
  };
  await publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" });
  assert.equal(values.get(key), "[]");
  assert.equal(patches, 0);
  assert.equal(reads, 1);
});

test("an unlisted mirror is removed while remote-only peers are preserved and local private peers are not published", async () => {
  const privateLocal = { id: "local-only", name: "Private", items: [] };
  values.set(key, JSON.stringify([{ id: "c", name: "Unlisted", items: [] }, privateLocal]));
  const peer = {
    id: "remote-only",
    name: "Other",
    shared: true,
    items: [{ id: "tt2", type: "movie", name: "Two" }],
    updatedAt: 9,
    createdAt: 1,
  };
  let patch: unknown;
  globalThis.fetch = async (_url, init) => {
    if (init?.method !== "PATCH")
      return new Response(
        JSON.stringify({
          isOwner: true,
          handle: "fixture-owner",
          collections: [{ id: "c", name: "Unlisted", items: [] }, peer],
        }),
      );
    patch = JSON.parse(String(init.body));
    return new Response(String(init.body));
  };
  await publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" });
  assert.deepEqual((patch as { collections: unknown[] }).collections, [peer]);
  assert.deepEqual(JSON.parse(values.get(key)!), [privateLocal]);
});

test("unverified or unavailable account mirrors require explicit local-only deletion", async () => {
  const before = values.get(key);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(
      JSON.stringify({ isOwner: false, handle: "fixture-owner", collections: [] }),
    );
  };
  await assert.rejects(
    publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" }),
    (error) => error instanceof publication.CollectionMirrorUnavailableError,
  );
  assert.equal(values.get(key), before);
  globalThis.fetch = async () => {
    requests++;
    throw new Error("offline");
  };
  await assert.rejects(
    publication.deleteCollectionAcknowledged({ collectionId: "c", profile, token: "fixture" }),
    (error) => error instanceof publication.CollectionMirrorUnavailableError,
  );
  assert.equal(values.get(key), before);
  const beforeLocalOnly = requests;
  await publication.deleteCollectionAcknowledged({
    collectionId: "c",
    profile,
    token: null,
    localOnly: true,
  });
  assert.equal(values.get(key), "[]");
  assert.equal(requests, beforeLocalOnly);
});

test("refreshing the token keeps full-array writes serialized for the same Harbor account", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  globalThis.fetch = async (_url, init) => {
    writes++;
    if (writes === 1) await gate;
    return new Response(String(init?.body));
  };
  const first = publish();
  await new Promise((resolve) => setImmediate(resolve));
  globalThis.fixtureToken = "refreshed";
  const second = sync.publishCollections();
  const completed = Promise.allSettled([first, second]);
  await new Promise((resolve) => setImmediate(resolve));
  const overlapped = writes > 1;
  release();
  await completed;
  assert.equal(overlapped, false);
  assert.equal(writes, 2);
});
