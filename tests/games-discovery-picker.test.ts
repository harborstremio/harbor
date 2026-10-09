import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {discoveryDefaults,discoveryQueries,discoveryQueryStages,discoverySignals,observeSteamLibrary,rankDiscovery,tagVector,tagSimilarity,type DiscoveryCandidate,type DiscoveryTaste} from '../src/lib/games/discovery-picker.ts';
import {readDiscoveryPreferences,writeDiscoveryPreferences,discoveryPreferences} from '../src/lib/games/discovery-picker-storage.ts';
import {parseDiscoveryMetadata,atlasDiscoveryTags} from '../src/lib/games/discovery-picker-data.ts';
import {decodeIgdbRows} from '../src/lib/games/igdb-records.ts';
const now=Date.UTC(2026,9,4);
const game=(id:number,extra={})=>({id:`steam:${id}`,steamId:id,name:`Game ${id}`,capsule:`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,platforms:['Windows'],adultContent:false,...extra});
const tags=(...ids:number[])=>ids.map((id,i)=>({id,weight:100-i*3}));
const candidate=(id:number,tagIds=[1199779,3859],extra={}):DiscoveryCandidate=>({game:game(id),tags:tags(...tagIds),reviews:{positive:90,count:1000},controller:false,...extra});
const taste=(id:number,tagIds:number[],weight=5):DiscoveryTaste=>({signal:{game:game(id),reason:'favorite',weight},tags:tags(...tagIds)});
const owned=(id:number,extra={})=>({appId:id,name:`Game ${id}`,minutes:0,recentMinutes:0,lastPlayed:0,...extra});
const steam=(ids:number[],extra={})=>({steamId:'76561198000000001',name:'Test',avatar:'',libraryVisible:true,games:ids.map(id=>owned(id)),updatedAt:now,...extra});

test('exact retrieval leads; closest alternatives keep multiplayer required',()=>{
 const options={...discoveryDefaults(),tags:[1199779],modes:[3859]};
 const seeds=[taste(1,[1662,1695]),taste(2,[1774,19]),taste(3,[1742,21]),taste(4,[1667,3859])];
 const lanes=discoveryQueries(options,seeds);assert.equal(lanes.length,4);
 for(const lane of lanes)for(const tag of [1199779,3859])assert.ok(lane.tags.includes(tag));
 const results=rankDiscovery([candidate(10),candidate(11,[1199779]),candidate(12,[3859]),candidate(13,[1662,3859])],seeds,options,[],now);
 assert.equal(results[0].game.steamId,10);assert.deepEqual(new Set(results.map(p=>p.game.steamId)),new Set([10,12,13]));
 assert.deepEqual(results[0].missingTags,[]);assert.deepEqual(results[1].missingTags,[1199779]);
 for(const stage of discoveryQueryStages(options,seeds))for(const lane of stage)assert.ok(lane.tags.includes(3859));
});
test('shooter, roguelite, relaxing and online co-op automatically widen to useful intersections',()=>{
 const options={...discoveryDefaults(),tags:[1774,3959,1654],modes:[3843],platform:'linux' as const,price:'free' as const,controller:true};
 const stages=discoveryQueryStages(options,[]);
 assert.deepEqual(stages[0][0].tags,[1774,3959,1654,3843]);
 assert.ok(stages[1].some(query=>query.tags.includes(1774)&&query.tags.includes(3959)&&!query.tags.includes(1654)));
 assert.ok(stages.at(-1)!.some(query=>query.tags.length===1&&query.tags[0]===3843));
 for(const stage of stages){assert.ok(stage.length<=4);for(const query of stage){assert.ok(query.tags.includes(3843));assert.equal(query.platform,'linux');assert.equal(query.price,'free');assert.equal(query.controller,true);}}
 const keys=stages.flat().map(query=>query.tags.slice().sort((a,b)=>a-b).join(','));assert.equal(new Set(keys).size,keys.length);
});
test('exact and closer matches stay ahead of popular loose matches even after diversity',()=>{
 const options={...discoveryDefaults(),tags:[1774,3959,1654],modes:[3843]};
 const results=rankDiscovery([
  candidate(10,[1774,3959,1654,3843],{reviews:{positive:60,count:20}}),
  candidate(11,[1774,3959,3843],{reviews:{positive:85,count:300}}),
  candidate(12,[1774,3843],{reviews:{positive:100,count:100000}}),
  candidate(13,[3843],{reviews:{positive:100,count:100000}}),
  candidate(14,[1774,3959,1654]),
  candidate(15,[1774,3959,1654,3843],{reviews:{positive:60,count:20}}),
 ],[],options,[],now);
 assert.deepEqual(results.map(p=>p.matchedTags.length),[3,3,2,1,0]);
 assert.deepEqual(results.find(p=>p.game.steamId===11)?.missingTags,[1654]);
 assert.deepEqual(results.find(p=>p.game.steamId===11)?.sharedTags,[1774,3959]);
 assert.ok(!results.some(p=>p.game.steamId===14));
});
test('fallback cannot leak owned, dismissed, adult, unavailable or incompatible games',()=>{
 const options={...discoveryDefaults(),tags:[1774,3959,1654],modes:[3843],platform:'linux' as const,price:'free' as const,controller:true,excluded:[3]};
 const valid={game:game(1,{platforms:['Linux'],price:{amount:0,currency:'USD',discount:0}}),controller:true};
 const make=(id:number,extra={})=>candidate(id,[3843],{...valid,game:{...valid.game,id:`steam:${id}`,steamId:id},...extra});
 const results=rankDiscovery([make(1),make(2),make(3),make(4,{controller:false}),make(5,{game:game(5,{adultContent:true})}),make(6,{game:game(6,{comingSoon:true})}),make(7,{game:game(7,{platforms:['Windows']})}),make(8,{game:game(8,{platforms:['Linux'],price:{amount:1999,currency:'USD',discount:0}})})],[],options,[game(2)],now);
 assert.deepEqual(results.map(p=>p.game.steamId),[1]);assert.deepEqual(results[0].missingTags,[1774,3959,1654]);
});
test('empty, single, duplicate and many mood selections have bounded non-repeating stages',()=>{
 for(const moods of [[],[1774],[1774,1774],Array.from({length:30},(_,i)=>1000+i)]){
  const stages=discoveryQueryStages({...discoveryDefaults(),tags:moods,modes:[3843]},[]);
  assert.ok(stages.length<=3);for(const stage of stages)assert.ok(stage.length<=4);
  const keys=stages.flat().map(query=>query.tags.slice().sort((a,b)=>a-b).join(','));assert.equal(new Set(keys).size,keys.length);
 }
 assert.deepEqual(discoveryQueryStages({...discoveryDefaults(),scope:'library',tags:[1774,3959]},[]),[[]]);
});
test('explicit taste can outrank popular unrelated games, generic multiplayer is weak evidence',()=>{
 const seeds=[taste(1,[1199779,1662,3859])];
 const results=rankDiscovery([candidate(10,[1199779,1662,3859]),candidate(11,[1664,1654,3859],{reviews:{positive:99,count:1000000}})],seeds,discoveryDefaults(),[],now);
 assert.equal(results[0].game.steamId,10);assert.equal(results[0].seed?.game.steamId,1);assert.ok(results[0].sharedTags.includes(1199779));
 assert.ok(tagSimilarity(tagVector(tags(1199779,1662,3859)),tagVector(tags(1664,1654,3859)))<.1);
});
test('ratings account for small samples; review score is never the internal affinity',()=>{
 const results=rankDiscovery([candidate(10,[],{reviews:{positive:100,count:1}}),candidate(11,[],{reviews:{positive:95,count:10000}})],[],discoveryDefaults(),[],now);
 assert.equal(results[0].game.steamId,11);assert.equal(results[0].reviews?.positive,95);assert.ok(results[0].score<1);
});
test('a defining genre outranks an incidental tag when that genre is explicitly requested',()=>{
 const options={...discoveryDefaults(),tags:[1199779],modes:[3859]};
 const primary=candidate(10,[1199779,3859]);
 const incidental=candidate(11,[1664,3859],{tags:[{id:1664,weight:1000},{id:3859,weight:900},{id:1199779,weight:3}],reviews:{positive:99,count:20000}});
 assert.equal(rankDiscovery([incidental,primary],[],options,[],now)[0].game.steamId,10);
});
test('large pools are shortlisted by merit before diversity, keeping a strong late candidate',()=>{
 const rows=Array.from({length:480},(_,i)=>candidate(i+1,[],{reviews:{positive:60,count:200}}));
 rows[479]=candidate(480,[],{reviews:{positive:98,count:10000}});
 const results=rankDiscovery(rows,[],discoveryDefaults(),[],now);assert.equal(results.length,120);assert.equal(results[0].game.steamId,480);
});
test('owned aliases, favorites, dismissed games, unreleased and unknown adult metadata are excluded',()=>{
 const rows=[candidate(1),candidate(2),candidate(3)];
 rows.push(candidate(4,[],{game:game(4,{comingSoon:true})}),candidate(5,[],{game:game(5,{adultContent:undefined})}),candidate(6,[],{game:game(6,{adultContent:true})}),candidate(7));
 assert.deepEqual(rankDiscovery(rows,[taste(1,[1199779])],{...discoveryDefaults(),excluded:[3]},[game(2,{id:'igdb:22',igdbId:22})],now).map(p=>p.game.steamId),[7]);
 assert.deepEqual(rankDiscovery(rows,[],{...discoveryDefaults(),scope:'library'},[game(2)],now).map(p=>p.game.steamId),[2]);
});
test('all platform, free, discount, controller and discovery directions enforce actual metadata',()=>{
 const rows=[candidate(1,[],{game:game(1,{platforms:['Linux'],price:{amount:0,currency:'USD',discount:0},releaseTimestamp:now/1000-100}),controller:true}),candidate(2,[],{game:game(2,{price:{amount:2000,currency:'USD',discount:25}}),reviews:{positive:84,count:100}})];
 assert.equal(rankDiscovery(rows,[],{...discoveryDefaults(),platform:'linux',price:'free',controller:true},[],now)[0].game.steamId,1);
 assert.equal(rankDiscovery(rows,[],{...discoveryDefaults(),price:'offers'},[],now)[0].game.steamId,2);
 assert.deepEqual(rankDiscovery(rows,[],{...discoveryDefaults(),direction:'acclaimed'},[],now).map(p=>p.game.steamId),[1]);
 assert.equal(rankDiscovery(rows,[],{...discoveryDefaults(),direction:'hidden'},[],now).length,2);
 assert.deepEqual(rankDiscovery(rows,[],{...discoveryDefaults(),direction:'recent'},[],now).map(p=>p.game.steamId),[1]);
 assert.deepEqual(discoveryQueries({...discoveryDefaults(),scope:'library'},[]),[]);
});
test('initial Steam import and account changes never invent purchase dates',()=>{
 const baseline=observeSteamLibrary(null,steam([1,2]),now);assert.deepEqual(baseline.added,[]);
 const added=observeSteamLibrary(baseline,steam([1,2,3]),now+1000);assert.deepEqual(added.added,[{id:3,at:now+1000}]);
 assert.deepEqual(observeSteamLibrary(added,steam([1,2,3],{steamId:'76561198000000002'}),now+2000).added,[]);
 assert.deepEqual(observeSteamLibrary(added,steam([],{libraryVisible:false}),now),added);
 assert.deepEqual(observeSteamLibrary(added,steam([1,2,3]),now+31*86400000).added,[]);
});
test('favorite seeds coexist with recent play, most played, newly added and saved signals',()=>{
 const account=steam([6,7,8,9,10,11],{games:[owned(6,{recentMinutes:100}),owned(7,{recentMinutes:90}),owned(8,{minutes:5000}),owned(9,{minutes:4000}),owned(10),owned(11)]});
 const result=discoverySignals([1,2,3,4,5].map(id=>game(id)),[game(12)],{games:[],recent:[]},account,[],{account:account.steamId,ids:[],added:[{id:10,at:now},{id:11,at:now}]},true,now);
 assert.equal(result.filter(s=>s.reason==='favorite').length,5);
 for(const reason of ['recent','mostPlayed','added','saved'])assert.ok(result.some(s=>s.reason===reason));
 assert.equal(result.length,12);
 assert.deepEqual(discoverySignals([game(1)],[game(12)],{games:[],recent:[]},account,[],null,false,now).map(s=>s.reason),['favorite']);
 assert.equal(discoverySignals([],[],{games:[],recent:[]},{...account,libraryVisible:false},[],null,true,now).length,0);
});
test('IGDB taxonomy maps names, not numeric provider IDs',()=>{
 assert.deepEqual(atlasDiscoveryTags({genres:[{id:1199779,name:'Role-playing (RPG)'}],keywords:[{name:'Extraction Shooter'}],game_modes:[{name:'Co-operative'}]},[{id:122,name:'RPG'},{id:1199779,name:'Extraction Shooter'},{id:1685,name:'Co-op'}]),tags(122,1685,1199779).map(t=>({...t,weight:1})));
  assert.deepEqual(atlasDiscoveryTags({genres:[{id:1199779,name:'Unknown'}]},[{id:1199779,name:'Extraction Shooter'}]),[]);
 const decoded=decodeIgdbRows([{id:15536,name:'Escape from Tarkov',keywords:[{id:9,name:'Extraction Shooter'},{id:0,name:'Invalid'}]}]);
 assert.deepEqual(atlasDiscoveryTags(decoded?.[0],[{id:1199779,name:'Extraction Shooter'}]),[{id:1199779,weight:1}]);
});
test('an exact Steam counterpart of an IGDB favorite is never recommended back to the user',()=>{
 const seed={...taste(1,[1199779]),signal:{game:game(1,{id:'igdb:15536',igdbId:15536}),reason:'favorite' as const,weight:5}};
 assert.deepEqual(rankDiscovery([candidate(1),candidate(2)],[seed],discoveryDefaults(),[],now).map(p=>p.game.steamId),[2]);
});
test('profile preferences isolate favorites, sanitize identifiers, and tolerate corrupt data',()=>{
 const records=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>records.get(k)??null,setItem:(k:string,v:string)=>records.set(k,v)}});
 const prefs=discoveryPreferences();prefs.favorites=[game(1)];prefs.options.tags=[1199779,9000000];prefs.options.history=false;writeDiscoveryPreferences('one',prefs);
 assert.equal(readDiscoveryPreferences('one').favorites[0].steamId,1);assert.equal(readDiscoveryPreferences('one').options.history,false);assert.deepEqual(readDiscoveryPreferences('one').options.tags,[1199779,9000000]);
 assert.equal(readDiscoveryPreferences('two').favorites.length,0);
 records.set('harbor.games.discovery-picker.v1:one','broken');assert.deepEqual(readDiscoveryPreferences('one'),discoveryPreferences());
 records.set('harbor.games.discovery-picker.v1:one',JSON.stringify({version:1,options:{tags:[-1,0,'1',1199779,1199779],scope:'secret'},favorites:[{id:'steam:1',name:'wrong'}]}));
 assert.deepEqual(readDiscoveryPreferences('one').options.tags,[1199779]);assert.equal(readDiscoveryPreferences('one').options.scope,'new');assert.equal(readDiscoveryPreferences('one').favorites.length,0);
});
test('metadata errors are not valid empty recommendations',()=>{
 assert.throws(()=>parseDiscoveryMetadata({},[1]));assert.throws(()=>parseDiscoveryMetadata({response:{store_items:[]}},[1]));
});
test('all 16 locale modules contain the same keys and interpolation tokens',()=>{
 const read=(lang:string)=>JSON.parse(fs.readFileSync(new URL(`../src/lib/i18n/locales/${lang}/game-discovery-picker.ts`,import.meta.url),'utf8').replace('export default','').replace(/,?\s*};\s*$/,'}'));
 const english=read('en'),tokens=(value:string)=>[...value.matchAll(/\{\w+\}/g)].map(match=>match[0]).sort();
 for(const lang of ['en','ar','de','es','fr','hi','id','it','ja','ko','pl','pt','ru','tr','vi','zh']){
  const data=read(lang);assert.deepEqual(Object.keys(data),Object.keys(english));
  for(const key of Object.keys(english)){assert.ok(data[key].trim());assert.deepEqual(tokens(data[key]),tokens(english[key]));}
  const root=fs.readFileSync(new URL(`../src/lib/i18n/locales/${lang}.ts`,import.meta.url),'utf8');assert.ok(root.includes('...gameDiscoveryPicker,'));
 }
});
