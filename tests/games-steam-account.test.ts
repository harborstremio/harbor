import assert from "node:assert/strict";
import test from "node:test";
import { filterSteamOwned, pickSteamOwnedGame, steamAccountError, steamOwnedSummary, type OwnedLibraryFilters } from "../src/lib/games/steam-account";
import type { SteamInstall } from "../src/lib/games/installed";
const filters = (patch: Partial<OwnedLibraryFilters> = {}): OwnedLibraryFilters => ({query:"",installation:"all",activity:"all",sort:"recent",...patch});

test("owned and installed filters retain separate authorities with reported playtime", () => {
  const games = [{ appId: 1, name: "One", minutes: 60, recentMinutes: 0, lastPlayed: 40 }, { appId: 2, name: "Two", minutes: 0, recentMinutes: 0, lastPlayed: 0 }, { appId: 3, name: "Three", minutes: 10, recentMinutes: 10, lastPlayed: 50 }];
  const installs = [{ appId: 1, state: "installed" }, { appId: 3, state: "missing" }] as SteamInstall[];
  assert.deepEqual(filterSteamOwned(games, installs, filters({installation:"installed",sort:"name"})).map(game => game.appId), [1]);
  assert.deepEqual(filterSteamOwned(games, installs, filters({installation:"uninstalled"})).map(game => game.appId), [3, 2]);
  assert.deepEqual(filterSteamOwned(games, installs, filters({activity:"unplayed"})).map(game => game.appId), [2]);
  assert.deepEqual(filterSteamOwned(games, installs, filters({activity:"recent"})).map(game => game.appId), [3]);
  assert.deepEqual(filterSteamOwned(games, installs, filters({sort:"time"})).map(game => game.appId), [1, 3, 2]);
  assert.equal(steamOwnedSummary(games[1]).id, "steam:2"); assert.equal(games[0].appId, 1);
});

test("installation and play-history filters intersect without treating updating games as absent", () => {
  const games = [1,2,3,4,5].map(appId=>({appId,name:`Game ${appId}`,minutes:appId===1?60:0,recentMinutes:0,lastPlayed:0}));
  const installs = [{appId:1,state:"installed"},{appId:2,state:"installed"},{appId:3,state:"updating"},{appId:4,state:"missing"}] as SteamInstall[];
  assert.deepEqual(filterSteamOwned(games,installs,filters({installation:"installed",activity:"unplayed"})).map(game=>game.appId),[2]);
  assert.deepEqual(filterSteamOwned(games,installs,filters({installation:"updating",activity:"unplayed"})).map(game=>game.appId),[3]);
  assert.deepEqual(filterSteamOwned(games,installs,filters({installation:"uninstalled",activity:"unplayed"})).map(game=>game.appId),[4,5]);
});

test("a return-to-game filter requires positive playtime and a known older date", () => {
  const now=2_000_000_000,cutoff=now-90*86400;
  const games=[
    {appId:1,name:"Old",minutes:200,recentMinutes:0,lastPlayed:cutoff-1},
    {appId:2,name:"Boundary",minutes:10,recentMinutes:0,lastPlayed:cutoff},
    {appId:3,name:"Newer",minutes:1,recentMinutes:0,lastPlayed:cutoff+1},
    {appId:4,name:"Unknown date",minutes:500,recentMinutes:0,lastPlayed:0},
    {appId:5,name:"Never recorded",minutes:0,recentMinutes:0,lastPlayed:cutoff},
    {appId:6,name:"Future",minutes:10,recentMinutes:0,lastPlayed:now+1},
  ];
  assert.deepEqual(filterSteamOwned(games,[],filters({activity:"returning"}),now).map(game=>game.appId),[2,1]);
});

test("unknown installation status is not an empty successful scan", () => {
  const games=[{appId:1,name:"Owned",minutes:0,recentMinutes:0,lastPlayed:0}];
  assert.deepEqual(filterSteamOwned(games,null,filters({installation:"uninstalled"})),[]);
  assert.deepEqual(filterSteamOwned(games,[],filters({installation:"uninstalled"})),games);
  assert.deepEqual(filterSteamOwned(games,null,filters({activity:"unplayed"})),games);
});

test("search and least-played ordering remain independent of filtering and do not mutate the account snapshot", () => {
  const games=[{appId:1,name:"Game C",minutes:5,recentMinutes:0,lastPlayed:9},{appId:2,name:"Game B",minutes:5,recentMinutes:0,lastPlayed:10},{appId:3,name:"Game A",minutes:0,recentMinutes:0,lastPlayed:0},{appId:4,name:"Other",minutes:0,recentMinutes:0,lastPlayed:0}];
  const before=structuredClone(games);
  assert.deepEqual(filterSteamOwned(games,[],filters({query:"  GAME ",sort:"leastTime"})).map(game=>game.appId),[3,2,1]);
  assert.deepEqual(games,before);
});

test("random choice includes the entire filtered pool and avoids immediate repeats without losing a singleton", () => {
  const games=Array.from({length:80},(_,index)=>({appId:index+1,name:`Game ${index+1}`,minutes:0,recentMinutes:0,lastPlayed:0}));
  assert.equal(pickSteamOwnedGame(games,undefined,.999)?.appId,80);
  assert.equal(pickSteamOwnedGame(games,1,0)?.appId,2);
  assert.equal(pickSteamOwnedGame([games[0],games[0]],1,.5)?.appId,1);
  assert.equal(pickSteamOwnedGame([],undefined,.5),null);
});
test("provider errors expose defined user copy instead of potentially sensitive upstream messages", () => {
  assert.equal(steamAccountError("steam_account_key"), "games.account.steam_account_key");
  assert.equal(steamAccountError("https://example.test?key=private"), "games.account.steam_account_network");
});
