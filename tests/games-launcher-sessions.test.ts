import assert from "node:assert/strict";
import test from "node:test";
import { emptyLauncherSessions, launcherSessionBusy, launcherSessionLabel, withLauncherActivity, type LauncherSessions } from "../src/lib/games/launcher-sessions.ts";
import type { LauncherScan } from "../src/lib/games/launchers.ts";
import { unifiedLibrary, unifiedLibraryDefaults, filterUnifiedLibrary } from "../src/lib/games/unified-library.ts";
import { libraryPlaytime } from "../src/lib/games/library-playtime.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";
import { emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";

const scan:LauncherScan={supported:true,clients:[],warnings:[],games:["d2","d2x"].map(id=>({id:`battlenet:classic:${id}`,launcher:"battlenet",productId:`classic:${id}`,name:id,installPath:"W:/Games/Diablo II",state:"installed",launchMode:"direct"}))};
function sessions(state:string):LauncherSessions{return {activity:[],error:false,sessions:[{profile:"one",id:scan.games[0].id,sessionId:"session-one",state,requestedAt:100,startedAt:0,updatedAt:100,elapsedMs:0}]};}
test("waiting handoff and unknown activity are never invented playtime",()=>{
  const waiting=withLauncherActivity(scan,sessions("waiting"),"one")!;
  assert.equal(launcherSessionBusy(waiting.games[0]),true);assert.equal(launcherSessionLabel(waiting.games[0]),"games.launcherSession.waiting");
  assert.equal(waiting.games[0].activity?.seconds,undefined);assert.equal(waiting.games[1].activity,undefined);
  assert.equal(withLauncherActivity(scan,sessions("running"),"two")!.games[0].activity,undefined);
  assert.equal(scan.games[0].activity,undefined);
});
test("latest session controls exact edition state and a failed start can be retried",()=>{
  const snapshot=sessions("running");snapshot.sessions.push({...snapshot.sessions[0],sessionId:"new",requestedAt:200,state:"notStarted"});
  const result=withLauncherActivity(scan,snapshot,"one")!;
  assert.equal(launcherSessionLabel(result.games[0]),"games.launcherSession.notStarted");assert.equal(launcherSessionBusy(result.games[0]),false);
  snapshot.sessions.reverse();assert.deepEqual(withLauncherActivity(scan,snapshot,"one"),result);
});
test("native totals feed recent and duration filters without borrowing a shared-folder expansion",()=>{
  const snapshot=emptyLauncherSessions();snapshot.activity=[{id:scan.games[0].id,seconds:123,lastPlayed:300}];
  const games=unifiedLibrary({installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),preferences:emptyLibraryPreferences(),launchersKnown:true,launchers:withLauncherActivity(scan,snapshot,"one")});
  assert.deepEqual(libraryPlaytime(games[0]),{seconds:123,source:"harbor"});assert.equal(libraryPlaytime(games[1]),undefined);assert.equal(games[0].lastPlayed,300);assert.equal(games[1].lastPlayed,0);
  assert.deepEqual(filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),playtime:"played"}).map(game=>game.id),[scan.games[0].id]);
  assert.deepEqual(filterUnifiedLibrary(games,{...unifiedLibraryDefaults(),playtime:"unknown"}).map(game=>game.id),[scan.games[1].id]);
});
