import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowDungeonRuns, parseWowRunEquipment, wowRunQueryUrl, wowTalentCode, type WowRunQuery } from '../src/lib/games/wow-dungeon-runs.ts';
import { wowSpecPosition } from '../src/lib/games/wow-run-specs.ts';
const query: WowRunQuery = { season: 'season-mn-2', region: 'eu', dungeon: { id: 16865, slug: 'altar-of-fangs' }, affixes: 'all', page: 0 };
const member = (id=1, extra={}) => ({ character: { id, name: `Name${id}`, path: `/characters/eu/silvermoon/Name${id}`, region:{slug:'eu'}, realm:{name:'Silvermoon',slug:'silvermoon'},class:{id:8,name:'Mage'},spec:{id:62,name:'Arcane'} },role:'dps',loadout:'A'.repeat(100),...extra });
const run = (id=1, extra={}) => ({ rank:id,score:0,run:{keystone_run_id:id,season:query.season,status:'finished',dungeon:{...query.dungeon},mythic_level:20,clear_time_ms:1234567,keystone_time_ms:1800000,completed_at:'2026-09-30T12:00:00Z',roster:[1,2,3,4,5].map(id=>member(id)),weekly_modifiers:[{id:10,name:'Fortified',icon:'ability_toughness'}],...extra} });
const response = (rankings=[run()]) => ({params:{...query,dungeon:query.dungeon.slug},rankings});
test('Run queries preserve exact season, dungeon, region, affix and provider page identity',()=>{
 assert.match(wowRunQueryUrl(query),/season=season-mn-2&region=eu&dungeon=altar-of-fangs&affixes=all&page=0/);
 for(const change of [{page:-1},{page:100},{page:1.5},{season:'../bad'},{dungeon:{id:0,slug:'altar-of-fangs'}}])assert.throws(()=>wowRunQueryUrl({...query,...change}));
 for(const key of ['season','region','dungeon','affixes','page']){const data=response();data.params[key]='wrong';assert.throws(()=>parseWowDungeonRuns(data,query));}
});
test('Real zero score, completion time, timer, party and provider ranks remain distinct',()=>{
 const parsed=parseWowDungeonRuns(response(),query);assert.equal(parsed.partial,false);assert.equal(parsed.runs[0]!.score,0);assert.equal(parsed.runs[0]!.time,1234567);assert.equal(parsed.runs[0]!.members.length,5);assert.equal(parsed.runs[0]!.members[0]!.loadout,'A'.repeat(100));
 assert.equal(parsed.runs[0]!.url,'https://raider.io/mythic-plus-runs/season-mn-2/1');assert.equal(parsed.runs[0]!.members[0]!.url,'https://raider.io/characters/eu/silvermoon/Name1');
});
test('Pagination uses raw provider page size, not valid-row count; empty is a valid observation',()=>{
 const data=response(Array.from({length:20},(_,i)=>run(i+1)));data.rankings[3].run.mythic_level=999;
 const parsed=parseWowDungeonRuns(data,query);assert.equal(parsed.runs.length,19);assert.equal(parsed.partial,true);assert.equal(parsed.next,1);
 assert.deepEqual(parseWowDungeonRuns(response([]),query),{runs:[],partial:false,next:null});
 const last={...query,page:99};assert.equal(parseWowDungeonRuns({...response(Array.from({length:20},(_,i)=>run(i+1))),params:{...last,dungeon:last.dungeon.slug}},last).next,null);
});
test('Wrong-season/dungeon/deleted/duplicate and impossible run observations never masquerade as valid rows',()=>{
 const data=response([run(),run(),run(2,{season:'season-mn-1'}),run(3,{dungeon:{id:42,slug:'other'}}),run(4,{deleted_at:'2026-09-30'}),run(5,{clear_time_ms:0})]);
 assert.equal(parseWowDungeonRuns(data,query).runs.length,1);assert.equal(parseWowDungeonRuns(data,query).partial,true);
 assert.throws(()=>parseWowDungeonRuns(response([run(1,{status:'running'})]),query));
});
test('Broken party identity stays partial without removing the valid run or manufacturing a character',()=>{
 const other=member(3);other.character.region.slug='us';const path=member(4);path.character.path='//evil.test/Name4';
 const data=parseWowDungeonRuns(response([run(1,{roster:[member(),member(),other,path]})]),query);
 assert.equal(data.runs[0]!.members.length,1);assert.equal(data.runs[0]!.partial,true);assert.equal(data.partial,true);
 for(const code of ['A'.repeat(19),'A\n'.repeat(30),'<script>bad</script>','A'.repeat(2001)])assert.equal(wowTalentCode(code),null);
});
test('Equipment is joined to the exact run and party identity, preserving its separate snapshot date',()=>{
 const parsed=parseWowDungeonRuns(response(),query).runs[0]!;
 const gear={...member(),items:{updated_at:'2026-09-29T11:00:00Z',item_level_equipped:330,items:{head:{item_id:42,name:'Helm',item_level:330,icon:'inv_helm',gems:[],gems_detail:[],enchants:[],enchants_detail:[]}}}};
 const details={...run().run,roster:[gear,member(99)]};const result=parseWowRunEquipment(details,query,parsed);
 assert.equal(result.length,1);assert.equal(result[0]!.equipment!.items[0]!.name,'Helm');assert.notEqual(result[0]!.at,parsed.completedAt);
 assert.throws(()=>parseWowRunEquipment({...details,keystone_run_id:2},query,parsed));
});
test('Specialization artwork joins exact class and specialization IDs, not ambiguous spec names',()=>{
 assert.ok(wowSpecPosition(62,8));assert.ok(wowSpecPosition(1480,12));assert.equal(wowSpecPosition(62,2),null);assert.equal(wowSpecPosition(99999,8),null);
});
