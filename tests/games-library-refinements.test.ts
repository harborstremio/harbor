import test from "node:test";
import assert from "node:assert/strict";
import { libraryShuffleKey, libraryShuffleRank, parseLibraryShuffle } from "../src/lib/games/library-shuffle.ts";
import { filterUnifiedLibrary, pickUnifiedGame, unifiedLibraryDefaults, type UnifiedLibraryGame } from "../src/lib/games/unified-library.ts";
import { parsePlaytimeFields, playtimeFields } from "../src/lib/games/playtime-input.ts";
import { correctCustomPlaytime, customPlaytime, emptyCustomLibrary, emptyLaunchConfig } from "../src/lib/games/custom-library.ts";
import { gameVideoSearchUrl } from "../src/lib/games/video-search.ts";

const games = (count=50): UnifiedLibraryGame[] => Array.from({length:count},(_,i)=>({id:`steam:${i+1}`,name:`Game ${i}`,source:"steam",favorite:false,hidden:i===3,lastPlayed:0,state:"ready",game:{id:`steam:${i+1}`,name:`Game ${i}`,capsule:"",platforms:[]}}));
const shuffled = (items:UnifiedLibraryGame[],seed=42)=>filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),sort:"shuffle",shuffleSeed:seed});
const ids=(items:UnifiedLibraryGame[])=>items.map(item=>item.id);
const fields=(value:Partial<ReturnType<typeof playtimeFields>>)=>({...playtimeFields(0),...value});
test("shuffle is stable across enumeration and presentation changes without mutating input",()=>{
 const items=games(),before=structuredClone(items),order=ids(shuffled(items));
 assert.deepEqual(order,ids(shuffled([...items].reverse().map(item=>({...item,name:"Renamed",favorite:true})))));
 assert.deepEqual(items,before);assert.notDeepEqual(order,ids(shuffled(items,99)));
});
test("shuffle preserves surviving order and existing visibility and source filters",()=>{
 const items=games(),all=shuffled(items),filtered=filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),sort:"shuffle",shuffleSeed:42,query:"Game 1"});
 assert.deepEqual(ids(filtered),ids(all.filter(item=>item.name.includes("Game 1"))));
 assert.ok(!all.some(item=>item.hidden));
 assert.equal(filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),sort:"shuffle",source:"custom"}).length,0);
});
test("large shuffle retains all visible identities and bounded ranks",()=>{
 const items=games(20000);assert.equal(shuffled(items).length,19999);assert.equal(new Set(ids(shuffled(items))).size,19999);
 for(const item of items){const rank=libraryShuffleRank(item.id,0xffffffff);assert.ok(Number.isInteger(rank)&&rank>=0&&rank<=0xffffffff);}
});
test("shuffle persistence is strict and profile keys cannot collide",()=>{
 assert.deepEqual(parseLibraryShuffle(null),{version:1,seed:0,enabled:false});
 assert.deepEqual(parseLibraryShuffle('{"version":1,"seed":4294967295,"enabled":true}'),{version:1,seed:4294967295,enabled:true});
 for(const raw of ['{}','null','bad','{"version":1,"seed":-1,"enabled":true}','{"version":1,"seed":1.5,"enabled":true}','{"version":1,"seed":4294967296,"enabled":true}','{"version":1,"seed":1,"enabled":"true"}'])assert.throws(()=>parseLibraryShuffle(raw));
 assert.notEqual(libraryShuffleKey('a/b'),libraryShuffleKey('a%2Fb'));
});
test("picker admits unmatched locals, avoids immediate repeats, and handles empty input",()=>{
 const local={...games(1)[0],id:"custom:local",game:undefined,quick:{source:"custom"}} as UnifiedLibraryGame;
 assert.equal(pickUnifiedGame([local],undefined,()=>0)?.id,local.id);
 assert.equal(pickUnifiedGame([local,games(1)[0]],local.id,()=>0)?.id,"steam:1");assert.equal(pickUnifiedGame([]),undefined);
});
test("whole seconds roundtrip through all four units including model limit",()=>{
 for(const seconds of [0,1,59,60,3661,86401,3600000000])assert.equal(parsePlaytimeFields(playtimeFields(seconds),'en'),seconds);
});
test("decimal units combine exactly and round only the final total",()=>{
 assert.equal(parsePlaytimeFields(fields({days:'1.5',hours:'0.25',minutes:'0.5',seconds:'0.5'}),'en'),130531);
 assert.equal(parsePlaytimeFields(fields({seconds:'0.499999'}),'en'),0);assert.equal(parsePlaytimeFields(fields({seconds:'0.5'}),'en'),1);
});
test("locale decimals and Arabic digits work while grouping and unsafe numeric syntax are rejected",()=>{
 assert.equal(parsePlaytimeFields(fields({hours:'1,5'}),'de'),5400);assert.equal(parsePlaytimeFields(fields({hours:'١٫٥'}),'ar'),5400);
 for(const value of ['-1','+1','1e2','Infinity','NaN','1,000','1.1234567'])assert.equal(parsePlaytimeFields(fields({hours:value}),'en'),null);
 assert.equal(parsePlaytimeFields(fields({hours:'1.500'}),'de'),null);
});
test("unrounded totals above the storage ceiling are rejected",()=>{
 assert.equal(parsePlaytimeFields(fields({hours:'1000000'}),'en'),3600000000);
 assert.equal(parsePlaytimeFields(fields({hours:'1000000',seconds:'0.000001'}),'en'),null);
});
test("correction and reset retain actual measured playtime",()=>{
 const game={id:'11111111-1111-4111-8111-111111111111',name:'Local',config:{...emptyLaunchConfig(),executable:'D:/Fixture/game.exe'},linked:null,artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:0,measuredSeconds:3661};
 const store={...emptyCustomLibrary(),games:[game]},adjusted=correctCustomPlaytime(store,game.id,7201);
 assert.equal(customPlaytime(adjusted.games[0]),7201);assert.equal(adjusted.games[0].measuredSeconds,3661);
 const reset=correctCustomPlaytime(adjusted,game.id,null);assert.equal(customPlaytime(reset.games[0]),3661);assert.equal("playtimeCorrection" in store.games[0],false);
});
test("video searches encode full edition titles as query data, never destinations",()=>{
 for(const name of ['NieR:Automata Game of the YoRHa Edition','Pokémon & Zelda #2?','日本語 + عربي','https://evil.example/&x=1']){
  const url=new URL(gameVideoSearchUrl(name,'gameplay')!);assert.equal(url.origin,'https://www.youtube.com');assert.equal(url.pathname,'/results');assert.deepEqual([...url.searchParams],[['search_query',name+' gameplay']]);assert.equal(url.hash,'');
 }
 assert.equal(new URL(gameVideoSearchUrl('  Half-Life 2  ','trailer')!).searchParams.get('search_query'),'Half-Life 2 trailer');
 for(const name of ['', ' ', 'bad\nname', 'bad\0name','x'.repeat(513)])assert.equal(gameVideoSearchUrl(name,'gameplay'),null);
 assert.equal(gameVideoSearchUrl('Game','anything' as never),null);
});
