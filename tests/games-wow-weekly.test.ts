import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowCharacter, wowCharacterUrl } from '../src/lib/games/wow-character-data.ts';
import { wowWeeklyProgress, type WowResetContext } from '../src/lib/games/wow-weekly.ts';
import type { WowSeason } from '../src/lib/games/wow-data.ts';

const start=Date.parse('2026-09-30T04:00:00Z'),week=7*86400_000,now=start+86400_000;
const target={region:'eu' as const,realm:'silvermoon',name:'Example'};
const season:WowSeason={slug:'season-mn-2',name:'Season 2',start:start-week*4,end:start+week*8,dungeons:[]};
const reset:WowResetContext={at:now,now,periods:[{region:'eu',current:10,periods:[{id:9,start:start-week,end:start},{id:10,start,end:start+week},{id:11,start:start+week,end:start+2*week}]}]};
const run=(id=1,level=12,completed=start+60000,extra={})=>({keystone_run_id:id,zone_id:100,dungeon:'Dungeon',mythic_level:level,clear_time_ms:1500000,par_time_ms:1800000,completed_at:new Date(completed).toISOString(),url:`https://raider.io/mythic-plus-runs/${season.slug}/${id}-${level}-dungeon`,...extra});
const character=(extra={})=>parseWowCharacter({region:'eu',realm:'Silvermoon',name:'Example',profile_url:'https://raider.io/characters/eu/silvermoon/Example',mythic_plus_scores_by_season:[{season:season.slug,scores:{all:3000}}],mythic_plus_weekly_highest_level_runs:[run()],mythic_plus_previous_weekly_highest_level_runs:[run(2,11,start-60000)],...extra},target,season.slug);

test('Profile requests both weekly fields; weekly runs remain distinct from recent and season-best',()=>{
 const fields=new URL(wowCharacterUrl(target,season.slug)).searchParams.get('fields')!.split(',');
 assert.ok(fields.includes('mythic_plus_weekly_highest_level_runs'));assert.ok(fields.includes('mythic_plus_previous_weekly_highest_level_runs'));
 const value=character({mythic_plus_recent_runs:[run(3,20)],mythic_plus_best_runs:[run(4,21)]});
 assert.equal(value.weekly.current?.runs[0].id,1);assert.equal(value.recent?.[0].id,3);assert.equal(value.best?.[0].id,4);
});
test('Runs are assigned to the regional reset, sorted by key level and preserve overtime',()=>{
 const value=character({mythic_plus_weekly_highest_level_runs:[run(1,12),run(2,14,start+60000,{clear_time_ms:1900000}),run(3,14,start+50000)]});
 const result=wowWeeklyProgress(value,now,season,'eu',reset)!;
 assert.deepEqual(result.current.runs?.map(r=>r.id),[3,2,1]);assert.equal(result.current.runs?.[1].timed,false);assert.equal(result.previous?.runs?.[0].id,2);
 assert.equal(result.current.start,start);assert.equal(result.current.partial,false);
});
test('Absent, observed empty, malformed and top-ten results stay distinct',()=>{
 assert.equal(character({mythic_plus_weekly_highest_level_runs:undefined}).weekly.current,null);
 assert.deepEqual(wowWeeklyProgress(character({mythic_plus_weekly_highest_level_runs:[]}),now,season,'eu',reset)?.current.runs,[]);
 assert.equal(character({mythic_plus_weekly_highest_level_runs:[run(1,0)]}).weekly.current,null);
 const ten=Array.from({length:10},(_,i)=>run(i+1,12));assert.equal(character({mythic_plus_weekly_highest_level_runs:ten}).weekly.current?.runs.length,10);
 assert.equal(character({mythic_plus_weekly_highest_level_runs:[...ten,run(11)]}).weekly.current,null);
});
test('Wrong-season, unsafe, duplicate and wrong-week records cannot inflate the list or become empty success',()=>{
 const value=character({mythic_plus_weekly_highest_level_runs:[run(),run(),run(2,12,start+1,{url:'https://evil.test/run'}),run(3,14,start-1),run(4,14,now+1),run(5,14,start+1,{url:'https://raider.io/mythic-plus-runs/season-mn-1/5-14-dungeon'})]});
 const projected=wowWeeklyProgress(value,now,season,'eu',reset)!.current;
 assert.equal(projected.runs?.length,1);assert.equal(projected.partial,true);
 assert.equal(wowWeeklyProgress(character({mythic_plus_weekly_highest_level_runs:[run(1,12,start-1)]}),now,season,'eu',reset)?.current.runs,null);
 const boundary=wowWeeklyProgress(character({mythic_plus_previous_weekly_highest_level_runs:[run(2,11,start)]}),now,season,'eu',reset);assert.equal(boundary?.previous?.runs,null);
});
test('Region, active season, checked time and reset observation must all agree',()=>{
 const value=character();
 for(const context of [null,{...reset,at:start-1},{...reset,at:now+1},{...reset,at:start+10000},{...reset,periods:[{...reset.periods[0],current:11}]}])assert.equal(wowWeeklyProgress(value,now,season,'eu',context),null);
 for(const at of [start-1,start+10000,now+1,NaN])assert.equal(wowWeeklyProgress(value,at,season,'eu',reset),null);
 assert.equal(wowWeeklyProgress(value,now,season,'us',reset),null);
 for(const entry of [null,{...season,slug:'season-mn-1'},{...season,end:now},{...season,start:now+1}])assert.equal(wowWeeklyProgress(value,now,entry,'eu',reset),null);
});
test('Crossing reset never relabels cached current/previous arrays; new observations recover',()=>{
 const nextNow=start+week+60000,nextReset={...reset,now:nextNow,at:nextNow,periods:[{...reset.periods[0],current:11}]};
 assert.equal(wowWeeklyProgress(character(),now,season,'eu',nextReset),null);
 const fresh=character({mythic_plus_weekly_highest_level_runs:[run(5,15,start+week+30000)],mythic_plus_previous_weekly_highest_level_runs:[run()]});
 const result=wowWeeklyProgress(fresh,nextNow,season,'eu',nextReset)!;assert.equal(result.current.id,11);assert.equal(result.current.runs?.[0].id,5);assert.equal(result.previous?.runs?.[0].id,1);
});
