import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasQuery, DEFAULT_ATLAS_FILTERS, igdbImage, igdbSteamId, parseAtlasGame, parseAtlasSummary } from '../src/lib/games/igdb-data.ts';
import { readSavedGames, writeSavedGames } from '../src/lib/games/saved.ts';

test('game identities require Steam source and ID on the same external record',()=>{
 assert.equal(igdbSteamId({external_games:[{uid:'1145360',external_game_source:14},{uid:'200',external_game_source:1}]}),200);
 assert.equal(igdbSteamId({external_games:[{uid:'javascript:1',external_game_source:1}]}),undefined);
 const game=parseAtlasSummary({id:113112,name:'Hades',external_games:[{uid:'1145360',external_game_source:{id:1}}],cover:{image_id:'coabc'}});
 assert.equal(game?.id,'steam:1145360'); assert.equal(game?.igdbId,113112);
 const handheld=parseAtlasSummary({id:1559,name:'Pokémon FireRed',cover:{image_id:'co123'}});
 assert.equal(handheld?.id,'igdb:1559');assert.equal(handheld?.steamId,undefined);
 assert.equal(igdbImage({image_id:'../../fake'}),'');
});
test('atlas relationships retain provider IDs, base game and rating evidence',()=>{
 const g=parseAtlasGame({id:141663,name:'Pokémon Unbound',game_type:5,platforms:[{id:24,name:'GBA'},{id:24,name:'GBA'}],parent_game:{id:1559,name:'FireRed'},total_rating:93,total_rating_count:13,similar_games:[{id:141663,name:'Self'},{id:3,name:'Other'},{id:3,name:'Other'}]});
 assert.equal(g.parent?.id,'igdb:1559');assert.equal(g.platformLinks.length,1);assert.equal(g.related.length,1);assert.equal(g.rating,93);
 assert.equal(parseAtlasGame({id:3,name:'Missing votes',total_rating:99}).rating,undefined);
});
test('atlas queries combine relationship IDs and eras without injecting user query syntax',()=>{
 const q=atlasQuery({kind:'platform',id:24,name:'GBA'},{...DEFAULT_ATLAS_FILTERS,query:'x"; where id = 1; \\ z',era:'2000'},24);
 assert.ok(q.includes('platforms = (24)')); assert.ok(q.includes('offset 24;'));assert.ok(q.includes('first_release_date >= 946684800'));
 assert.equal((q.match(/search "/g)??[]).length,1);assert.equal((q.match(/"/g)??[]).length,2);
 assert.throws(()=>atlasQuery({kind:'series',id:-1,name:'x'},DEFAULT_ATLAS_FILTERS));
 assert.ok(atlasQuery({kind:'hacks',name:'Mods'},DEFAULT_ATLAS_FILTERS).includes('game_type = 5'));
});
test('saved console games retain provider identity, validated artwork and profile isolation',()=>{
 const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
 const game=parseAtlasGame({id:1559,name:'FireRed',cover:{image_id:'co123'},platforms:[{id:24,name:'GBA'}]});
 writeSavedGames('atlas-a',[game]);const loaded=readSavedGames('atlas-a');assert.equal(loaded[0]?.id,'igdb:1559');assert.equal(loaded[0]?.portrait,game.portrait);assert.deepEqual(loaded[0]?.platforms,['GBA']);assert.deepEqual(readSavedGames('atlas-b'),[]);
});
test('all-time filters query the whole platform and era catalog while retaining the rating floor',()=>{
 const query=atlasQuery({kind:'greats',name:'All-time greats'},{...DEFAULT_ATLAS_FILTERS,platform:167,era:'2020',sort:'rated'},24);
 assert.match(query,/platforms = \(167\)/);assert.match(query,/total_rating_count >= 100/);
 assert.match(query,/first_release_date >= 1577836800/);assert.match(query,/offset 24;/);
});

test('studio filters and sort apply to the entire catalog, including searched titles and later pages',()=>{
 const query=atlasQuery({kind:'company',id:139,name:'Take-Two'},{...DEFAULT_ATLAS_FILTERS,query:'Grand Theft',platform:6,genre:31,era:'2010',sort:'rated',minimumRating:80,minimumVotes:100},48);
 assert.match(query,/sort total_rating desc;/);assert.doesNotMatch(query,/search "/);
 assert.match(query,/name ~ \*"Grand Theft"\*/);assert.match(query,/platforms = \(6\)/);assert.match(query,/genres = \(31\)/);
 assert.match(query,/total_rating >= 80/);assert.match(query,/total_rating_count >= 100/);assert.match(query,/offset 48;/);
 assert.match(query,/company.parent.parent = \(139,20228\)/);assert.match(query,/first_release_date >= 1262304000/);
});

test('studio score filters require evidence and reject unsupported or injected values',()=>{
 const route={kind:'company' as const,id:139,name:'Take-Two'};
 const rated=atlasQuery(route,{...DEFAULT_ATLAS_FILTERS,query:'BioShock',sort:'rated'});
 assert.match(rated,/total_rating_count >= 5/);
 assert.match(atlasQuery(route,{...DEFAULT_ATLAS_FILTERS,minimumRating:90}),/total_rating_count >= 5/);
 for(const bad of [{platform:-1},{genre:999},{minimumRating:101},{minimumVotes:0},{minimumVotes:NaN}])assert.throws(()=>atlasQuery(route,{...DEFAULT_ATLAS_FILTERS,...bad}));
 const escaped=atlasQuery(route,{...DEFAULT_ATLAS_FILTERS,query:'x"; where id = 1; \\ \n'});
 assert.equal((escaped.match(/"/g)??[]).length,2);assert.doesNotMatch(escaped,/search /);
 assert.doesNotMatch(atlasQuery(route,DEFAULT_ATLAS_FILTERS),/total_rating_count >=/);
});
