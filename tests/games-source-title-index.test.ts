import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceTitleIndex, createSourceTitleCache, searchSourceTitleIndex, validSourceTitleIndex, SOURCE_TITLE_INDEX_BYTES } from '../src/lib/games/source-title-index.ts';
import type { SourceRelease } from '../src/lib/games/sources.ts';

const entries = (titles: string[]): SourceRelease[] => titles.map((title, id) => ({ id: String(id), title, kind: 'game', files: [] }));

test('compact title queries equal full-record substring search including Unicode, empty and final rows', () => {
  const releases = entries(['Alpha', '東京 — PROJECT', 'Straße', 'İstanbul', 'Σίσυφος', 'Hello 🌊', 'Last Project']);
  const index = buildSourceTitleIndex(releases)!;
  assert.ok(validSourceTitleIndex(index));
  for (const query of ['', '  project  ', '東京', 'straße', 'İSTANBUL', 'ΣΊΣΥΦΟΣ', '🌊', 'last', 'missing']) {
    const expected = releases.flatMap((entry, row) => entry.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) ? [row] : []);
    assert.deepEqual(Array.from(searchSourceTitleIndex(index, query)), expected);
  }
  assert.deepEqual(Array.from(searchSourceTitleIndex(buildSourceTitleIndex([])!, '')), []);
});

test('substring matching never crosses title boundaries and preserves duplicate-title rows', () => {
  const index = buildSourceTitleIndex(entries(['AB', 'CD', 'AB']))!;
  assert.deepEqual(Array.from(searchSourceTitleIndex(index, 'bc')), []);
  assert.deepEqual(Array.from(searchSourceTitleIndex(index, 'AB')), [0, 2]);
  assert.deepEqual(Array.from(searchSourceTitleIndex(index, '')), [0, 1, 2]);
});

test('malformed and oversized indexes cannot drive record lookups', () => {
  for (const value of [undefined, {}, { text: 'abc', ends: [3] }, { text: 'abc', ends: new Uint32Array([4]) }, { text: 'abc', ends: new Uint32Array([2, 2, 3]) }, { text: 'abc', ends: new Uint32Array([2, 1, 3]) }, { text: 'abc', ends: new Uint32Array() }]) {
    assert.equal(validSourceTitleIndex(value), false);
    assert.throws(() => searchSourceTitleIndex(value as never, 'x'), /source_storage/);
  }
  const tooLarge = { text: 'a'.repeat(SOURCE_TITLE_INDEX_BYTES / 2), ends: new Uint32Array([SOURCE_TITLE_INDEX_BYTES / 2]) };
  assert.equal(validSourceTitleIndex(tooLarge), false);
  assert.equal(buildSourceTitleIndex(entries(Array.from({ length: 20000 }, () => 'x'.repeat(500)))), undefined);
  assert.throws(() => searchSourceTitleIndex(buildSourceTitleIndex(entries(['test']))!, 'x'.repeat(501)), /source_storage/);
});

test('only the active catalog may populate the cache; fixed expiry and invalidation preserve isolation', () => {
  const cache = createSourceTitleCache(), index = buildSourceTitleIndex(entries(['One', 'Two']))!;
  const first = cache.select('profile-a/catalog-a/version-a'); cache.put(first, index, 2, 1000);
  assert.equal(cache.get(first, 120999), index);
  assert.equal(cache.get(first, 121000), undefined);
  cache.put(first, index, 2, 1000);
  const second = cache.select('profile-a/catalog-b/version-a'); assert.equal(cache.get(second, 1001), undefined);
  cache.put(first, index, 2, 1001); assert.equal(cache.get(second, 1002), undefined);
  const third = cache.select('profile-a/catalog-a/version-a'); cache.put(first, index, 2, 1001); assert.equal(cache.get(third, 1002), undefined);
  cache.put(third, index, 3, 1001); assert.equal(cache.get(third, 1002), undefined);
  cache.put(third, index, 2, 1001); cache.remove(first); assert.equal(cache.get(third, 1002), index);
  cache.remove(third); assert.equal(cache.get(third, 1002), undefined);
  cache.put(third, index, 2, 1001); assert.equal(cache.get(third, 1000), undefined);
});
