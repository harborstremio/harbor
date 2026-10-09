import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceMatchCache } from '../src/lib/games/source-match-cache.ts';
import type { StoredMatchPreview } from '../src/lib/games/source-match-preview.ts';

const preview = (): StoredMatchPreview => ({ release: { id: 'one', title: 'Example', kind: 'game' }, match: 'title', deferred: { signature: 'a'.repeat(64), rows: [2] } });
test('previews and full releases share one combined LRU budget', () => {
  const cache = createSourceMatchCache(3500), owner = {};
  cache.rememberPreviews(owner, 'preview', [preview()]);
  cache.remember(owner, 'files', [{ release: { id: 'two', title: 'Other', kind: 'game', files: [{ name: 'Game', kind: 'direct', url: 'https://example.org/' + 'x'.repeat(1000) }] }, match: 'title' }]);
  assert.ok(cache.usage().bytes <= 3500); assert.equal(cache.getPreviews(owner, 'preview'), undefined);
  assert.equal(cache.get(owner, 'files')?.length, 1); assert.equal(cache.getPreviews(owner, 'files'), undefined);
});
test('preview snapshots exclude source objects and detach mutable metadata and row lists', () => {
  const cache = createSourceMatchCache(), owner = {}, value = { ...preview(), source: { entries: ['large owner'] } };
  cache.rememberPreviews(owner, 'key', [value]);
  value.release.title = 'Changed'; value.deferred.rows[0] = 8;
  const cached = cache.getPreviews(owner, 'key')![0];
  assert.equal(cached.release.title, 'Example'); assert.deepEqual(cached.deferred.rows, [2]);
  assert.equal('source' in cached, false); assert.equal('files' in cached.release, false);
});
test('preview rows and optional metadata are accounted and malformed data is not retained', () => {
  const cache = createSourceMatchCache(3000), owner = {};
  const rows = preview(); rows.deferred.rows = Array.from({ length: 1000 }, (_, i) => i); cache.rememberPreviews(owner, 'rows', [rows]); assert.equal(cache.getPreviews(owner, 'rows'), undefined);
  const metadata = preview(); metadata.release.sourcePage = 'https://example.org/' + '界'.repeat(2000); cache.rememberPreviews(owner, 'metadata', [metadata]); assert.equal(cache.getPreviews(owner, 'metadata'), undefined);
  for (const row of [-1, NaN, 150000, 1.5]) { const value = preview(); value.deferred.rows = [row]; cache.rememberPreviews(owner, 'bad', [value]); assert.equal(cache.getPreviews(owner, 'bad'), undefined); }
  const full = preview(); Object.assign(full.release, { files: [{ url: 'https://example.org/file' }] }); cache.rememberPreviews(owner, 'files', [full]); assert.equal(cache.getPreviews(owner, 'files'), undefined);
});
test('empty previews use query budget, explicit invalidation removes keys, and owners remain isolated', () => {
  const cache = createSourceMatchCache(1e6, 3, 100, 2), a = {}, b = {};
  cache.rememberPreviews(a, 'one', []); cache.rememberPreviews(a, 'two', []); assert.deepEqual(cache.getPreviews(a, 'one'), []);
  cache.rememberPreviews(a, 'three', []); assert.equal(cache.getPreviews(a, 'two'), undefined);
  assert.equal(cache.getPreviews(b, 'one'), undefined); cache.forget(a, 'one'); assert.equal(cache.getPreviews(a, 'one'), undefined); assert.equal(cache.usage().queries, 1);
});
