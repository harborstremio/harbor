import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReleaseHistory, gameAlternativeTitles, releasedOn } from '../src/lib/games/release-data.ts';
import { decodeIgdbRows } from '../src/lib/games/igdb-records.ts';
import { parseAtlasGame } from '../src/lib/games/igdb-data.ts';
import { createRomSpotlight, ROM_SPOTLIGHT_IDS, romGameArtwork } from '../src/lib/games/rom-editorial.ts';
import { createRomDiscovery, DEFAULT_ROM_FILTERS, ROM_PAGE_SIZE } from '../src/lib/games/rom-discovery.ts';
import { markSavedMetadata } from '../src/lib/games/metadata-records.ts';

const release = (id: number, platform = 19, extra = {}) => ({ id, platform: { id: platform, name: platform === 19 ? 'Super Nintendo' : 'Dreamcast' }, date: 900000000, date_format: 0, human: 'Jul 9, 1998', release_region: { id: 5, region: 'japan' }, ...extra });
test('release history survives cache validation without inventing dates, regions or precision', () => {
  const raw = { id: 1070, name: 'Original', release_dates: [release(1), release(2, 19, { date: 915148800, date_format: 2, human: '1999' }), release(3, 23, { date: undefined, status: { id: 5, name: 'Cancelled' } }), release(4, 19, { date: NaN }), { id: 5, platform: 19 }, release(1)], alternative_names: [{ name: 'Super Mario Bros. 4', comment: 'Japanese title' }, { name: 'Super Mario Bros. 4' }, { name: '   ' }] };
  const rows = decodeIgdbRows([raw])!; const game = parseAtlasGame(rows[0]);
  assert.deepEqual(game.releaseHistory, gameReleaseHistory(raw.release_dates));
  assert.equal(game.releaseHistory!.length, 4); assert.equal(game.releaseHistory!.find(r => r.id === 2)?.dateFormat, 2);
  assert.equal(game.releaseHistory!.find(r => r.id === 3)?.date, undefined);
  assert.equal(game.releaseHistory!.find(r => r.id === 3)?.status?.name, 'Cancelled');
  assert.equal(game.alternativeTitles?.length, 1); assert.equal(game.alternativeTitles?.[0].name, 'Super Mario Bros. 4');
  assert.deepEqual(gameAlternativeTitles(null), []);
});
test('classic eligibility uses platform, date and cancellation on the same release', () => {
  const cancelledPort = gameReleaseHistory([release(1, 6), release(2, 23, { status: { id: 5, name: 'Cancelled' } })]);
  assert.equal(releasedOn(cancelledPort, [23]), false);
  assert.equal(releasedOn(cancelledPort, [6]), true);
  assert.equal(releasedOn(gameReleaseHistory([release(3, 19, { date: 4000000000 })]), [19]), false);
  assert.equal(releasedOn(gameReleaseHistory([release(3, 19, { date_format: 7 })]), [19]), false);
  assert.equal(releasedOn(undefined, [19]), false);
});
test('classic page removes cancelled ports and keeps raw continuation for further discovery', async () => {
  const raw = Array.from({ length: ROM_PAGE_SIZE }, (_, index) => ({ id: index + 1, name: `Game ${index}`, release_dates: [release(index + 1, 23, index === 0 ? {} : { status: { id: 5, name: 'Cancelled' } })] }));
  const source = createRomDiscovery({ query: async () => raw, snapshot: async () => raw });
  const page = await source.load({ ...DEFAULT_ROM_FILTERS, scope: 'classics' });
  assert.deepEqual(page.games.map(g => g.igdbId), [1]); assert.equal(page.nextOffset, ROM_PAGE_SIZE);
  assert.equal((await source.load(DEFAULT_ROM_FILTERS)).games.length, ROM_PAGE_SIZE);
  assert.deepEqual((await source.snapshot({ ...DEFAULT_ROM_FILTERS, scope: 'classics' }))?.games, page.games);
});
test('spotlight preserves exact original identity, source order, cached age and artwork isolation', async () => {
  const rows = ROM_SPOTLIGHT_IDS.toReversed().map(id => ({ id, name: `Original ${id}`, game_type: id === 1517 ? 10 : 0, external_games: [{ external_game_source: 1, uid: '123' }] }));
  const api = createRomSpotlight({ query: async () => rows, snapshot: async () => markSavedMetadata(rows, 123456) });
  const page = await api.load(); assert.deepEqual(page.games.map(g => g.igdbId), [...ROM_SPOTLIGHT_IDS]);
  assert.ok(page.games.every(g => g.id === `igdb:${g.igdbId}`)); assert.equal((await api.snapshot())?.cachedAt, 123456);
  assert.ok(ROM_SPOTLIGHT_IDS.every(id => romGameArtwork(id)?.logo.startsWith('/games/roms/')));
  assert.equal(romGameArtwork(999999), undefined);
  const abort = new AbortController(); abort.abort(); await assert.rejects(api.load(abort.signal));
  const outage = createRomSpotlight({ query: async () => { throw Error('offline'); }, snapshot: async () => { throw Error('offline'); } });
  assert.equal(await outage.snapshot(), null); await assert.rejects(outage.load(), /offline/);
});
