import test from 'node:test';import assert from 'node:assert/strict';
import {detailStudioCompany,studioGames,studioPage,studioRowQuery,mergeStudioGames} from '../src/lib/games/studio-row.ts';
test('studio catalogs include verified publishing and subsidiary credits without borrowing other labels',()=>{
 const rows=[
  {id:1,name:'Direct',involved_companies:[{company:{id:29},developer:true}]},
  {id:2,name:'Published',involved_companies:[{company:{id:29},publisher:true},{company:{id:99},developer:true}]},
  {id:3,name:'Child studio',involved_companies:[{company:{id:365,parent:{id:29,parent:{id:139}}},developer:true}]},
  {id:4,name:'Grandchild studio',involved_companies:[{company:{id:999,parent:{id:365,parent:{id:29}}},publisher:true}]},
  {id:5,name:'Sibling label',involved_companies:[{company:{id:8,parent:{id:139}},publisher:true}]},
  {id:6,name:'Unrelated role',involved_companies:[{company:{id:29},developer:false,publisher:false},{company:{id:8},developer:true}]},
 ];
 assert.deepEqual(studioGames(rows,29).map(g=>g.name),['Direct','Published','Child studio','Grandchild studio']);
 assert.deepEqual(studioGames(rows,365).map(g=>g.name),['Child studio','Grandchild studio']);
});
test('studio row keeps titles beyond six, deduplicates editions and excludes the current game',()=>{
 const game=(i:number)=>({id:`steam:${i}`,steamId:i,name:`Game ${i}`,capsule:'',platforms:[]});
 const games=mergeStudioGames(game(1),[game(99)],Array.from({length:20},(_,i)=>game(i+1)),[game(99),{...game(2),id:'igdb:two'}]);
 assert.equal(games.length,20);assert.equal(games[0].steamId,99);assert.ok(!games.some(g=>g.steamId===1));
});
test('current and legacy company identities use the same family in querying and local validation',()=>{
 const rows=[{id:1,name:'Current 2K game',involved_companies:[{company:{id:20228},publisher:true}]},{id:2,name:'Legacy 2K game',involved_companies:[{company:{id:8},developer:true}]}];
 assert.equal(studioGames(rows,8).length,2);assert.equal(studioGames(rows,20228).length,2);
 assert.match(studioRowQuery(8),/company = \(8,20228\)/);
});
test('company lookup also checks verified publisher credits when Steam calls the brand its developer',()=>{
 const metadata={developers:[{id:365,name:'Rockstar North'}],publishers:[{id:29,name:'Rockstar Games'}]};
 assert.equal(detailStudioCompany('  Rockstar   Games ',metadata)?.id,29);
 assert.equal(detailStudioCompany('Rockstar North',metadata)?.id,365);
 assert.equal(detailStudioCompany(undefined,metadata)?.id,365);
 assert.equal(detailStudioCompany('Unverified brand',metadata),undefined);
 assert.equal(detailStudioCompany(undefined,{developers:[],publishers:metadata.publishers})?.id,29);
});
test('API cursors use raw page length even when local validation filters some results',()=>{
 const rows=Array.from({length:24},(_,i)=>({id:i+1,name:`Game ${i+1}`,involved_companies:[{company:{id:i===0?29:99},developer:true}]}));
 const first=studioPage(rows,29,0);assert.equal(first.games.length,1);assert.equal(first.nextOffset,24);
 assert.equal(studioPage(rows,29,240).nextOffset,264);
 assert.equal(studioPage(rows.slice(0,23),29,24).nextOffset,null);
 assert.equal(studioPage([],29,48).nextOffset,null);
});
test('company rows continue beyond the old 48-title cap with safe family queries',()=>{
 const query=studioRowQuery(29,96);
 assert.match(query,/company\.parent = \(29\)/);assert.match(query,/company\.parent\.parent = \(29\)/);
 assert.match(query,/involved_companies\.publisher/);assert.doesNotMatch(query,/developer = true/);
 assert.match(query,/limit 24; offset 96;/);
 assert.match(studioRowQuery(56,0,true),/first_release_date = null & external_games.external_game_source = 1/);
 assert.doesNotMatch(studioRowQuery(56,0,true),/company\.parent =/);
 assert.throws(()=>studioRowQuery(-1));assert.throws(()=>studioRowQuery(29,-1));assert.throws(()=>studioRowQuery(29,NaN));
});
