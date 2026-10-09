import assert from "node:assert/strict";
import test from "node:test";
import { defaultSidebarPreferences, moveSidebarGame, parseSidebarPreferences, sidebarGames, sidebarSections, sidebarPreferenceKey } from "../src/lib/games/sidebar-preferences.ts";
import { sidebarStatus } from "../src/lib/games/sidebar-status.ts";
import type { QuickGame } from "../src/lib/games/quick-library.ts";
import { emptyLaunchConfig } from "../src/lib/games/custom-library.ts";

const game = (id: number, name: string, lastPlayed: number): QuickGame => ({
  id: `steam:${id}`, name, lastPlayed, favorite: false, ready: true, source: "steam",
  install: { appId: id, name, state: "installed", installPath: "", libraryPath: "", sizeBytes: 0, lastPlayed: lastPlayed / 1000 },
});
const games = [game(1, "Zulu", 30), game(2, "Alpha", 20), game(3, "Beta", 10)];
const ids = (value: QuickGame[]) => value.map(game => game.id);

test("sidebar preferences validate storage, deduplicate IDs and isolate profiles", () => {
  assert.deepEqual(parseSidebarPreferences("broken"), defaultSidebarPreferences());
  const saved = parseSidebarPreferences(JSON.stringify({filters:{source:"evil",group:"favorites",sort:"custom",ready:true},pinned:["steam:1","steam:1",false,"bad\n"],hidden:["steam:3"]}));
  assert.deepEqual(saved.pinned, ["steam:1"]); assert.equal(saved.filters.source, "all");
  assert.deepEqual(parseSidebarPreferences(JSON.stringify(saved)), saved);
  assert.notEqual(sidebarPreferenceKey("one"), sidebarPreferenceKey("two"));
});
test("pins stay ordered above every sort and still respect active filters", () => {
  const p = {...defaultSidebarPreferences(), pinned:["steam:3","steam:1"]};
  p.filters.sort = "name";
  assert.deepEqual(ids(sidebarGames(games,p,"")), ["steam:3","steam:1","steam:2"]);
  assert.deepEqual(ids(sidebarGames(games,p,"Alpha")), ["steam:2"]);
  p.filters.source = "custom"; assert.equal(sidebarGames(games,p,"").length,0);
});
test("hiding only affects the sidebar; arrange reveals hidden and filtered entries", () => {
  const p = {...defaultSidebarPreferences(),hidden:["steam:2"]};
  assert.deepEqual(ids(sidebarGames(games,p,"")),["steam:1","steam:3"]);
  p.filters.ready=true; p.filters.source="custom";
  assert.deepEqual(ids(sidebarGames(games,p,"",true)),ids(games));
  assert.equal(games.length,3);
});
test("manual ordering survives filtering, rescan and roundtrip without losing absent entries", () => {
  let p = {...defaultSidebarPreferences(),order:["steam:99"]};
  p = moveSidebarGame(p,games,"steam:3","steam:1");
  assert.equal(p.filters.sort,"custom"); assert.deepEqual(ids(sidebarGames(games,p,"")),["steam:3","steam:1","steam:2"]);
  assert.ok(p.order.includes("steam:99"));
  p = parseSidebarPreferences(JSON.stringify(p));
  assert.deepEqual(ids(sidebarGames([...games].reverse(),p,"")),["steam:3","steam:1","steam:2"]);
  assert.deepEqual(ids(sidebarGames(games,p,"Alpha")),["steam:2"]);
});
test("manual movement starts from the displayed sort and cannot cross pinned boundaries", () => {
  const p = {...defaultSidebarPreferences(),order:["steam:1","steam:2","steam:3"]}; p.filters.sort="name";
  const next = moveSidebarGame(p,games,"steam:1","steam:3");
  assert.deepEqual(ids(sidebarGames(games,next,"")),["steam:2","steam:1","steam:3"]);
  const pins = {...next,pinned:["steam:2","steam:3"]};
  assert.equal(moveSidebarGame(pins,games,"steam:1","steam:2"),pins);
  assert.deepEqual(moveSidebarGame(pins,games,"steam:3","steam:2").pinned,["steam:3","steam:2"]);
});
test("source sections preserve pins and each group's chosen game order without duplicating entries", () => {
  const saved: QuickGame = { id:"igdb:9", name:"Saved game", source:"saved", lastPlayed:0, favorite:false, ready:false };
  const preferences = { ...defaultSidebarPreferences(), pinned:["steam:2"] };
  const sections = sidebarSections(sidebarGames([saved,...games],preferences,""),preferences);
  assert.deepEqual(sections.map(section=>[section.id,ids(section.games)]),[["pinned",["steam:2"]],["steam",["steam:1","steam:3"]],["saved",["igdb:9"]]]);
  assert.equal(sections[1].label,"Steam"); assert.equal(sections[2].translated,true);
  const moved=moveSidebarGame(preferences,[saved,...games],saved.id,"steam:1");
  assert.equal(moved.grouping,"none");
  assert.deepEqual(sidebarSections(sidebarGames([saved,...games],moved,""),moved).map(section=>section.id),["pinned","all"]);
  assert.deepEqual(sidebarSections(games,preferences,true).map(section=>section.id),["pinned","all"]);
});
test("group choices roundtrip and existing custom orders keep their ungrouped arrangement", () => {
  const p=parseSidebarPreferences(JSON.stringify({filters:{sort:"custom"},collapsedGroups:["steam","steam","saved"]}));
  assert.equal(p.grouping,"none"); assert.deepEqual(p.collapsedGroups,["steam","saved"]);
  assert.deepEqual(parseSidebarPreferences(JSON.stringify(p)),p);
  const explicit=parseSidebarPreferences(JSON.stringify({...p,grouping:"source"}));
  assert.equal(explicit.grouping,"source");
  assert.deepEqual(sidebarSections(games,explicit).flatMap(section=>section.games),games);
});

test("new local additions lead Recent without duplicating their source rows or inventing playtime", () => {
  const now=Date.UTC(2026,9,3), addedAt=now-1000;
  const local:QuickGame={id:"custom:new",name:"Just installed",source:"custom",favorite:false,ready:true,lastPlayed:0,
    custom:{id:"new",name:"Just installed",config:emptyLaunchConfig(),linked:null,artwork:null,pinned:false,hidden:false,addedAt,lastPlayed:0,measuredSeconds:0}};
  const played=game(4,"Played yesterday",now-86400_000);
  const list=[...games,played,local], p=defaultSidebarPreferences();
  const sections=sidebarSections(sidebarGames(list,p,""),p,false,now);
  assert.equal(sections[0].id,"recent");
  assert.deepEqual(ids(sections[0].games),[local.id,played.id]);
  const all=sections.flatMap(section=>ids(section.games));
  assert.equal(new Set(all).size,list.length); assert.equal(all.length,list.length);
  assert.equal(local.lastPlayed,0); assert.equal(local.custom.measuredSeconds,0);
  assert.deepEqual(sidebarSections(sidebarGames(list,p,"Just installed"),p,false,now)[0].games,[local]);
});

test("Recent is bounded, expires old activity, rejects invalid clocks and keeps pins first", () => {
  const now=Date.UTC(2026,9,3), p={...defaultSidebarPreferences(),pinned:["steam:1"]};
  const fresh=Array.from({length:9},(_,i)=>game(i+1,`Recent ${i+1}`,now-i*1000));
  const stale=game(20,"Old",now-31*86400_000),future=game(21,"Future",now+1000),invalid=game(22,"Invalid",NaN);
  const list=[stale,future,invalid,...fresh];
  const sections=sidebarSections(list,p,false,now);
  assert.deepEqual(sections.map(section=>section.id),["pinned","recent","steam"]);
  assert.deepEqual(ids(sections[1].games),fresh.slice(1,7).map(game=>game.id));
  assert.equal(sections.flatMap(section=>section.games).length,list.length);
  assert.equal(sidebarSections(fresh,p,false,now+31*86400_000).some(section=>section.id==="recent"),false);
});

test("Recent respects active filters and leaves flat/manual arrangements alone", () => {
  const now=Date.UTC(2026,9,3), p=defaultSidebarPreferences(), list=[game(1,"One",now-1000),game(2,"Two",now-2000)];
  p.hidden=[list[0].id];
  assert.deepEqual(sidebarSections(sidebarGames(list,p,""),p,false,now)[0].games,[list[1]]);
  p.filters.source="custom";
  assert.deepEqual(sidebarSections(sidebarGames(list,p,""),p,false,now),[]);
  assert.deepEqual(sidebarSections(list,{...p,grouping:"none"},false,now).map(section=>section.id),["all"]);
  assert.deepEqual(sidebarSections(list,p,true,now).map(section=>section.id),["all"]);
});
test("update tooltip shows bounded download progress, never invented validation progress", () => {
  const steam = game(4,"Updating",0); if(steam.source!=="steam")throw Error();
  steam.install.update="downloading"; steam.install.bytesToDownload=100; steam.install.bytesDownloaded=40;
  assert.equal(sidebarStatus(steam).progress,.4);
  steam.install.bytesDownloaded=140; assert.equal(sidebarStatus(steam).progress,1);
  steam.install.bytesToDownload=0; assert.equal(sidebarStatus(steam).progress,null);
  steam.install.bytesToDownload=100; steam.install.bytesDownloaded=undefined; assert.equal(sidebarStatus(steam).progress,null);
  steam.install.update="validating"; steam.install.bytesToDownload=100;
  assert.equal(sidebarStatus(steam).progress,null); assert.equal(sidebarStatus(steam).icon,"verify");
});
test("running, saved and missing installation states stay distinct", () => {
  assert.equal(sidebarStatus(games[0],true).icon,"running");
  assert.equal(sidebarStatus(games[0]).key,"games.sidebar.launchWith");
  assert.equal(sidebarStatus({id:"igdb:8",name:"Saved",source:"saved",lastPlayed:0,favorite:false,ready:false}).icon,"saved");
  const missing=game(4,"Missing",0); if(missing.source!=="steam")throw Error(); missing.install.state="missing"; missing.ready=false;
  assert.equal(sidebarStatus(missing).key,"games.badge.unavailable");
});
test("all sidebar copy is translated with matching interpolation variables", async () => {
  const fs=await import("node:fs/promises");
  const languages=["en","ar","de","es","fr","hi","id","it","ja","ko","pl","pt","ru","tr","vi","zh"];
  const keys=["playerReady","launchWith","manageSteam","played","disk","customOrder","arrange","resetFilters","arrangeNote","saveFailed","move","up","down","unpin","pin","restore","hide","pinned","groupBy"];
  const english=(await import("../src/lib/i18n/locales/en/game-dock.ts")).default;
  for(const lang of languages){
    const source=await fs.readFile(new URL(`../src/lib/i18n/locales/${lang}/game-dock.ts`,import.meta.url),"utf8");
    for(const suffix of keys){const key=`games.sidebar.${suffix}`, match=source.match(new RegExp(`"${key.replaceAll(".","\\.")}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`));assert.ok(match,`${lang}:${key}`);
      const text=JSON.parse(match[1]); assert.deepEqual((text.match(/\{\w+\}/g)??[]).sort(),(english[key as keyof typeof english].match(/\{\w+\}/g)??[]).sort(),`${lang}:${key}`);
    }
  }
});
