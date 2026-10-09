import assert from "node:assert/strict";
import test from "node:test";
import { canLaunchGame, findLauncherInstall, isLauncherGameId, launcherDispatchId, launcherGameSummary, launcherProductImage, type LauncherGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { emptyLibraryPreferences, parseLibraryPreferences, patchLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { collectionGame } from "../src/lib/games/personal-collections.ts";
import { filterUnifiedLibrary, unifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";

const id="itch:123:01234567-89ab-4cde-8123-456789abcdef";
const second="itch:123:01234567-89ab-4cde-8123-456789abcdee";
const art="https://img.itch.zone/aW1n/cover%23.png";
const game:LauncherGame={id,launcher:"itch",productId:id.slice(5),name:"Original game title",installPath:"D:/Games/itch/game",state:"installed",launchMode:"play",artwork:{capsule:art}};
const scan:LauncherScan={supported:true,clients:[{launcher:"itch",installed:true}],games:[game,{...game,id:second,productId:second.slice(5)}],warnings:[]};

test("itch identifiers require both the real game ID and exact cave UUID",()=>{
 assert.ok(isLauncherGameId(id)); assert.equal(launcherDispatchId(game),id);
 for(const value of ["itch:123",id.toUpperCase(),id.replace("123:","0:"),id.replace("123:","9007199254740992:"),id+":upload",id.replace("01234567","../other")]) assert.equal(isLauncherGameId(value),false,value);
});
test("source summaries and portable collections retain itch artwork and cannot borrow Steam identity",()=>{
 const summary=launcherGameSummary(game); assert.equal(summary.capsule,art); assert.equal(summary.id,id); assert.equal(summary.steamId,undefined);
 const saved=collectionGame({...summary,steamId:123,catalogSteamId:123});
 assert.equal(saved?.capsule,art); assert.equal(saved?.steamId,undefined); assert.equal(saved?.catalogSteamId,undefined);
 assert.equal(findLauncherInstall({id:"steam:123",steamId:123},scan),undefined);
 assert.equal(findLauncherInstall(summary,scan)?.id,id);
});
test("unified library keeps two copies separate and supports the itch source filter",()=>{
 const input={installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),launchersKnown:true,preferences:emptyLibraryPreferences(),launchers:scan};
 const games=unifiedLibrary(input); assert.equal(games.length,2); assert.ok(games.every(g=>g.state==="ready"&&g.source==="itch"));
 assert.equal(filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),source:"itch"}).length,2);
 assert.equal(filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),source:"steam"}).length,0);
});
test("favorite, hide and custom title persist only for the selected itch installation",()=>{
 const data=patchLibraryPreferences(emptyLibraryPreferences(),[id],{pinned:true,hidden:true,title:"My installation"});
 const restored=parseLibraryPreferences(JSON.stringify(data)); assert.equal(restored.entries[id].title,"My installation"); assert.equal(restored.entries[second],undefined);
});
test("missing client, interrupted installs and unavailable drives never claim ready",()=>{
 assert.ok(canLaunchGame(game,scan));
 assert.equal(canLaunchGame(game,{...scan,clients:[]}),false);
 for(const state of ["missing","incomplete","ambiguous"] as const) assert.equal(canLaunchGame({...game,state},scan),false);
 const input={installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),launchersKnown:true,preferences:emptyLibraryPreferences(),launchers:{...scan,games:[{...game,launchMode:"client" as const}]}};
 assert.equal(unifiedLibrary(input)[0].state,"client");
});
test("portable itch covers reject credentials, wrong hosts and private URL parameters",()=>{
 assert.equal(launcherProductImage(id,art),art);
 for(const value of ["https://img.itch.zone.evil.test/a.png","https://secret@img.itch.zone/a.png",art+"?key=private",art+"#fragment","file:///D:/secret.png","http://img.itch.zone/a.png"]) assert.equal(launcherProductImage(id,value),"");
 assert.equal(launcherProductImage("gog:123",art),"");
});
