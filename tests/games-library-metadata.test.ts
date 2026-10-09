import assert from "node:assert/strict";
import test from "node:test";
import { changeLibraryMetadata, emptyLibraryPreferences, patchLibraryLinkOrders, patchLibraryMetadata, patchLibraryPreferences, readLibraryPreferences, parseLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { libraryMetadataMatch, libraryMetadataPresentation, metadataMatchTarget } from "../src/lib/games/library-metadata.ts";
import { libraryTitle } from "../src/lib/games/library-titles.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import { resolveDetailEdition } from "../src/lib/games/detail-edition.ts";
import { quickLibrary } from "../src/lib/games/quick-library.ts";
import { customLinkedGame, emptyLaunchConfig, matchingCustomGames } from "../src/lib/games/custom-library.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";

const candidate={id:"steam:999",steamId:999,igdbId:123,name:"Reviewed edition",capsule:"",platforms:["Windows"]};
const match=libraryMetadataMatch(candidate);
test("reviewed metadata is bounded and cannot carry executable or store authority",()=>{
  assert.equal("steamId" in match,false);assert.equal("id" in match,false);
  assert.equal("config" in libraryMetadataMatch({...candidate,config:emptyLaunchConfig()}),false);
  assert.equal(metadataMatchTarget(match).id,"igdb:123");assert.equal(metadataMatchTarget(match).steamId,undefined);
  for(const value of [{...candidate,igdbId:0},{...candidate,name:"\n"},{...candidate,capsule:"javascript:alert(1)"},{...candidate,portrait:"file:///C:/private.png"},{...candidate,platforms:[42]}]) assert.throws(()=>libraryMetadataMatch(value));
});
test("metadata survives other presentation edits and remove restores the previous choices",()=>{
  let store=patchLibraryPreferences(emptyLibraryPreferences(),["steam:42"],{title:"My title",cover:"D:/Art/cover.png"});
  store=patchLibraryMetadata(store,"steam:42",match);
  store=patchLibraryPreferences(store,["steam:42"],{pinned:true});
  store=patchLibraryLinkOrders(store,[{id:"steam:42",order:[],expectedOrder:undefined}]);
  assert.deepEqual(parseLibraryPreferences(JSON.stringify(store)).entries["steam:42"].metadata,match);
  assert.equal(libraryTitle("steam:42","Original",store.entries["steam:42"]),"My title");
  assert.equal(libraryTitle("steam:42","Original",{metadata:match}),"Reviewed edition");
  store=patchLibraryMetadata(store,"steam:42",null,match);
  assert.equal(store.entries["steam:42"].title,"My title");assert.equal(store.entries["steam:42"].cover,"D:/Art/cover.png");assert.equal(store.entries["steam:42"].metadata,undefined);
  const only=patchLibraryMetadata(emptyLibraryPreferences(),"steam:42",match);
  assert.deepEqual(patchLibraryLinkOrders(only,[{id:"steam:42",order:[]}]).entries["steam:42"].metadata,match);
  assert.deepEqual(patchLibraryMetadata(only,"steam:42",null,match).entries,{});
});
test("profile persistence merges unrelated changes and rejects stale reviewed choices",async()=>{
  const values=new Map<string,string>();Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  await Promise.all([changeLibraryMetadata("one","steam:42",match),changeLibraryMetadata("one","steam:43",match)]);
  assert.equal(Object.keys(readLibraryPreferences("one").entries).length,2);assert.equal(Object.keys(readLibraryPreferences("two").entries).length,0);
  await assert.rejects(changeLibraryMetadata("one","steam:42",null),/library_metadata_conflict/);
  assert.deepEqual(readLibraryPreferences("one").entries["steam:42"].metadata,match);
});
test("selected details cannot become a different Steam launch or an inferred official store link",()=>{
  const source={id:"steam:42",steamId:42,igdbId:15,catalogSteamId:42,name:"Native",capsule:"",platforms:[]};
  const displayed=libraryMetadataPresentation(source,match);
  assert.equal(displayed.steamId,42);assert.equal(displayed.igdbId,15);assert.equal(displayed.catalogSteamId,42);assert.equal(displayed.id,"steam:42");
  const atlas=parseAtlasGame({id:123,name:"Reviewed edition",summary:"Selected description",external_games:[{external_game_source:1,uid:"999"}]});
  const resolved=resolveDetailEdition(source,null,atlas,match);
  assert.equal(resolved.detail?.description,"Selected description");assert.equal(resolved.portableGame.steamId,42);assert.equal(resolved.portableGame.igdbId,15);assert.equal(resolved.target.steamId,42);assert.equal(resolved.steamLinkId,42);
  assert.equal(resolveDetailEdition(source,null,atlas).atlas,null);
  assert.equal(resolveDetailEdition(source,null,{...atlas,igdbId:124},match).atlas,null);
  const local={...source,id:"custom:11111111-1111-4111-8111-111111111111",steamId:undefined,catalogSteamId:undefined,igdbId:undefined};
  assert.equal(resolveDetailEdition(local,null,atlas,match).steamLinkId,undefined);
});
test("custom library matching leaves launch configuration and the exact copy intact",()=>{
  const local={id:"11111111-1111-4111-8111-111111111111",name:"Local title",config:{...emptyLaunchConfig(),executable:"D:/Games/local.exe"},linked:null,artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:0,measuredSeconds:0};
  const other={...local,id:"22222222-2222-4222-8222-222222222222"};
  const prefs=patchLibraryMetadata(emptyLibraryPreferences(),`custom:${local.id}`,match);
  const games=quickLibrary([],[local,other],EMPTY_EMULATION(),[],prefs);
  assert.equal(games[0].game?.id,`custom:${local.id}`);assert.equal(games[0].game?.steamId,undefined);assert.equal(games[0].game?.igdbId,undefined);
  assert.equal(games[0].name,"Reviewed edition");assert.equal(games[0].originalName,"Local title");
  assert.equal(matchingCustomGames([local,other],games[0].game!)[0],local);
  assert.equal(games[0].source==="custom"&&games[0].custom.config.executable,"D:/Games/local.exe");assert.equal(local.linked,null);
});
test("a reviewed custom-game edition survives repeated store projection",()=>{
  const selected=customLinkedGame({...candidate,id:"igdb:123"})!;
  assert.equal(selected.id,"igdb:123");assert.equal(customLinkedGame(selected)?.id,"igdb:123");
  assert.equal(customLinkedGame(candidate)?.id,"steam:999");
  assert.equal(customLinkedGame({...candidate,id:"igdb:456"})?.id,"steam:999");
  assert.equal(resolveDetailEdition(selected,null,null).target.steamId,undefined);
});
