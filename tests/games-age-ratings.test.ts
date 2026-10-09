import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ageRatingRecords, chooseAgeRatings, parseAgeRatings } from '../src/lib/games/age-ratings.ts';
import { decodeIgdbRows } from '../src/lib/games/igdb-records.ts';
import { parseAtlasGame } from '../src/lib/games/igdb-data.ts';
import { GameMetadataCache } from '../src/lib/games/metadata-cache.ts';

// Public IGDB response through Harbor's production proxy, October 3, 2026.
const live = JSON.parse(readFileSync(new URL('./fixtures/igdb-age-ratings.json', import.meta.url), 'utf8'));
const raw = live[0].age_ratings;
const steam = { agency: 'ESRB', rating: 'M', image: 'https://store.akamai.steamstatic.com/public/shared/images/game_ratings/ESRB/m.png', descriptors: ['Violence'], interactive: '', };

test('current published organization/category data survives public decoding and Atlas parsing', () => {
  const decoded = decodeIgdbRows(live)!;
  assert(decoded);
  const game = parseAtlasGame(decoded[0]);
  assert.equal(game.igdbId, 1942);
  assert.equal(game.ageRatings?.length, 2);
  assert.equal(game.ageRatings?.find(r => r.agency === 'ESRB')?.rating, 'M');
  assert.equal(game.ageRatings?.find(r => r.agency === 'PEGI')?.rating, '18');
  assert(game.ageRatings?.find(r => r.agency === 'ESRB')?.descriptors.includes('Blood and Gore'));
  assert(game.ageRatings?.find(r => r.agency === 'PEGI')?.descriptors.includes('Violence'));
});

test('preferences select actual published ratings, preserve attribution and never invent artwork', () => {
  const ratings = parseAgeRatings(raw), url = 'https://www.igdb.com/games/the-witcher-3-wild-hunt';
  const esrb = chooseAgeRatings(ratings, 'ESRB', steam, url);
  const pegi = chooseAgeRatings(ratings, 'PEGI', steam, url);
  assert.deepEqual(esrb.map(r => r.agency), ['ESRB']);
  assert.deepEqual(pegi.map(r => r.agency), ['PEGI']);
  assert.equal(pegi[0].rating, '18');
  assert.equal(pegi[0].image, '');
  assert.deepEqual(pegi[0].source, { name: 'IGDB', url });
  assert.deepEqual(chooseAgeRatings([], 'PEGI', steam), [steam]);
  assert.deepEqual(chooseAgeRatings(undefined, 'ESRB', undefined), []);
  assert.deepEqual(chooseAgeRatings(ratings.filter(r => r.agency === 'PEGI'), 'ESRB', steam), [steam]);
  assert.equal(chooseAgeRatings(ratings.filter(r => r.agency === 'PEGI'), 'ESRB')[0].agency, 'PEGI');
});

test('unrelated agencies, mismatched names, legacy values and malformed text cannot be relabeled', () => {
  const valid = raw.find((r: any) => r.organization.id === 1);
  for (const bad of [null, {}, { category: 1, rating: 6 }, { ...valid, organization: { id: 2, name: 'ESRB' } }, { ...valid, rating_category: { rating: 'M\n' } }, { ...valid, rating_category: { rating: 'x'.repeat(33) } }]) assert.deepEqual(parseAgeRatings([bad]), []);
  assert.deepEqual(parseAgeRatings(Array.from({ length: 65 }, () => valid)), []);
  const cleaned = ageRatingRecords([{ ...valid, account: 'private', rating_content_descriptions: [{ description: 'Valid', password: 'private' }, { description: 'bad\ntext' }] }]);
  assert(!JSON.stringify(cleaned).includes('private'));
  assert.deepEqual(parseAgeRatings(cleaned)[0].descriptors, ['Valid']);
});

test('duplicate records merge descriptors but conflicting published ratings remain distinct', () => {
  const record = { organization: { id: 1, name: 'ESRB' }, rating_category: { rating: 'M' }, rating_content_descriptions: [{ description: 'Violence' }] };
  const result = parseAgeRatings([record, { ...record, rating_content_descriptions: [{ description: 'Language' }, { description: 'Violence' }] }, { ...record, rating_category: { rating: 'T' } }]);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].descriptors, ['Violence', 'Language']);
  assert.deepEqual(chooseAgeRatings(result, 'ESRB').map(r => r.rating), ['M', 'T']);
});

test('persisted ratings survive reopen and an offline refresh without changing their age', async () => {
  const records = new Map<string, any>(), key = 'igdb:games:v1:age-ratings', at = 1791058000000;
  const store = { read: async (key: string) => records.get(key) ?? null, write: async (key: string, value: unknown) => { records.set(key, value); } };
  const first = new GameMetadataCache(store, () => at, () => true, 1000);
  await first.load(key, async () => decodeIgdbRows(live)!);
  const reopened = new GameMetadataCache(store, () => at + 2000, () => true, 1000);
  const result = await reopened.load<unknown[]>(key, async () => { throw Error('offline'); });
  assert.equal(parseAtlasGame(result[0]).ageRatings?.length, 2);
  assert.equal(parseAtlasGame(result[0]).cachedAt, at);
  assert.equal(records.get(key).at, at);
});
