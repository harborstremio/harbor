import test from "node:test";
import assert from "node:assert/strict";
import { prependMusicSearch } from "../src/lib/music/search-history.ts";

test("recent music searches move repeat selections to the front and keep twelve entries", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({ id: String(index), query: `Search ${index}` }));
  const repeated = prependMusicSearch(entries, entries[8]);
  assert.equal(repeated.length, 12);
  assert.equal(repeated[0].id, "8");
  assert.equal(repeated.filter((entry) => entry.id === "8").length, 1);
  const added = prependMusicSearch(entries, { id: "new", query: "Kevin Gates" });
  assert.equal(added.length, 12);
  assert.equal(added.at(-1)?.id, "10");
});
