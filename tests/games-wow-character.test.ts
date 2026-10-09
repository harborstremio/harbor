import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowCharacter, rememberedWowCharacter, wowCharacterKey, wowCharacterPortrait, wowCharacterTarget, wowCharacterUrl, type WowCharacterTarget } from '../src/lib/games/wow-character-data.ts';

const target:WowCharacterTarget={region:'eu',realm:'Tarren Mill',name:'Mëeres'};
const season='season-mn-2';
const run=(extra={})=>({keystone_run_id:10,dungeon:'Ruby Life Pools',mythic_level:12,clear_time_ms:1165033,par_time_ms:1680999,completed_at:'2026-09-30T07:53:52Z',score:376.5,icon_url:'https://cdn.raiderio.net/images/wow/icons/large/test.jpg',url:`https://raider.io/mythic-plus-runs/${season}/10-12-ruby-life-pools`,...extra});
const profile=(extra={})=>({name:'Mëeres',region:'eu',realm:'Tarren Mill',profile_url:'https://raider.io/characters/eu/tarren-mill/M%C3%ABeres',thumbnail_url:'https://render.worldofwarcraft.com/eu/character/tarren-mill/45/188942893-avatar.jpg',class:'Hunter',active_spec_name:'Survival',gear:{item_level_equipped:240,updated_at:'2026-09-30T18:44:26Z'},last_crawled_at:'2026-09-29T19:14:24Z',mythic_plus_scores_by_season:[{season,scores:{all:4000}}],mythic_plus_recent_runs:[run()],mythic_plus_best_runs:[run()],raid_progression:{'test-raid':{total_bosses:8,normal_bosses_killed:8,heroic_bosses_killed:8,mythic_bosses_killed:5}},...extra});

test('Character input supports Unicode and exact region/realm/name encoding without query injection',()=>{
 assert.deepEqual(wowCharacterTarget({...target,name:' Mëeres '}),target);
 assert.ok(wowCharacterTarget({...target,name:'青心',realm:'Pozzo dell’Eternità'}));
 assert.equal(wowCharacterKey(target),wowCharacterKey({...target,realm:'tarren-mill',name:'MËERES'}));
 const url=new URL(wowCharacterUrl(target,season));assert.equal(url.searchParams.get('name'),'Mëeres');assert.equal(url.searchParams.get('realm'),'Tarren Mill');assert.ok(url.searchParams.get('fields')?.includes('mythic_plus_scores_by_season:season-mn-2'));
 for(const bad of [{...target,region:'invalid'},{...target,name:'../../test'},{...target,name:'test&fields=secret'},{...target,name:'x'.repeat(25)},{...target,realm:'bad\nrealm'}])assert.equal(wowCharacterTarget(bad),null);
 assert.throws(()=>wowCharacterUrl(target,'wrong,field'));
});
test('Response must identify the requested character and region, preserving the provider canonical realm',()=>{
 const result=parseWowCharacter(profile(),target,season);assert.equal(result.target.realm,'tarren-mill');assert.equal(result.key,wowCharacterKey(target));assert.equal(result.name,'Mëeres');
 for(const extra of [{name:'Somebody'},{region:'us'},{realm:'Other',profile_url:'https://raider.io/characters/eu/other/M%C3%ABeres'},{profile_url:'https://evil.test/characters/eu/tarren-mill/M%C3%ABeres'},{profile_url:'https://raider.io/characters/eu/tarren-mill/Other'}])assert.throws(()=>parseWowCharacter(profile(extra),target,season));
});
test('Missing score/gear data stays unknown while observed zero remains zero; timestamps stay separate',()=>{
 assert.equal(parseWowCharacter(profile({mythic_plus_scores_by_season:[{season,scores:{all:0}}]}),target,season).score,0);
 const missing=parseWowCharacter(profile({mythic_plus_scores_by_season:[],gear:{}}),target,season);assert.equal(missing.score,null);assert.equal(missing.itemLevel,null);assert.equal(missing.recent,null);
 const full=parseWowCharacter(profile(),target,season);assert.notEqual(full.crawledAt,full.gearAt);assert.equal(full.itemLevel,240);
});
test('Runs reject other seasons and unsafe links, deduplicate exact IDs, and distinguish malformed from empty',()=>{
 const result=parseWowCharacter(profile({mythic_plus_recent_runs:[run(),run(),run({keystone_run_id:11,url:'https://raider.io/mythic-plus-runs/season-tww-3/11-test'})]}),target,season);
 assert.equal(result.recent?.length,1);assert.equal(result.recent?.[0]?.timed,true);
 assert.deepEqual(parseWowCharacter(profile({mythic_plus_recent_runs:[]}),target,season).recent,[]);
 assert.equal(parseWowCharacter(profile({mythic_plus_recent_runs:[run({clear_time_ms:-1})]}),target,season).recent,null);
 assert.equal(parseWowCharacter(profile(),target,'season-future-1').score,null);
});
test('Recent runs are newest first; best runs are ordered by score and expose actual overtime',()=>{
 const newer=run({keystone_run_id:11,url:`https://raider.io/mythic-plus-runs/${season}/11-test`,completed_at:'2026-09-30T08:00:00Z',score:100,clear_time_ms:1800000});
 const result=parseWowCharacter(profile({mythic_plus_recent_runs:[run(),newer],mythic_plus_best_runs:[newer,run()]}),target,season);
 assert.deepEqual(result.recent?.map(x=>x.id),[11,10]);assert.deepEqual(result.best?.map(x=>x.id),[10,11]);assert.equal(result.recent?.[0]?.timed,false);
});
test('Raid kill counts cannot exceed source boss totals, and missing difficulty data is not zero',()=>{
 const result=parseWowCharacter(profile({raid_progression:{test:{total_bosses:8,normal_bosses_killed:0,heroic_bosses_killed:10},bad:{total_bosses:0}}}),target,season);
 assert.deepEqual(result.raids,[{slug:'test',total:8,normal:0,heroic:null,mythic:null}]);
});
test('Remembered identity is bounded and region-specific; portraits only use the official renderer',()=>{
 assert.deepEqual(rememberedWowCharacter(JSON.stringify(target),'eu'),target);assert.equal(rememberedWowCharacter(JSON.stringify(target),'us'),null);assert.equal(rememberedWowCharacter('{','eu'),null);assert.equal(rememberedWowCharacter('x'.repeat(1025),'eu'),null);
 assert.ok(wowCharacterPortrait(profile().thumbnail_url));for(const url of ['javascript:alert(1)','https://render.worldofwarcraft.com.evil.test/eu/character/x.jpg','https://u@render.worldofwarcraft.com/eu/character/x.jpg','http://render.worldofwarcraft.com/eu/character/x.jpg'])assert.equal(wowCharacterPortrait(url),'');
});
