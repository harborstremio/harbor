import assert from "node:assert/strict";
import test from "node:test";
import { libraryPlaytime } from "../src/lib/games/library-playtime.ts";
import { unifiedLibrary, unifiedLibraryDefaults, filterUnifiedLibrary, pickUnifiedGame, type UnifiedLibraryInput } from "../src/lib/games/unified-library.ts";
import { emptyLaunchConfig } from "../src/lib/games/custom-library.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";
import { emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { defaultCollectionRules, parseCollectionRules } from "../src/lib/games/collection-rules.ts";
import { dynamicCollectionGames } from "../src/lib/games/dynamic-collections.ts";
import { createPersonalCollection, emptyPersonalCollections, parsePersonalCollections } from "../src/lib/games/personal-collections.ts";

function fixture(): UnifiedLibraryInput {
  const summary={id:"steam:42",steamId:42,name:"Same game",capsule:"",platforms:[]};
  return {installed:[42,43].map(appId=>({appId,name:`Game ${appId}`,installPath:`W:/games/${appId}`,libraryPath:"W:/games",sizeBytes:10,lastPlayed:123,state:"installed"})),steamKnown:true,launchersKnown:true,
    custom:[0,3600].map((measuredSeconds,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,name:`Local ${i}`,config:emptyLaunchConfig(),linked:summary,artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:1,measuredSeconds})),
    retro:EMPTY_EMULATION(),preferences:emptyLibraryPreferences(),account:{steamId:"123",name:"Test",avatar:"",libraryVisible:true,updatedAt:1,games:[0,119,120,300].map((minutes,i)=>({appId:42+i*2,name:`Game ${42+i*2}`,minutes,recentMinutes:0,lastPlayed:123}))}};
}
const ids=(items:ReturnType<typeof unifiedLibrary>)=>items.map(x=>x.id);
const select=(data:UnifiedLibraryInput,change:Partial<ReturnType<typeof unifiedLibraryDefaults>>)=>filterUnifiedLibrary(unifiedLibrary(data),{...unifiedLibraryDefaults(),...change});

test("zero, unknown and exact local copies retain separate duration provenance",()=>{
  const data=fixture(),before=structuredClone(data),games=unifiedLibrary(data);
  assert.deepEqual(libraryPlaytime(games.find(x=>x.id==="steam:42")!),{seconds:0,source:"steam"});
  assert.equal(libraryPlaytime(games.find(x=>x.id==="steam:43")!),undefined);
  assert.deepEqual(games.filter(x=>x.source==="custom").map(libraryPlaytime),[{seconds:0,source:"harbor"},{seconds:3600,source:"harbor"}]);
  assert.deepEqual(data,before);
  data.account!.libraryVisible=false;
  assert.deepEqual(ids(select(data,{playtime:"unknown"})),["steam:42","steam:43"]);
  assert.equal(select(data,{playtime:"zero",source:"steam"}).length,0);
});

test("short playtime includes known zero, excludes unknown and exactly two hours",()=>{
  const data=fixture();
  assert.deepEqual(new Set(ids(select(data,{playtime:"short"}))),new Set(["steam:42","steam:44",...data.custom.map(g=>`custom:${g.id}`)]));
  assert.deepEqual(ids(select(data,{playtime:"played",source:"steam"})).sort(),["steam:44","steam:46","steam:48"]);
  assert.equal(select(data,{playtime:"zero",query:"local",source:"custom"}).length,1);
});

test("time sorting is numeric, unknown last in both directions even when pinned",()=>{
  const data=fixture();data.preferences.entries["steam:43"]={pinned:true,hidden:false,cover:null};
  for(const sort of ["leastTime","mostTime"] as const){
    const games=select(data,{sort});
    assert.equal(games.at(-1)!.id,"steam:43");
    const times=games.slice(0,-1).map(g=>libraryPlaytime(g)!.seconds);
    assert.deepEqual(times,[...times].sort((a,b)=>sort==="leastTime"?a-b:b-a));
  }
});

test("custom corrections and subsequent sessions determine current total",()=>{
  const data=fixture(),game=data.custom[1];
  game.playtimeCorrection={totalSeconds:0,measuredSeconds:3600,changedAt:5};
  assert.deepEqual(libraryPlaytime(unifiedLibrary(data).find(x=>x.id===`custom:${game.id}`)!),{seconds:0,source:"adjusted"});
  assert.equal(select(data,{playtime:"zero",source:"custom"}).length,2);
  game.measuredSeconds+=360;
  assert.equal(select(data,{playtime:"zero",source:"custom"}).length,1);
  assert.equal(libraryPlaytime(unifiedLibrary(data).find(x=>x.id===`custom:${game.id}`)!)!.seconds,360);
});

test("invalid durations and ROM launch dates never become zero totals",()=>{
  const data=fixture();
  data.retro.folders=[{id:"roms",root:"W:/roms",system:24,scannedAt:1,skipped:0,limited:false,games:[{path:"W:/roms/game.gba",name:"ROM",system:24,format:"gba",available:true,discs:1,sizeBytes:1}]}];
  data.retro.lastPlayed["W:/roms/game.gba"]=Date.now();
  for(const value of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER]){
    data.account!.games[0].minutes=value;
    assert.equal(libraryPlaytime(unifiedLibrary(data).find(x=>x.id==="steam:42")!),undefined);
  }
  assert.equal(select(data,{source:"retro",playtime:"unknown"}).length,1);
  assert.equal(select(data,{source:"retro",playtime:"zero"}).length,0);
});

test("old saved rules migrate; new rules round-trip and reject invalid filters",()=>{
  const {playtime,...old}=defaultCollectionRules();
  assert.equal(parseCollectionRules(old).playtime,"all");
  for(const value of [null,"never","",3])assert.throws(()=>parseCollectionRules({...old,playtime:value}),/collections_rules/);
  const rules={...old,playtime:"short" as const};
  const saved=createPersonalCollection(emptyPersonalCollections(),"Next to play","test",1,rules);
  assert.deepEqual(parsePersonalCollections(JSON.stringify(saved)).collections[0].rules,rules);
  const data=fixture();
  assert.equal(dynamicCollectionGames(rules,unifiedLibrary(data)).length,4);
  data.custom[0].measuredSeconds=7200;
  assert.equal(dynamicCollectionGames(rules,unifiedLibrary(data)).length,3);
});

test("pick uses all matching games beyond the first visible page",()=>{
  const data=fixture();data.custom=[];data.installed=[];
  data.account!.games=Array.from({length:80},(_,i)=>({appId:i+1,name:`Game ${String(i).padStart(2,"0")}`,minutes:i%2?180:0,recentMinutes:0,lastPlayed:0}));
  const games=select(data,{playtime:"zero",sort:"name"});
  assert.equal(games.length,40);
  assert.equal(pickUnifiedGame(games,undefined,()=>.999)?.id,"steam:79");
  assert.notEqual(pickUnifiedGame(games,"steam:79",()=>.999)?.id,"steam:79");
});
