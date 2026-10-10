import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRecommendationLibrary,recommendationExclusions,chooseRecommendationSeeds,rankRecommendations,recommendationDefaults,readRecommendationPreferences,writeRecommendationPreferences,excludeRecommendationSeed,restoreRecommendationSeed,hideRecommendation,restoreRecommendation,recommendationChoice,hiddenRecommendationChoices} from '../src/lib/games/recommendations.ts';
import { emptyLaunchConfig } from '../src/lib/games/custom-library.ts';
import {EMPTY_EMULATION,folderKey} from '../src/lib/games/emulation.ts';
import { recommendationPlatformNames, recommendationsForPlatform } from '../src/lib/games/recommendations.ts';
const game=(id:number,extra={})=>({id:`steam:${id}`,steamId:id,name:`Game ${id}`,capsule:'https://example.test/art.jpg',portrait:'https://example.test/cover.jpg',platforms:[],...extra});
const installed=(id:number,at:number)=>({appId:id,name:`Game ${id}`,lastPlayed:at,installPath:'W:/Games/'+id,libraryPath:'W:/Games',sizeBytes:100,state:'installed' as const});

test('platform choices reconcile provider PC names without inventing console or emulation compatibility',()=>{
 const names=recommendationPlatformNames(game(1,{platforms:['PC (Microsoft Windows)','Windows',' Mac ','macOS','Linux','PlayStation 4','PlayStation 5','Nintendo Switch','Nintendo Switch 2','Game Boy Advance']}));
 assert.deepEqual(names,['Windows','macOS','Linux','PlayStation 4','PlayStation 5','Nintendo Switch','Nintendo Switch 2','Game Boy Advance']);
 const seed={game:game(1),reason:'saved' as const};
 const picks=rankRecommendations([{seed,games:[game(2,{platforms:['Nintendo Switch 2']}),game(3,{platforms:['Nintendo Switch']}),game(4,{platforms:[]}),game(5,{platforms:['Game Boy Advance']})]}],[],[]);
 assert.deepEqual(recommendationsForPlatform(picks,'Nintendo Switch').map(p=>p.game.steamId),[3]);
 assert.deepEqual(recommendationsForPlatform(picks,'Windows'),[]);
 assert.equal(recommendationsForPlatform(picks,'all').length,4);
});

test('platform selection searches all eligible related games beyond the former 24-card cutoff',()=>{
 const games=Array.from({length:30},(_,i)=>game(i+10,{platforms:[i<25?'Windows':'Game Boy Advance']}));
 const seed={game:game(1),reason:'played' as const};
 const picks=rankRecommendations([{seed,games}], [game(37)], ['steam:38'], Infinity);
 assert.deepEqual(recommendationsForPlatform(picks,'Game Boy Advance').map(p=>p.game.steamId),[35,36,39]);
 assert.equal(picks.length,28);assert.equal(picks[25].seed.reason,'played');
});

test('platform preference survives hide/undo and profile reload; legacy and invalid values stay unrestricted',()=>{
 const memory=new Map();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
 const chosen={...recommendationDefaults(),platform:'PlayStation 5'};
 const restored=restoreRecommendation(hideRecommendation(chosen,game(2)),recommendationChoice(game(2)));
 writeRecommendationPreferences('platform-review',restored);
 assert.equal(readRecommendationPreferences('platform-review').platform,'PlayStation 5');
 assert.equal(readRecommendationPreferences('separate-profile').platform,'all');
 for(const platform of [undefined,{},'','x'.repeat(97),'Windows\nLinux']) {
  memory.set('harbor.games.recommendations.v1:legacy-platform',JSON.stringify({version:1,platform}));
  assert.equal(readRecommendationPreferences('legacy-platform').platform,'all');
 }
 memory.set('harbor.games.recommendations.v1:legacy-platform',JSON.stringify({version:1,platform:'PC (Microsoft Windows)'}));
 assert.equal(readRecommendationPreferences('legacy-platform').platform,'Windows');
});
test('saved/recent signals interleave and deduplicate the same game across providers',()=>{
 const saved=[game(1,{igdbId:11}),game(2),game(3)],recent=[installed(1,100),installed(4,50),installed(5,20)];
 const seeds=chooseRecommendationSeeds(saved,recent,EMPTY_EMULATION(),recommendationDefaults());assert.deepEqual(seeds.map(s=>s.game.steamId),[1,2,4,3]);assert.deepEqual(seeds.map(s=>s.reason),['saved','saved','played','saved']);
 assert.deepEqual(chooseRecommendationSeeds(saved,recent,EMPTY_EMULATION(),{...recommendationDefaults(),saved:false}).map(s=>s.game.steamId),[1,4,5]);
 assert.deepEqual(chooseRecommendationSeeds(saved,recent,EMPTY_EMULATION(),{...recommendationDefaults(),saved:false,recent:false}),[]);
});
test('confirmed retro metadata participates in recent play without filename guesses',()=>{
 const path='W:/Games/Pocket.gba',store={...EMPTY_EMULATION(),folders:[{id:'folder',root:'W:/Games',system:24,games:[{path,name:'filename',sizeBytes:1,system:24,format:'GBA',available:true,discs:1}],skipped:0,limited:false,scannedAt:1}],lastPlayed:{[path]:200},matches:{[folderKey(path,24)]:game(7,{id:'igdb:7',steamId:undefined,igdbId:7})}};
 assert.equal(chooseRecommendationSeeds([],[],store,recommendationDefaults())[0].game.igdbId,7);assert.equal(chooseRecommendationSeeds([],[],{...store,matches:{}},recommendationDefaults()).length,0);
});
test('suggestions rotate seed origins, exclude known/hidden identities and collapse aliases',()=>{
 const a={game:game(1),reason:'saved' as const},b={game:game(2),reason:'played' as const};
 const groups=[{seed:a,games:[game(10),game(11,{igdbId:111}),game(12),game(1)]},{seed:b,games:[game(20),game(21,{igdbId:111}),game(22),game(23,{portrait:undefined})]}];
 const result=rankRecommendations(groups,[game(10)],['steam:22']);assert.deepEqual(result.map(p=>p.game.steamId),[11,20,12]);assert.deepEqual(result.map(p=>p.seed.reason),['saved','played','saved']);assert.equal(rankRecommendations(groups,[],[],2).length,2);
});
test('discovery choices are profile-local and unsafe stored entries do not survive',()=>{
 const memory=new Map();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
 writeRecommendationPreferences('a/b',{...recommendationDefaults(),saved:false,hidden:['steam:12','javascript:x']});assert.equal(readRecommendationPreferences('a/b').saved,false);assert.deepEqual(readRecommendationPreferences('a/b').hidden,['steam:12']);assert.equal(readRecommendationPreferences('a%2Fb').saved,true);
});

test('excluding an influence fills its slot beyond the first four saved games and preserves the library',()=>{
 const saved=Array.from({length:9},(_,i)=>game(i+1,{igdbId:i+101})),original=structuredClone(saved);
 let preferences=recommendationDefaults();for(const seed of saved.slice(0,5))preferences=excludeRecommendationSeed(preferences,seed);
 assert.deepEqual(chooseRecommendationSeeds(saved,[],EMPTY_EMULATION(),preferences).map(s=>s.game.steamId),[6,7,8,9]);
 assert.deepEqual(saved,original);
 preferences=restoreRecommendationSeed(preferences,recommendationChoice(saved[1]));
 assert.deepEqual(chooseRecommendationSeeds(saved,[],EMPTY_EMULATION(),preferences).map(s=>s.game.steamId),[2,6,7,8]);
});

test('influence exclusions cover verified provider aliases, including recent play, and keep editions distinct',()=>{
 const preferences=excludeRecommendationSeed(recommendationDefaults(),game(1,{igdbId:101}));
 const seeds=chooseRecommendationSeeds([game(1,{id:'igdb:101',steamId:undefined,igdbId:101}),game(2,{id:'igdb:102',steamId:undefined,igdbId:102})],[installed(1,200),installed(3,100)],EMPTY_EMULATION(),preferences);
 assert.deepEqual(seeds.map(seed=>seed.game.id),['igdb:102','steam:3']);
});

test('individual restoration and undo preserve later choices and toggles while clearing every alias',()=>{
 const first=game(10,{igdbId:110}),second=game(20,{igdbId:120});
 let preferences=hideRecommendation(hideRecommendation(recommendationDefaults(),first),second);
 preferences={...excludeRecommendationSeed(preferences,game(30)),recent:false};
 preferences=restoreRecommendation(preferences,recommendationChoice(first));
 assert.deepEqual(preferences.hidden,['steam:20','igdb:120']);assert.equal(preferences.recent,false);assert.equal(preferences.excludedSeeds[0].id,'steam:30');
 assert.deepEqual(hiddenRecommendationChoices(preferences).map(choice=>choice.name),['Game 20']);
});

test('hidden aliases merge metadata without creating duplicate history entries',()=>{
 let preferences=hideRecommendation(recommendationDefaults(),game(10,{igdbId:110}));
 preferences=hideRecommendation(preferences,game(10,{id:'igdb:110',steamId:undefined,igdbId:110}));
 assert.equal(preferences.hiddenGames.length,1);
 preferences=restoreRecommendation(preferences,recommendationChoice(game(10,{id:'igdb:110',steamId:undefined,igdbId:110})));
 assert.deepEqual(preferences.hidden,[]);assert.deepEqual(preferences.hiddenGames,[]);
});

test('legacy exclusions remain restorable by ID and new named choices survive profile reload',()=>{
 const memory=new Map();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
 memory.set('harbor.games.recommendations.v1:old',JSON.stringify({version:1,saved:false,recent:true,hidden:['igdb:123','steam:456']}));
 const legacy=readRecommendationPreferences('old');assert.deepEqual(legacy.excludedSeeds,[]);assert.deepEqual(hiddenRecommendationChoices(legacy).map(choice=>choice.name),['igdb:123','steam:456']);
 const restored=restoreRecommendation(legacy,hiddenRecommendationChoices(legacy)[0]);assert.deepEqual(restored.hidden,['steam:456']);
 const preferences=excludeRecommendationSeed(hideRecommendation(restored,game(12,{igdbId:112})),game(15));
 writeRecommendationPreferences('old',preferences);assert.deepEqual(readRecommendationPreferences('old'),preferences);assert.deepEqual(readRecommendationPreferences('other'),recommendationDefaults());
});

test('untrusted preference metadata is bounded and unsafe images and identities are discarded',()=>{
 const memory=new Map();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
 const choice={id:'steam:12',name:'x'.repeat(500),identities:['steam:12','javascript:x','igdb:112'],image:'javascript:alert(1)'};
 memory.set('harbor.games.recommendations.v1:bounded',JSON.stringify({version:1,hidden:['steam:12'],hiddenGames:[choice,{id:'javascript:x',name:'Bad'}],excludedSeeds:[choice]}));
 const read=readRecommendationPreferences('bounded');assert.equal(read.hiddenGames.length,1);assert.equal(read.hiddenGames[0].name.length,200);assert.equal(read.hiddenGames[0].image,undefined);assert.deepEqual(read.hidden,['steam:12','igdb:112']);assert.deepEqual(read.excludedSeeds[0].identities,['steam:12','igdb:112']);
});

test('unmatched local entries cannot consume influence slots or trigger impossible catalog lookups',()=>{
 const unmatched=Array.from({length:5},(_,i)=>game(i,{id:'custom:'+i,steamId:undefined,igdbId:undefined}));
 const seeds=chooseRecommendationSeeds([...unmatched,game(10),game(11,{id:'launcher:gog:11'})],[],EMPTY_EMULATION(),recommendationDefaults());
 assert.deepEqual(seeds.map(seed=>seed.game.steamId),[10,11]);
 const choice=recommendationChoice(seeds[1].game);assert.equal(choice.id,'steam:11');
 assert.equal(chooseRecommendationSeeds([seeds[1].game],[],EMPTY_EMULATION(),excludeRecommendationSeed(recommendationDefaults(),seeds[1].game)).length,0);
});

test('uninstalled Steam ownership participates in exclusion and its recorded history remains an influence',()=>{
 const now=2_000_000_000_000,owned=[{appId:10,name:'Account only',minutes:90,recentMinutes:30,lastPlayed:now/1000-20},{appId:11,name:'Never played',minutes:0,recentMinutes:0,lastPlayed:0}];
 const context={steam:{steamId:'account',name:'Fixture',avatar:'',games:owned,libraryVisible:true,updatedAt:now/1000-5}};
 const library=buildRecommendationLibrary([],EMPTY_EMULATION(),context,now);
 assert.deepEqual(library.games.map(game=>game.steamId),[10,11]);assert.equal(library.steamSyncedAt,now/1000-5);
 const seeds=chooseRecommendationSeeds([],[],EMPTY_EMULATION(),recommendationDefaults(),library);assert.deepEqual(seeds.map(seed=>seed.game.steamId),[10]);
 const groups=[{seed:{game:game(1),reason:'saved' as const},games:[game(10),game(11),game(12)]}];
 assert.deepEqual(rankRecommendations(groups,recommendationExclusions([],library,recommendationDefaults()),[]).map(pick=>pick.game.steamId),[12]);
});

test('private or absent Steam ownership never fabricates matches or play history',()=>{
 const steam={steamId:'private',name:'Fixture',avatar:'',games:[{appId:20,name:'Stale private item',minutes:30,recentMinutes:0,lastPlayed:100}],libraryVisible:false,updatedAt:200};
 const library=buildRecommendationLibrary([installed(3,50)],EMPTY_EMULATION(),{steam});
 assert.deepEqual(library.games.map(game=>game.steamId),[3]);assert.equal(library.steamSyncedAt,undefined);assert.deepEqual(library.recent.map(entry=>entry.game.steamId),[3]);
 assert.deepEqual(buildRecommendationLibrary([],EMPTY_EMULATION(),{steam:null}),{games:[],recent:[]});
});

test('saved and library exclusion switches work independently across verified aliases',()=>{
 const preferences=recommendationDefaults(),saved=[game(30,{igdbId:300})],library={games:[game(40,{igdbId:400})],recent:[]};
 const candidates=[game(30,{id:'igdb:300'}),game(40,{id:'igdb:400'}),game(50),game(60)],groups=[{seed:{game:game(1),reason:'saved' as const},games:candidates}];
 const picks=(hideSaved:boolean,hideLibrary:boolean)=>rankRecommendations(groups,recommendationExclusions(saved,library,{...preferences,hideSaved,hideLibrary}),['steam:60']).map(pick=>pick.game.steamId);
 assert.deepEqual(picks(true,true),[50]);assert.deepEqual(picks(false,true),[30,50]);assert.deepEqual(picks(true,false),[40,50]);assert.deepEqual(picks(false,false),[30,40,50]);
});

test('linked imports and confirmed launcher identities count without filename guessing or orphaned matches',()=>{
 const linked=game(71,{igdbId:710}),custom={id:'custom',name:'Local name',linked,artwork:null,pinned:false,hidden:true,addedAt:1,lastPlayed:100,measuredSeconds:20,config:emptyLaunchConfig()};
 const launcher={id:'battlenet:wow',launcher:'battlenet' as const,productId:'wow',name:'Translated name',installPath:'W:/WoW',state:'installed' as const,launchMode:'play' as const};
 const emulation={...EMPTY_EMULATION(),matches:{orphaned:game(99)}};
 const library=buildRecommendationLibrary([],emulation,{custom:[custom,{...custom,id:'unmatched',linked:null}],launchers:{supported:true,clients:[],games:[launcher,{...launcher,id:'battlenet:wow_classic',productId:'wow_classic'}],warnings:[]}});
 assert.deepEqual(library.games.map(game=>game.igdbId),[710,123]);assert.equal(library.recent.length,0);
});

test('account and local history merge by newest observation without duplicate slots or future dates',()=>{
 const now=2_000_000_000_000,steam={steamId:'account',name:'Fixture',avatar:'',libraryVisible:true,updatedAt:now/1000,games:[
 {appId:1,name:'Account duplicate',minutes:100,recentMinutes:30,lastPlayed:now/1000-10},
 {appId:2,name:'Account second',minutes:50,recentMinutes:30,lastPlayed:now/1000-20},
 {appId:3,name:'Future date',minutes:10,recentMinutes:10,lastPlayed:now/1000+1},
 {appId:4,name:'Unknown date',minutes:50,recentMinutes:0,lastPlayed:0}]};
 const local=[installed(1,now/1000-30),installed(5,now/1000-40)];
 const library=buildRecommendationLibrary(local,EMPTY_EMULATION(),{steam},now);
 assert.deepEqual(chooseRecommendationSeeds([],local,EMPTY_EMULATION(),recommendationDefaults(),library).map(seed=>seed.game.steamId),[1,2,5]);
 assert.deepEqual(steam.games.map(game=>game.appId),[1,2,3,4]);
});

test('legacy preferences retain both exclusions and new filter choices stay profile-local through undo',()=>{
 const memory=new Map();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
 memory.set('harbor.games.recommendations.v1:legacy',JSON.stringify({version:1,saved:true,recent:false,hidden:[]}));
 const old=readRecommendationPreferences('legacy');assert.equal(old.hideLibrary,true);assert.equal(old.hideSaved,true);
 let preferences=hideRecommendation({...old,hideLibrary:false},game(3));preferences=restoreRecommendation(preferences,recommendationChoice(game(3)));
 writeRecommendationPreferences('legacy',preferences);assert.equal(readRecommendationPreferences('legacy').hideLibrary,false);assert.equal(readRecommendationPreferences('legacy').hideSaved,true);assert.equal(readRecommendationPreferences('other').hideLibrary,true);
});
