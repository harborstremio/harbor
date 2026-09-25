// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are outside browser config.
import { registerHooks } from "node:module";
// @ts-expect-error Node test types are outside browser config.
import { readFileSync } from "node:fs";
const endpoint = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const hook = registerHooks({
  load(url, context, nextLoad) {
    return url === endpoint
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : nextLoad(url, context);
  },
});
const pages = await import("../src/lib/page-collection-rows.ts");
hook.deregister();
let values: Map<string, string>;
let failure = false;
let writes = 0;
const key = "harbor.pagecollrows.v1";
const profile = { activeId: "a", settingsLinked: false };
beforeEach(() => {
  values = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "a", profiles: [{ id: "a", settingsLinked: false }] }),
    ],
    [
      "harbor.collections.a",
      JSON.stringify(
        ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, name: id, items: [] })),
      ),
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
const set = (present = true) => {
  assert.equal(typeof pages.setCollectionOnPageWithResult, "function");
  return pages.setCollectionOnPageWithResult({ page: "home", collectionId: "c", present, profile });
};
test("page membership commits once, preserves other data, and is idempotent at capacity", () => {
  values.set(
    key,
    JSON.stringify({
      home: ["a", "b", "d", "e", "f"],
      movies: ["other"],
      extra: { preserved: true },
    }),
  );
  assert.equal(set().status, "added");
  assert.equal(writes, 1);
  const stored = JSON.parse(values.get(key)!);
  assert.deepEqual(stored.home, ["a", "b", "d", "e", "f", "c"]);
  assert.deepEqual(stored.extra, { preserved: true });
  assert.equal(set().status, "already-present");
  assert.equal(writes, 1);
  assert.equal(set(false).status, "removed");
  assert.equal(writes, 2);
});
test("failed page write preserves persistent and subscribed UI state", () => {
  assert.equal(set().status, "added");
  const before = values.get(key);
  failure = true;
  assert.deepEqual(set(false), { status: "error", reason: "storage-failed" });
  assert.equal(values.get(key), before);
  assert.equal(pages.isCollectionOnPage("home", "c"), true);
});
test("page mutations revalidate capacity, source, profile, and malformed snapshots", () => {
  values.set(key, JSON.stringify({ home: ["a", "b", "d", "e", "f", "g"] }));
  assert.equal(set().reason, "destination-full");
  values.set(key, "{bad");
  assert.equal(set().reason, "invalid-data");
  values.delete(key);
  values.set("harbor.collections.a", "[]");
  assert.equal(set().reason, "missing-source");
  values.set(
    "harbor.profiles.v1",
    JSON.stringify({ activeId: "b", profiles: [{ id: "b", settingsLinked: false }] }),
  );
  assert.equal(set().reason, "profile-changed");
  assert.equal(writes, 0);
});

test("page capacity ignores stale or other-profile collection references while preserving them", () => {
  values.set(
    key,
    JSON.stringify({ home: ["other-1", "other-2", "other-3", "other-4", "other-5", "other-6"] }),
  );
  assert.equal(set().status, "added");
  assert.equal(JSON.parse(values.get(key)!).home.length, 7);
});
