import assert from "node:assert/strict";
import test from "node:test";
import {defaultCollectionRules,parseCollectionRules} from "../src/lib/games/collection-rules.ts";
import {dynamicCollectionGames} from "../src/lib/games/dynamic-collections.ts";
import {unifiedLibrary,type UnifiedLibraryInput} from "../src/lib/games/unified-library.ts";
import {EMPTY_EMULATION} from "../src/lib/games/emulation.ts";
import {emptyLaunchConfig} from "../src/lib/games/custom-library.ts";
import {emptyLibraryPreferences,patchLibraryPreferences,romPreferenceId} from "../src/lib/games/library-preferences.ts";
import {addCollectionGame,changePersonalCollections,createPersonalCollection,emptyPersonalCollections,parsePersonalCollections,readPersonalCollections,removeCollectionGame,updatePersonalCollection} from "../src/lib/games/personal-collections.ts";

const summary={id:"steam:42",steamId:42,name:"Pokémon",capsule:"",platforms:[]};
const id="00000000-0000-4000-8000-000000000001";
const cartridge={path:"W:/roms/a.gba",name:"Pokémon",system:24,available:true,format:"gba",discs:1,sizeBytes:100};
function input():UnifiedLibraryInput {
  const retro=EMPTY_EMULATION();
  retro.folders=[{id:"folder",root:"W:/roms",system:24,games:[cartridge],skipped:0,limited:false,scannedAt:1}];
  return {installed:[{appId:42,name:"Pokémon",installPath:"W:/games/42",libraryPath:"W:/games",sizeBytes:100,lastPlayed:0,state:"installed"}],steamKnown:true,launchersKnown:true,
    custom:[{id,name:"Pokémon",config:emptyLaunchConfig(),linked:summary,artwork:null,pinned:false,hidden:false,addedAt:0,lastPlayed:0,measuredSeconds:0}],retro,preferences:emptyLibraryPreferences(),
    account:{steamId:"123",name:"Fixture",avatar:"",libraryVisible:true,updatedAt:1,games:[{appId:99,name:"Uninstalled game",minutes:0,recentMinutes:0,lastPlayed:0}]}};
}
const members=(data:UnifiedLibraryInput,rules=defaultCollectionRules())=>dynamicCollectionGames(rules,unifiedLibrary(data));

test("dynamic members keep distinct installations and unmatched local identities",()=>{
  const data=input(),before=structuredClone(data),games=members(data,{...defaultCollectionRules(),query:"pokemon"});
  assert.equal(games.length,3);
  assert.deepEqual(new Set(games.map(g=>g.id)),new Set(["steam:42",`custom:${id}`,romPreferenceId(24,cartridge.path)]));
  assert.deepEqual(games.find(g=>g.id===`custom:${id}`)?.local,{kind:"custom",id});
  assert.deepEqual(games.find(g=>g.local?.kind==="rom")?.local,{kind:"rom",system:24,path:cartridge.path});
  assert.equal(games.find(g=>g.local?.kind==="custom")?.steamId,undefined);
  assert.deepEqual(data,before);
});
test("membership follows current source, readiness and favorite intersections",()=>{
  const data=input(),rules={...defaultCollectionRules(),source:"retro" as const,availability:"ready" as const,visibility:"pinned" as const};
  assert.equal(members(data,rules).length,0);
  data.preferences=patchLibraryPreferences(data.preferences,[romPreferenceId(24,cartridge.path)],{pinned:true});
  assert.equal(members(data,rules).length,1);
  data.retro.folders[0].unavailable=true;
  assert.equal(members(data,rules).length,0);
  assert.equal(members(data,{...rules,availability:"attention"}).length,1);
  data.preferences=patchLibraryPreferences(data.preferences,[romPreferenceId(24,cartridge.path)],{hidden:true});
  assert.equal(members(data,{...rules,availability:"attention"}).length,0);
  assert.equal(members(data,{...rules,availability:"attention",visibility:"hidden"}).length,1);
});
test("failed scans and private ownership never assert unavailable knowledge",()=>{
  const data=input(),rules={...defaultCollectionRules(),source:"steam" as const,availability:"notInstalled" as const};
  assert.equal(members(data,rules)[0]?.id,"steam:99");
  data.steamKnown=false;
  assert.equal(members(data,rules).length,0);
  assert.equal(members(data,{...rules,availability:"ready"}).length,0);
  data.steamKnown=true;data.steamComplete=false;
  assert.equal(members(data,rules).length,0);
  data.account!.libraryVisible=false;
  assert.deepEqual(members(data,{...rules,availability:"all"}).map(g=>g.id),["steam:42"]);
});
test("rules persist without snapshots, coexist with manual collections and update explicitly",()=>{
  let store=createPersonalCollection(emptyPersonalCollections(),"Manual","manual",1);
  store=addCollectionGame(store,"manual",summary);
  store=createPersonalCollection(store,"Cartridges","auto",2,{...defaultCollectionRules(),source:"retro"});
  assert.deepEqual(store.collections[0].gameIds,[]);
  assert.deepEqual(Object.keys(store.games),["steam:42"]);
  store=parsePersonalCollections(JSON.stringify(store));
  assert.equal(store.collections[0].rules?.source,"retro");
  store=updatePersonalCollection(store,"auto",{rules:{...defaultCollectionRules(),visibility:"pinned"}});
  assert.equal(store.collections[0].rules?.visibility,"pinned");
  assert.throws(()=>updatePersonalCollection(store,"auto",{rules:undefined}),/collections_rules/);
  assert.throws(()=>addCollectionGame(store,"auto",summary),/collections_dynamic/);
  assert.throws(()=>removeCollectionGame(store,"auto","steam:42"),/collections_dynamic/);
  assert.throws(()=>updatePersonalCollection(store,"manual",{rules:defaultCollectionRules()}),/collections_rules/);
});
test("malformed rules fail closed instead of expanding the saved collection",()=>{
  for(const value of [null,{}, {...defaultCollectionRules(),source:"typo"},{...defaultCollectionRules(),availability:"installed"},{...defaultCollectionRules(),visibility:"everything"},{...defaultCollectionRules(),query:"a".repeat(201)}])assert.throws(()=>parseCollectionRules(value),/collections_rules/);
  const store=createPersonalCollection(emptyPersonalCollections(),"Dynamic","auto",1,defaultCollectionRules());
  assert.throws(()=>parsePersonalCollections(JSON.stringify({...store,collections:[{...store.collections[0],rules:{source:"retro"}}]})),/collections_rules/);
  const manual=addCollectionGame(createPersonalCollection(emptyPersonalCollections(),"Manual","manual"),"manual",summary);
  assert.throws(()=>parsePersonalCollections(JSON.stringify({...manual,collections:[{...manual.collections[0],rules:defaultCollectionRules()}]})),/collections_rules/);
});
test("profile storage and failed writes preserve prior rules and membership",async()=>{
  const memory=new Map<string,string>();let full=false;
  globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{if(full)throw Error("quota");memory.set(key,value);}} as Storage;
  await changePersonalCollections("auto-profile",s=>createPersonalCollection(s,"Ready","auto",1,{...defaultCollectionRules(),availability:"ready"}));
  const before=readPersonalCollections("auto-profile");
  assert.equal(readPersonalCollections("other").collections.length,0);
  full=true;
  await assert.rejects(changePersonalCollections("auto-profile",s=>updatePersonalCollection(s,"auto",{rules:defaultCollectionRules()})));
  assert.deepEqual(readPersonalCollections("auto-profile"),before);
});
