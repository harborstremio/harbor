// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { registerHooks } from "node:module";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import { executeContextAction, findAction } from "../src/lib/context-actions.ts";

const endpointsUrl = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const hook = registerHooks({
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
const module = await import("../src/lib/membership-actions.ts").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const { createListStore } = await import("../src/lib/custom-lists.ts");
hook.deregister();

let values = new Map<string, string>();
let failure = false;
beforeEach(() => {
  values = new Map();
  failure = false;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failure) throw new DOMException("Full", "QuotaExceededError");
        values.set(key, value);
      },
    },
  });
  values.set(
    "harbor.profiles.v1",
    JSON.stringify({ activeId: "a", profiles: [{ id: "a", settingsLinked: false }] }),
  );
  values.set(
    "harbor.collections.a",
    JSON.stringify([
      { id: "collection-a", name: "Collection A", items: [item] },
      { id: "collection-b", name: "Collection B", items: [] },
    ]),
  );
  values.set(
    "harbor.customlists.v1.a",
    JSON.stringify([
      { id: "list-a", name: "List A", items: [item] },
      { id: "list-b", name: "List B", items: [] },
    ]),
  );
});
const item = { id: "tt1", type: "movie", name: "One" };
const profile = { activeId: "a", settingsLinked: false };
const source = (membership?: { kind: "collection" | "list"; id: string }) => {
  assert.equal(
    typeof module.buildMembershipActionSource,
    "function",
    "Membership action builder exists",
  );
  return module.buildMembershipActionSource({ item, profile, membership });
};

test("manga list destinations toggle and remove only within their official store", async () => {
  const store = createListStore("harbor.mangalists.v1");
  const key = "harbor.mangalists.v1.a";
  values.set(
    key,
    JSON.stringify([{ id: "list-b", name: "Reading", description: "Notes", items: [] }]),
  );
  const sharedBefore = values.get("harbor.customlists.v1.a");
  const selected = module.buildMembershipActionSource({
    item: { id: "source::manga", type: "manga", name: "Manga" },
    profile,
    membership: { kind: "list", id: "list-b", store },
  });
  assert.equal(findAction(selected.actions(), "membership:add:default"), undefined);
  assert.equal(findAction(selected.actions(), "membership:add:list:list-a"), undefined);
  assert.equal(findAction(selected.actions(), "membership:move"), undefined);
  let updates = 0;
  const stop = selected.subscribe(() => updates++);
  await executeContextAction(selected, "membership:add:list:list-b");
  assert.equal(updates, 1);
  assert.equal(findAction(selected.actions(), "membership:add:list:list-b").checked, true);
  assert.equal(store.readLists()[0].description, "Notes");
  await executeContextAction(selected, "membership:remove:list:list-b");
  assert.equal(updates, 2);
  assert.deepEqual(store.readLists()[0].items, []);
  assert.equal(values.get("harbor.customlists.v1.a"), sharedBefore);
  stop();
});

test("membership destination artwork belongs to that collection", () => {
  const collections = JSON.parse(values.get("harbor.collections.a")!);
  collections[1].coverImage = "https://example.invalid/designated-cover.png";
  collections[1].bgImage = "https://example.invalid/designated-background.png";
  values.set("harbor.collections.a", JSON.stringify(collections));
  const seen: Array<{ kind: string; destination: unknown }> = [];
  module
    .buildMembershipActionSource({
      item,
      profile,
      membership: { kind: "collection", id: "collection-a" },
      icon: (_checked, kind, destination) => {
        seen.push({ kind, destination });
        return null;
      },
    })
    .actions();
  const artwork = seen.filter((entry) => entry.destination?.id === "collection-b");
  assert.equal(artwork.length, 1);
  for (const entry of artwork) {
    assert.equal(entry.kind, "collection");
    assert.equal(entry.destination.coverImage, collections[1].coverImage);
    assert.equal(entry.destination.bgImage, collections[1].bgImage);
  }
  assert.ok(seen.some((entry) => entry.kind === "list" && entry.destination?.id === "list-b"));
});

test("membership destinations expose independent checked states and keep already-added rows actionable", () => {
  const actions = source().actions();
  assert.ok(findAction(actions, "membership:add:default"));
  assert.equal(findAction(actions, "membership:add:list:list-a")?.disabled, false);
  assert.equal(findAction(actions, "membership:add:collection:collection-a")?.disabled, false);
  assert.equal(findAction(actions, "membership:add:list:list-a")?.checked, true);
  assert.equal(findAction(actions, "membership:add:collection:collection-a")?.checked, true);
  assert.equal(findAction(actions, "membership:add:list:list-b")?.checked, false);
  assert.equal(findAction(actions, "membership:add:list:list-b")?.dismiss, "keep-open");
  assert.equal(findAction(actions, "membership:add:list:list-b")?.disabled, false);
  assert.equal(findAction(actions, "membership:add:collection:collection-b")?.disabled, false);
  assert.equal(
    actions.some((action) => action.id === "membership:move"),
    false,
  );
});

test("creating a list belongs to Add and opening creation does not change existing memberships", async () => {
  let opened = 0;
  const selected = module.buildMembershipActionSource({
    item,
    profile,
    membership: { kind: "collection", id: "collection-a" },
    onCreateList: () => opened++,
  });
  const before = new Map(values);
  const actions = selected.actions();
  assert.equal(
    actions.some((action) => action.id === "membership:create-list"),
    false,
  );
  const add = findAction(actions, "membership:add");
  assert.equal(add.label, "Add to");
  const createIndex = add.children.findIndex((action) => action.id === "membership:create-list");
  assert.equal(add.children[createIndex].sectionLabel, "Lists");
  assert.equal(add.children[createIndex].group, "create");
  assert.ok(
    createIndex < add.children.findIndex((action) => action.sectionLabel === "Collections"),
  );
  assert.deepEqual(
    [...new Set(add.children.map((action) => action.sectionLabel))],
    ["Lists", "Collections"],
  );
  await executeContextAction(selected, "membership:create-list");
  assert.equal(opened, 1);
  assert.deepEqual(values, before, "opening or cancelling creation must not move or add the item");
});

test("creation stays available without custom destinations and is unavailable at the list limit", () => {
  values.set("harbor.customlists.v1.a", "[]");
  values.set("harbor.collections.a", "[]");
  const selected = module.buildMembershipActionSource({ item, profile, onCreateList: () => {} });
  const add = findAction(selected.actions(), "membership:add");
  assert.deepEqual(
    add.children.map((action) => action.id),
    ["membership:add:default", "membership:create-list"],
  );
  values.set(
    "harbor.customlists.v1.a",
    JSON.stringify(
      Array.from({ length: 24 }, (_, index) => ({
        id: `list-${index}`,
        name: `List ${index}`,
        items: [],
      })),
    ),
  );
  assert.equal(findAction(selected.actions(), "membership:create-list").disabled, true);
  assert.ok(findAction(selected.actions(), "membership:create-list").reason);
});

test("large destination choices are searchable without making short menus into editors", () => {
  assert.equal(findAction(source().actions(), "membership:add").searchable, false);
  values.set(
    "harbor.customlists.v1.a",
    JSON.stringify(
      Array.from({ length: 9 }, (_, index) => ({
        id: index === 0 ? "list-a" : `destination-${index}`,
        name: `Destination ${index}`,
        items: index === 0 ? [item] : [],
      })),
    ),
  );
  const actions = source({ kind: "list", id: "list-a" }).actions();
  assert.equal(findAction(actions, "membership:add").searchable, true);
  assert.equal(findAction(actions, "membership:move"), undefined);
  const lists = JSON.parse(values.get("harbor.customlists.v1.a")!);
  lists.push({ id: "tenth", name: "Tenth", items: [] });
  values.set("harbor.customlists.v1.a", JSON.stringify(lists));
  assert.equal(
    findAction(source({ kind: "list", id: "list-a" }).actions(), "membership:add").searchable,
    true,
  );
});

test("each membership changes independently and removal affects only the explicitly selected destination", async () => {
  const selected = source({ kind: "collection", id: "collection-a" });
  const actions = selected.actions();
  assert.equal(findAction(actions, "membership:move"), undefined);
  assert.equal(actions.at(-1).id, "membership:remove:collection:collection-a");
  await executeContextAction(selected, "membership:add:collection:collection-b");
  assert.deepEqual(JSON.parse(values.get("harbor.collections.a")!)[0].items, [item]);
  await executeContextAction(selected, "membership:add:collection:collection-a");
  const after = JSON.parse(values.get("harbor.collections.a")!);
  assert.deepEqual(after[0].items, []);
  assert.deepEqual(after[1].items, [item]);
  assert.deepEqual(JSON.parse(values.get("harbor.customlists.v1.a")!)[0].items, [item]);
});

test("membership menu revalidates the destination and surfaces failed persistence", async () => {
  const selected = source();
  failure = true;
  await assert.rejects(
    executeContextAction(selected, "membership:add:list:list-b"),
    /save|storage/i,
  );
  assert.deepEqual(JSON.parse(values.get("harbor.customlists.v1.a")!)[1].items, []);
  failure = false;
  values.set("harbor.customlists.v1.a", "[]");
  await assert.rejects(
    executeContextAction(selected, "membership:add:list:list-b"),
    /no longer available/i,
  );
});

test("a profile switch invalidates an open membership menu", async () => {
  const selected = source({ kind: "list", id: "list-a" });
  values.set(
    "harbor.profiles.v1",
    JSON.stringify({ activeId: "b", profiles: [{ id: "b", settingsLinked: false }] }),
  );
  assert.equal(selected.isValid(), false);
  await assert.rejects(
    executeContextAction(selected, "membership:remove:list:list-a"),
    /no longer available/i,
  );
});

test("a single existing membership remains removable without another destination", async () => {
  values.set(
    "harbor.collections.a",
    JSON.stringify([{ id: "collection-a", name: "Only", items: [item] }]),
  );
  const selected = source({ kind: "collection", id: "collection-a" });
  assert.equal(
    findAction(selected.actions(), "membership:add:collection:collection-a").disabled,
    false,
  );
  await executeContextAction(selected, "membership:add:collection:collection-a");
  assert.deepEqual(JSON.parse(values.get("harbor.collections.a")!)[0].items, []);
  assert.equal(selected.isValid(), true, "Removing source membership is not target invalidation");
});

test("explicit nonfilm membership controls retain the supported destination family", async () => {
  const manga = { id: "manga:fixture", type: "manga", name: "Fixture" };
  values.set(
    "harbor.collections.a",
    JSON.stringify([
      { id: "collection-a", name: "A", items: [manga] },
      { id: "collection-b", name: "B", items: [] },
    ]),
  );
  const selected = module.buildMembershipActionSource({
    item: manga,
    profile,
    membership: { kind: "collection", id: "collection-a" },
    membershipOnly: true,
    onCreateList: () => {
      throw new Error("Must not be exposed");
    },
  });
  assert.deepEqual(
    selected.actions().map((action) => action.id),
    ["membership:add", "membership:remove:collection:collection-a"],
  );
  const add = findAction(selected.actions(), "membership:add");
  assert.deepEqual(
    add.children.map((action) => action.id),
    ["membership:add:collection:collection-a", "membership:add:collection:collection-b"],
  );
  await executeContextAction(selected, "membership:add:collection:collection-b");
  assert.deepEqual(JSON.parse(values.get("harbor.collections.a")!)[1].items, [manga]);
});

test("simultaneous destination changes retain both writes, metadata and stable row order", async () => {
  const collections = JSON.parse(values.get("harbor.collections.a")!);
  collections[0].sourceHandle = "original-owner";
  collections[0].sourceId = "original-collection";
  collections[1].custom = { preserve: true };
  collections.push({ id: "collection-c", name: "C", items: [], custom: { other: true } });
  values.set("harbor.collections.a", JSON.stringify(collections));
  const selected = source();
  const order = findAction(selected.actions(), "membership:add").children.map(
    (action) => action.id,
  );
  await Promise.all([
    executeContextAction(selected, "membership:add:collection:collection-b"),
    executeContextAction(selected, "membership:add:collection:collection-c"),
  ]);
  const stored = JSON.parse(values.get("harbor.collections.a")!);
  assert.deepEqual(
    stored.map((entry) => entry.items),
    [[item], [item], [item]],
  );
  assert.equal(stored[0].sourceHandle, "original-owner");
  assert.equal(stored[0].sourceId, "original-collection");
  assert.deepEqual(stored[1].custom, { preserve: true });
  assert.deepEqual(stored[2].custom, { other: true });
  assert.deepEqual(
    findAction(selected.actions(), "membership:add").children.map((action) => action.id),
    order,
  );
});

test("rapid repeated input does not toggle an accepted membership back off", async () => {
  const selected = source();
  const adding = executeContextAction(selected, "membership:add:list:list-b");
  await assert.rejects(
    executeContextAction(selected, "membership:add:list:list-b"),
    /already running/,
  );
  await adding;
  assert.equal(findAction(selected.actions(), "membership:add:list:list-b").checked, true);
  assert.equal(JSON.parse(values.get("harbor.customlists.v1.a")!)[1].items.length, 1);
});

test("failed addition never removes another membership and an explicit removal is not rolled back", async () => {
  const selected = source();
  failure = true;
  await assert.rejects(
    executeContextAction(selected, "membership:add:collection:collection-b"),
    /save|storage/i,
  );
  assert.deepEqual(
    JSON.parse(values.get("harbor.collections.a")!).map((entry) => entry.items),
    [[item], []],
  );
  assert.equal(
    findAction(selected.actions(), "membership:add:collection:collection-b").checked,
    false,
  );
  failure = false;
  await executeContextAction(selected, "membership:add:collection:collection-a");
  failure = true;
  await assert.rejects(
    executeContextAction(selected, "membership:add:collection:collection-b"),
    /save|storage/i,
  );
  assert.deepEqual(
    JSON.parse(values.get("harbor.collections.a")!).map((entry) => entry.items),
    [[], []],
  );
});

test("full destinations allow removal of an existing member while refusing new additions", async () => {
  values.set(
    "harbor.collections.a",
    JSON.stringify([
      {
        id: "collection-a",
        name: "A",
        items: Array.from({ length: 100 }, (_, i) => ({ ...item, id: `tt${i}` })),
      },
      {
        id: "collection-b",
        name: "B",
        items: Array.from({ length: 100 }, (_, i) => ({ ...item, id: `other${i}` })),
      },
    ]),
  );
  const selected = source();
  assert.equal(
    findAction(selected.actions(), "membership:add:collection:collection-a").disabled,
    false,
  );
  assert.equal(
    findAction(selected.actions(), "membership:add:collection:collection-b").disabled,
    true,
  );
  await executeContextAction(selected, "membership:add:collection:collection-a");
  assert.equal(JSON.parse(values.get("harbor.collections.a")!)[0].items.length, 99);
});

test("unreadable membership data is unavailable, never presented as unchecked or an empty destination set", () => {
  values.set("harbor.customlists.v1.a", "not-json");
  values.set("harbor.localwatchlist.v1.a", "not-json");
  const actions = source().actions();
  const defaultList = findAction(actions, "membership:add:default");
  assert.equal(defaultList.checked, undefined);
  assert.equal(defaultList.disabled, true);
  assert.ok(defaultList.reason);
  const unavailable = findAction(actions, "membership:unavailable:list");
  assert.equal(unavailable.disabled, true);
  assert.ok(unavailable.reason);
  assert.equal(findAction(actions, "membership:add:collection:collection-a").checked, true);
});

test("default My List membership supports immediate removal while preserving unrelated saved metadata", async () => {
  values.set(
    "harbor.localwatchlist.v1.a",
    JSON.stringify([
      { ...item, custom: true },
      { id: "other", custom: { keep: true } },
    ]),
  );
  const selected = source();
  assert.equal(findAction(selected.actions(), "membership:add:default").checked, true);
  await executeContextAction(selected, "membership:add:default");
  assert.deepEqual(JSON.parse(values.get("harbor.localwatchlist.v1.a")!), [
    { id: "other", custom: { keep: true } },
  ]);
  await executeContextAction(selected, "membership:add:default");
  assert.equal(findAction(selected.actions(), "membership:add:default").checked, true);
});

test("membership subscriptions observe store changes without a polling timer", async () => {
  const selected = source();
  assert.equal(typeof selected.subscribe, "function");
  let updates = 0;
  const unsubscribe = selected.subscribe(() => updates++);
  await executeContextAction(selected, "membership:add:list:list-b");
  assert.equal(updates, 1);
  unsubscribe();
  await executeContextAction(selected, "membership:add:list:list-b");
  assert.equal(updates, 1);
});

test("a captured membership intent remains additive or subtractive after another source changes state", async () => {
  const selected = source();
  const add = findAction(selected.actions(), "membership:add:collection:collection-b").run;
  await executeContextAction(source(), "membership:add:collection:collection-b");
  await add();
  assert.deepEqual(JSON.parse(values.get("harbor.collections.a")!)[1].items, [item]);
  const remove = findAction(selected.actions(), "membership:add:collection:collection-b").run;
  await executeContextAction(source(), "membership:add:collection:collection-b");
  await remove();
  assert.deepEqual(JSON.parse(values.get("harbor.collections.a")!)[1].items, []);
});

test("a read failure during an open chooser preserves row identities but clears unverified checks", () => {
  const selected = source();
  const before = findAction(selected.actions(), "membership:add").children.map(
    (action) => action.id,
  );
  values.set("harbor.collections.a", "not-json");
  const actions = selected.actions();
  assert.deepEqual(
    findAction(actions, "membership:add").children.map((action) => action.id),
    before,
  );
  const existing = findAction(actions, "membership:add:collection:collection-a");
  assert.equal(existing.checked, undefined);
  assert.equal(existing.disabled, true);
  assert.ok(existing.reason);
});

test("destination rows and checked states derive from one acknowledged storage snapshot", () => {
  let reads = 0;
  localStorage.getItem = (key: string) => {
    if (key === "harbor.collections.a" && ++reads > 1)
      throw new DOMException("Unavailable", "SecurityError");
    return values.get(key) ?? null;
  };
  const existing = findAction(source().actions(), "membership:add:collection:collection-a");
  assert.ok(existing);
  assert.equal(existing.checked, true);
  assert.equal(reads, 1);
});
