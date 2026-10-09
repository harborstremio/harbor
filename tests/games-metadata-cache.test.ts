import assert from 'node:assert/strict';
import test from 'node:test';
import { GameMetadataCache, METADATA_FRESH_MS, METADATA_MAX_AGE } from '../src/lib/games/metadata-cache.ts';
import { decodeGameMetadata, markSavedMetadata, savedMetadataAt } from '../src/lib/games/metadata-records.ts';
import type { MetadataEntry } from '../src/lib/games/metadata-store.ts';
import type { GameDetail, GameDiscovery } from '../src/lib/games/types.ts';

const NOW = 1_790_786_400_000;
test('explicit release refresh bypasses fresh cache, persists new plans and retains labeled outage data',async()=>{
  const disk=storage(),cache=new GameMetadataCache(disk,()=>NOW);let calls=0;
  const initial={steamId:620,release:'2030',comingSoon:true};
  await cache.load('steam-release:620',async()=>{calls++;return initial;});
  assert.equal((await cache.load('steam-release:620',async()=>{calls++;return {...initial,release:'2031'};})).release,'2030');
  assert.equal(calls,1);
  const changed=await cache.load('steam-release:620',async()=>{calls++;return {...initial,release:'2031'};},new AbortController().signal,true);
  assert.equal(changed.release,'2031');assert.equal(calls,2);
  const outage=await cache.load<typeof initial & {cachedAt?:number}>('steam-release:620',async()=>{throw Error('offline');},undefined,true);
  assert.equal(outage.release,'2031');assert.equal(outage.cachedAt,NOW);
  assert.equal(decodeGameMetadata('steam-release:620',{...initial,steamId:999}),null);
  assert.equal(decodeGameMetadata('steam-release:620',{...initial,comingSoon:'false'}),null);
});
const game: GameDetail = { id: 'steam:620', steamId: 620, name: 'Portal 2', capsule: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/header.jpg', platforms: ['Windows'], price: { amount: 999, currency: 'USD', discount: 0 }, description: 'A puzzle game', about: 'About Portal 2', hero: '', logo: '', screenshots: [], trailers: [], genres: ['Puzzle'], features: [], developers: ['Valve'], publishers: ['Valve'], release: '2011', comingSoon: false, requirements: { minimum: '', recommended: '' }, languages: 'English' };
test('old screenshots remain readable and thumbnail maps cannot introduce images outside the validated collection', () => {
 const full=game.capsule.replace('header.jpg','ss_a.jpg'),thumb=full.replace('.jpg','.600x338.jpg'),unrelated=full.replace('ss_a','ss_b');
 const old=decodeGameMetadata('game:620',{...game,screenshots:[full]}) as GameDetail;
 assert.deepEqual(old.screenshots,[full]);assert.deepEqual(old.screenshotThumbnails,{});
 const restored=decodeGameMetadata('game:620',{...game,screenshots:[full],screenshotThumbnails:{[full]:thumb,[unrelated]:thumb}}) as GameDetail;
 assert.deepEqual(restored.screenshotThumbnails,{[full]:thumb});
 assert.deepEqual((decodeGameMetadata('game:620',{...game,screenshots:[full],screenshotThumbnails:{[full]:'https://evil.test/a.jpg'}}) as GameDetail).screenshotThumbnails,{});
});
function storage(entry?: MetadataEntry) {
  const records = new Map<string, MetadataEntry>(entry ? [['game:620', entry]] : []);
  const writes: string[] = [];
  return { records, writes, read: async (key: string) => records.get(key) ?? null, write: async (key: string, value: MetadataEntry) => { writes.push(key); records.set(key, structuredClone(value)); } };
}

test('a new cache instance reuses a recent saved record without a network request', async () => {
  const disk = storage();
  await new GameMetadataCache(disk, () => NOW).load('game:620', async () => game);
  const value = await new GameMetadataCache(disk, () => NOW + 1000).load<GameDetail>('game:620', async () => { throw Error('must not fetch'); });
  assert.equal(value.name, game.name); assert.equal(value.price?.amount, 999); assert.equal(value.cachedAt, undefined);
});
test('paged store selections keep provider cursors and availability through disk reload and outages', async () => {
  const disk=storage(),key='catalog:selection:filter=popularcomingsoon&start=30';
  await new GameMetadataCache(disk,()=>NOW).load(key,async()=>({games:[{...game,comingSoon:true}],total:123,nextOffset:60}));
  const fresh=await new GameMetadataCache(disk,()=>NOW+1000).load<{games:GameDetail[];nextOffset:number}>(key,async()=>{throw Error('should reuse page');});
  assert.equal(fresh.nextOffset,60);assert.equal(fresh.games[0].comingSoon,true);
  const old=await new GameMetadataCache(disk,()=>NOW+METADATA_FRESH_MS+1).load(key,async()=>{throw Error('503');});
  assert.equal(savedMetadataAt(old),NOW);
});

test('Steam feature IDs survive disk reload and reject malformed categories', async () => {
 const disk=storage();
 await new GameMetadataCache(disk,()=>NOW).load('game:620',async()=>({...game,features:['Co-op'],featureCategories:[{id:9,name:'Co-op'},{id:-3,name:'Invalid'}]}));
 const value=await new GameMetadataCache(disk,()=>NOW+1000).load<GameDetail>('game:620',async()=>{throw Error('must not fetch');});
 assert.deepEqual(value.featureCategories,[{id:9,name:'Co-op'}]);
 assert.deepEqual(value.features,['Co-op']);
});

test('an older snapshot appears immediately and keeps its original age and no current price after an outage', async () => {
  const at = NOW - METADATA_FRESH_MS - 1, disk = storage({ at, data: game });
  const cache = new GameMetadataCache(disk, () => NOW);
  const peek = await cache.peek<GameDetail>('game:620'); assert.equal(peek?.cachedAt, at); assert.equal(peek?.price, undefined);
  const value = await cache.load<GameDetail>('game:620', async () => { throw Error('503'); });
  assert.equal(value.name, game.name); assert.equal(value.cachedAt, at); assert.equal(value.price, undefined);
  assert.equal(disk.writes.length, 0); assert.equal(disk.records.get('game:620')?.at, at);
  const recovered = await cache.load('game:620', async () => ({ ...game, price: { amount: 799, currency: 'USD', discount: 20 } }));
  assert.equal(recovered.price?.amount, 799); assert.equal(recovered.cachedAt, undefined); assert.equal(disk.records.get('game:620')?.at, NOW);
});

test('offline results are labeled even when recent, while cancellation never falls back to an old result', async () => {
  const disk = storage({ at: NOW, data: game });
  const offline = await new GameMetadataCache(disk, () => NOW, () => false).load<GameDetail>('game:620', async () => { throw Error('must not fetch'); });
  assert.equal(offline.cachedAt, NOW); assert.equal(offline.price, undefined);
  const old = storage({ at: NOW - METADATA_FRESH_MS - 1, data: game }), controller = new AbortController();
  await assert.rejects(new GameMetadataCache(old, () => NOW).load('game:620', async () => { controller.abort(); throw Error('cancelled'); }, controller.signal), { name: 'AbortError' });
});

test('expired, future, wrong-identity and empty discovery records do not turn into successful cached results', async () => {
  for (const entry of [{ at: NOW - METADATA_MAX_AGE - 1, data: game }, { at: NOW + 61000, data: game }, { at: NOW, data: { ...game, steamId: 999 } }, { at: NaN, data: game }]) {
    const cache = new GameMetadataCache(storage(entry), () => NOW);
    assert.equal(await cache.peek('game:620'), null);
    await assert.rejects(cache.load('game:620', async () => { throw Error('unavailable'); }), /unavailable/);
  }
  assert.equal(decodeGameMetadata('discovery:home:us:en', { source: 'Steam', fetchedAt: NOW, shelves: [] }), null);
  assert.equal(decodeGameMetadata('discovery:home:us:en', { source: 'Steam', fetchedAt: NOW, shelves: [{ id: 'top_sellers', games: [] }] }), null);
});

test('blocked storage and quota failures do not prevent fresh metadata loading', async () => {
  const cache = new GameMetadataCache({ read: async () => { throw Error('blocked'); }, write: async () => { throw Error('quota'); } }, () => NOW);
  assert.equal(await cache.peek('game:620'), null);
  assert.equal((await cache.load('game:620', async () => game)).name, game.name);
  assert.equal((await cache.load<GameDetail>('game:620', async () => { throw Error('memory should survive'); })).name, game.name);
});

test('simultaneous public reads share work; signaled requests have independent cancellation', async () => {
  const cache = new GameMetadataCache(storage(), () => NOW); let count = 0;
  const fetch = async () => { count++; await new Promise(resolve => setTimeout(resolve, 5)); return game; };
  const results = await Promise.all([cache.load('game:620', fetch), cache.load('game:620', fetch)]);
  assert.equal(count, 1); assert.equal(results[0], results[1]);
  const separate = new GameMetadataCache(storage(), () => NOW), controller = new AbortController();
  const first = separate.load('game:620', fetch, controller.signal).catch(error => error.name);
  const second = separate.load('game:620', fetch, new AbortController().signal);
  controller.abort(); assert.equal(await first, 'AbortError'); assert.equal((await second).name, game.name);
});

test('mixed-age discovery preserves the oldest timestamp and never writes an old child with a fresh age', async () => {
  const disk = storage(), cache = new GameMetadataCache(disk, () => NOW), at = NOW - 5000000;
  const discovery: GameDiscovery = { source: 'Steam', fetchedAt: NOW, shelves: [{ id: 'top_sellers', games: [markSavedMetadata(game, at)] }] };
  assert.equal(savedMetadataAt({ ...discovery, cachedAt: NOW - 100 }), at);
  const value = await cache.load('discovery:us:en', async () => discovery);
  assert.equal(savedMetadataAt(value), at); assert.equal(disk.writes.length, 0);
});

test('saved metadata validates media origins and retains valid catalog pagination and release data', () => {
  const parsed = decodeGameMetadata('game:620', { ...game, hero: 'https://untrusted.invalid/a', trailers: [{ url: 'file:///C:/private.mp4' }], screenshots: ['https://shared.fastly.steamstatic.com/test.jpg', 'javascript:bad'] }) as GameDetail;
  assert.equal(parsed.hero, game.capsule); assert.equal(parsed.trailers.length, 0); assert.equal(parsed.screenshots.length, 1);
  const page = decodeGameMetadata('catalog:test', { games: [{ ...game, releaseTimestamp: 12345 }], total: 90, nextOffset: 30 }) as { games: GameDetail[]; nextOffset: number };
  assert.equal(page.nextOffset, 30); assert.equal(page.games[0].releaseTimestamp, 12345);
  assert.equal(decodeGameMetadata('catalog:test', { games: [], total: 'bad', nextOffset: -1 }), null);
});
