import assert from 'node:assert/strict';
import test from 'node:test';
import { isLeague, leagueLocale, leaguePatch, leagueKey, normalizeChampion, parseLeagueCatalog, parseLeagueKit, parseLeagueMeta, parseLeagueBuild, parseLeagueAssets, matchLeagueChampion } from '../src/lib/games/league-data.ts';
import { parseLeagueWire } from '../src/lib/games/league-wire.ts';
import { parseLeagueTiers, parseLeagueVersions } from '../src/lib/games/league-tier-data.ts';
import { officialGameDownload } from '../src/lib/games/official-download.ts';

const wire = (text: string) => ({ result: { content: [{ type: 'text', text }] } });
const patch = '16.19.1';
const rawChampion = {id:'Ahri',key:'103',name:'Ahri',title:'the Nine-Tailed Fox',tags:['Mage'],info:{difficulty:5}};
const champion = parseLeagueCatalog({version:patch,data:{Ahri:rawChampion}},patch)[0]!;

test('League identity excludes mobile, PBE, unrelated games and title lookalikes',()=>{
  assert.ok(isLeague({id:'igdb:115'}));assert.ok(isLeague({id:'riot:league_of_legends:live'}));
  for(const id of ['riot:league_of_legends:pbe','igdb:120059','steam:115','riot:valorant:live','League of Legends']) assert.equal(isLeague({id}),false);
});
test('OP.GG compact wire is parsed as data with escaped strings, arrays, null and zero',()=>{
  assert.deepEqual(parseLeagueWire(wire('class Result: items,value\nclass Entry: name,wins\n\nResult([Entry("A \\"name\\"",0)],null)'.replaceAll('\\\\"','\\"'))),{items:[{name:'A "name"',wins:0}],value:null});
  assert.deepEqual(parseLeagueWire(wire('{"items":[]}')),{items:[]});
  assert.deepEqual(parseLeagueWire({result:{structuredContent:{valid:true}}}),{valid:true});
});
test('Malformed compact responses, executable expressions and prototype keys fail closed',()=>{
  for(const s of ['class X: a\n\nX(alert(1))','class X: __proto__\n\nX(1)','class X: a\n\nX(1);process.exit()','class X: a\n\nX(1,2)','class X: a\n\nX("unterminated)','class X: a\n\nX(1e999)','class X: a,a\n\nX(1,2)']) assert.throws(()=>parseLeagueWire(wire(s)));
  assert.throws(()=>parseLeagueWire({result:{isError:true,content:[{text:'{}'}]}}));
  assert.throws(()=>parseLeagueWire(wire('class X: a\n\nX('+ '['.repeat(30)+'0'+']'.repeat(30)+')')));
});
test('Data Dragon validates patch and identity and constructs only original asset URLs',()=>{
  assert.match(champion.portrait,/\/16\.19\.1\/img\/champion\/Ahri\.png$/);
  assert.throws(()=>parseLeagueCatalog({version:'1.0',data:{Ahri:rawChampion}},patch));
  assert.throws(()=>parseLeagueCatalog({version:patch,data:{bad:{...rawChampion,id:'../evil'}}},patch));
  assert.equal(leaguePatch('../evil'),'');assert.equal(leagueKey('https://evil'),'');assert.equal(leagueLocale('ar'),'ar_AE');assert.equal(leagueLocale('hi'),'en_US');
  assert.equal(matchLeagueChampion([champion],'AHRI')?.id,103);
});
test('Lane sample uses actual wins/games and retains zero; malformed stats cannot become rankings',()=>{
  const valid={champion:'Ahri',play:1001,win:513,tier:1,rank:1,pick_rate:.09,ban_rate:.03};
  const meta=parseLeagueMeta({data:{positions:{mid:[valid,{...valid},{...valid,champion:'Zero',win:0},{...valid,champion:'Bad',win:1002},{...valid,champion:'BadRate',pick_rate:9}]}}});
  assert.equal(meta.length,2);assert.equal(meta[0]!.winRate,513/1001);assert.equal(meta[1]!.winRate,0);assert.equal(meta[0]!.role,'mid');
  assert.throws(()=>parseLeagueMeta({data:{positions:{mid:[]}}}));
});
test('Build sample identity, counters perspective, patch and safe videos are kept distinct',()=>{
  const raw={champion:'AHRI',position:'MID',data:{summary:{id:103},core_items:{ids:[3118,3157],play:1000,win:530,pick_rate:.2},trends:{win:{version:'16.19',created_at:'2026-10-01T10:00:00Z'}},weak_counters:[{champion_id:142,champion_name:'Zoe',play:200,win:90,my_win_rate:.45,counter_win_rate:.55,win_rate:.55}],strong_counters:[{champion_id:54,champion_name:'Malphite',play:60,my_win_rate:.6}],skills:{order:['Q','W','E','bad']},skill_combos:[{name:'E Flash',video_url:'https://www.youtube.com/watch?v=H3c3Kqd2beI'},{name:'Unsafe',video_url:'https://evil.test/watch?v=H3c3Kqd2beI'}]}};
  const build=parseLeagueBuild(raw,champion,'mid');assert.equal(build.weak[0]!.winRate,.45);assert.equal(build.strong[0]!.winRate,.6);assert.equal(build.core!.games,1000);assert.equal(build.videos.length,1);assert.equal(build.patch,'16.19');assert.deepEqual(build.skillOrder,['Q','W','E']);
  assert.throws(()=>parseLeagueBuild(raw,champion,'top'));assert.throws(()=>parseLeagueBuild({...raw,data:{...raw.data,summary:{id:99}}},champion,'mid'));
});
test('Missing builds remain missing instead of producing invented items or zero rates',()=>{
  const build=parseLeagueBuild({position:'MID',data:{summary:{id:103},core_items:{ids:[1],play:10,win:20}}},champion,'mid');
  assert.equal(build.core,null);assert.equal(build.runes,null);assert.deepEqual(build.weak,[]);assert.equal(build.patch,'');assert.equal(build.sourceAt,0);
});
test('Champion spells strip source markup, require five abilities and reject other identities',()=>{
  const data={...rawChampion,passive:{name:'Passive',description:'<b>Heal</b>',image:{full:'Ahri_Passive.png'}},spells:['Q','W','E','R'].map(id=>({name:id,description:'<script>bad</script>Text',image:{full:`Ahri${id}.png`},cooldownBurn:'7/6/5'}))};
  const result=parseLeagueKit({version:patch,data:{Ahri:data}},champion,patch);assert.equal(result.abilities.length,5);assert.equal(result.abilities[0]!.description,'Heal');assert.equal(result.abilities[1]!.description.includes('<'),false);
  assert.throws(()=>parseLeagueKit({version:patch,data:{Ahri:{...data,id:'Jinx'}}},champion,patch));
});
test('Item/spell/rune metadata keeps real names and rejects traversal or external artwork',()=>{
  const data=parseLeagueAssets({data:{'3118':{name:'Malignance',image:{full:'3118.png'},plaintext:'Ability haste'},'123':{name:'Bad',image:{full:'../../evil.png'}}}},patch,'item');
  assert.equal(Object.keys(data).length,1);assert.equal(data[3118]!.name,'Malignance');assert.ok(data[3118]!.image.startsWith('https://ddragon.leagueoflegends.com/'));
});

test('Tier history validates patch scope and keeps each role and its exact sample',()=>{
  const stats={play:12345,win_rate:.512345,pick_rate:.123,ban_rate:.056,tier_data:{tier:0,rank:1}};
  const data=[{id:103,positions:[{name:'MID',stats},{name:'SUPPORT',stats:{...stats,tier_data:{tier:3,rank:20}}}]}];
  const raw={data,meta:{version:'16.18',analyzed_at:'2026-09-20T01:00:00Z',match_count:1_234_567}};
  const result=parseLeagueTiers(raw,'16.18');
  assert.equal(result.rows.length,2);assert.equal(result.rows[0]!.winRate,.512345);assert.equal(result.rows[0]!.tier,0);assert.equal(result.rows[1]!.role,'support');assert.equal(result.matches,1_234_567);
  assert.throws(()=>parseLeagueTiers(raw,'16.19'));
  assert.throws(()=>parseLeagueTiers({...raw,meta:{...raw.meta,analyzed_at:'invalid'}},'16.18'));
  assert.throws(()=>parseLeagueTiers({...raw,data:[{id:103,positions:[{name:'MID',stats:{...stats,win_rate:1.5}}]}]},'16.18'));
  assert.equal(parseLeagueTiers({...raw,data:[...data,...data]},'16.18').rows.length,2);
});

test('Patch options come from valid distinct provider versions',()=>{
  assert.deepEqual(parseLeagueVersions({data:['16.19','16.18','16.19','../../evil',null]}),['16.19','16.18']);
  assert.throws(()=>parseLeagueVersions({data:[]}));
});

test('Non-Latin champion searches and English provider aliases survive localization',()=>{
  assert.equal(normalizeChampion('阿狸'),'阿狸');assert.notEqual(normalizeChampion('阿狸'),normalizeChampion('金克丝'));
  assert.equal(normalizeChampion('Élise'),'elise');
  assert.equal(matchLeagueChampion([{...champion,id:20,key:'Nunu',name:'누누와 윌럼프'}],'Nunu & Willump')?.id,20);
  assert.equal(matchLeagueChampion([{...champion,id:888,key:'Renata',name:'Рената Гласк'}],'Renata Glasc')?.id,888);
});

test('Official sources route exact League and WoW products to their publishers',()=>{
  for(const id of ['igdb:115','riot:league_of_legends:live']) assert.equal(new URL(officialGameDownload({id})!.href).hostname,'www.leagueoflegends.com');
  for(const id of ['igdb:123','igdb:75379','battlenet:wow','battlenet:wow_classic','battlenet:wow_classic_era','battlenet:wow_classic_anniversary']) { const source=officialGameDownload({id})!;assert.equal(source.launcher,'Battle.net');assert.equal(new URL(source.href).searchParams.get('product'),'wow'); }
  for(const id of ['steam:123','riot:league_of_legends:pbe','igdb:120059','battlenet:war3','World of Warcraft','wow']) assert.equal(officialGameDownload({id}),null);
});
