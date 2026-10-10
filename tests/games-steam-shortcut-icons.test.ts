import test from "node:test";
import assert from "node:assert/strict";
import { loadSteamShortcutIcon } from "../src/lib/games/steam-shortcut-icons.ts";
import type { SteamShortcut } from "../src/lib/games/steam-shortcuts.ts";

const image="data:image/png;base64,aGVsbG8=";
const game=(appId:number,iconKey="0123456789abcdef")=>({id:`steam-shortcut:123:${appId}`,accountId:123,appId,iconKey}) as SteamShortcut;
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test("visible icon requests batch by profile/root/account, preserve IDs and deduplicate",async()=>{
  const calls:any[]=[];
  (globalThis as any).window={__TAURI_INTERNALS__:{invoke:async(cmd:string,args:any)=>{calls.push({cmd,args});return Object.fromEntries(args.requests.map((item:any)=>[`steam-shortcut:${args.accountId}:${item.appId}`,image]));}}};
  const first=loadSteamShortcutIcon("icons-a",null,game(4294967295));
  assert.equal(first,loadSteamShortcutIcon("icons-a",null,game(4294967295)));
  const values=await Promise.all([first,...Array.from({length:30},(_,i)=>loadSteamShortcutIcon("icons-a",null,game(2147483648+i)))]);
  assert.ok(values.every(value=>value===image));
  assert.equal(calls.length,2);assert.ok(calls.every(call=>call.cmd==="games_steam_shortcut_icons"&&call.args.requests.length<=24));
  assert.equal(calls[0].args.requests[0].appId,4294967295);
  await loadSteamShortcutIcon("icons-b",null,game(4294967295));
  await loadSteamShortcutIcon("icons-a","W:/OtherSteam",game(4294967295));
  await loadSteamShortcutIcon("icons-a",null,game(4294967295,"fedcba9876543210"));
  assert.equal(calls.length,5);
});
test("native errors can retry, cached misses invalidate by version, invalid payloads are rejected",async()=>{
  let calls=0,error=true,value:string|undefined=image;
  (globalThis as any).window={__TAURI_INTERNALS__:{invoke:async(_:string,args:any)=>{calls++;if(error)throw Error("shortcut_read");return {[`steam-shortcut:123:${args.requests[0].appId}`]:value};}}};
  assert.equal(await loadSteamShortcutIcon("icons-errors",null,game(2147483650)),undefined);
  error=false;await tick();assert.equal(await loadSteamShortcutIcon("icons-errors",null,game(2147483650)),image);
  value=undefined;assert.equal(await loadSteamShortcutIcon("icons-errors",null,game(2147483651)),undefined);
  await loadSteamShortcutIcon("icons-errors",null,game(2147483651));assert.equal(calls,3);
  value="https://example.com/not-a-local-icon.png";
  assert.equal(await loadSteamShortcutIcon("icons-errors",null,game(2147483651,"1111111111111111")),undefined);
  value="data:image/png;base64,"+"A".repeat(90_000);
  assert.equal(await loadSteamShortcutIcon("icons-errors",null,game(2147483651,"2222222222222222")),undefined);
});
test("at most two native batches run concurrently",async()=>{
  let active=0,peak=0;const releases:(()=>void)[]=[];
  (globalThis as any).window={__TAURI_INTERNALS__:{invoke:async()=>{active++;peak=Math.max(peak,active);await new Promise<void>(resolve=>releases.push(resolve));active--;return {};}}};
  const requests=Array.from({length:80},(_,i)=>loadSteamShortcutIcon("icons-bounds",null,game(2147484000+i)));
  await tick();assert.equal(active,2);
  for(let index=0;index<6;index++){releases.splice(0).forEach(release=>release());await tick();}
  await Promise.all(requests);assert.equal(peak,2);assert.equal(active,0);
});


test("local legacy icon requests carry the exact local identity without a fabricated app ID",async()=>{
  const calls:any[]=[];const id="steam-shortcut:123:local-0123456789abcdef012345";
  (globalThis as any).window={__TAURI_INTERNALS__:{invoke:async(cmd:string,args:any)=>{calls.push({cmd,args});return {[id]:image};}}};
  const local={...game(0),id,appId:null} as SteamShortcut;
  assert.equal(await loadSteamShortcutIcon("legacy-icons",null,local),image);
  assert.deepEqual(calls[0].args.requests,[{appId:null,shortcutId:id,key:"0123456789abcdef"}]);
  assert.equal(calls[0].args.accountId,123);
});
