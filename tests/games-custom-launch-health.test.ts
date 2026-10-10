import assert from "node:assert/strict";
import test from "node:test";
import { customLaunchHealth, inspectCustomLaunches, launchConfigKey, launchHealthObservation, relocateCustomExecutable } from "../src/lib/games/custom-launch-health.ts";
import { emptyLaunchConfig, type CustomGame } from "../src/lib/games/custom-library.ts";
import { quickLibrary, filterQuickLibrary } from "../src/lib/games/quick-library.ts";
import { unifiedLibrary, filterUnifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";

const game = (id="copy-a"): CustomGame => ({id,name:"Same game",config:{...emptyLaunchConfig(),executable:"W:/Games/game.exe"},linked:null,artwork:null,pinned:false,hidden:false,addedAt:0,lastPlayed:0,measuredSeconds:3600});
test("health belongs to the exact copy and every launch field, not presentation or play history",()=>{
  const g=game(),values={[g.id]:launchHealthObservation(g.config)};
  assert.equal(customLaunchHealth({...g,name:"Renamed",measuredSeconds:7200},values)?.state,"ready");
  assert.equal(customLaunchHealth(game("copy-b"),values),undefined);
  for(const patch of [{executable:"D:/Game/game.exe"},{workingDirectory:"W:/other"},{arguments:["a","b"]},{mode:"wine" as const},{runner:"W:/runner"},{prefix:"W:/prefix"},{steamDirectory:"W:/Steam"}]) assert.equal(customLaunchHealth({...g,config:{...g.config,...patch}},values),undefined);
  assert.notEqual(launchConfigKey({...g.config,arguments:["a","b"]}),launchConfigKey({...g.config,arguments:["b","a"]}));
});
test("filesystem/configuration failures are repairable while unavailable IPC remains unknown",()=>{
  const config=game().config;
  for(const error of ["launch_missing","launch_permission","launch_runner","launch_platform","launch_directory"]) assert.equal(launchHealthObservation(config,error).state,"attention");
  assert.equal(launchHealthObservation(config,Error("launch_missing")).issue,"missing");
  for(const error of ["Command not found","launch_failed",null]) assert.equal(launchHealthObservation(config,error).state,"unknown");
});
test("checks are read-only, bounded to three actual calls, progressive and reject malformed responses",async()=>{
  const games=Array.from({length:9},(_,i)=>game(String(i))),before=structuredClone(games),results:any[]=[];
  let active=0,peak=0;
  await inspectCustomLaunches(games,async config=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return config;},new AbortController().signal,(id,value)=>results.push([id,value]));
  assert.equal(peak,3);assert.equal(results.length,9);assert.deepEqual(games,before);
  for(const validate of [async()=>null,async()=>{throw undefined;}]){
    const failures:any[]=[];await inspectCustomLaunches([game()],validate,new AbortController().signal,(_,value)=>failures.push(value));assert.equal(failures[0].state,"unknown");
  }
});
test("cancelling a scan drains existing work but never starts or publishes subsequent checks",async()=>{
  const controller=new AbortController(),games=Array.from({length:10},(_,i)=>game(String(i)));let calls=0,published=0;const releases:(()=>void)[]=[];
  const pending=inspectCustomLaunches(games,async config=>{calls++;await new Promise<void>(resolve=>releases.push(resolve));return config;},controller.signal,()=>published++);
  assert.equal(calls,3);controller.abort();releases.forEach(release=>release());await pending;
  assert.equal(calls,3);assert.equal(published,0);
});
test("quick and unified readiness exclude unknown/failed copies and react to repaired config observations",()=>{
  const a=game(),b=game("copy-b"),prefs=emptyLibraryPreferences(),retro=EMPTY_EMULATION(),health={[a.id]:launchHealthObservation(a.config),[b.id]:launchHealthObservation(b.config,"launch_missing")};
  const quick=quickLibrary([], [a,b],retro,[],prefs,undefined,{customHealth:health});
  assert.deepEqual(filterQuickLibrary(quick,{query:"",group:"all",source:"all",ready:true,sort:"name"}).map(item=>item.id),["custom:copy-a"]);
  const input={installed:[],steamKnown:true,custom:[a,b],customHealth:health,retro,launchersKnown:true,preferences:prefs};
  const items=unifiedLibrary(input);assert.deepEqual(items.map(item=>item.state),["ready","setup"]);
  assert.deepEqual(filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),availability:"attention"}).map(item=>item.id),["custom:copy-b"]);
  const moved={...a,config:{...a.config,executable:"D:/Moved/game.exe"}};
  assert.equal(unifiedLibrary({...input,custom:[moved]})[0].state,"unknown");
  assert.equal(unifiedLibrary({...input,custom:[moved],customHealth:{[a.id]:launchHealthObservation(moved.config)}})[0].state,"ready");
  assert.equal(quickLibrary([], [a],retro,[],prefs)[0].ready,false);
});
test("repair follows an implicit executable folder, preserving explicit working folders and all other launch choices",()=>{
  const config={...game().config,workingDirectory:"w:\\games\\",arguments:["--profile","One"],prefix:"W:/Prefix"};
  const moved=relocateCustomExecutable(config,"D:/Moved/game.exe");
  assert.equal(moved.workingDirectory,null);assert.deepEqual(moved.arguments,config.arguments);assert.equal(moved.prefix,config.prefix);assert.equal(config.executable,"W:/Games/game.exe");
  assert.equal(relocateCustomExecutable({...config,workingDirectory:"W:/Custom working"},"D:/Moved/game.exe").workingDirectory,"W:/Custom working");
  assert.equal(relocateCustomExecutable({...config,executable:"/Games/game",workingDirectory:"/games"},"/Moved/game").workingDirectory,"/games");
});
