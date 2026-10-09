import assert from "node:assert/strict";
import test from "node:test";
import { catalogInput } from "../src/lib/games/source-catalog-transfer.ts";
import { SOURCE_MAX_ENTRIES, type GameSource } from "../src/lib/games/sources.ts";

const entry = (index: number) => ({ id: String(index), title: `Project ${index}`, kind: "game" as const, files: [{ name: "Archive.zip", url: `https://project.example/${index}`, kind: "page" as const }] });
const source = (count: number): GameSource => ({ id: "catalog", name: "Projects", url: "https://catalog.example/data.json", format: "community", entries: Array.from({ length: count }, (_, index) => entry(index)), skipped: 0, checkedAt: 1, enabled: true });

test("stored and legacy catalogs transfer bounded batches preserving every entry in order", () => {
  const value = source(600), chunks = [value.entries.slice(0, 350), value.entries.slice(350)];
  const stored = catalogInput(value, chunks);
  assert.equal("entries" in stored.source, false);
  const storedEntries = [];
  for (let part = stored.next(); part; part = stored.next()) { assert.ok(part.length <= 256); storedEntries.push(...part); }
  assert.deepEqual(storedEntries, value.entries);
  const legacy = catalogInput(value), received = [];
  for (let part = legacy.next(); part; part = legacy.next()) { assert.ok(part.length <= 256); received.push(...part); }
  assert.deepEqual(received, value.entries);
  assert.equal(catalogInput(source(0), []).next(), undefined);
});

test("catalog transfer rejects malformed metadata, excessive entry counts and incomplete chunk plans", () => {
  const value = source(2);
  for (const bad of [undefined, {}, { ...value, entries: null }, { ...value, id: "../catalog" }, { ...value, url: "https://name:password@example.org/data.json" }, { ...value, entries: new Array(SOURCE_MAX_ENTRIES + 1) }]) assert.throws(() => catalogInput(bad));
  assert.throws(() => catalogInput(value, [value.entries.slice(0, 1)]));
});
