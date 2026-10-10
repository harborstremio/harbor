import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecentSourceArtCache, recentArtworkKey, RECENT_ART_CACHE_BYTES } from '../src/lib/games/recent-source-art-cache.ts';
import { sourcePageUrl } from '../src/lib/games/source-page-url.ts';
import type { GameSource, SourceRelease } from '../src/lib/games/sources.ts';
import type { SourceGameArtwork } from '../src/lib/games/source-display.ts';

const source: GameSource = { id: 'source', name: 'Source', url: 'https://source.test/feed', format: 'harbor', entries: [], enabled: true, checkedAt: 1, skipped: 0 };
const file = (url: string) => ({ name: 'Mirror', kind: 'page' as const, url });
const release = (extra: Partial<SourceRelease> = {}): SourceRelease => ({ id: 'r', title: 'Game', kind: 'game', files: [file('https://mirror.test/download#key')], ...extra });
const art = (extra: Partial<SourceGameArtwork['game']> = {}): SourceGameArtwork => ({ match: 'exact', game: { id: 'steam:10', steamId: 10, name: 'Game', capsule: 'https://art.test/poster.jpg', platforms: ['Windows'], adultContent: true, ...extra } });

test('page identity preserves explicit pages, one same-site file and ambiguity', () => {
  assert.equal(sourcePageUrl(source, release()), undefined);
  assert.equal(sourcePageUrl(source, release({ files: [file('https://source.test/game#selected'), file('https://mirror.test/game')] })), 'https://source.test/game#selected');
  assert.equal(sourcePageUrl(source, release({ files: [file('https://source.test/a'), file('https://source.test/b')] })), undefined);
  assert.equal(sourcePageUrl(source, release({ sourcePage: 'https://publisher.test/game#section', files: [file('https://source.test/a'), file('https://source.test/b')] })), 'https://publisher.test/game');
  assert.equal(sourcePageUrl({ ...source, website: { kind: 'wordpress', site: 'https://site.test', api: 'https://site.test/api' } }, release({ files: [file('https://site.test/game#part')] })), 'https://site.test/game#part');
  assert.equal(sourcePageUrl(source, release({ files: [file('https://user:pass@source.test/a'), file('https://source.test.evil/a'), { ...file('https://source.test/direct'), kind: 'direct' }] })), undefined);
});

test('artwork identity ignores unrelated mirrors without shortening any download link', () => {
  const many = release({ files: Array.from({ length: 64 }, (_,i) => file(`https://mirror.test/${i}/${'x'.repeat(7900)}#key-${i}`)) });
  const before = JSON.stringify(many);
  assert.equal(recentArtworkKey(many, source), recentArtworkKey(release(), source));
  assert.ok(recentArtworkKey(many, source).length < 250);
  assert.equal(JSON.stringify(many), before);
  const explicit = release({ steamId: 10 });
  assert.equal(recentArtworkKey(explicit, source), recentArtworkKey({ ...explicit, files: [file('https://source.test/different')] }, source));
});

test('origin fast rejection agrees with standard URL parsing for noncanonical authorities', () => {
  for (const url of ['HTTPS://SOURCE.TEST:443/a', ' https://source.test/a ', 'https://sou\trce.test/a', 'https://source.test\n.evil/a', 'https://source.test\\a', 'https://source.test?x=/foreign.test', 'https://source.test#other', 'https://user@source.test/a', 'https://foreign.test/path/source.test', 'https:source.test/a', 'http://source.test/a', 'https://source.test.evil/a', 'https://source.test/%2f%2fforeign.test', 'https://foreign.test\\@source.test/a', 'https://source.test:99999/a']) {
    let expected: string | undefined;
    try { const parsed = new URL(url); if (parsed.origin === 'https://source.test' && !parsed.username && !parsed.password) expected = url; } catch {}
    assert.equal(sourcePageUrl(source, release({ files: [file(url)] })), expected, url);
  }
});

test('keys retain provider IDs, edition, platform, page, ambiguity and source/version identity', () => {
  const base = release({ files: [file('https://source.test/game#one')] });
  const original = recentArtworkKey(base, source);
  for (const change of [{ title: 'Game Deluxe' }, { steamId: 10 }, { igdbId: 10 }, { platform: 'Linux' }, { kind: 'mod' as const }, { sourcePage: 'https://source.test/other' }, { files: [file('https://source.test/game#two')] }, { files: [...base.files, file('https://source.test/other')] }]) {
    assert.notEqual(recentArtworkKey({ ...base, ...change }, source), original);
  }
  for (const change of [{ id: 'other' }, { name: 'Renamed' }, { url: 'https://other.test/feed' }, { checkedAt: 2 }, { homepage: 'https://other.test' }]) assert.notEqual(recentArtworkKey(base, { ...source, ...change }), original);
  const catalog = { profile: 'p1', version: 'v1', parts: 1, layout: { bytes: 10, ends: [1] }, storedEnds: [1], recent: [], recentAt: 1, recentUntil: 2 };
  const keyed = recentArtworkKey(base, { ...source, catalog });
  assert.notEqual(recentArtworkKey(base, { ...source, catalog: { ...catalog, profile: 'p2' } }), keyed);
  assert.notEqual(recentArtworkKey(base, { ...source, catalog: { ...catalog, version: 'v2' } }), keyed);
  assert.notEqual(recentArtworkKey(release({ steamId: 10, igdbId: 20 }), source), recentArtworkKey(release({ steamId: 11, igdbId: 20 }), source));
});

test('positive, source-listing and negative lifetimes expire and release accounting', () => {
  const cache = createRecentSourceArtCache();
  cache.remember('positive', art(), 100);
  cache.remember('listing', art({ sourceListing: { page: source.url, sourceName: source.name, description: 'Story', screenshots: [] } }), 100);
  cache.remember('negative', undefined, 100);
  assert.ok(cache.get('negative', 60_099)); assert.equal(cache.get('negative', 60_100), undefined);
  assert.ok(cache.get('listing', 300_099)); assert.equal(cache.get('listing', 300_100), undefined);
  assert.ok(cache.get('positive', 1_800_099)); assert.equal(cache.get('positive', 1_800_100), undefined);
  assert.deepEqual(cache.usage(), { bytes: 0, entries: 0 });
});

test('shared count/byte budgets evict least-recent results and allow their reloading', () => {
  const cache = createRecentSourceArtCache(RECENT_ART_CACHE_BYTES, 3);
  for (const key of ['a', 'b', 'c']) cache.remember(key, art(), 0);
  cache.get('a', 1); cache.remember('d', art(), 1);
  assert.equal(cache.get('b', 2), undefined); assert.ok(cache.get('a', 2));
  cache.remember('b', art({ name: 'Reloaded' }), 2); assert.equal(cache.get('b', 2)?.art?.game.name, 'Reloaded');
  const bounded = createRecentSourceArtCache(8_000, 144);
  for (let i=0;i<200;i++) bounded.remember('key'+i, art({ capsule: 'https://art.test/'+'x'.repeat(700) }), 0);
  assert.ok(bounded.usage().bytes <= 8_000); assert.ok(bounded.usage().entries > 0); assert.equal(bounded.get('key0', 1), undefined); assert.ok(bounded.get('key199', 1));
  bounded.remember('key199', art({ capsule: 'x'.repeat(10_000) }), 1); assert.equal(bounded.get('key199', 1), undefined);
});

test('cached metadata is detached and retains adult, platform, source and rich artwork fields', () => {
  const value = art({ sourceListing: { page: source.url, sourceName: source.name, description: 'Story', screenshots: ['https://art.test/one.png'] } });
  const cache = createRecentSourceArtCache(); cache.remember('a', value, 0);
  assert.deepEqual(cache.get('a', 1)?.art, value);
  value.game.platforms.push('Other'); value.game.sourceListing!.screenshots[0] = 'https://other.test';
  const held = cache.get('a', 1)!;
  assert.deepEqual(held.art?.game.platforms, ['Windows']); assert.equal(held.art?.game.adultContent, true);
  assert.equal(held.art?.game.sourceListing?.screenshots[0], 'https://art.test/one.png');
  assert.throws(() => held.art!.game.platforms.push('Mutation'), TypeError);
});

test('unknown graphs, getters, hidden properties and sparse/custom arrays are not cached', () => {
  const cache = createRecentSourceArtCache(); let called = false;
  const variants: object[] = [new Date(), new Map(), Object.assign(art(), { cycle: undefined }), Object.assign(art(), { extra: Array(1_000_000) })];
  (variants[2] as Record<string, unknown>).cycle = variants[2];
  const getter = art(); Object.defineProperty(getter.game, 'private', { enumerable: true, get() { called = true; return []; } }); variants.push(getter);
  const hidden = art(); Object.defineProperty(hidden.game, 'hidden', { value: Array(1000) }); variants.push(hidden);
  const custom = art(); Object.setPrototypeOf(custom.game, { retained: Array(1000) }); variants.push(custom);
  for (const value of variants) { cache.remember('a', value as SourceGameArtwork, 0); assert.equal(cache.get('a', 1), undefined); }
  assert.equal(called, false); assert.deepEqual(cache.usage(), { bytes: 0, entries: 0 });
});
