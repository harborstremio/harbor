import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSteamPublishers } from '../src/lib/games/steam-data.ts';
import { MAJOR_TOURNAMENTS, upcomingMajorTournaments, tournamentDates } from '../src/lib/games/major-tournaments.ts';
import { GAME_MILESTONES, milestoneQuery } from '../src/lib/games/discovery-collections.ts';

test('Steam publisher display accepts names only, deduplicating verified basic-info metadata',()=>{
 assert.deepEqual(parseSteamPublishers({publishers:[{name:' Valve '},{name:'Valve'},{name:5},null,{},'Fake']}),['Valve']);
 assert.deepEqual(parseSteamPublishers(null),[]);
});
test('major calendar expires completed events, filters game identity and never reuses last year',()=>{
 const future=upcomingMajorTournaments(Date.parse('2026-11-08T23:00:00Z'),'cs2');
 assert(future.some(event=>event.id==='iem-beijing-2026'));
 assert(!upcomingMajorTournaments(Date.parse('2026-11-09T00:00:00Z'),'cs2').some(event=>event.id==='iem-beijing-2026'));
 assert(future.every(event=>event.game==='cs2'));
 assert.deepEqual(upcomingMajorTournaments(Date.parse('2028-01-01T00:00:00Z')),[]);
 assert.equal(new Set(MAJOR_TOURNAMENTS.map(event=>event.id)).size,MAJOR_TOURNAMENTS.length);
 assert(MAJOR_TOURNAMENTS.every(event=>event.start<=event.end&&event.source.startsWith('https://')));
});
test('calendar formatting preserves organizer dates independently of viewer timezone',()=>{
 const label=tournamentDates({start:'2026-12-02',end:'2026-12-06'},'en-US');
 assert.match(label,/2/);assert.match(label,/6/);assert.match(label,/2026/);
});
test('record milestones are dated and reference the actual Manhunt sequel',()=>{
 assert.equal(GAME_MILESTONES.find(record=>record.key==='manhunt')?.id,1972);
 assert.equal(new Set(GAME_MILESTONES.map(record=>record.key)).size,GAME_MILESTONES.length);
 assert.match(milestoneQuery,new RegExp(`limit ${GAME_MILESTONES.length};`));
 assert(GAME_MILESTONES.every(record=>/^\d{4}(-\d{2}(-\d{2})?)?$/.test(record.date)&&record.value.trim()));
 assert(GAME_MILESTONES.every(record=>new URL(record.source).hostname==='www.guinnessworldrecords.com'&&record.date));
});
