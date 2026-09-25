import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as lists from "../src/lib/custom-lists.ts";

function fixture(full = false, alreadyPresent = false) {
  const sourceKey = "harbor.customlists.v1.reader";
  const destinationKey = "harbor.mangalists.v1.reader";
  const manga = { id: "source::manga", type: "manga", name: "Reading", addedAt: 1 };
  const movie = { id: "tt-film", type: "movie", name: "Film", addedAt: 1 };
  const values = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "reader", profiles: [{ id: "reader", settingsLinked: false }] }),
    ],
    [
      sourceKey,
      JSON.stringify([
        { id: "legacy", name: "Shelf", description: "Notes", items: [manga, movie] },
      ]),
    ],
    [
      destinationKey,
      JSON.stringify([
        {
          id: "reading",
          name: "Shelf",
          description: "Notes",
          items: full
            ? Array.from({ length: lists.MAX_ITEMS }, (_, i) => ({ ...manga, id: `other::${i}` }))
            : alreadyPresent
              ? [manga]
              : [],
        },
      ]),
    ],
  ]);
  let fail = false;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (fail && key === destinationKey) throw new Error("Controlled destination write failure");
        values.set(key, value);
      },
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  const source = lists.createListStore("harbor.customlists.v1");
  const load = () => {
    const output = ts.transpileModule(
      readFileSync(new URL("../src/lib/manga-lists.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    );
    const exports = {};
    new Function("require", "exports", output.outputText)((name: string) => {
      assert.equal(name, "./custom-lists");
      return { ...lists, readLists: source.readLists, removeFromList: source.removeFromList };
    }, exports);
    return exports as typeof import("../src/lib/manga-lists.ts");
  };
  return {
    values,
    sourceKey,
    destinationKey,
    manga,
    movie,
    load,
    setFailed: (value: boolean) => (fail = value),
  };
}

test("manga migration preserves the source when the destination is full", () => {
  const h = fixture(true);
  const before = h.values.get(h.sourceKey);
  h.load();
  assert.equal(h.values.get(h.sourceKey), before);
  assert.equal(h.values.has("harbor.mangalists.migrated.v1"), false);
});

test("manga migration retries a failed destination write before removing the source", () => {
  const h = fixture();
  const before = h.values.get(h.sourceKey);
  h.setFailed(true);
  const migration = h.load();
  assert.equal(h.values.get(h.sourceKey), before);
  assert.equal(h.values.has("harbor.mangalists.migrated.v1"), false);
  h.setFailed(false);
  migration.ensureMangaListsMigrated();
  assert.deepEqual(JSON.parse(h.values.get(h.sourceKey)!)[0].items, [h.movie]);
  assert.equal(JSON.parse(h.values.get(h.destinationKey)!)[0].items[0].id, h.manga.id);
  assert.equal(JSON.parse(h.values.get(h.destinationKey)!)[0].description, "Notes");
  assert.equal(h.values.get("harbor.mangalists.migrated.v1"), "1");
});

test("an acknowledged existing manga permits source cleanup without duplicating it", () => {
  const h = fixture(false, true);
  const destinationBefore = h.values.get(h.destinationKey);
  h.load();
  assert.equal(h.values.get(h.destinationKey), destinationBefore);
  assert.deepEqual(JSON.parse(h.values.get(h.sourceKey)!)[0].items, [h.movie]);
  assert.equal(h.values.get("harbor.mangalists.migrated.v1"), "1");
});
