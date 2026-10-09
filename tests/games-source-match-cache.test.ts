import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceMatchCache, type CachedSourceMatch } from '../src/lib/games/source-match-cache.ts';

const result = (title = 'Example', length = 0): CachedSourceMatch => ({ release: { id: title, title, kind: 'game', files: [{ name: 'Game.zip', kind: 'direct', url: 'https://example.org/game.zip?key=' + 'x'.repeat(length) }] }, match: 'title' });

test('the shared budget evicts old results even while all source snapshots remain alive', () => {
  const cache = createSourceMatchCache(6000), owners = Array.from({ length: 12 }, () => ({}));
  for (const owner of owners) { cache.remember(owner, 'game', [result('Game', 700)]); assert.ok(cache.usage().bytes <= 6000); }
  assert.equal(cache.get(owners[0], 'game'), undefined);
  assert.equal(cache.get(owners.at(-1)!, 'game')?.[0].release.title, 'Game');
});

test('global and per-owner query limits include empty matches and update recency', () => {
  const cache = createSourceMatchCache(1e6, 3, 100, 2), first = {}, second = {};
  cache.remember(first, 'a', []); cache.remember(first, 'b', []); assert.deepEqual(cache.get(first, 'a'), []);
  cache.remember(first, 'c', []); assert.equal(cache.get(first, 'b'), undefined);
  cache.remember(second, 'd', []); cache.remember(second, 'e', []);
  assert.equal(cache.usage().queries, 3); assert.equal(cache.get(first, 'a'), undefined); assert.deepEqual(cache.get(first, 'c'), []);
});

test('record count and oversized values cannot retain an unbounded result set', () => {
  const cache = createSourceMatchCache(1e6, 512, 3), first = {}, second = {};
  cache.remember(first, 'a', [result('A'), result('B')]); cache.remember(second, 'b', [result('C'), result('D')]);
  assert.equal(cache.usage().matches, 2); assert.equal(cache.get(first, 'a'), undefined);
  cache.remember(second, 'b', [result('Too large', 1e6)]); assert.equal(cache.get(second, 'b'), undefined); assert.deepEqual(cache.usage(), { bytes: 0, matches: 0, queries: 0 });
  cache.remember(first, 'large-count', Array.from({ length: 1001 }, () => result())); assert.equal(cache.usage().queries, 0);
});

test('replacement removes old accounting; owners and query identities remain separate', () => {
  const cache = createSourceMatchCache(), a = {}, b = {};
  cache.remember(a, 'same', [result('A')]); const before = cache.usage();
  cache.remember(a, 'same', [result('A')]); assert.deepEqual(cache.usage(), before);
  cache.remember(b, 'same', [result('B')]); assert.equal(cache.get(a, 'same')?.[0].release.title, 'A'); assert.equal(cache.get(b, 'same')?.[0].release.title, 'B');
});

test('cached tuples discard source back-references and reject unknown nested payloads', () => {
  const cache = createSourceMatchCache(), owner = {}, source = { entries: new Array(10000) };
  const input = [{ ...result(), source }]; cache.remember(owner, 'safe', input);
  assert.equal('source' in cache.get(owner, 'safe')![0], false);
  input[0].match = 'identity'; assert.equal(cache.get(owner, 'safe')![0].match, 'title');
  const nested = result(); Object.assign(nested.release, { unexpected: source }); cache.remember(owner, 'nested', [nested]); assert.equal(cache.get(owner, 'nested'), undefined);
  const cycle = result(); Object.assign(cycle.release.files[0], { owner: cycle.release }); cache.remember(owner, 'cycle', [cycle]); assert.equal(cache.get(owner, 'cycle'), undefined);
  const hidden = result(); Object.defineProperty(hidden.release, 'hiddenOwner', { value: source }); cache.remember(owner, 'hidden', [hidden]); assert.equal(cache.get(owner, 'hidden'), undefined);
  const getter = result(); Object.defineProperty(getter.release, 'title', { get: () => { throw Error('Do not invoke a getter'); }, enumerable: true }); cache.remember(owner, 'getter', [getter]); assert.equal(cache.get(owner, 'getter'), undefined);
});

test('all optional strings, file mirrors and UTF-16 payloads participate in the budget', () => {
  const cache = createSourceMatchCache(4000), owner = {}, value = result();
  Object.assign(value.release, { sourcePage: 'https://example.org/' + '界'.repeat(2000), platform: 'Linux', version: '1', date: '2026-10-01', size: '1GB', steamId: 1 });
  cache.remember(owner, 'unicode', [value]); assert.equal(cache.get(owner, 'unicode'), undefined);
  const mirrors = result(); mirrors.release.files = Array.from({ length: 64 }, () => ({ name: 'File', kind: 'page' as const, url: 'https://example.org/', sha256: 'a'.repeat(64), sizeBytes: 10 }));
  cache.remember(owner, 'mirrors', [mirrors]); assert.equal(cache.get(owner, 'mirrors'), undefined);
});
