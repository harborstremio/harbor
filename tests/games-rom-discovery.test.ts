import test from 'node:test';
import assert from 'node:assert/strict';
import { createRomDiscovery, DEFAULT_ROM_FILTERS, ROM_PAGE_SIZE, ROM_PLATFORM_IDS, ROM_PLATFORMS, ROM_CLASSIC_PLATFORM_IDS, romDiscoveryQuery, romFranchises } from '../src/lib/games/rom-discovery.ts';
import { parseAtlasGame } from '../src/lib/games/igdb-data.ts';

const record = (id: number, extra: Record<string, unknown> = {}) => ({ id, name: `Game ${id}`, platforms: [{ id: 24, name: 'Game Boy Advance', platform_logo: { image_id: 'pl74' } }], ...extra });
const sources = (query: (body: string, signal?: AbortSignal) => Promise<unknown[]>) => createRomDiscovery({ query, snapshot: async () => null });

test('studio and collection discovery apply to every provider page without a rating cutoff', () => {
  const query = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, scope: 'classics', studio: 70, directory: true }, 72);
  assert.match(query, /involved_companies.company = \(70\)/);
  assert.match(query, /\(franchises != null \| collections != null\)/);
  assert.match(query, /offset 72;/);
  assert.doesNotMatch(query, /total_rating >=|total_rating_count >=/);
  assert.throws(() => romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, studio: -1 }), /studio/);
});

test('default discovery leads with classic systems while explicit consoles and search keep the full catalog', () => {
  const classic = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, scope: 'classics', collection: 'rated' });
  assert.ok(classic.includes(`platforms = (${ROM_CLASSIC_PLATFORM_IDS.join(',')})`));
  assert.ok(classic.includes('game_type = (0,8,9,10,11)')); assert.ok(classic.includes('version_parent = null'));
  for (const id of [9, 12, 41]) assert.ok(!ROM_CLASSIC_PLATFORM_IDS.includes(id));
  for (const platform of [9, 12, 37]) {
    const explicit = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, scope: 'classics', platform });
    assert.ok(explicit.includes(`platforms = (${ROM_PLATFORM_IDS.join(',')})`));
    assert.ok(explicit.includes(`platforms = (${platform})`));
  }
  const search = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, scope: 'classics', query: 'Portal', sort: 'relevance' });
  assert.ok(search.includes(`platforms = (${ROM_PLATFORM_IDS.join(',')})`));
  assert.ok(!search.includes('game_type ='));
  assert.throws(() => romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, scope: 'invalid' as 'all' }), /scope/);
});

test('ROM catalog scope includes classic consoles without restricting games to an editorial list or artwork availability', () => {
  for (const id of [4, 5, 7, 8, 9, 11, 12, 18, 19, 20, 21, 22, 23, 24, 29, 32, 33, 35, 37, 38, 41, 64]) assert.ok(ROM_PLATFORM_IDS.includes(id));
  assert.equal(new Set(ROM_PLATFORM_IDS).size, ROM_PLATFORMS.length);
  assert.ok(ROM_PLATFORMS.every(platform => platform.name && platform.short));
  assert.ok(!ROM_PLATFORM_IDS.includes(167)); assert.ok(!ROM_PLATFORM_IDS.includes(508));
  const query = romDiscoveryQuery(DEFAULT_ROM_FILTERS);
  assert.match(query, /limit 36; offset 0;/);
  assert.doesNotMatch(query, /(?:where|&) id =|cover !=|version_parent =|game_type =/);
  assert.match(query, /franchises.name/); assert.match(query, /genres.name/);
});

test('console, genre, era and live franchise filters intersect without leaking user query syntax', () => {
  const query = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, platform: 24, genre: 12, era: '2000', sort: 'name', relationship: { kind: 'franchise', id: 42 }, query: 'x"; where id = 1; \\ z\n' }, 36);
  assert.match(query, /platforms = \(24\)/); assert.match(query, /genres = \(12\)/);
  assert.match(query, /franchises = \(42\)/); assert.match(query, /first_release_date >= 946684800/);
  assert.match(query, /first_release_date < 1262304000/); assert.match(query, /sort name asc/);
  assert.match(query, /offset 36;/); assert.equal((query.match(/"/g) ?? []).length, 4);
  assert.doesNotMatch(query, /search "/);
  assert.match(romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, relationship: { kind: 'series', id: 42 } }), /collections = \(42\)/);
});

test('relevance uses provider search for accents and aliases while explicit sorts stay global', () => {
  const relevant = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, query: 'Pokemon FireRed', sort: 'relevance' });
  assert.match(relevant, /search "Pokemon FireRed";/); assert.doesNotMatch(relevant, /sort |name ~/);
  const sorted = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, query: 'Pokemon', sort: 'name' });
  assert.match(sorted, /alternative_names.name/); assert.match(sorted, /sort name asc;/); assert.doesNotMatch(sorted, /search /);
  assert.match(romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, sort: 'relevance' }), /sort total_rating_count desc;/);
});

test('ROM collections and ranking retain explicit evidence thresholds', () => {
  const rated = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, collection: 'rated' });
  assert.match(rated, /total_rating >= 80/); assert.match(rated, /total_rating_count >= 20/);
  assert.match(romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, sort: 'rated' }), /total_rating_count >= 5/);
  assert.match(romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, collection: 'coop' }), /game_modes = \(3\)/);
  assert.match(romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, collection: 'platformer' }), /genres = \(8\)/);
  assert.match(romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, collection: 'rpg' }), /genres = \(12\)/);
});

test('invalid provider IDs, filters and offsets fail before a request can start', async () => {
  let requests = 0; const api = sources(async () => { requests++; return []; });
  for (const filters of [{ platform: 167 }, { genre: -1 }, { genre: 1.5 }, { era: 'bad' }, { sort: 'bad' }, { collection: 'bad' }, { relationship: { kind: 'name', id: 42 } }, { relationship: { kind: 'franchise', id: 0 } }]) {
    await assert.rejects(api.load({ ...DEFAULT_ROM_FILTERS, ...filters } as never));
  }
  for (const offset of [-1, 0.5, NaN, Infinity]) await assert.rejects(api.load(DEFAULT_ROM_FILTERS, offset));
  assert.equal(requests, 0);
});

test('page continuation uses raw provider rows while distinct console IDs retain their identity', async () => {
  const sharedPort = { external_games: [{ external_game_source: 1, uid: '77' }] };
  const rows = Array.from({ length: ROM_PAGE_SIZE }, (_, index) => record(index === 35 ? 1 : index + 1, sharedPort));
  const page = await sources(async () => rows).load(DEFAULT_ROM_FILTERS, 36);
  assert.equal(page.games.length, 35); assert.equal(page.nextOffset, 72);
  assert.equal(new Set(page.games.map(game => game.igdbId)).size, 35);
  assert.equal(new Set(page.games.map(game => game.id)).size, 35);
  assert.ok(page.games.every(game => game.id === `igdb:${game.igdbId}` && game.steamId === 77));
  assert.equal(page.platforms[0].image, 'https://images.igdb.com/igdb/image/upload/t_logo_med/pl74.png');
  assert.equal((await sources(async () => [record(1)]).load()).nextOffset, null);
  assert.equal('total' in page, false);
});

test('franchise and series IDs are separate, source-backed and counted only as loaded examples', () => {
  const one = parseAtlasGame(record(1, { franchises: [{ id: 50, name: 'Actual franchise' }], collections: [{ id: 50, name: 'Actual series' }], screenshots: [{ image_id: 'screen1' }] }));
  const two = parseAtlasGame(record(2, { franchises: [{ id: 50, name: 'Actual franchise' }] }));
  const groups = romFranchises([one, two, one]);
  assert.equal(groups.length, 2); assert.equal(groups[0].kind, 'franchise');
  assert.deepEqual(groups[0].games.map(game => game.igdbId), [1, 2]);
  assert.match(groups[0].image!, /screen1.jpg$/); assert.equal(groups[1].kind, 'series');
});

test('saved snapshots keep oldest cache age and share the exact live request key', async () => {
  let key = ''; const saved = Object.assign([record(1, { cachedAt: 1200 })], { cachedAt: 1500 });
  const api = createRomDiscovery({ query: async body => { key = body; return saved; }, snapshot: async body => { assert.equal(body, key); return saved; } });
  const live = await api.load(); const held = await api.snapshot();
  assert.equal(live.cachedAt, 1200); assert.deepEqual(held, live);
  assert.equal(await createRomDiscovery({ query: async () => [], snapshot: async () => { throw Error('disk'); } }).snapshot(), null);
});

test('errors stay retryable and aborted or malformed replies cannot become empty success', async () => {
  let attempt = 0;
  const api = sources(async () => { if (attempt++ === 0) throw Error('IGDB 503'); return [record(2)]; });
  await assert.rejects(api.load(), /503/); assert.equal((await api.load()).games[0].igdbId, 2);
  const controller = new AbortController();
  const late = sources(async (_body, signal) => { assert.equal(signal, controller.signal); controller.abort(); return [record(1)]; });
  await assert.rejects(late.load(DEFAULT_ROM_FILTERS, 0, controller.signal), { name: 'AbortError' });
  await assert.rejects(sources(async () => [{ name: 'Missing ID' }]).load(), /Invalid game record/);
  assert.deepEqual((await sources(async () => []).load()).games, []);
});


test('console search, collection and deeper filters always retain their platform boundary', () => {
  const query=romDiscoveryQuery({...DEFAULT_ROM_FILTERS,scope:'classics',platform:24,query:'Mario',mode:2,perspective:4,relationship:{kind:'series',id:42}},36);
  assert.match(query,/platforms = \(24\)/);
  assert.match(query,/game_modes = \(2\)/);
  assert.match(query,/player_perspectives = \(4\)/);
  assert.match(query,/collections = \(42\)/);
  assert.match(query,/name ~ \*"Mario"\*/);
  assert.match(query,/offset 36/);
  for (const field of ['mode','perspective']) for (const id of [-1,0,1.5,Infinity,NaN]) assert.throws(()=>romDiscoveryQuery({...DEFAULT_ROM_FILTERS,[field]:id}));
});

test('year filter retains exact UTC boundaries across continuation pages', () => {
  for (const offset of [0, 72]) {
    const query = romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, collection: 'rated', year: 1998 }, offset);
    assert.ok(query.includes(`first_release_date >= ${Date.UTC(1998, 0, 1) / 1000}`));
    assert.ok(query.includes(`first_release_date < ${Date.UTC(1999, 0, 1) / 1000}`));
  }
  for (const year of [NaN, 1998.5, 1949, 9999]) assert.throws(() => romDiscoveryQuery({ ...DEFAULT_ROM_FILTERS, year }), /year/);
});
