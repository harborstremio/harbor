import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceBrowseCache } from '../src/lib/games/source-browse-cache.ts';

test('query rows preserve sparse ordering and empty results without retaining release records', () => {
  const cache = createSourceBrowseCache(), token = cache.select('one');
  cache.put(token, 'project', new Uint32Array([0, 20, 149999]), 150000, 100);
  assert.deepEqual(Array.from(cache.get(token, 'project', 101)!), [0, 20, 149999]);
  assert.deepEqual(Array.from(cache.get(token, 'project', 102)!.subarray(0, 2)), [0, 20]);
  cache.put(token, 'missing', new Uint32Array(), 150000, 100);
  assert.equal(cache.get(token, 'missing', 101)?.length, 0);
  assert.equal(cache.get(token, 'other', 101), undefined);
});

test('profile changes clear rows and prevent late work from repopulating even after switching back', () => {
  const cache = createSourceBrowseCache(), first = cache.select('one');
  cache.put(first, 'q', new Uint32Array([1]), 2);
  const second = cache.select('two');
  assert.equal(cache.get(second, 'q'), undefined);
  cache.put(first, 'late', new Uint32Array([0]), 2);
  assert.equal(cache.get(second, 'late'), undefined);
  const third = cache.select('one');
  cache.put(first, 'late', new Uint32Array([0]), 2);
  assert.equal(cache.get(third, 'q'), undefined);
  assert.equal(cache.get(third, 'late'), undefined);
  assert.equal(cache.select('one'), third);
});

test('query count and byte budgets evict least recently used rows', () => {
  const cache = createSourceBrowseCache(), token = cache.select('one');
  for (let i = 0; i < 32; i++) cache.put(token, String(i), new Uint32Array([i]), 100, 100);
  cache.get(token, '0', 101);
  cache.put(token, '32', new Uint32Array([32]), 100, 101);
  assert.equal(cache.get(token, '1', 102), undefined);
  assert.ok(cache.get(token, '0', 102));
  for (let i = 0; i < 7; i++) cache.put(token, 'large-' + i, Uint32Array.from({ length: 150000 }, (_, row) => row), 150000, 102);
  assert.equal(cache.get(token, 'large-0', 103), undefined);
  assert.ok(cache.get(token, 'large-1', 103));
  assert.ok(cache.get(token, 'large-6', 103));
});

test('expiry is fixed rather than prolonged by reads and rejects a rewound or invalid clock', () => {
  const cache = createSourceBrowseCache(), token = cache.select('one');
  cache.put(token, 'q', new Uint32Array([0]), 1, 1000);
  assert.ok(cache.get(token, 'q', 120999));
  assert.equal(cache.get(token, 'q', 121000), undefined);
  for (const now of [999, NaN]) {
    cache.put(token, 'q', new Uint32Array([0]), 1, 1000);
    assert.equal(cache.get(token, 'q', now), undefined);
  }
});

test('malformed rows are never reused; request errors evict only the matching active query', () => {
  const cache = createSourceBrowseCache(), token = cache.select('one');
  for (const rows of [new Uint32Array([3]), new Uint32Array([1, 1]), new Uint32Array([2, 1])]) {
    cache.put(token, 'bad', rows, 3);
    assert.equal(cache.get(token, 'bad'), undefined);
  }
  cache.put(token, 'q', new Uint32Array([1]), 3);
  cache.put(token, 'other', new Uint32Array([2]), 3);
  cache.remove(token - 1, 'q');
  assert.ok(cache.get(token, 'q'));
  cache.remove(token, 'q');
  assert.equal(cache.get(token, 'q'), undefined);
  assert.ok(cache.get(token, 'other'));
});
