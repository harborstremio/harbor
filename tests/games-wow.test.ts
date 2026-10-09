import assert from 'node:assert/strict';
import test from 'node:test';
import { activeWowPeriod, parseWowAffixes, parseWowPeriods, parseWowRaids, parseWowSeason, retryAfterTime, wowExpansion, wowImage, wowLocale } from '../src/lib/games/wow-data.ts';
import { canLaunchGame, isLauncherGameId, isRetailWow, launcherGameSummary, type LauncherGame, type LauncherScan } from '../src/lib/games/launchers.ts';
import { wowSeasonArt } from '../src/lib/games/wow-art.ts';
import { wowEncounterArt, wowRaidArt } from '../src/lib/games/wow-raid-art.ts';

const start = Date.parse('2026-09-29T15:00:00Z'), end = start + 7 * 86400_000;
const period = (n: number, offset = 0) => ({ period:n,start:new Date(start+offset).toISOString(),end:new Date(end+offset).toISOString() });
const affix = (extra = {}) => ({ id: 10, name: 'Fortified', description: 'Enemies have more health.', icon_url: 'https://cdn.raiderio.net/images/wow/icons/large/ability_toughness.jpg', ...extra });
const affixes = (extra = {}) => ({ region:'us', leaderboard_url:'https://raider.io/mythic-plus-affix-rankings/season-mn-2/all/us/leaderboards-strict/test', affix_details:[affix()], ...extra });
const dungeon = (extra = {}) => ({ id:1,slug:'test-dungeon',name:'Test dungeon',keystone_timer_seconds:1800,background_image_url:'https://cdn.raiderio.net/images/dungeons/expansion11/base/test.jpg',...extra });
const season = (extra = {}) => ({ slug:'season-mn-2',name:'MN Season 2',is_main_season:true,starts:{us:new Date(start).toISOString()},ends:{us:new Date(end).toISOString()},dungeons:[dungeon()],...extra });

test('Persisted launcher identities retain canonical content-ID sets and native bounds', () => {
  for(const id of ['battlenet:wow','battlenet:wow_classic_anniversary','ubisoft:4294967295','ea:Origin.OFR.50.000001','ea:A:1,B_2,C.3']) assert.equal(isLauncherGameId(id),true,id);
  for(const id of [null,12,'battlenet:','battlenet:WOW','ubisoft:0','ubisoft:01','ubisoft:4294967296','ea:B,A','ea:A,A','ea:A,,B','ea:hello/world','ea:'+ 'a'.repeat(129),'battlenet:bad\n','steam:123']) assert.equal(isLauncherGameId(id),false,String(id));
  const ids=Array.from({length:64},(_,i)=>String(i).padStart(2,'0')+'a'.repeat(126));
  assert.equal(isLauncherGameId('ea:'+ids.join(',')),true);assert.equal(isLauncherGameId('ea:'+[...ids,'zz'].join(',')),false);
});

test('Retail identity never follows a matching name or Classic installation into current Mythic+ data', () => {
  assert.equal(isRetailWow({id:'igdb:123',igdbId:123}),true);
  assert.equal(isRetailWow({id:'battlenet:wow'}),true);
  assert.equal(isRetailWow({id:'battlenet:wow_classic_anniversary',igdbId:123}),false);
  assert.equal(isRetailWow({id:'steam:123',steamId:123,igdbId:123}),false);
  assert.equal(isRetailWow({id:'custom:World of Warcraft'}),false);
});
test('Native library retains product/edition identity and requires client plus complete installation', () => {
  const retail:LauncherGame={id:'battlenet:wow',launcher:'battlenet',productId:'wow',name:'World of Warcraft',installPath:'F:\\World of Warcraft',state:'installed',launchMode:'play'};
  const classic={...retail,id:'battlenet:wow_classic',productId:'wow_classic',launchMode:'client' as const};
  assert.equal(launcherGameSummary(retail).igdbId,123); assert.equal(launcherGameSummary(classic).igdbId,undefined);
  const scan:LauncherScan={supported:true,clients:[{launcher:'battlenet',installed:true}],games:[retail,classic],warnings:[]};
  assert.equal(canLaunchGame(retail,scan),true);
  for(const state of ['missing','incomplete','ambiguous'] as const) assert.equal(canLaunchGame({...retail,state},scan),false);
  assert.equal(canLaunchGame(retail,{...scan,clients:[]}),false);
});
test('Regional reset selection handles future provider current periods, exact boundaries and expires', () => {
  const parsed=parseWowPeriods({periods:[{region:'us',previous:period(10,-7*86400_000),current:period(11),next:period(12,7*86400_000)}]});
  assert.equal(activeWowPeriod(parsed,'us',start)?.id,11); assert.equal(activeWowPeriod(parsed,'us',start-1)?.matchesProvider,false);
  assert.equal(activeWowPeriod(parsed,'us',end)?.id,12); assert.equal(activeWowPeriod(parsed,'us',end)?.matchesProvider,false);
  assert.equal(activeWowPeriod(parsed,'eu',start),null);assert.equal(activeWowPeriod(parsed,'us',end+7*86400_000),null);
  assert.throws(()=>parseWowPeriods({error:'offline'}));assert.throws(()=>parseWowPeriods({periods:[{region:'us',current:{period:1,start:'bad',end:'bad'}}]}));
});
test('Affixes require trustworthy season/region identity, deduplicate and reject provider failures', () => {
  const data=parseWowAffixes(affixes({affix_details:[affix(),affix(),affix({id:9,name:'Tyrannical'}),affix({id:20,name:''})]}));
  assert.deepEqual(data.affixes.map(x=>x.id),[10,9]);assert.equal(data.season,'season-mn-2');
  assert.throws(()=>parseWowAffixes(affixes({leaderboard_url:'https://raider.io.evil.test/mythic-plus-affix-rankings/season-mn-2/'})));
  assert.throws(()=>parseWowAffixes(affixes({region:'unknown'})));assert.throws(()=>parseWowAffixes({error:'offline'}));
});
test('Current dungeon pool matches exact main season and region; invalid timers and duplicate entries are excluded', () => {
  const result=parseWowSeason({seasons:[season({dungeons:[dungeon(),dungeon(),dungeon({id:2,keystone_timer_seconds:0}),dungeon({id:3})]})]},'season-mn-2','us');
  assert.deepEqual(result?.dungeons.map(x=>x.id),[1,3]);
  assert.equal(parseWowSeason({seasons:[season()]},'season-mn-3','us'),null);
  assert.equal(parseWowSeason({seasons:[season({is_main_season:false})]},'season-mn-2','us'),null);
  assert.throws(()=>parseWowSeason({seasons:[season()]},'season-mn-2','eu'));
  assert.equal(wowExpansion('season-mn-2'),11);assert.equal(wowExpansion('season-future-1'),null);
});
test('Raid encounters carry region dates and never fabricate missing bosses', () => {
  const data=parseWowRaids({raids:[{...season(),slug:'test-raid',name:'Test raid',icon:'achievement_boss_elitenagamale',encounters:[{name:'Boss one'},{name:''},{name:'Boss two'}]}]},'us');
  assert.deepEqual(data[0]?.bosses,[{id:null,slug:'',name:'Boss one'},{id:null,slug:'',name:'Boss two'}]);assert.equal(data[0]?.start,start);
  assert.equal(data[0]?.image,'https://cdn.raiderio.net/images/wow/icons/large/achievement_boss_elitenagamale.jpg');
  assert.equal(parseWowRaids({raids:[{...season(),slug:'test-raid',icon:'../../other',encounters:[{name:'Boss'}]}]},'us')[0]?.image,'');
  assert.deepEqual(parseWowRaids({raids:[{...season(),slug:'test-raid',encounters:[]}]},'us'),[]);
});
test('Official encounter art requires the exact raid, boss slug and provider ID', () => {
  const raw = {raids:[{...season(),slug:'the-venomous-abyss',encounters:[
    {id:197163,slug:'nekzali-the-soulcoiler',name:'A translated encounter name'},
    {id:-1,slug:'../invalid',name:'Still readable'},
  ]}]};
  const raid = parseWowRaids(raw,'us')[0]!;
  assert.ok(wowRaidArt(raid.slug)?.source.startsWith('https://news.blizzard.com/'));
  assert.ok(wowEncounterArt(raid.slug,raid.bosses[0]!).includes('8I2TB0943KH41785170425628'));
  assert.deepEqual(raid.bosses[1],{id:null,slug:'',name:'Still readable'});
  assert.equal(wowEncounterArt(raid.slug,raid.bosses[1]!), '');
  for(const boss of [{id:197164,slug:'nekzali-the-soulcoiler'},{id:null,slug:'nekzali-the-soulcoiler'},{id:197163,slug:'constructor'},{id:197163,slug:'future-boss'}]) assert.equal(wowEncounterArt(raid.slug,boss),'');
  assert.equal(wowEncounterArt('a-different-raid',raid.bosses[0]!), '');
  assert.equal(wowRaidArt('a-future-raid'),null);
});
test('Media allowlist, provider locale fallback and rate-limit cooldown are explicit', () => {
  assert.ok(wowImage(affix().icon_url));
  for(const url of ['javascript:alert(1)','http://cdn.raiderio.net/images/wow/icons/a.jpg','https://cdn.raiderio.net.evil.test/images/wow/icons/a.jpg','https://user@cdn.raiderio.net/images/wow/icons/a.jpg','https://cdn.raiderio.net/images/wow/icons/a.svg']) assert.equal(wowImage(url),'');
  assert.equal(wowLocale('zh'),'cn');assert.equal(wowLocale('de'),'de');assert.equal(wowLocale('ar'),'en');
  assert.equal(wowSeasonArt('season-future-1'),null);assert.equal(wowSeasonArt(undefined),null);assert.equal(wowSeasonArt('season-mn-2')?.name,'World of Warcraft: Midnight');
  assert.equal(retryAfterTime('120',start),start+120000);assert.equal(retryAfterTime(new Date(start+300000).toUTCString(),start),start+300000);assert.equal(retryAfterTime(null,start),start+60000);
});
