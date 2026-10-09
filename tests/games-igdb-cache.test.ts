import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeIgdbRows } from '../src/lib/games/igdb-records.ts';
import { GameMetadataCache } from '../src/lib/games/metadata-cache.ts';
import { markSavedMetadata, savedMetadataAt } from '../src/lib/games/metadata-records.ts';
import { parseAtlasGame, igdbSteamIds } from '../src/lib/games/igdb-data.ts';
import { parseStudioProfile, parseStudioSearch } from '../src/lib/games/studio-data.ts';

const game = { id: 22, name: 'Example game', slug: 'example-game', summary: 'A game description.', cover: { image_id: 'co_example' }, artworks: [{ image_id: 'ar_example' }], screenshots: [{ image_id: 'sc_example' }], first_release_date: 1790700000, total_rating: 88, total_rating_count: 30, game_type: 0,
  platforms: [{ id: 6, name: 'PC', platform_logo: { image_id: 'pl_example' } }], genres: [{ id: 5, name: 'Shooter' }], collections: [{ id: 7, name: 'Series' }],
  external_games: [{ external_game_source: 1, uid: '123' }, { external_game_source: 3, uid: '999' }],
  involved_companies: [{ developer: true, publisher: true, company: { id: 20228, name: '2K', description: 'Publisher', logo: { image_id: 'cl_2k' }, parent: { id: 139, name: 'Take-Two Interactive', logo: { image_id: 'cl_parent' } } } }],
  similar_games: [{ id: 23, name: 'Related game', cover: { image_id: 'co_related' } }], parent_game: { id: 21, name: 'Base game', cover: { image_id: 'co_base' } } };

test('persisted game and studio metadata preserve exact identities, parent relationships and publisher imagery', () => {
  const rows = decodeIgdbRows([game])!;
  const parsed = parseAtlasGame(rows[0]), studio = parseStudioProfile(rows, 139);
  assert.equal(parsed.id, 'steam:123'); assert.equal(parsed.igdbId, 22); assert.equal(parsed.rating, 88);
  assert.equal(parsed.platformLinks[0].name, 'PC'); assert.equal(parsed.series[0].id, 7); assert.equal(parsed.parent?.igdbId, 21);
  assert.equal(parsed.related[0].igdbId, 23); assert.equal(parsed.developers[0].id, 20228);
  assert.equal(studio.children[0].id, 20228); assert.match(studio.image!, /cl_parent\.png$/);
  assert.deepEqual(igdbSteamIds(rows[0]), [123]);
});

test('company-only queries preserve usable logos and search results without requiring a game name', () => {
  const rows = decodeIgdbRows([{ id: game.id, involved_companies: game.involved_companies }])!;
  assert.equal(parseStudioSearch(rows, '2K')[0].id, 20228);
  assert.equal(parseStudioSearch(rows, 'Take-Two')[0].id, 139);
  assert.equal(decodeIgdbRows([{ id: 22 }]), null);
});

test('unknown fields, untrusted media paths and forged cache timestamps never enter persisted IGDB records', () => {
  const rows = decodeIgdbRows([{ ...game, cachedAt: 100, authorization: 'not-provider-data', artworkUrl: 'file:///private', screenshots: [{ image_id: '../escape' }, { image_id: 'valid' }], cover: { image_id: 'https://untrusted.invalid/image' } }])!;
  const parsed = parseAtlasGame(rows[0]);
  assert.equal(savedMetadataAt(rows), undefined); assert.equal((rows[0] as any).authorization, undefined);
  assert.equal(parsed.screenshots.length, 1); assert.ok(parsed.screenshots[0].startsWith('https://images.igdb.com/'));
  assert.equal(parsed.portrait, undefined);
  for (const bad of [null, {}, [{ id: -1, name: 'Bad' }], Array.from({ length: 101 }, () => game)]) assert.equal(decodeIgdbRows(bad), null);
});

test('old game details propagate their age into related/base games and company profiles', () => {
  const rows = markSavedMetadata(decodeIgdbRows([game])!, 1790780000000);
  const parsed = parseAtlasGame(rows[0]);
  assert.equal(parsed.cachedAt, 1790780000000); assert.equal(parsed.parent?.cachedAt, parsed.cachedAt); assert.equal(parsed.related[0].cachedAt, parsed.cachedAt);
  assert.equal(parseStudioProfile(rows, 139).cachedAt, parsed.cachedAt);
});

test('IGDB uses its existing thirty-minute freshness policy and restores older rows on outage', async () => {
  const now = 1790780000000, key = 'igdb:games:v1:query';
  const records = new Map([[key, { at: now - 21 * 60000, data: [game] }]]);
  const cache = new GameMetadataCache({ read: async key => records.get(key) ?? null, write: async (key, value) => { records.set(key, value as any); } }, () => now, () => true, 30 * 60000);
  const fresh = await cache.load<unknown[]>(key, async () => { throw Error('must not fetch'); });
  assert.equal(savedMetadataAt(fresh), undefined); assert.equal(parseAtlasGame(fresh[0]).name, game.name);
  const reopened = new GameMetadataCache({ read: async key => records.get(key) ?? null, write: async () => { throw Error('must not renew age'); } }, () => now + 20 * 60000, () => true, 30 * 60000);
  const old = await reopened.load<unknown[]>(key, async () => { throw Error('provider unavailable'); });
  assert.equal(savedMetadataAt(old), now - 21 * 60000); assert.equal(parseAtlasGame(old[0]).steamId, 123);
});

test('a genuinely empty saved search keeps its age and cannot be persisted as newly fetched data', async () => {
  const now = 1790780000000, key = 'igdb:games:v1:empty', at = now - 3600000;
  const cache = new GameMetadataCache({ read: async () => ({ at, data: [] }), write: async () => { throw Error('must not write fallback'); } }, () => now);
  const result = await cache.load<unknown[]>(key, async () => { throw Error('offline'); });
  assert.equal(result.length, 0); assert.equal(savedMetadataAt(result), at);
});
