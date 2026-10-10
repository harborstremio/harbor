import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyHydraGames, existingHydraGame, mergeHydraGames, planHydraGames, type HydraGamePlan } from '../src/lib/games/hydra-import.ts';
import { parseHydraReview, type HydraGame, type HydraReview } from '../src/lib/games/hydra-import-records.ts';
import { correctCustomPlaytime, customPlaytime, emptyCustomLibrary, emptyLaunchConfig, matchingCustomGames, parseCustomLibrary, readCustomLibrary, saveCustomConfiguration } from '../src/lib/games/custom-library.ts';
import { customLaunchHealth, inspectCustomLaunches } from '../src/lib/games/custom-launch-health.ts';
import { libraryPlaytime } from '../src/lib/games/library-playtime.ts';
import { unifiedLibrary } from '../src/lib/games/unified-library.ts';
import { EMPTY_EMULATION } from '../src/lib/games/emulation.ts';
import { emptyLibraryPreferences } from '../src/lib/games/library-preferences.ts';
const game=(patch:Partial<HydraGame>={}):HydraGame=>({key:'steam:123',shop:'steam',objectId:'123',name:'Game',executable:'D:/Games/Game.exe',launchOptions:null,winePrefix:null,proton:null,addedAt:'2020-01-01T00:00:00Z',lastPlayed:'2021-01-01T00:00:00Z',playtimeMs:90000,steamPlaytimeMs:180000,playtimeManuallyEdited:true,favorite:true,pinned:false,concealed:false,issues:[],...patch});
const review=(games:HydraGame[]):HydraReview=>({directory:'D:/hydra-db',fingerprint:'a'.repeat(64),sourceBytes:100,report:{games,sources:[],deletedGames:0,invalidGames:0,invalidSources:0}});
const plan=(original=game(),pending=false):HydraGamePlan=>({original,pending,issue:pending?'hydra_launch_review':'',config:pending?emptyLaunchConfig():{...emptyLaunchConfig(),executable:original.executable!}});

test('review allowlist preserves settings but rejects invalid or duplicate identities',()=>{
  const raw=review([game()]);(raw.report.games[0] as unknown as Record<string,unknown>).token='secret';
  assert.equal(JSON.stringify(parseHydraReview(raw)).includes('secret'),false);
  for(const value of [review([game(),game()]),review([game({objectId:'999'})]),review([game({playtimeMs:-1})]),{...raw,fingerprint:'bad'}])assert.throws(()=>parseHydraReview(value));
});
test('metadata-only imports stay in the real library without being marked playable',async()=>{
  const plans=await planHydraGames(review([game({executable:null})]),emptyCustomLibrary(),new AbortController().signal);
  const imported=mergeHydraGames(emptyCustomLibrary(),plans).store.games[0];
  assert.equal(imported.launchPending,true);assert.equal(imported.config.executable,'');assert.equal(customLaunchHealth(imported)?.state,'attention');
  assert.equal(matchingCustomGames([imported],imported.linked!).length,0);
  let probes=0;await inspectCustomLaunches([imported],async()=>{probes++;},new AbortController().signal,()=>{});assert.equal(probes,0);
  assert.equal(parseCustomLibrary(JSON.stringify({version:1,games:[imported],sessions:[]})).games.length,1);
});
test('raw launch options and compatibility settings cannot silently become a default launch',async()=>{
  const records=[game({launchOptions:'--name "A B"'}),game({key:'custom:two',shop:'custom',objectId:'two',winePrefix:'/prefix'}),game({key:'custom:three',shop:'custom',objectId:'three',issues:['discs']})];
  const plans=await planHydraGames(review(records),emptyCustomLibrary(),new AbortController().signal);
  assert(plans.every(p=>p.pending&&!p.checkOnImport));
  assert.equal(mergeHydraGames(emptyCustomLibrary(),[plans[0]]).store.games[0].hydra?.original.launchOptions,'--name "A B"');
});
test('selected native validation is bounded, drains on cancellation and writes nothing',async()=>{
  const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  let active=0,peak=0,started=0;const abort=new AbortController();
  const records=Array.from({length:20},(_,i)=>game({key:`custom:${i}`,shop:'custom',objectId:String(i)}));
  const plans=await planHydraGames(review(records),emptyCustomLibrary(),abort.signal);
  await assert.rejects(applyHydraGames('cancel',plans,async config=>{started++;peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,5));active--;abort.abort();return config;},abort.signal,()=>true));
  assert.equal(peak,3);assert.equal(started,3);assert.equal(active,0);assert.equal(storage.size,0);
});
test('exact provenance/path dedup preserves Harbor settings and separate installations',()=>{
  const initial=mergeHydraGames(emptyCustomLibrary(),[plan()]).store;initial.games[0].name='My title';initial.games[0].pinned=false;
  const same=mergeHydraGames(initial,[plan(game({name:'Changed'}))]);assert.equal(same.added,0);assert.equal(same.existing,1);assert.equal(same.store.games[0].name,'My title');assert.equal(same.store.games[0].pinned,false);
  assert(existingHydraGame(initial,game({key:'custom:alias',shop:'custom',objectId:'alias',executable:'d:\\games\\game.exe'})));
  const separate=mergeHydraGames(initial,[plan(game({key:'custom:copy',shop:'custom',objectId:'copy',executable:'D:/Other/Game.exe'}))]);assert.equal(separate.added,1);
});
test('imported history is separate from Harbor measurements and survives configuration repair',()=>{
  let store=mergeHydraGames(emptyCustomLibrary(),[plan(game(),true)],Date.now()).store;let imported=store.games[0];
  assert.equal(imported.measuredSeconds,0);assert.equal(customPlaytime(imported),90);assert.equal(imported.playtimeCorrection,undefined);
  store=saveCustomConfiguration(store,{...imported,config:{...emptyLaunchConfig(),executable:'D:/Fixed/Game.exe'}});imported=store.games[0];assert.equal(imported.launchPending,undefined);assert(imported.hydra);assert.equal(customPlaytime(imported),90);
  store=correctCustomPlaytime(store,imported.id,30);assert.equal(customPlaytime(store.games[0]),30);
  store=correctCustomPlaytime(store,imported.id,null);assert.equal(customPlaytime(store.games[0]),90);
});
test('pending state cannot bypass launch-config validation without genuine bounded provenance',()=>{
  const store=mergeHydraGames(emptyCustomLibrary(),[plan(game(),true)]).store;
  const invalid=structuredClone(store);delete invalid.games[0].hydra;assert.throws(()=>parseCustomLibrary(JSON.stringify(invalid)));
  store.games[0].config.executable='D:/unexpected.exe';assert.throws(()=>parseCustomLibrary(JSON.stringify(store)));
});
test('apply rechecks moved files, preserves current choices and stops on profile change',async()=>{
  const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  const abort=new AbortController();const result=await applyHydraGames('hydra-fixture',[plan()],async()=>{throw Error('launch_missing');},abort.signal,()=>true);
  assert.equal(result.added,1);assert.equal(readCustomLibrary('hydra-fixture').games[0].launchPending,true);
  assert.equal((await applyHydraGames('hydra-fixture',[plan()],async c=>c,abort.signal,()=>true)).existing,1);
  await assert.rejects(applyHydraGames('other',[plan()],async c=>c,abort.signal,()=>false));assert.equal(readCustomLibrary('other').games.length,0);
});

test('unified library keeps imported duration provenance and uninstalled availability',()=>{
  const store=mergeHydraGames(emptyCustomLibrary(),[plan(game({executable:null}),true)]).store;
  const items=unifiedLibrary({installed:[],custom:store.games,retro:EMPTY_EMULATION(),preferences:emptyLibraryPreferences(),steamKnown:true,launchersKnown:true});
  assert.equal(items.length,1);assert.equal(items[0].state,'notInstalled');
  assert.deepEqual(libraryPlaytime(items[0]),{seconds:90,source:'hydra'});
});

test('an exact existing installation does not schedule another validation',async()=>{
  const store=mergeHydraGames(emptyCustomLibrary(),[plan()]).store;
  const result=await planHydraGames(review([game()]),store,new AbortController().signal);
  assert.equal(result[0].existing,store.games[0].id);
  assert.equal(result[0].checkOnImport,undefined);
});

test('10,000 executable records are reviewable without claiming the files exist',async()=>{
  const records=Array.from({length:10000},(_,i)=>game({key:`custom:${i}`,shop:'custom',objectId:String(i),executable:`D:/Games/${i}/game.exe`}));
  let yielded=false;setTimeout(()=>{yielded=true;},0);
  const plans=await planHydraGames(review(records),emptyCustomLibrary(),new AbortController().signal);
  assert.equal(plans.length,10000);assert(yielded);
  assert(plans.every(p=>p.pending&&p.checkOnImport&&p.config.executable===''));
  assert.equal(plans.at(-1)?.original.executable,'D:/Games/9999/game.exe');
  const abort=new AbortController();setTimeout(()=>abort.abort(),0);
  await assert.rejects(planHydraGames(review(records),emptyCustomLibrary(),abort.signal));
});

test('import checks only selected plain paths and retains unavailable or configured entries',async()=>{
  const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  const records=[game(),game({key:'steam:2',objectId:'2',executable:'D:/moved.exe'}),game({key:'steam:3',objectId:'3',executable:'D:/configured.exe',launchOptions:'--saved "A B"'}),game({key:'steam:4',objectId:'4',executable:null}),game({key:'steam:5',objectId:'5',executable:'D:/not-selected.exe'})];
  const plans=await planHydraGames(review(records),emptyCustomLibrary(),new AbortController().signal),calls:string[]=[],progress:number[]=[];
  const result=await applyHydraGames('selected',plans.slice(0,4),async c=>{calls.push(c.executable);if(c.executable==='D:/moved.exe')throw Error('launch_missing');return c;},new AbortController().signal,()=>true,(n,total)=>{assert.equal(total,4);progress.push(n);});
  assert.deepEqual(calls.sort(),['D:/Games/Game.exe','D:/moved.exe']);assert.deepEqual(progress,[0,1,2,3,4]);assert.equal(result.added,4);
  const saved=readCustomLibrary('selected').games;assert.equal(saved[0].launchPending,undefined);assert(saved.slice(1).every(g=>g.launchPending));
  assert.equal(saved[2].hydra?.original.launchOptions,'--saved "A B"');assert.equal(saved[3].config.executable,'');
});

test('current existing games skip probes and a profile change during probes commits nothing',async()=>{
  const store=mergeHydraGames(emptyCustomLibrary(),[plan()]).store,raw=JSON.stringify(store),storage=new Map([['harbor.games.custom.v1:current',raw]]);
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  const plans=await planHydraGames(review([game()]),emptyCustomLibrary(),new AbortController().signal);
  const result=await applyHydraGames('current',plans,async()=>{throw Error('must not probe existing');},new AbortController().signal,()=>true);
  assert.equal(result.existing,1);assert.equal(storage.get('harbor.games.custom.v1:current'),raw);
  let current=true;
  await assert.rejects(applyHydraGames('changed',plans,async c=>{current=false;return c;},new AbortController().signal,()=>current),/hydra_canceled/);
  assert.equal(storage.has('harbor.games.custom.v1:changed'),false);
});

test('indexed duplicate matching preserves earliest-library precedence and canonical aliases',async()=>{
  const first=plan(game({key:'steam:2',objectId:'2',executable:'D:/first.exe'})),second=plan(game({key:'steam:3',objectId:'3',executable:'D:/second.exe'}));
  const store=mergeHydraGames(emptyCustomLibrary(),[first,second]).store;
  const conflict=game({key:'steam:3',objectId:'3',executable:'d:\\FIRST.exe'});
  const plans=await planHydraGames(review([conflict]),store,new AbortController().signal);
  assert.equal(plans[0].existing,existingHydraGame(store,conflict)?.id);assert.equal(plans[0].existing,store.games[0].id);
  const alias=plan(game({key:'custom:alias',shop:'custom',objectId:'alias',executable:'D:/first.exe'}));
  const merged=mergeHydraGames(emptyCustomLibrary(),[first,alias]);assert.equal(merged.added,1);assert.equal(merged.existing,1);
});

test('library capacity refuses the whole selection and preserves previous data',async()=>{
  const records=Array.from({length:1000},(_,i)=>plan(game({key:`custom:${i}`,shop:'custom',objectId:String(i),executable:null}),true));
  const store=mergeHydraGames(emptyCustomLibrary(),records).store,raw=JSON.stringify(store);
  const storage=new Map([['harbor.games.custom.v1:hydra-full',raw]]);
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},configurable:true});
  await assert.rejects(applyHydraGames('hydra-full',[plan()],async c=>c,new AbortController().signal,()=>true),/launch_limit/);
  assert.equal(storage.get('harbor.games.custom.v1:hydra-full'),raw);
});
