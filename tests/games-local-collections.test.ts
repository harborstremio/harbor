import assert from "node:assert/strict";
import test from "node:test";
import {addCollectionGames,changePersonalCollections,collectionGame,collectionHasGame,createPersonalCollection,emptyPersonalCollections,parsePersonalCollections,personalCollectionsKey,readPersonalCollections,removeCollectionGame} from "../src/lib/games/personal-collections.ts";
import {customCollectionGame,romCollectionGame,resolveCollectionLibrary} from "../src/lib/games/personal-collection-library.ts";
import {emptyLaunchConfig,type CustomGame} from "../src/lib/games/custom-library.ts";
import {EMPTY_EMULATION,folderKey,type LocalGame} from "../src/lib/games/emulation.ts";

const id="00000000-0000-4000-8000-000000000001",otherId="00000000-0000-4000-8000-000000000002";
const catalog={id:"steam:620",steamId:620,igdbId:72,name:"Portal 2",capsule:"https://shared.akamai.steamstatic.com/steam/apps/620/header.jpg",platforms:["Windows"]};
const pc=(other:Partial<CustomGame>={}):CustomGame=>({id,name:"My local game",config:{...emptyLaunchConfig(),executable:"W:/Library/game.exe",arguments:["--profile","My saves"]},linked:null,artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:0,measuredSeconds:0,...other});
const rom=(other:Partial<LocalGame>={}):LocalGame=>({path:"W:/Cartridges/日本語.gba",name:"Fan project",sizeBytes:20,system:24,format:"GBA",available:true,discs:1,...other});
const store=()=>createPersonalCollection(emptyPersonalCollections(),"Weekend","weekend");
const retro=(games:LocalGame[])=>({...EMPTY_EMULATION(),folders:[{id:folderKey("W:/Cartridges",24),root:"W:/Cartridges",system:24,scannedAt:1,games,skipped:0,limited:false}]});

test("unmatched PC and ROM entries survive serialization alongside existing catalog collections",()=>{
 const custom=customCollectionGame(pc()),cartridge=romCollectionGame(rom());
 const next=addCollectionGames(store(),"weekend",[catalog,custom,cartridge]);
 const loaded=parsePersonalCollections(JSON.stringify(next));
 assert.deepEqual(loaded.collections[0].gameIds,[cartridge.id,custom.id,catalog.id]);
 assert.deepEqual(loaded.games[custom.id].local,{kind:"custom",id});
 assert.deepEqual(loaded.games[cartridge.id].local,{kind:"rom",system:24,path:rom().path});
 assert.ok(collectionHasGame(loaded,loaded.collections[0],custom));
 assert.equal(loaded.version,1);
 assert.ok(parsePersonalCollections(JSON.stringify(addCollectionGames(store(),"weekend",[catalog]))).games[catalog.id]);
});

test("copies with shared names or catalog matches stay distinct and keep exact local identities",()=>{
 const a=customCollectionGame(pc({name:"Portal 2",linked:catalog})),b=customCollectionGame(pc({id:otherId,name:"Portal 2",linked:catalog}));
 const r=romCollectionGame(rom({linked:catalog})),r2=romCollectionGame(rom({path:"W:/Cartridges/another.gba",linked:catalog}));
 let next=addCollectionGames(store(),"weekend",[a,b,r,r2,catalog]);
 assert.equal(Object.keys(next.games).length,5);
 assert.equal(next.games[a.id].steamId,undefined);
 assert.equal(collectionHasGame(addCollectionGames(store(),"weekend",[a]),next.collections[0],catalog),false);
 next=removeCollectionGame(next,"weekend",a.id);
 assert.equal(Object.keys(next.games).length,4);
 assert.ok(next.games[b.id]);assert.ok(next.games[catalog.id]);
});

test("resolving collections uses current profile library configuration and never saved launch settings",()=>{
 const snapshot=customCollectionGame(pc({linked:catalog})),updated=pc({name:"Renamed local game",config:{...emptyLaunchConfig(),executable:"D:/Moved/game.exe"}});
 const resolved=resolveCollectionLibrary([snapshot],[updated],EMPTY_EMULATION())[snapshot.id];
 assert.equal(resolved.custom,updated);
 assert.equal(resolved.game.name,"Renamed local game");
 assert.equal(resolved.game.capsule,"");
 const checked=collectionGame({...snapshot,config:pc().config,steamId:620,artwork:"W:/Private/cover.png",local:{...snapshot.local,executable:"W:/Wrong.exe"}})!;
 const raw=JSON.stringify(checked);
 assert.equal(raw.includes("executable"),false);assert.equal(raw.includes("Private"),false);assert.equal(checked.steamId,undefined);
});

test("missing references remain readable without resolving to a namesake or a different ROM system",()=>{
 const custom=customCollectionGame(pc()),cartridge=romCollectionGame(rom());
 const resolved=resolveCollectionLibrary([custom,cartridge],[pc({id:otherId})],retro([rom({system:19})]));
 assert.equal(resolved[custom.id].custom,undefined);assert.equal(resolved[custom.id].game.name,custom.name);
 assert.equal(resolved[cartridge.id].rom,undefined);
 const restored=resolveCollectionLibrary([custom,cartridge],[pc()],retro([rom({available:false})]));
 assert.equal(restored[cartridge.id].rom?.available,false);
 assert.equal(restored[cartridge.id].rom?.root,"W:/Cartridges");
 assert.equal(restored[custom.id].custom?.id,id);
});

test("invalid local references fail atomically instead of becoming catalog fallbacks",()=>{
 const base=customCollectionGame(pc()),saved=addCollectionGames(store(),"weekend",[catalog]);
 for(const bad of [{...base,local:{kind:"custom",id:"bad"}},{...base,id:"steam:620",steamId:620},{...base,local:null},
   {...romCollectionGame(rom()),local:{kind:"rom",system:999,path:rom().path}},
   {...romCollectionGame(rom()),local:{kind:"rom",system:24,path:"relative.gba"}},
   {...romCollectionGame(rom()),local:{kind:"rom",system:24,path:"W:/bad\0.gba"}}]){
   assert.equal(collectionGame(bad),null);
   assert.throws(()=>addCollectionGames(saved,"weekend",[base,bad as any]),/collections_game/);
 }
 assert.deepEqual(saved.collections[0].gameIds,[catalog.id]);
 const windows=romCollectionGame(rom({path:"D:\\Games\\Hack.gba"}));
 assert.ok(collectionGame(windows));
 assert.ok(collectionGame(romCollectionGame(rom({path:"/home/user/hack.gba"}))));
});

test("local membership persists per profile and quota or invalid saved data never replaces prior data",async()=>{
 const memory=new Map<string,string>();let full=false;
 globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{if(full)throw Error("QuotaExceededError");memory.set(key,value);}} as Storage;
 await changePersonalCollections("local/profile",()=>addCollectionGames(store(),"weekend",[customCollectionGame(pc()),romCollectionGame(rom())]));
 assert.equal(readPersonalCollections("local/profile").collections[0].gameIds.length,2);
 assert.equal(readPersonalCollections("local%2Fprofile").collections.length,0);
 const prior=memory.get(personalCollectionsKey("local/profile"));full=true;
 await assert.rejects(changePersonalCollections("local/profile",s=>removeCollectionGame(s,"weekend",`custom:${id}`)));
 assert.equal(memory.get(personalCollectionsKey("local/profile")),prior);
 full=false;const corrupt=prior!.replace(id,"invalid");memory.set(personalCollectionsKey("local/profile"),corrupt);
 await assert.rejects(changePersonalCollections("local/profile",()=>store()));
 assert.equal(memory.get(personalCollectionsKey("local/profile")),corrupt);
});
