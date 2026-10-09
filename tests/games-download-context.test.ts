import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloadContextStore, DOWNLOAD_CONTEXT_KEY } from '../src/lib/games/download-context.ts';

const game = { id: 'steam:1536610', name: 'OpenTTD', artwork: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1536610/library_hero.jpg?t=1773680448', sourceName: 'Official release' };
const savedGame = { ...game, artwork: game.artwork.split('?')[0], logo: undefined };
function memoryStorage(initial: string | null = null) {
  let value = initial, reads = 0, writes = 0;
  return { getItem(key: string) { assert.equal(key, DOWNLOAD_CONTEXT_KEY); reads++; return value; }, setItem(key: string, next: string) { assert.equal(key, DOWNLOAD_CONTEXT_KEY); writes++; value = next; }, get value() { return value; }, get reads() { return reads; }, get writes() { return writes; } };
}
const record = (profile = 'alice', id = 'transfer-1') => ({ profile, id, name: 'unrelated filename.zip', status: 'complete', received: 123, bytesPerSecond: 0, url: 'https://private.example/download?token=secret' });

test('exact profile/kind/id associations survive reload without persisting URLs or changing engine state', () => {
  const storage = memoryStorage(), store = createDownloadContextStore(storage);
  store.remember('alice', 'http', 'transfer-1', game);
  assert.deepEqual(store.merge('http', record()), { ...record(), game: savedGame });
  assert.strictEqual(store.merge('http', record('bob')).game, undefined);
  assert.strictEqual(store.merge('torrent', record()).game, undefined);
  assert.strictEqual(store.merge('http', record('alice', 'other')).game, undefined);
  store.remember('alice', 'torrent', 'transfer-1', { ...game, id: 'igdb:123', name: 'Other edition' });
  assert.equal(store.merge('http', record()).game?.id, game.id);
  assert.equal(store.merge('torrent', record()).game?.id, 'igdb:123');
  const reloaded = createDownloadContextStore(storage);
  assert.deepEqual(reloaded.merge('http', record()).game, savedGame);
  assert.equal(storage.value!.includes('private.example'), false);
  assert.equal(storage.value!.includes('bytesPerSecond'), false);
  assert.equal(storage.value!.includes('destination'), false);
  const reads = storage.reads;
  for (let i = 0; i < 120; i++) reloaded.merge('http', record());
  assert.equal(storage.reads, reads, 'live events do not parse localStorage repeatedly');
});

test('native metadata wins; unknown old records remain unchanged and unsafe art is removed', () => {
  const store = createDownloadContextStore();
  store.remember('alice', 'http', 'transfer-1', game);
  const native = { ...record(), game: { id: 'igdb:222', name: 'Native exact edition', logo: 'https://user:secret@cdn.example/logo.png' } };
  const merged = store.merge('http', native);
  assert.equal(merged.game?.id, 'igdb:222');
  assert.equal(merged.game?.logo, undefined);
  assert.equal(merged.game?.artwork, undefined, 'do not borrow cached artwork from a different native edition');
  const unknown = record('alice', 'old-unassociated');
  assert.strictEqual(store.merge('http', unknown), unknown);
  store.remember('alice', 'http', 'unsafe', { ...game, artwork: 'https://cdn.example/a?token=secret' });
  assert.equal(store.merge('http', record('alice', 'unsafe')).game?.artwork, undefined);
  const first = store.merge('http', record()); first.game!.name = 'Changed by consumer';
  assert.equal(store.merge('http', record()).game?.name, 'OpenTTD');
});

test('declared content type survives older native snapshots only for the same game identity',()=>{
 const store=createDownloadContextStore();
 store.remember('alice','http','transfer-1',{...game,contentKind:'mod'});
 assert.equal(store.merge('http',{...record(),game}).game?.contentKind,'mod');
 assert.equal(store.merge('http',{...record(),game:{...game,id:'igdb:999'}}).game?.contentKind,undefined);
 assert.equal(store.merge('http',{...record(),game:{...game,contentKind:'patch' as const}}).game?.contentKind,'patch');
});

test('corrupt or unavailable storage never blocks exact in-memory context', () => {
  for (const raw of ['not json', '{}', 'null', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [null, 3, { profile: 'alice', kind: 'http', id: 'transfer-1', game: { id: '', name: 'bad' } }] }), ' '.repeat(2_500_001)]) {
    const store = createDownloadContextStore(memoryStorage(raw));
    assert.equal(store.merge('http', record()).game, undefined);
    store.remember('alice', 'http', 'transfer-1', game);
    assert.equal(store.merge('http', record()).game?.id, game.id);
  }
  const store = createDownloadContextStore({ getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } });
  store.remember('alice', 'http', 'transfer-1', game);
  assert.equal(store.merge('http', record()).game?.id, game.id);
  store.forget('alice', 'http', 'transfer-1');
  assert.equal(store.merge('http', record()).game, undefined);
});

test('successful-removal helper deletes only the exact association; missing data does not erase context', () => {
  const storage = memoryStorage(), store = createDownloadContextStore(storage);
  for (const profile of ['alice', 'bob']) for (const kind of ['http', 'torrent'] as const) store.remember(profile, kind, 'transfer-1', game);
  store.remember('alice', 'http', 'transfer-1', undefined);
  assert.equal(store.merge('http', record()).game?.id, game.id);
  store.forget('alice', 'http', 'transfer-1');
  const restored = createDownloadContextStore(storage);
  assert.equal(restored.merge('http', record()).game, undefined);
  assert.equal(restored.merge('torrent', record()).game?.id, game.id);
  assert.equal(restored.merge('http', record('bob')).game?.id, game.id);
});

test('normal refresh reconciles another module instance and preserves unsaved exact associations', () => {
  const storage = memoryStorage(), mounted = createDownloadContextStore(storage), other = createDownloadContextStore(storage);
  other.remember('alice', 'torrent', 'transfer-1', game);
  assert.equal(mounted.merge('torrent', record()).game, undefined);
  mounted.refresh();
  assert.equal(mounted.merge('torrent', record()).game?.id, game.id);
  other.forget('alice', 'torrent', 'transfer-1');
  mounted.refresh();
  assert.equal(mounted.merge('torrent', record()).game, undefined);

  const blocked = createDownloadContextStore({ getItem: storage.getItem, setItem() { throw Error('full'); } });
  blocked.remember('alice', 'http', 'transfer-1', game);
  blocked.refresh();
  assert.equal(blocked.merge('http', record()).game?.id, game.id, 'unchanged storage does not erase an unsaved record');
  other.remember('bob', 'http', 'external', game);
  blocked.refresh();
  assert.equal(blocked.merge('http', record()).game?.id, game.id, 'external updates preserve quota-failed additions');
  assert.equal(blocked.merge('http', record('bob', 'external')).game?.id, game.id);
  blocked.forget('bob', 'http', 'external');
  other.remember('charlie', 'http', 'another', game);
  blocked.refresh();
  assert.equal(blocked.merge('http', record('bob', 'external')).game, undefined, 'external updates preserve quota-failed removals');
});

test('batch mapping uses unique exact destination filenames, independent of response order', () => {
  const storage = memoryStorage(), store = createDownloadContextStore(storage);
  const requests = [{ filename: 'World.part01.zip', game }, { filename: 'World.part02.zip', game: { ...game, id: 'igdb:22', name: 'Second exact game' } }];
  store.rememberBatch('alice', requests, [
    { ...record('alice', 'b'), destination: 'W:\\Games\\World.part02.zip' },
    { ...record('alice', 'a'), destination: '/games/World.part01.zip' },
    { ...record('bob', 'wrong-profile'), destination: '/games/World.part01.zip' },
  ]);
  assert.equal(store.merge('http', record('alice', 'a')).game?.id, game.id);
  assert.equal(store.merge('http', record('alice', 'b')).game?.id, 'igdb:22');
  assert.equal(store.merge('http', record('bob', 'wrong-profile')).game, undefined);
  assert.equal(storage.writes, 1, 'one durable update per accepted batch');
  const ambiguous = createDownloadContextStore();
  ambiguous.rememberBatch('alice', requests, [{ ...record('alice', 'c'), destination: '/one/World.part01.zip' }, { ...record('alice', 'd'), destination: '/two/World.part01.zip' }]);
  assert.equal(ambiguous.merge('http', record('alice', 'c')).game, undefined);
  ambiguous.rememberBatch('alice', [...requests, { filename: 'world.PART01.zip', game }], [{ ...record('alice', 'c'), destination: '/one/World.part01.zip' }]);
  assert.equal(ambiguous.merge('http', record('alice', 'c')).game, undefined);
  ambiguous.rememberBatch('alice', requests, [{ ...record('alice', 'c'), destination: '/one/World.part01.zip' }, { ...record('alice', 'c'), destination: '/one/World.part02.zip' }]);
  assert.equal(ambiguous.merge('http', record('alice', 'c')).game, undefined);
});

test('cache bounds limit each profile and total associations across profiles', () => {
  const storage = memoryStorage(), store = createDownloadContextStore(storage);
  for (const profile of ['alice', 'bob', 'charlie']) {
    const requests = Array.from({ length: 401 }, (_, i) => ({ filename: `${i}.zip`, game }));
    store.rememberBatch(profile, requests, requests.map((request, i) => ({ profile, id: `id-${i}`, destination: `/games/${request.filename}` })));
    assert.equal(store.merge('http', record(profile, 'id-0')).game, undefined);
    assert.equal(store.merge('http', record(profile, 'id-400')).game?.id, game.id);
  }
  const parsed = JSON.parse(storage.value!);
  assert.equal(parsed.entries.length, 800);
  assert.equal(parsed.entries.filter((item: { profile: string }) => item.profile === 'charlie').length, 400);
  assert.equal(store.merge('http', record('alice', 'id-400')).game, undefined);
});
