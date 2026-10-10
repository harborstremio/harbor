import test from "node:test";
import assert from "node:assert/strict";
import { sourceEntryLayout, sourceProfileBytes, sourceStoreHeaders, storedSourceProfile, SOURCE_CHUNK_BYTES, SOURCE_STORE_MAX_PARTS } from "../src/lib/games/source-store-format.ts";
import { parseSourceText, SOURCE_STORE_MAX_BYTES, type GameSource } from "../src/lib/games/sources.ts";

const source = (): GameSource => ({ ...parseSourceText(JSON.stringify({ name: "Community projects", downloads: [{ title: "Project 日本", uris: ["https://files.example/project.zip"] }] })), id: "catalog-one", url: "https://catalog.example/source.json", enabled: true, checkedAt: 1 });

test("chunk layout bounds actual UTF-8 records while preserving every entry and order", () => {
  const base = source().entries[0];
  const entries = Array.from({ length: 13000 }, (_, index) => ({ ...base, id: String(index), title: `${index} 日本${"界".repeat(240)}` }));
  const layout = sourceEntryLayout(entries), encoder = new TextEncoder();
  assert.ok(layout.ends.length > 1);
  assert.equal(layout.bytes, encoder.encode(JSON.stringify(entries)).byteLength);
  let start = 0; const restored = [];
  for (const end of layout.ends) {
    const chunk = entries.slice(start, end);
    assert.ok(encoder.encode(JSON.stringify(chunk)).byteLength <= SOURCE_CHUNK_BYTES);
    restored.push(...chunk); start = end;
  }
  assert.deepEqual(restored, entries);
  assert.deepEqual(sourceEntryLayout([]), { bytes: 2, ends: [] });
});

test("profile sizing preserves the aggregate cap and counts metadata and Unicode exactly", () => {
  const item = source(), headers = sourceStoreHeaders([item]);
  const layout = sourceEntryLayout(item.entries);
  assert.equal(sourceProfileBytes(headers, [layout]), Buffer.byteLength(JSON.stringify([{ ...headers[0], entries: item.entries }])));
  assert.throws(() => sourceProfileBytes(headers, [{ bytes: SOURCE_STORE_MAX_BYTES, ends: [1] }]), /source_capacity/);
  assert.throws(() => sourceEntryLayout([{ ...item.entries[0], title: "x".repeat(SOURCE_CHUNK_BYTES) }]), /source_limit/);
});

test("stored chunk references retain source identity and reject corrupt or excessive plans", () => {
  const header = sourceStoreHeaders([source()])[0];
  const catalog = { source: header, version: "11111111-1111-4111-8111-111111111111", parts: 2 };
  const profile = { version: 2, catalogs: [catalog] };
  assert.deepEqual(storedSourceProfile(profile), profile);
  for (const value of [null, { ...profile, version: 3 }, { ...profile, catalogs: [{ ...catalog, parts: -1 }] }, { ...profile, catalogs: [{ ...catalog, parts: SOURCE_STORE_MAX_PARTS + 1 }] }, { ...profile, catalogs: [{ ...catalog, version: "../other" }] }, { ...profile, catalogs: [catalog, catalog] }]) assert.throws(() => storedSourceProfile(value), /source_storage/);
  assert.throws(() => sourceStoreHeaders([source(), { ...source(), url: "https://different.example/source.json" }]), /source_storage/);
});
