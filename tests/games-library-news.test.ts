import test from "node:test";
import assert from "node:assert/strict";
import { libraryNewsGames, libraryNewsItems, mergeLibraryNews, libraryNewsCollapsed, saveLibraryNewsCollapsed, LIBRARY_NEWS_WINDOW } from "../src/lib/games/library-news.ts";
import { loadLibraryNews } from "../src/lib/games/library-news-load.ts";
import { GameRequestPool } from "../src/lib/games/request-pool.ts";
import type { UnifiedLibraryGame } from "../src/lib/games/unified-library.ts";

const now=Date.now(),date=Math.floor(now/1000);
const game=(id:number)=>({id:`steam:${id}`,steamId:id,name:`Game ${id}`,capsule:"",platforms:[]});
const entry=(id:number,extra:Partial<UnifiedLibraryGame>={}):UnifiedLibraryGame=>({id:`steam:${id}`,name:`Game ${id}`,game:game(id),source:"steam",favorite:false,hidden:false,lastPlayed:0,state:"ready",...extra});
const post=(id:string,at=date)=>({id,date:at,title:`Update ${id}`,url:`https://steamcommunity.com/games/42/announcements/detail/${id}`,body:"Developer post",image:""});
const success=(items= [post("1")])=>({status:"fulfilled" as const,value:items});
const failure=()=>({status:"rejected" as const,reason:Error("offline")});

test("only exact visible Steam-linked membership produces news; copies dedupe without title matching",()=>{
  const games=[entry(42),entry(42,{id:"custom:copy",source:"custom",favorite:true}),entry(43,{hidden:true}),entry(44,{game:{...game(44),steamId:undefined,name:"Game 42"}}),entry(45,{game:{...game(45),steamId:Infinity}}),entry(46,{game:{...game(46),steamId:0x100000000}}),entry(47)];
  const before=structuredClone(games);
  assert.deepEqual(libraryNewsGames(games).map(game=>game.steamId),[42,47]);assert.deepEqual(games,before);
  assert.deepEqual(libraryNewsGames(games.filter(game=>game.hidden)),[]);
});
test("favorite/recent priority covers the full library rather than only the first rendered page",()=>{
  const games=Array.from({length:80},(_,index)=>entry(index+1));games[70].lastPlayed=now;games[79].favorite=true;
  const targets=libraryNewsGames(games);assert.equal(targets.length,80);assert.deepEqual(targets.slice(0,2).map(game=>game.steamId),[80,71]);
});
test("a failed refresh retains that exact feed with a saved label; healthy empty responses clear old posts",()=>{
  const previous=mergeLibraryNews([game(42),game(43)],[success(),success([post("2")])]);
  const result=mergeLibraryNews([game(42),game(43)],[failure(),success([])],previous);
  assert.equal(result[0].unavailable,true);assert.equal(result[0].items[0].id,"1");assert.equal(result[1].unavailable,false);assert.deepEqual(result[1].items,[]);
  assert.deepEqual(mergeLibraryNews([game(44)],[failure()],previous)[0].items,[]);
});
test("posts have bounded age, deterministic order, per-game diversity and game-scoped identities",()=>{
  const feeds=mergeLibraryNews([game(42),game(43)],[success([post("1",date-5),post("2",date-4),post("3",date-3),post("3",date-3),post("old",Math.floor((now-LIBRARY_NEWS_WINDOW)/1000)-1),post("future",date+3600)]),success([post("3",date-2)])]);
  const items=libraryNewsItems(feeds,now);assert.deepEqual(items.map(item=>item.key),["43:3","42:3"]);
  assert.equal(libraryNewsItems(feeds,now+LIBRARY_NEWS_WINDOW+3601_000).length,0);
});
test("collapse preference is profile-local and cannot stop the view when storage fails",()=>{
  const memory=new Map<string,string>();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
  assert.equal(libraryNewsCollapsed("a"),false);saveLibraryNewsCollapsed("a",true);assert.equal(libraryNewsCollapsed("a"),true);assert.equal(libraryNewsCollapsed("b"),false);saveLibraryNewsCollapsed("a",false);assert.equal(libraryNewsCollapsed("a"),false);
  globalThis.localStorage={getItem:()=>{throw Error("blocked");},setItem:()=>{throw Error("blocked");}} as unknown as Storage;
  assert.doesNotThrow(()=>saveLibraryNewsCollapsed("a",true));assert.equal(libraryNewsCollapsed("a"),false);
});
test("partial provider failures settle independently; explicit refresh reaches each exact app",async()=>{
  const calls:Array<[number,boolean|undefined]>=[],controller=new AbortController();
  const results=await loadLibraryNews([game(42),game(43)],controller.signal,async(id,_signal,refresh)=>{calls.push([id,refresh]);if(id===43)throw Error("offline");return [post("1")];},100,true);
  assert.deepEqual(results.map(result=>result.status),["fulfilled","rejected"]);assert.deepEqual(calls,[[42,true],[43,true]]);
});
test("deadline includes queue time and ignores late provider completion",async()=>{
  const pool=new GameRequestPool(1),calls:number[]=[],controller=new AbortController();let finish:(value:ReturnType<typeof post>[])=>void=()=>{};
  const pending=loadLibraryNews([game(42),game(43)],controller.signal,(id,signal)=>pool.run(()=>{calls.push(id);return new Promise(resolve=>{finish=resolve;});},signal),20);
  const results=await pending;assert.deepEqual(results.map(result=>result.status),["rejected","rejected"]);assert.deepEqual(calls,[42]);finish([post("late")]);await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(calls,[42]);assert.ok(results.every(result=>result.status==="rejected"));
});
test("scope cancellation rejects the batch instead of publishing partial old-profile results",async()=>{
  const controller=new AbortController();const pending=loadLibraryNews([game(42)],controller.signal,async()=>new Promise(()=>{}),1000);controller.abort();await assert.rejects(pending,{name:"AbortError"});
});
test("two stalled feeds cannot starve later healthy feeds",async()=>{
  const calls:number[]=[],controller=new AbortController();
  const result=await loadLibraryNews([game(1),game(2),game(3)],controller.signal,async(id)=>{calls.push(id);if(id<3)return new Promise(()=>{});return [post("healthy")];},200,false,10);
  assert.deepEqual(calls,[1,2,3]);assert.deepEqual(result.map(value=>value.status),["rejected","rejected","fulfilled"]);
});
