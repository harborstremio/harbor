import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowCharacter, wowCharacterUrl, type WowCharacter } from '../src/lib/games/wow-character-data.ts';
import { orderWowProgress, parseWowDungeonCounts, wowSeasonProgress } from '../src/lib/games/wow-season-progress.ts';
import type { WowSeason } from '../src/lib/games/wow-data.ts';

const season: WowSeason = {slug:'season-mn-2',name:'Season 2',start:0,end:9999999999999,dungeons:[1,2,3].map(id=>({id,slug:`dungeon-${id}`,name:`Dungeon ${id}`,seconds:1800,image:''}))};
const target={region:'eu' as const,realm:'silvermoon',name:'Test'};
const rawRun=(id:number,zone:number,score:number)=>({keystone_run_id:id,zone_id:zone,dungeon:'A translated name',mythic_level:12,clear_time_ms:1000000,par_time_ms:1800000,completed_at:'2026-10-01T00:00:00Z',score,url:`https://raider.io/mythic-plus-runs/season-mn-2/${id}-12-dungeon`});
const rawCount=(id:number,total=5,timed=3)=>({zone_id:id,season_runs_total:total,season_runs_timed:timed});
function character(extra={}): WowCharacter {return parseWowCharacter({region:'eu',name:'Test',realm:'Silvermoon',profile_url:'https://raider.io/characters/eu/silvermoon/Test',mythic_plus_scores_by_season:[{season:season.slug,scores:{all:900}}],mythic_plus_best_runs:[rawRun(11,1,300),rawRun(12,2,400)],mythic_plus_dungeon_run_counts:[rawCount(1),rawCount(2),rawCount(3,0,0)],...extra},target,season.slug);}

test('Character request includes all best runs and exact season counts, without inventing a season alias',()=>{
 const fields=new URL(wowCharacterUrl(target,season.slug)).searchParams.get('fields');
 assert.ok(fields?.includes('mythic_plus_best_runs:all'));assert.ok(fields?.includes(`mythic_plus_dungeon_run_counts:${season.slug}`));
 assert.ok(new URL(wowCharacterUrl(target)).searchParams.get('fields')?.includes('mythic_plus_dungeon_run_counts,'));
});
test('Progress joins zone IDs despite translated names and includes explicit zero-filled current-pool dungeons',()=>{
 const result=wowSeasonProgress(character(),season,'eu')!;
 assert.equal(result.rows.length,3);assert.equal(result.rows[0].best?.zoneId,1);assert.equal(result.rows[2].best,null);assert.deepEqual(result.rows[2].count,{id:3,total:0,timed:0});assert.equal(result.timedDungeons,2);assert.equal(result.totalRuns,10);assert.equal(result.timedRuns,6);assert.equal(result.partial,false);
 assert.equal(wowSeasonProgress(character(),season,'us'),null);assert.equal(wowSeasonProgress(character(),{...season,slug:'season-mn-3'},'eu'),null);
});
test('Bad, duplicate, missing and contradictory counts never manufacture a zero or aggregate total',()=>{
 assert.equal(parseWowDungeonCounts({}),null);assert.equal(parseWowDungeonCounts(Array(51).fill(rawCount(1))),null);
 assert.deepEqual(parseWowDungeonCounts([rawCount(1),rawCount(1),rawCount(2,2,3),rawCount(3,0,0),rawCount(4,1.1,0),rawCount(5,Infinity,0)]),[{id:3,total:0,timed:0}]);
 const result=wowSeasonProgress(character({mythic_plus_dungeon_run_counts:[rawCount(1,0,0),rawCount(2)]}),season,'eu')!;
 assert.equal(result.rows[0].count,null);assert.equal(result.rows[0].best?.score,300);assert.equal(result.rows[2].count,null);assert.equal(result.totalRuns,null);assert.equal(result.timedDungeons,null);assert.equal(result.partial,true);
});
test('Valid overtime and observed zero stay distinct from unavailable best or count data',()=>{
 const result=wowSeasonProgress(character({mythic_plus_best_runs:[{...rawRun(11,1,0),clear_time_ms:1900000}],mythic_plus_dungeon_run_counts:[rawCount(1,1,0),rawCount(2,0,0),rawCount(3,0,0)]}),season,'eu')!;
 assert.equal(result.rows[0].best?.timed,false);assert.equal(result.rows[0].best?.score,0);assert.equal(result.timedDungeons,0);assert.equal(result.totalRuns,1);assert.equal(result.partial,false);
 const missing=wowSeasonProgress(character({mythic_plus_best_runs:null}),season,'eu')!;assert.equal(missing.partial,true);assert.equal(missing.totalRuns,10);
});
test('Best score wins per dungeon and unrecognized zone identities cannot join by title',()=>{
 const data=character({mythic_plus_best_runs:[rawRun(11,1,200),rawRun(12,1,400),{...rawRun(13,2,500),zone_id:undefined},rawRun(14,99,600)]});
 const result=wowSeasonProgress(data,season,'eu')!;assert.equal(result.rows[0].best?.id,12);assert.equal(result.rows[1].best,null);assert.equal(result.partial,true);
});
test('Sorting prioritizes genuine untimed/low-score records while unknown coverage remains last',()=>{
 const rows=wowSeasonProgress(character(),season,'eu')!.rows;
 assert.deepEqual(orderWowProgress(rows,'score').map(row=>row.dungeon.id),[3,1,2]);assert.deepEqual(orderWowProgress(rows,'untimed').map(row=>row.dungeon.id),[3,1,2]);assert.deepEqual(rows.map(row=>row.dungeon.id),[1,2,3]);
 rows[2].count=null;assert.deepEqual(orderWowProgress(rows,'score').map(row=>row.dungeon.id),[1,2,3]);assert.deepEqual(orderWowProgress(rows,'untimed').map(row=>row.dungeon.id),[1,2,3]);
});
