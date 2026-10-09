import assert from "node:assert/strict";
import test from "node:test";
import { isSteamShortcutId, readSteamShortcutSettings, selectedShortcutAccount, steamShortcutGames, steamShortcutKey, type SteamShortcut, type SteamShortcutScan } from "../src/lib/games/steam-shortcuts.ts";
import { emptyLibraryPreferences, parseLibraryPreferences, patchLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { unifiedLibrary, filterUnifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";
import { libraryPlaytime } from "../src/lib/games/library-playtime.ts";
import { quickLibrary, filterQuickLibrary } from "../src/lib/games/quick-library.ts";
import { parseSidebarPreferences } from "../src/lib/games/sidebar-preferences.ts";

const shortcut=(accountId=123,state:SteamShortcut["state"]="ready"):SteamShortcut=>({id:`steam-shortcut:${accountId}:4294967295`,accountId,appId:4294967295,runGameId:"18446744069448138752",name:"Same title",executable:'"W:\\Games\\game.exe"',startDirectory:'"W:\\Games"',launchOptions:'--level "Two words"',hidden:false,lastPlayed:1790000000,tags:["Co-op"],state,artwork:{capsule:"local-capsule",portrait:"local-portrait"}});
const scan=():SteamShortcutScan=>({steamFound:true,activeAccountId:123,accounts:[123,456],games:[shortcut(),shortcut(456,"account")],warnings:[]});

test("unsigned shortcut identities stay separate from store IDs and reject malformed accounts",()=>{
  assert.equal(isSteamShortcutId(shortcut().id),true);
  for(const id of ["steam:4294967295","steam-shortcut:0:4294967295","steam-shortcut:123:42","steam-shortcut:4294967296:4294967295","steam-shortcut:123:4294967296","steam-shortcut:0123:4294967295"])assert.equal(isSteamShortcutId(id),false,id);
  const prefs=patchLibraryPreferences(emptyLibraryPreferences(),[shortcut().id],{pinned:true,playStatus:"toPlay"});
  assert.equal(parseLibraryPreferences(JSON.stringify(prefs)).entries[shortcut().id].pinned,true);
});
test("account selection never spills into another account after files disappear",()=>{
  const value=scan(),settings={root:null,accountId:456};
  assert.equal(selectedShortcutAccount(value,{root:null,accountId:null}),123);
  assert.deepEqual(steamShortcutGames(value,settings).map(g=>g.accountId),[456]);
  value.games=value.games.filter(g=>g.accountId!==456);value.accounts=[123];
  assert.equal(selectedShortcutAccount(value,settings),456);
  assert.deepEqual(steamShortcutGames(value,settings),[]);
});
test("profile settings are isolated and corrupt or relative paths use discovery",()=>{
  const data=new Map<string,string>();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>data.get(key)??null}});
  data.set(steamShortcutKey("a"),JSON.stringify({root:"W:/Steam/userdata",accountId:456}));
  assert.deepEqual(readSteamShortcutSettings("a"),{root:"W:/Steam/userdata",accountId:456});
  assert.deepEqual(readSteamShortcutSettings("b"),{root:null,accountId:null});
  for(const value of ['bad',JSON.stringify({root:"relative/path",accountId:123}),JSON.stringify({root:null,accountId:4294967296})]){
    data.set(steamShortcutKey("a"),value);assert.deepEqual(readSteamShortcutSettings("a"),{root:null,accountId:null});
  }
});
test("same-name store games and shortcuts keep separate ownership and unknown playtime",()=>{
  const input={installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),launchersKnown:true,preferences:emptyLibraryPreferences(),shortcuts:scan().games,account:{steamId:"123",name:"Fixture",avatar:"",libraryVisible:true,updatedAt:0,games:[{appId:4294967295,name:"Same title",minutes:999,recentMinutes:0,lastPlayed:0}]}};
  const games=unifiedLibrary(input),first=games.find(g=>g.id===shortcut().id)!;
  assert.equal(games.length,3);assert.equal(first.game,undefined);assert.equal(first.owned,undefined);assert.equal(libraryPlaytime(first),undefined);
  assert.deepEqual(games.map(g=>g.state),["ready","setup","notInstalled"]);
  assert.deepEqual(filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),source:"shortcut",availability:"ready"}).map(g=>g.id),[shortcut().id]);
});
test("missing executables, hidden preferences, pinning and source filters agree across library surfaces",()=>{
  const ready=shortcut(),missing=shortcut(456,"missing");
  const prefs=patchLibraryPreferences(emptyLibraryPreferences(),[ready.id],{pinned:true,hidden:true});
  const games=quickLibrary([],[],EMPTY_EMULATION(),[],prefs,null,{shortcuts:[ready,missing,missing]});
  assert.deepEqual(games.map(g=>g.id),[missing.id]);assert.equal(games[0].ready,false);
  const all=quickLibrary([],[],EMPTY_EMULATION(),[],prefs,null,{shortcuts:[ready,missing],includeHidden:true});
  assert.equal(all[0].favorite,true);assert.equal(all[0].art,"local-capsule");
  assert.deepEqual(filterQuickLibrary(all,{query:"same",group:"all",source:"shortcut",ready:true,sort:"name"}).map(g=>g.id),[ready.id]);
  assert.equal(parseSidebarPreferences(JSON.stringify({filters:{source:"shortcut"}})).filters.source,"shortcut");
});


test("legacy shortcut identities retain personal state without borrowing Steam ownership or dispatch readiness",()=>{
  const local:SteamShortcut={...shortcut(),id:"steam-shortcut:123:local-0123456789abcdef012345",appId:null,runGameId:null,state:"local"};
  assert.equal(isSteamShortcutId(local.id),true);
  for(const id of [local.id.toUpperCase(),local.id+"0",local.id.slice(0,-1),local.id.replace(":123:",":0:"),local.id.replace(":123:",":4294967296:")])assert.equal(isSteamShortcutId(id),false,id);
  const prefs=patchLibraryPreferences(emptyLibraryPreferences(),[local.id],{pinned:true,playStatus:"toPlay"});
  assert.equal(parseLibraryPreferences(JSON.stringify(prefs)).entries[local.id].pinned,true);
  const games=unifiedLibrary({installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),launchersKnown:true,preferences:prefs,shortcuts:[local]});
  assert.equal(games[0].id,local.id);assert.equal(games[0].favorite,true);assert.equal(games[0].game,undefined);assert.equal(games[0].owned,undefined);assert.equal(libraryPlaytime(games[0]),undefined);
  assert.equal(games[0].state,"setup");assert.equal(games[0].quick?.ready,false);
  assert.equal(filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),source:"shortcut"}).length,1);
  assert.equal(quickLibrary([],[],EMPTY_EMULATION(),[],patchLibraryPreferences(prefs,[local.id],{hidden:true}),null,{shortcuts:[local]}).length,0);
});

test("legacy controls and identity feedback are translated consistently in every catalog",async()=>{
  const {readFile,readdir}=await import("node:fs/promises");
  const root=new URL("../src/lib/i18n/locales/",import.meta.url);
  let count=0;
  for(const locale of await readdir(root)) {
    let source:string;try{source=await readFile(new URL(locale+"/game-steam-shortcuts.ts",root),"utf8")}catch{continue}
    for(const key of ["reviewLaunch","state.local","shortcut_identity"])assert.equal(source.split('"games.shortcuts.'+key+'":').length-1,1,locale+":"+key);
    count++;
  }
  assert.equal(count,16);
});
