import assert from "node:assert/strict";
import test from "node:test";
import {changeLibraryPreferences,emptyLibraryPreferences,libraryPreferenceKey,parseLibraryPreferences,patchLibraryPreferences,readLibraryPreferences} from "../src/lib/games/library-preferences.ts";
import {unifiedLibrary,unifiedLibraryDefaults,filterUnifiedLibrary,pickUnifiedGame,type UnifiedLibraryInput} from "../src/lib/games/unified-library.ts";
import {EMPTY_EMULATION} from "../src/lib/games/emulation.ts";
import {emptyLaunchConfig} from "../src/lib/games/custom-library.ts";
import {defaultCollectionRules,parseCollectionRules} from "../src/lib/games/collection-rules.ts";
import {dynamicCollectionGames} from "../src/lib/games/dynamic-collections.ts";

const localId="00000000-0000-4000-8000-000000000001";
function fixture():UnifiedLibraryInput {
  return {installed:[],steamKnown:true,launchersKnown:true,retro:EMPTY_EMULATION(),preferences:emptyLibraryPreferences(),
    account:{steamId:"123",name:"Fixture",avatar:"",updatedAt:1,libraryVisible:true,games:[42,43,44].map((appId,i)=>({appId,name:`Game ${appId}`,minutes:i*200,recentMinutes:0,lastPlayed:1}))},
    custom:[{id:localId,name:"Another copy",config:emptyLaunchConfig(),linked:{id:"steam:42",steamId:42,name:"Game 42",capsule:"",platforms:[]},artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:1,measuredSeconds:3600}]};
}
test("manual status keeps exact installations independent and never derives completion from time",()=>{
  const data=fixture();
  data.preferences=patchLibraryPreferences(data.preferences,["steam:42"],{playStatus:"finished"});
  data.preferences=patchLibraryPreferences(data.preferences,[`custom:${localId}`],{playStatus:"onHold"});
  const rows=unifiedLibrary(data);
  assert.equal(rows.find(x=>x.id==="steam:42")?.playStatus,"finished");
  assert.equal(rows.find(x=>x.id===`custom:${localId}`)?.playStatus,"onHold");
  assert.equal(rows.find(x=>x.id==="steam:44")?.playStatus,"unset");
  data.custom[0].measuredSeconds+=5000; data.account!.games[0].minutes=9000;
  assert.equal(unifiedLibrary(data).find(x=>x.id==="steam:42")?.playStatus,"finished");
  assert.equal(unifiedLibrary(data).find(x=>x.id===`custom:${localId}`)?.playStatus,"onHold");
});
test("status-only preferences survive edits; clearing retains independent pin and artwork",()=>{
  let store=patchLibraryPreferences(emptyLibraryPreferences(),["steam:42"],{playStatus:"playing"});
  store=patchLibraryPreferences(store,["steam:42"],{pinned:true,cover:"W:/Art/42.png"});
  assert.equal(parseLibraryPreferences(JSON.stringify(store)).entries["steam:42"].playStatus,"playing");
  store=patchLibraryPreferences(store,["steam:42"],{playStatus:"unset"});
  assert.deepEqual(store.entries["steam:42"],{pinned:true,hidden:false,cover:"W:/Art/42.png"});
  store=patchLibraryPreferences(store,["steam:42"],{pinned:false,cover:null});
  assert.deepEqual(store,emptyLibraryPreferences());
});
test("malformed new status does not silently erase or broaden a saved rule",()=>{
  for(const value of [null,"bogus",1,{},[]]) {
    assert.throws(()=>patchLibraryPreferences(emptyLibraryPreferences(),["steam:42"],{playStatus:value as never}),/library_prefs_read/);
    assert.throws(()=>parseLibraryPreferences(JSON.stringify({version:1,entries:{"steam:42":{pinned:false,hidden:false,cover:null,playStatus:value}}})),/library_prefs_read/);
    assert.throws(()=>parseCollectionRules({...defaultCollectionRules(),playStatus:value}),/collections_rules/);
  }
  const old={query:"",source:"all",availability:"all",visibility:"visible"};
  assert.equal(parseCollectionRules(old).playStatus,"all");
  assert.equal(parseLibraryPreferences(JSON.stringify({version:1,entries:{"steam:42":{pinned:false,hidden:false,cover:null}}})).entries["steam:42"].playStatus,undefined);
});
test("status intersects existing criteria and dynamic membership follows manual changes",()=>{
  const data=fixture(); data.preferences=patchLibraryPreferences(data.preferences,["steam:42","steam:43"],{playStatus:"toPlay"});
  const rules={...defaultCollectionRules(),source:"steam" as const,playStatus:"toPlay" as const,playtime:"zero" as const};
  assert.deepEqual(dynamicCollectionGames(rules,unifiedLibrary(data)).map(x=>x.id),["steam:42"]);
  data.preferences=patchLibraryPreferences(data.preferences,["steam:42"],{playStatus:"finished"});
  assert.equal(dynamicCollectionGames(rules,unifiedLibrary(data)).length,0);
  assert.deepEqual(filterUnifiedLibrary(unifiedLibrary(data),{...unifiedLibraryDefaults(),playStatus:"unset",source:"steam"}).map(x=>x.id),["steam:44"]);
});
test("persisted concurrent changes merge and failed writes keep the prior manual choice",async()=>{
  const values=new Map<string,string>();let fail=false;
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error("quota");values.set(key,value);}}});
  await Promise.all([changeLibraryPreferences("one",["steam:42"],{playStatus:"finished"}),changeLibraryPreferences("one",["steam:42"],{pinned:true})]);
  assert.equal(readLibraryPreferences("one").entries["steam:42"].playStatus,"finished");
  assert.equal(readLibraryPreferences("one").entries["steam:42"].pinned,true);
  assert.deepEqual(readLibraryPreferences("two"),emptyLibraryPreferences());
  fail=true;await assert.rejects(changeLibraryPreferences("one",["steam:42"],{playStatus:"stopped"}),/quota/);
  assert.equal(readLibraryPreferences("one").entries["steam:42"].playStatus,"finished");
  assert.ok(values.has(libraryPreferenceKey("one")));
});
test("filtered Pick includes every eligible status match beyond the rendered first page",()=>{
  const games=Array.from({length:80},(_,i)=>({id:`steam:${100+i}`,source:"steam" as const,name:`Game ${i}`,state:"notInstalled" as const,favorite:false,hidden:false,lastPlayed:0,playStatus:i%2?"finished" as const:"toPlay" as const,game:{id:`steam:${100+i}`,name:`Game ${i}`,steamId:100+i,capsule:"",platforms:[]}}));
  const filtered=filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),playStatus:"toPlay"});
  assert.equal(filtered.length,40);
  const chosen=pickUnifiedGame(filtered,undefined,()=>.999)!;
  assert.equal(chosen.id,filtered.at(-1)?.id);
  assert.notEqual(pickUnifiedGame(filtered,chosen.id,()=>.999)?.id,chosen.id);
});
