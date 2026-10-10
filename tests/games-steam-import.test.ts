import assert from "node:assert/strict";
import test from "node:test";
import { initialSteamImportRows, parseSteamImportMetadata, parseSteamImportText, reviewSteamImports, steamImportSummary } from "../src/lib/games/steam-import.ts";
import { changeSteamImports, emptySteamImports, parseSteamImports, readSteamImports, steamImportsKey } from "../src/lib/games/steam-imports.ts";
import { unifiedLibrary, filterUnifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";

const entry = (id: number, name = `Game ${id}`) => ({ game: steamImportSummary(id, name), addedAt: 100, origin: "store" as const });
test("mixed exact Steam URLs and IDs deduplicate canonically and expose every invalid token", () => {
  const rows = parseSteamImportText('000730, https://store.steampowered.com/app/730/Counter_Strike_2/?l=en; 570\nhttps://store.steampowered.com/app/281990/');
  assert.deepEqual(rows.map(row => [row.appId, row.issue]), [[730, undefined], [730, 'duplicate'], [570, undefined], [281990, undefined]]);
  for (const value of ['0', '-1', '4294967296', '1.2', 'steam://run/730', 'https://store.steampowered.com.evil.test/app/730/', 'https://user@store.steampowered.com/app/730/', 'https://store.steampowered.com/sub/730', 'https://store.steampowered.com/app/730bad', 'file:///app/730']) assert.equal(parseSteamImportText(value)[0].issue, 'invalid', value);
  assert.throws(() => parseSteamImportText(' '), /empty/);
  assert.throws(() => parseSteamImportText(Array.from({length:5001}, (_, i) => i+1).join(',')), /limit/);
});
test("metadata must identify the requested app and preserves names without trusting external art", () => {
  const value = { '730': { success: true, data: { steam_appid: 730, name: 'Game & 日本', header_image: 'https://evil.test/a.png', platforms: { windows: true, linux: true, mac: false } } } };
  assert.deepEqual(parseSteamImportMetadata(value, 730), { id: 'steam:730', steamId: 730, name: 'Game & 日本', capsule: '', platforms: ['Windows', 'Linux'] });
  assert.throws(() => parseSteamImportMetadata(value, 42), /metadata/);
  value['730'].data.steam_appid = 42; assert.throws(() => parseSteamImportMetadata(value, 730), /metadata/);
  assert.throws(() => steamImportSummary(42, 'bad\nname'), /record/);
});
test("review skips existing entries, resolves only new identities, and keeps failures for explicit selection", async () => {
  const inputs = [...parseSteamImportText('42,43,43,bad,44'), { input:'45', appId:45, name:'From profile' }];
  const existing = new Set([42]), calls:number[] = [], waits:number[] = [], updates:number[] = [];
  const initial = initialSteamImportRows(inputs, existing); assert.equal(initial[0].state, 'existing');
  const rows = await reviewSteamImports(inputs, existing, async id => { calls.push(id); if(id===44) throw Error('Offline'); return steamImportSummary(id,'Game'); }, new AbortController().signal, index => updates.push(index), async ms => { waits.push(ms); });
  assert.deepEqual(calls, [43,44]); assert.deepEqual(waits,[1200]); assert.deepEqual(updates,[1,4]);
  assert.deepEqual(rows.map(row=>row.state),['existing','ready','duplicate','invalid','unavailable','ready']);
  assert.equal(rows[5].origin,'profile'); assert.equal(rows[4].game,undefined);
  assert.equal(inputs[1].name,undefined);
});
test("cancellation during lookup discards late results and prevents subsequent requests", async () => {
  const controller = new AbortController(), calls:number[] = [], updates:unknown[] = [];
  await assert.rejects(reviewSteamImports(parseSteamImportText('43,44'),new Set(),async id=>{calls.push(id);controller.abort();return steamImportSummary(id);},controller.signal,(_,row)=>updates.push(row),async()=>{}),{name:'AbortError'});
  assert.deepEqual(calls,[43]);assert.deepEqual(updates,[]);
});
test("cancellation during paced waiting does not start another lookup", async () => {
  const controller=new AbortController(),calls:number[]=[];
  await assert.rejects(reviewSteamImports(parseSteamImportText('43,44'),new Set(),async id=>{calls.push(id);return steamImportSummary(id);},controller.signal,()=>{},async()=>{controller.abort();}),{name:'AbortError'});
  assert.deepEqual(calls,[43]);
});
test("import storage rejects ambiguous identities, corrupt envelopes and invalid timestamps", () => {
  assert.deepEqual(parseSteamImports(null),emptySteamImports());
  for(const games of [[entry(42),entry(42)],[{...entry(42),addedAt:0}],[{...entry(42),origin:'account'}],[{...entry(42),game:{...entry(42).game,id:'steam:43'}}]]) assert.throws(()=>parseSteamImports(JSON.stringify({version:1,games})),/read/);
  assert.throws(()=>parseSteamImports('{broken'),/read/);
  assert.throws(()=>parseSteamImports(JSON.stringify({version:2,games:[]})),/read/);
});
test("concurrent writes merge by exact ID and profile; removal leaves other records intact",async()=>{
  const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
  const result=await Promise.all([changeSteamImports('A',[entry(42)]),changeSteamImports('A',[entry(42,'Other name'),entry(43)])]);
  assert.deepEqual(result.map(row=>row.added),[1,1]);assert.equal(readSteamImports('A').games[0].game.name,'Game 42');assert.deepEqual(readSteamImports('B').games,[]);
  await changeSteamImports('A',[],[42]);assert.deepEqual(readSteamImports('A').games.map(row=>row.game.steamId),[43]);
  const controller=new AbortController();controller.abort();await assert.rejects(changeSteamImports('A',[entry(44)],[],controller.signal),{name:'AbortError'});assert.equal(readSteamImports('A').games.length,1);
  data.set(steamImportsKey('A'),'original corrupt bytes');await assert.rejects(changeSteamImports('A',[entry(44)]),/read/);assert.equal(data.get(steamImportsKey('A')),'original corrupt bytes');
});
test("failed writes do not erase the previously persisted library",async()=>{
  const raw=JSON.stringify({version:1,games:[entry(42)]});Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw,setItem:()=>{throw Error('QuotaExceededError');}}});
  await assert.rejects(changeSteamImports('quota',[entry(43)]),/QuotaExceeded/);assert.deepEqual(readSteamImports('quota').games.map(item=>item.game.steamId),[42]);
});
test("manual records merge only exact Steam identities without inventing ownership or installation",()=>{
  const input={installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),launchersKnown:true,preferences:emptyLibraryPreferences(),steamImports:[entry(42),entry(43)]};
  const before=structuredClone(input),games=unifiedLibrary(input,1000);
  assert.equal(games.length,2);assert.equal(games[0].owned,undefined);assert.equal(games[0].quick,undefined);assert.equal(games[0].state,'notInstalled');assert.equal(games[0].lastPlayed,0);assert.deepEqual(input,before);
  assert.equal(unifiedLibrary({...input,steamKnown:false},1000)[0].state,'unknown');
  const owned={appId:42,name:'Account title',minutes:10,recentMinutes:0,lastPlayed:0};
  const account={steamId:'123',name:'Account',avatar:'',updatedAt:100,libraryVisible:true,games:[owned]};
  const combined=unifiedLibrary({...input,account},1000);assert.equal(combined.length,2);assert.equal(combined[0].name,'Account title');assert.equal(combined[0].imported?.game.steamId,42);assert.equal(combined[0].owned?.minutes,10);
  const hidden=emptyLibraryPreferences();hidden.entries['steam:42']={hidden:true,pinned:false,cover:null};
  assert.deepEqual(filterUnifiedLibrary(unifiedLibrary({...input,preferences:hidden},1000),unifiedLibraryDefaults()).map(item=>item.id),['steam:43']);
  const installed={appId:42,name:'Installed title',installPath:'D:/Game',libraryPath:'D:/',sizeBytes:1,lastPlayed:0,state:'installed' as const};
  const ready=unifiedLibrary({...input,installed:[installed]},1000);assert.equal(ready.length,2);assert.equal(ready[0].state,'ready');assert.equal(ready[0].imported?.game.steamId,42);assert.equal(ready[0].owned,undefined);
});
test("ignored IDs skip both pasted and profile candidates without network requests",async()=>{
 const inputs=[...parseSteamImportText('42,43'),{input:'44',appId:44,name:'From profile'}],calls:number[]=[];
 const rows=await reviewSteamImports(inputs,new Set([42]),async id=>{calls.push(id);return steamImportSummary(id);},new AbortController().signal,()=>{},async()=>{},new Set([42,43,44]));
 assert.deepEqual(rows.map(row=>row.state),['existing','excluded','excluded']);assert.deepEqual(calls,[]);
});
test("old stores remain readable while exclusion settings reject malformed and excessive IDs",()=>{
 assert.deepEqual(parseSteamImports(JSON.stringify({version:1,games:[entry(42)]})).excluded,undefined);
 assert.deepEqual(parseSteamImports(JSON.stringify({version:1,games:[],excluded:[43,42]})).excluded,[42,43]);
 for(const excluded of ['42',[42,42],[0],['42'],[4294967296]])assert.throws(()=>parseSteamImports(JSON.stringify({version:1,games:[],excluded})),/read/);
 assert.throws(()=>parseSteamImports(JSON.stringify({version:1,games:[],excluded:Array.from({length:5001},(_,i)=>i+1)})),/limit/);
});
test("exclusion deltas merge across writes and never remove existing entries or other profiles",async()=>{
 const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
 await changeSteamImports('settings',[entry(42)]);
 await Promise.all([changeSteamImports('settings',[],[],undefined,{add:[42,43],remove:[]}),changeSteamImports('settings',[],[],undefined,{add:[44],remove:[]})]);
 assert.deepEqual(readSteamImports('settings').excluded,[42,43,44]);assert.equal(readSteamImports('settings').games.length,1);assert.equal(readSteamImports('other').excluded,undefined);
 const ignored=await changeSteamImports('settings',[entry(43),entry(44)]);assert.equal(ignored.added,0);
 await changeSteamImports('settings',[],[],undefined,{add:[45],remove:[43]});assert.deepEqual(readSteamImports('settings').excluded,[42,44,45]);
 assert.equal((await changeSteamImports('settings',[entry(43)])).added,1);
 await changeSteamImports('settings',[],[42]);assert.deepEqual(readSteamImports('settings').excluded,[42,44,45]);
 const before=data.get(steamImportsKey('settings'));await assert.rejects(changeSteamImports('settings',[],[],undefined,{add:[0],remove:[]}),/record/);assert.equal(data.get(steamImportsKey('settings')),before);
});
test("an exclusion committed while an import waits prevents adding that identity",async()=>{
 const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
 const [settings,imported]=await Promise.all([changeSteamImports('race',[],[],undefined,{add:[43],remove:[]}),changeSteamImports('race',[entry(43)])]);
 assert.deepEqual(settings.data.excluded,[43]);assert.equal(imported.added,0);assert.equal(readSteamImports('race').games.length,0);
});
