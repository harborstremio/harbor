import assert from 'node:assert/strict';
import test from 'node:test';
import { DOTA_SAMPLES, dotaHeroImage, dotaWinRate, filterDotaHeroes, filterDotaMatchups, parseDotaHeroes, parseDotaMatchups } from '../src/lib/games/dota-data.ts';
const hero = (id = 1, extra = {}) => ({id,name:'npc_dota_hero_antimage',localized_name:'Anti-Mage',primary_attr:'agi',img:'/apps/dota2/images/dota_react/heroes/antimage.png?',...Object.fromEntries(DOTA_SAMPLES.flatMap(s=>[[`${s}_pick${s==='turbo'?'s':''}`,100],[`${s}_win${s==='turbo'?'s':''}`,55]])),...extra});
test('Hero samples keep public, average rank, Turbo and professional observations separate',()=>{
 const data=parseDotaHeroes([hero(1,{'pub_pick':200,'pub_win':101,'1_pick':0,'1_win':0,'8_pick':null,'8_win':null,'turbo_picks':33,'turbo_wins':12})]);
 assert.equal(data.partial,true);const h=data.items[0]!;
 assert.deepEqual(h.samples.pub,{games:200,wins:101});assert.deepEqual(h.samples.turbo,{games:33,wins:12});assert.equal(dotaWinRate(h.samples['1']),null);assert.equal(h.samples['8'],null);assert.equal(dotaWinRate(h.samples.pro),.55);
});
test('Invalid identities and impossible samples cannot become valid heroes or win rates',()=>{
 const data=parseDotaHeroes([hero(),hero(),hero(-1),hero(3,{name:'../bad'}),hero(4,{primary_attr:'future'}),hero(5,{'pub_pick':10,'pub_win':11})]);
 assert.deepEqual(data.items.map(h=>h.id),[1,5]);assert.equal(data.items[1]!.samples.pub,null);assert.equal(data.partial,true);
 for(const raw of [null,{},[],[hero(0)]])assert.throws(()=>parseDotaHeroes(raw));
});
test('Images accept only observed Valve hero paths and reject external URLs or traversal',()=>{
 assert.equal(dotaHeroImage(hero().img),'https://cdn.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png');
 for(const path of ['https://evil.test/a.png','//evil.test/a.png','/apps/dota2/images/dota_react/heroes/../../x.png','/apps/dota2/images/dota_react/heroes/x.svg','/apps/dota2/images/dota_react/heroes/x.png?redirect=a'])assert.equal(dotaHeroImage(path),'');
});
test('Matchup parsing preserves true zero and rejects duplicates, self matches and invalid counts',()=>{
 const data=parseDotaMatchups([{hero_id:2,games_played:20,wins:0},{hero_id:2,games_played:30,wins:30},{hero_id:1,games_played:30,wins:1},{hero_id:3,games_played:10,wins:11},{hero_id:4,games_played:0,wins:0}],1);
 assert.deepEqual(data.items,[{id:2,games:20,wins:0},{id:4,games:0,wins:0}]);assert.equal(data.partial,true);assert.equal(dotaWinRate(data.items[0]!),0);assert.equal(dotaWinRate(data.items[1]!),null);
 assert.deepEqual(parseDotaMatchups([],1),{items:[],partial:false});assert.throws(()=>parseDotaMatchups([{hero_id:2,games_played:-1,wins:0}],1));assert.throws(()=>parseDotaMatchups([],0));
});
test('Filtering and sorting use the chosen sample without mutating observations',()=>{
 const heroes=parseDotaHeroes([hero(1),hero(2,{name:'npc_dota_hero_axe',localized_name:'Axe',primary_attr:'str',pub_pick:200,pub_win:90}),hero(3,{localized_name:'Unknown',pub_pick:null,pub_win:null})]).items;
 assert.deepEqual(filterDotaHeroes(heroes,'','', 'pub','picks').map(h=>h.id),[2,1,3]);assert.deepEqual(filterDotaHeroes(heroes,'','', 'pub','win').map(h=>h.id),[1,2,3]);assert.deepEqual(filterDotaHeroes(heroes,' AX','str','pub','name').map(h=>h.id),[2]);assert.deepEqual(heroes.map(h=>h.id),[1,2,3]);
});
test('Opponent filters require a known roster identity and retain sample size beside raw win rates',()=>{
 const heroes=parseDotaHeroes([hero(2,{localized_name:'Axe'}),hero(3,{localized_name:'Pudge'}),hero(4,{localized_name:'No sample'})]).items;
 const matches=[{id:2,games:100,wins:40},{id:3,games:5,wins:5},{id:4,games:0,wins:0},{id:999,games:1000,wins:990}];
 assert.deepEqual(filterDotaMatchups(matches,heroes,'',50,'high').map(h=>h.id),[2]);assert.deepEqual(filterDotaMatchups(matches,heroes,'',0,'low').map(h=>h.id),[2,3,4]);assert.deepEqual(filterDotaMatchups(matches,heroes,'Pud',0,'games').map(h=>h.id),[3]);
});
