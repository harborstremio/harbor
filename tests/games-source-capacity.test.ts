import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceProfileBytes, sourceStoreHeaders, storedSourceProfile, SOURCE_CHUNK_BYTES } from '../src/lib/games/source-store-format.ts';
import { SOURCE_STORE_MAX_BYTES, SOURCE_CATALOG_MAX_BYTES, SOURCE_MAX_BYTES, SOURCE_MAX_ENTRIES, SOURCE_MAX_SUBSCRIPTIONS, sourceError, type GameSource } from '../src/lib/games/sources.ts';
import { sourceStorageError } from '../src/lib/games/source-storage-error.ts';

const source: GameSource = { id: 'one', name: 'Catalog 日本', url: 'https://catalog.example/feed', format: 'community', checkedAt: 1, enabled: true, skipped: 0, entries: [] };
test('aggregate headroom does not relax individual feed, entry, subscription or chunk limits', () => {
  assert.equal(SOURCE_STORE_MAX_BYTES, 2 ** 31);
  assert.equal(SOURCE_CATALOG_MAX_BYTES, 512 * 1024 ** 2);
  assert.equal(SOURCE_MAX_BYTES, 64 * 1024 ** 2); assert.equal(SOURCE_MAX_ENTRIES, 150000);
  assert.equal(SOURCE_MAX_SUBSCRIPTIONS, 128); assert.equal(SOURCE_CHUNK_BYTES, 8 * 1024 ** 2);
});
test('profile accounting admits data above the previous cap and rejects the exact new boundary including Unicode headers', () => {
  const headers = sourceStoreHeaders(Array.from({ length: 4 }, (_, i) => ({ ...source, id: 'source-' + i, url: `https://catalog.example/${i}` })));
  const overhead = sourceProfileBytes(headers, headers.map(() => ({ bytes: 2, ends: [] }))) - 8;
  const layouts = headers.map((_, i) => ({ bytes: SOURCE_CATALOG_MAX_BYTES - (i === 3 ? overhead : 0), ends: [1] }));
  assert.equal(sourceProfileBytes(headers, layouts), SOURCE_STORE_MAX_BYTES);
  layouts[3].bytes++;
  assert.throws(() => sourceProfileBytes(headers, layouts), /source_capacity/);
});
test('128 uneven catalogs at the aggregate boundary remain readable', () => {
  const headers = sourceStoreHeaders(Array.from({ length: 128 }, (_, i) => ({ ...source, id: 'source-' + i, url: `https://catalog.example/${i}` })));
  const bytes = Math.floor((SOURCE_STORE_MAX_BYTES - 100000) / headers.length);
  const layouts = headers.map(() => ({ bytes, ends: [1, 2] }));
  assert.ok(sourceProfileBytes(headers, layouts) < SOURCE_STORE_MAX_BYTES);
  const catalogs = headers.map(header => ({ source: header, version: '11111111-1111-4111-8111-111111111111', parts: Math.ceil(bytes / SOURCE_CHUNK_BYTES) }));
  assert.equal(storedSourceProfile({ version: 2, catalogs }).catalogs.length, 128);
});
test('large releases leaving half-full chunks cannot make a permitted profile unreadable', () => {
  const headers = sourceStoreHeaders(Array.from({ length: 128 }, (_, i) => ({ ...source, id: 'source-' + i, url: `https://catalog.example/${i}` })));
  // 34 raw-feed-sized catalogs of 15 releases just over half a chunk each,
  // plus 94 small catalogs: within the byte cap but beyond 512 chunk references.
  const layouts = headers.map((_, i) => i < 34 ? { bytes: 2 + 15 * (SOURCE_CHUNK_BYTES / 2 + 1024), ends: Array.from({ length: 15 }, (_, j) => j + 1) } : { bytes: 1000, ends: [1] });
  assert.ok(layouts.every(layout => layout.bytes < SOURCE_MAX_BYTES));
  assert.ok(sourceProfileBytes(headers, layouts) < SOURCE_STORE_MAX_BYTES);
  const catalogs = headers.map((header, i) => ({ source: header, version: '11111111-1111-4111-8111-111111111111', parts: layouts[i].ends.length }));
  assert.equal(catalogs.reduce((sum, catalog) => sum + catalog.parts, 0), 604);
  assert.equal(storedSourceProfile({ version: 2, catalogs }).catalogs.length, 128);
});
test('write quota exhaustion is actionable without disguising corruption or generic write failures', () => {
  assert.equal(sourceStorageError(new DOMException('Full', 'QuotaExceededError')).message, 'source_quota');
  assert.equal(sourceError(sourceStorageError({ name: 'QuotaExceededError' })), 'games.sources.source_quota');
  assert.equal(sourceError(Error('source_capacity')), 'games.sources.source_capacity');
  for (const error of [undefined, null, Error('QuotaExceededError'), new DOMException('Stopped', 'AbortError'), new DOMException('Invalid', 'DataError')]) assert.equal(sourceStorageError(error).message, 'source_storage');
});
