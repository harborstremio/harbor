// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import { beforeEach, test } from "node:test";
import * as operations from "../src/lib/membership-operations.ts";
let values: Map<string, string>;
let failure = false;
let writes = 0;
const profile = { activeId: "a", settingsLinked: false };
const key = "harbor.customlists.a";
beforeEach(() => {
  values = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "a", profiles: [{ id: "a", settingsLinked: false }] }),
    ],
    [
      key,
      JSON.stringify([
        { id: "one", name: "One", items: [{ id: "tt1", keep: true }], custom: 42 },
        { id: "two", name: "Two", items: [] },
      ]),
    ],
  ]);
  failure = false;
  writes = 0;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes++;
        if (failure) throw new Error("full");
        values.set(key, value);
      },
    },
  });
});
const run = (operation: object) => {
  assert.equal(typeof operations.performContainerOperation, "function");
  return operations.performContainerOperation("harbor.customlists.v1", profile, {
    id: "one",
    ...operation,
  });
};
test("rename and delete preserve unaffected containers and metadata", () => {
  assert.equal(run({ mode: "rename", name: "New" }).status, "updated");
  assert.equal(JSON.parse(values.get(key)!)[0].custom, 42);
  assert.equal(JSON.parse(values.get(key)!)[0].items[0].keep, true);
  assert.equal(run({ mode: "delete" }).status, "removed");
  assert.deepEqual(JSON.parse(values.get(key)!), [{ id: "two", name: "Two", items: [] }]);
  assert.equal(writes, 2);
});
test("container mutations reject failures, stale snapshot, and stale profile without data loss", () => {
  const before = values.get(key);
  failure = true;
  assert.equal(run({ mode: "delete" }).reason, "storage-failed");
  assert.equal(values.get(key), before);
  failure = false;
  assert.equal(run({ mode: "delete", expectedRaw: "stale" }).reason, "unsaved-changes");
  values.set(
    "harbor.profiles.v1",
    JSON.stringify({ activeId: "b", profiles: [{ id: "b", settingsLinked: false }] }),
  );
  assert.equal(run({ mode: "rename", name: "New" }).reason, "profile-changed");
  assert.equal(values.get(key), before);
});
