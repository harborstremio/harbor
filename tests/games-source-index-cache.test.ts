import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceIndexCache, SOURCE_INDEX_CACHE_BYTES } from '../src/lib/games/source-index-cache.ts';
import { sourceIndex, rememberSourceIndex, type SourceIndex } from '../src/lib/games/source-index.ts';
import type { SourceRelease } from '../src/lib/games/sources.ts';

const index = (length = 4): SourceIndex => ({ keys: new Uint32Array(length), rows: new Uint32Array(length) });

test('live catalog handles cannot retain evicted indexes; recently used indexes survive', () => {
  const cache = createSourceIndexCache(64), first = {}, second = {}, third = {};
  const a = index(), b = index(), c = index();
  cache.remember(first, a); cache.remember(second, b);
  assert.equal(cache.get(first), a);
  cache.remember(third, c);
  assert.equal(cache.get(second), undefined);
  assert.equal(cache.get(first), a); assert.equal(cache.get(third), c);
});

test('recovered snapshots share one allocation and all aliases observe its eviction', () => {
  const cache = createSourceIndexCache(64), original = {}, recovered = {}, second = {}, third = {};
  const a = index(), b = index(), c = index();
  cache.remember(original, a); cache.remember(recovered, a); cache.remember(second, b);
  assert.equal(cache.get(original), a); assert.equal(cache.get(recovered), a);
  cache.get(second); cache.remember(third, c);
  assert.equal(cache.get(original), undefined); assert.equal(cache.get(recovered), undefined);
  cache.remember(original, a);
  assert.equal(cache.get(original), a); assert.equal(cache.get(second), undefined);
});

test('backing allocations are charged in full while shared buffers count once', () => {
  const cache = createSourceIndexCache(64), key = {}, buffer = new ArrayBuffer(64);
  const shared = { keys: new Uint32Array(buffer, 0, 4), rows: new Uint32Array(buffer, 16, 4) };
  cache.remember(key, shared); assert.equal(cache.get(key), shared);
  cache.remember(key, { keys: new Uint32Array(new ArrayBuffer(128), 0, 1), rows: new Uint32Array(1) });
  assert.equal(cache.get(key), undefined);
});

test('zero-byte indexes also obey the record limit and replacement returns the current value', () => {
  const cache = createSourceIndexCache(64, 2), a = {}, b = {}, c = {};
  cache.remember(a, index(0)); cache.remember(b, index(0)); cache.remember(c, index(0));
  assert.equal(cache.get(a), undefined);
  const replacement = index(); cache.remember(b, replacement);
  assert.equal(cache.get(b), replacement);
});

test('the production cache remains within 32 MiB with 128 retained catalog snapshots', () => {
  const catalogs: SourceRelease[][] = Array.from({ length: 128 }, () => []);
  for (const catalog of catalogs) rememberSourceIndex(catalog, index(40_000));
  const retained = catalogs.flatMap(catalog => sourceIndex(catalog) ?? []);
  assert.ok(retained.length < catalogs.length);
  assert.ok(retained.reduce((bytes, item) => bytes + item.keys.byteLength + item.rows.byteLength, 0) <= SOURCE_INDEX_CACHE_BYTES);
  assert.equal(sourceIndex(catalogs[0]), undefined);
  assert.ok(sourceIndex(catalogs.at(-1)!));
});
