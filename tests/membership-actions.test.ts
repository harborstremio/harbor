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
    "harbor.customlists.a",
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

test("Add destinations include default My List, custom lists, and collections with duplicates disabled", () => {
  const actions = source().actions();
  assert.ok(findAction(actions, "membership:add:default"));
  assert.equal(findAction(actions, "membership:add:list:list-a")?.disabled, true);
  assert.equal(findAction(actions, "membership:add:collection:collection-a")?.disabled, true);
  assert.equal(findAction(actions, "membership:add:list:list-b")?.disabled, false);
  assert.equal(findAction(actions, "membership:add:collection:collection-b")?.disabled, false);
  assert.equal(
    actions.some((action) => action.id === "membership:move"),
    false,
  );
});

test("Move exposes only same-family destinations and Remove targets the explicit source", async () => {
  const selected = source({ kind: "collection", id: "collection-a" });
  const actions = selected.actions();
  const move = findAction(actions, "membership:move");
  assert.deepEqual(
    move.children.map((action) => action.id),
    ["membership:move:collection:collection-b"],
  );
  assert.equal(actions.at(-1).id, "membership:remove:collection:collection-a");
  await executeContextAction(selected, "membership:move:collection:collection-b");
  const after = JSON.parse(values.get("harbor.collections.a")!);
  assert.deepEqual(after[0].items, []);
  assert.deepEqual(after[1].items, [item]);
  assert.deepEqual(JSON.parse(values.get("harbor.customlists.a")!)[0].items, [item]);
});

test("membership menu revalidates the destination and surfaces failed persistence", async () => {
  const selected = source();
  failure = true;
  await assert.rejects(
    executeContextAction(selected, "membership:add:list:list-b"),
    /save|storage/i,
  );
  assert.deepEqual(JSON.parse(values.get("harbor.customlists.a")!)[1].items, []);
  failure = false;
  values.set("harbor.customlists.a", "[]");
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

test("Move is disabled when there is no other destination in its family", () => {
  values.set(
    "harbor.collections.a",
    JSON.stringify([{ id: "collection-a", name: "Only", items: [item] }]),
  );
  assert.equal(
    findAction(source({ kind: "collection", id: "collection-a" }).actions(), "membership:move")
      ?.disabled,
    true,
  );
});

test("explicit nonfilm membership exposes only same-family Move and Remove", async () => {
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
    ["membership:move", "membership:remove:collection:collection-a"],
  );
  await executeContextAction(selected, "membership:move:collection:collection-b");
  assert.deepEqual(JSON.parse(values.get("harbor.collections.a")!)[1].items, [manga]);
});
