import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { changeCustomLibrary, customLibraryKey, emptyCustomLibrary, emptyLaunchConfig, filterCustomGames, launchArguments, parseCustomLibrary, readCustomLibrary, recordCustomExit, removeCustomGame, upsertCustomGame, type CustomGame } from "../src/lib/games/custom-library.ts";
const game = (name = "Rain & dusk"): CustomGame => ({ id: randomUUID(), name, config: { ...emptyLaunchConfig(), executable: "W:/Games 雨 & dusk/Game.exe" }, linked: null, artwork: null, pinned: false, hidden: false, addedAt: 10, lastPlayed: 0, measuredSeconds: 0 });
test("launch argument lines preserve spaces, quotes and shell characters as literal values", () => {
  assert.deepEqual(launchArguments('--player\r\nRain & Dusk\n$(literal); "quoted"\n\n--windowed'), ['--player','Rain & Dusk','$(literal); "quoted"','--windowed']);
  assert.throws(()=>launchArguments('x\0y')); assert.throws(()=>launchArguments(Array(129).fill('arg').join('\n')));
});
test("completed sessions are idempotent and removing an entry preserves other games", () => {
  const first=game(),second=game("Other game");let store=upsertCustomGame(upsertCustomGame(emptyCustomLibrary(),first),second);
  const event={profile:"p",id:first.id,sessionId:randomUUID(),pid:12,seconds:8,startedAt:100,endedAt:8100,success:true,code:0};store=recordCustomExit(store,event,100);store=recordCustomExit(store,event,100);assert.equal(store.games.find(g=>g.id===first.id)?.measuredSeconds,8);assert.equal(store.sessions.length,1);assert.equal(parseCustomLibrary(JSON.stringify(store)).sessions[0].seconds,8);
  const next=removeCustomGame(store,first.id);assert.equal(next.games[0].id,second.id);assert.equal(next.sessions.length,0);assert.equal(first.config.executable,"W:/Games 雨 & dusk/Game.exe");
});
test("pinning, hiding, matching, and sorting preserve separate local copies", () => {
  const a=game("Zulu"),b={...game("Alpha"),pinned:true},c={...game("Hidden"),hidden:true};const store={...emptyCustomLibrary(),games:[a,b,c]};
  assert.deepEqual(filterCustomGames(store,"","visible","name").map(g=>g.id),[b.id,a.id]);assert.equal(filterCustomGames(store,"","hidden","recent")[0].id,c.id);
  const updated=upsertCustomGame(store,{...a,linked:{id:"igdb:42",igdbId:42,name:"Catalog name",capsule:"https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg",platforms:["PC"]}});assert.equal(filterCustomGames(updated,"Catalog name","visible","name")[0].id,a.id);assert.equal(updated.games.length,3);
});
test("profile stores serialize changes and never replace corrupt or unwritable state", async()=>{
  const values=new Map<string,string>();let full=false;globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(full)throw Error();values.set(key,value);}}as Storage;
  const a=game(),b=game();await Promise.all([changeCustomLibrary("a/b",s=>upsertCustomGame(s,a)),changeCustomLibrary("a/b",s=>upsertCustomGame(s,b))]);assert.equal(readCustomLibrary("a/b").games.length,2);assert.equal(readCustomLibrary("a%2Fb").games.length,0);
  full=true;await assert.rejects(changeCustomLibrary("a/b",s=>removeCustomGame(s,a.id)));assert.equal(readCustomLibrary("a/b").games.length,2);full=false;
  values.set(customLibraryKey("broken"),'broken');await assert.rejects(changeCustomLibrary("broken",s=>upsertCustomGame(s,a)));assert.equal(values.get(customLibraryKey("broken")),'broken');
  for(const raw of ["{}",JSON.stringify({...emptyCustomLibrary(),games:[{...a,id:"../other"}]}),JSON.stringify({...emptyCustomLibrary(),games:[{...a,config:{...a.config,executable:"relative.exe"}}]})])assert.throws(()=>parseCustomLibrary(raw));
});
