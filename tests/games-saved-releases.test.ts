import test from "node:test";
import assert from "node:assert/strict";
import { releaseWindow,steamSavedRelease,atlasSavedRelease,savedReleaseState,savedReleaseGames } from "../src/lib/games/saved-releases.ts";
import { loadSavedReleases } from "../src/lib/games/saved-releases-load.ts";
import { decodeIgdbRows } from "../src/lib/games/igdb-records.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
const now=Date.UTC(2026,9,1),game=(id:number,name=`Game ${id}`)=>({id:`steam:${id}`,steamId:id,name,capsule:"",platforms:["Windows"]});
test("release windows retain public precision and reject fuzzy or invalid dates",()=>{
  assert.deepEqual(releaseWindow("Q4 2026"),{start:Date.UTC(2026,9,1),end:Date.UTC(2027,0,1),precision:"quarter"});
  assert.equal(releaseWindow("2027")?.precision,"year");assert.equal(releaseWindow("October 2026")?.precision,"month");
  assert.equal(releaseWindow("13 Oct, 2026")?.start,releaseWindow("Oct 13, 2026")?.start);
  assert.equal(releaseWindow("2026-10-13")?.start,Date.UTC(2026,9,13));
  for(const invalid of ["Coming soon","To be announced","Feb 29, 2026","2026-02-30","Q5 2027","Octopus 2027","Summer 2027","2027 or 2028"]){assert.equal(releaseWindow(invalid),undefined,invalid);}
  assert.equal(releaseWindow("Feb 29, 2028")?.precision,"day");
});
test("Steam availability is authoritative even when a projected date has passed",()=>{
  assert.equal(savedReleaseState(steamSavedRelease("Sep 1, 2026",true),now).status,"upcoming");
  assert.equal(savedReleaseState(steamSavedRelease("2027",false),now).status,"released");
  assert.equal(savedReleaseState(steamSavedRelease("Coming soon",true),now).status,"upcoming");
  assert.equal(savedReleaseState(undefined,now).status,"unknown");
});
test("IGDB expanded formats survive decode and never turn year precision into December 31",()=>{
  const rows=decodeIgdbRows([{id:1070,name:"Super Mario World",release_dates:[{id:505223,human:"1991",date:694137600,date_format:{id:2,format:"YYYY"},platform:{id:19,name:"SNES"},release_region:{id:1,region:"europe"},status:{id:6,name:"Full Release"}}]}])!;
  const parsed=parseAtlasGame(rows[0]);assert.equal(parsed.releaseHistory![0].dateFormatName,"YYYY");
  const info=atlasSavedRelease(parsed.releaseHistory!);assert.equal(info.releases[0].label,"1991");assert.equal(info.releases[0].window?.precision,"year");
  assert.equal(savedReleaseState(info,now).status,"past");assert.equal(info.releases[0].region,"europe");
});
test("cancelled ports cannot replace upcoming releases; no date falls back to another platform's timestamp",()=>{
  const releases=[{id:1,label:"Oct 5, 2026",platform:{id:6,name:"PC"},status:{id:5,name:"Cancelled"}},{id:2,label:"Q1 2027",platform:{id:48,name:"PlayStation 4"},dateFormatName:"YYYYQ1"}];
  const info=atlasSavedRelease(releases),state=savedReleaseState(info,now);
  assert.equal(state.status,"upcoming");assert.equal(state.release?.platform,"PlayStation 4");assert.equal(state.release?.window?.precision,"quarter");
  assert.equal(savedReleaseState(atlasSavedRelease([releases[0]]),now).status,"cancelled");
  assert.equal(atlasSavedRelease([{id:3,label:"",date:694137600,dateFormat:0,platform:{id:19,name:"SNES"}}]).releases[0].window,undefined);
});
test("unknown format precision and contradictory coarse labels do not yield a sortable exact date",()=>{
  assert.equal(atlasSavedRelease([{id:1,label:"Dec 31, 1991",dateFormatName:"YYYY",platform:{id:19,name:"SNES"}}]).releases[0].window,undefined);
  assert.equal(atlasSavedRelease([{id:2,label:"",date:694137600,dateFormatName:"YYYYMMDD",platform:{id:19,name:"SNES"}}]).releases[0].window?.precision,"day");
});
test("saved filtering preserves exact editions, accents and unavailable items",()=>{
  const a=game(1,"Pokémon"),b={...game(2,"Original"),id:"igdb:2",steamId:undefined,igdbId:2},c=game(3);
  const results={[a.id]:{info:steamSavedRelease("2027",true),failed:false},[b.id]:{info:atlasSavedRelease([{id:1,label:"1991",platform:{id:19,name:"SNES"}}]),failed:false}};
  assert.deepEqual(savedReleaseGames([a,b,c],results,"pokemon","all","recent",now).map(g=>g.id),[a.id]);
  assert.deepEqual(savedReleaseGames([b,c,a],results,"","all","next",now).map(g=>g.id),[a.id,b.id,c.id]);
  assert.deepEqual(savedReleaseGames([a,b,c],results,"","released","recent",now).map(g=>g.id),[b.id]);
  assert.deepEqual(savedReleaseGames([a,b,c],results,"","unknown","recent",now).map(g=>g.id),[c.id]);
});
test("bounded loader continues past timed-out feeds and attributes partial failure to exact identity",async()=>{
  const seen:string[]=[],results:any[]=[];let current=0,max=0;
  await loadSavedReleases([game(1),game(2),game(3)],new AbortController().signal,(id,result)=>results.push([id,result]),async(g,signal)=>{
    seen.push(g.id);current++;max=Math.max(max,current);
    try{if(g.steamId===1)await new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));if(g.steamId===2)throw Error("offline");return steamSavedRelease("2027",true);}finally{current--;}
  },20);
  assert.equal(max,2);assert.equal(results.length,3);assert.equal(results.find(([id])=>id==="steam:1")[1].failed,true);assert.equal(results.find(([id])=>id==="steam:3")[1].info.source,"Steam");assert.equal(seen.length,3);
});
test("cancelled loader cannot publish late membership results",async()=>{
  const controller=new AbortController();let resolve:any;const values:any[]=[];
  const promise=loadSavedReleases([game(1)],controller.signal,(...value)=>values.push(value),()=>new Promise(done=>resolve=done));
  await Promise.resolve();controller.abort();await assert.rejects(promise);resolve(steamSavedRelease("2027",true));await Promise.resolve();assert.deepEqual(values,[]);
});
test("manual refresh reaches the provider with force for every requested identity",async()=>{
  const forced:boolean[]=[];
  await loadSavedReleases([game(1),game(2)],new AbortController().signal,()=>{},async(_,__,force)=>{forced.push(!!force);return steamSavedRelease("2031",true);},50,true);
  assert.deepEqual(forced,[true,true]);
});
