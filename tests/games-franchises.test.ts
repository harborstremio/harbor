import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFranchiseIndex, parseFranchisePage, franchiseQuery, franchiseDiscoveryQuery, parseFranchiseDiscovery, uniqueGameWorlds, gameWorldsQuery, parseGameWorldsPage } from '../src/lib/games/franchise-data.ts';
import { DEFAULT_ATLAS_FILTERS } from '../src/lib/games/igdb-data.ts';
import { decodeIgdbRows } from '../src/lib/games/igdb-records.ts';
import { markSavedMetadata } from '../src/lib/games/metadata-records.ts';

const game = { id: 132181, name: 'Resident Evil 4', game_type: 8, first_release_date: 1679616000, cover: {image_id:'co_cover'}, artworks:[{image_id:'ar_scene'}], franchises:[{id:29,name:'Resident Evil'}], platforms:[{id:6,name:'PC'},{id:167,name:'PlayStation 5'}] };
test('live world discovery accepts provider relationships beyond the editorial doors and preserves their namespaces', () => {
  const worlds=parseFranchiseDiscovery(decodeIgdbRows([
    {...game,id:77,screenshots:[{image_id:'sc_gameplay'}],franchises:[{id:991,name:'New world'}],collections:[{id:991,name:'Another series'}]},
    {...game,id:78,franchises:[{id:992,name:'New world'}]},
    {...game,id:79,franchises:[],collections:[]},
    {...game,id:80,franchises:[],collections:[{id:991,name:'Another series'}]},
  ])!);
  assert.deepEqual(worlds.map(world=>world.id),['franchise:991','series:991']);
  assert.equal(worlds[0].featuredGame.igdbId,77);
  assert.match(worlds[0].hero,/sc_gameplay/);
  assert.equal(worlds[0].route.image,worlds[0].hero);
  assert.equal(worlds[1].route.kind,'series');
  assert.match(franchiseDiscoveryQuery(120),/limit 60; offset 120;/);
  for(const offset of [-1,1.5,NaN,Infinity]) assert.throws(()=>franchiseDiscoveryQuery(offset));
});
test('world picker removes duplicate franchise aliases and artwork while keeping distinct catalogs intact',()=>{
  const [base]=parseFranchiseIndex([game]);
  const alias={...base,id:'series:29',name:'Resident Evil'};
  const sharedArt={...base,id:'franchise:100',name:'Another name'};
  assert.equal(uniqueGameWorlds([base,alias,sharedArt]).length,1);
  assert.equal(parseFranchisePage([game,{...game,id:11,name:'Resident Evil 4 Remake'}],'franchise:29',0).games.length,2);
});
test('world feed continues past editorial doors and pages by raw records, not distinct worlds',()=>{
  assert.equal(parseGameWorldsPage([game],0).nextOffset,1);
  assert.equal(parseGameWorldsPage([],0).nextOffset,1);
  assert.match(gameWorldsQuery(1),/offset 0;/);
  assert.match(gameWorldsQuery(61),/offset 60;/);
  assert.match(gameWorldsQuery(121),/offset 120;/);
  const rows=Array.from({length:60},(_,i)=>({...game,id:i+1,franchises:[{id:9999,name:'Beyond the seeds'}]}));
  const page=parseGameWorldsPage(markSavedMetadata(rows,10000),1);
  assert.equal(page.games.length,1);
  assert.equal(page.games[0].id,'franchise:9999');
  assert.equal(page.games[0].route.id,9999);
  assert.equal(page.nextOffset,61);
  assert.equal(page.cachedAt,10000);
  assert.equal(parseGameWorldsPage(rows.slice(0,59),61).nextOffset,null);
  assert.equal(parseGameWorldsPage([],121).nextOffset,null);
  for(const cursor of [-1,1.5,NaN,Infinity])assert.throws(()=>gameWorldsQuery(cursor));
});
test('provider worlds without bundled logos survive and repeat identities keep the first scene',()=>{
  const [first]=parseGameWorldsPage([{...game,id:42,franchises:[{id:9999,name:'Unbundled world'}]}],1).games;
  const [later]=parseGameWorldsPage([{...game,id:43,artworks:[{image_id:'other_scene'}],franchises:[{id:9999,name:'Updated provider name'}]}],61).games;
  assert.equal(first.name,'Unbundled world');
  assert.equal(uniqueGameWorlds([first,later]).length,1);
  assert.equal(uniqueGameWorlds([first,later])[0].featuredGame.igdbId,42);
});
test('franchise doorways require the verified seed and explicit provider membership, never a matching name alone', () => {
  const result = parseFranchiseIndex(decodeIgdbRows([game])!);
  assert.equal(result[0].id, 'franchise:29'); assert.equal(result[0].route.name, 'Resident Evil');
  assert.deepEqual(parseFranchiseIndex([{...game,id:99}]), []);
  assert.deepEqual(parseFranchiseIndex([{...game,franchises:[{id:99,name:'Resident Evil'}]}]), []);
});
test('franchise pages preserve remakes, platform/era metadata, original cache age and exact identity deduplication', () => {
  const rows = markSavedMetadata(decodeIgdbRows([game,game,{...game,id:12,game_type:0,first_release_date:828316800}])!,10000);
  const result = parseFranchisePage(rows,'franchise:29',0);
  assert.equal(result.games.length,2); assert.equal(result.games[0].gameType,8); assert.equal(result.games[0].release,1679616000);
  assert.deepEqual(result.games[0].platforms,['PC','PlayStation 5']); assert.equal(result.cachedAt,10000); assert.equal(result.nextOffset,null);
});
test('series and franchise IDs stay separate, filters are escaped and pagination follows actual provider rows', () => {
  assert.match(franchiseQuery('series:29',DEFAULT_ATLAS_FILTERS,24),/collections = \(29\).*limit 24; offset 24;/);
  assert.match(franchiseQuery('franchise:29',{...DEFAULT_ATLAS_FILTERS,era:'1990',sort:'oldest'},0),/sort first_release_date asc/);
  for (const id of ['franchise:0','29','franchise:29;limit 99','company:29']) assert.throws(()=>franchiseQuery(id,DEFAULT_ATLAS_FILTERS));
  assert.throws(()=>parseFranchisePage([{...game,franchises:[]}],'franchise:29',0));
  assert.equal(parseFranchisePage(Array.from({length:24},(_,i)=>({...game,id:i+1})),'franchise:29',24).nextOffset,48);
});
