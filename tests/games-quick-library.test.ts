import assert from "node:assert/strict";
import test from "node:test";
import { filterQuickLibrary, quickLibrary, libraryFavoriteGames, libraryFavoriteKeys } from "../src/lib/games/quick-library.ts";
import { emptyLibraryPreferences, patchLibraryPreferences, romPreferenceId } from "../src/lib/games/library-preferences.ts";
import { emptyLaunchConfig, matchingCustomGames } from "../src/lib/games/custom-library.ts";
import type { EmulationStore } from "../src/lib/games/emulation.ts";
import { addCollectionGame, createPersonalCollection, emptyPersonalCollections, parsePersonalCollections } from "../src/lib/games/personal-collections.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";

const saved = { id: "steam:42", steamId: 42, name: "Saved copy", capsule: "", platforms: [] };
const installs = [{ appId: 42, name: "Installed game", installPath: "W:/games/42", libraryPath: "W:/games", sizeBytes: 100, lastPlayed: 20, state: "installed" as const }];
const retro: EmulationStore = { version: 1, folders: [{ id: "folder", root: "W:/roms", system: 24, scannedAt: 0, games: [{ path: "W:/roms/a.gba", name: "A cartridge", system: 24, available: true, format: "gba", discs: 1, sizeBytes: 100 }], skipped: 0, limited: false }], profiles: {}, lastPlayed: {}, matches: {} };

test("catalog favorites appear in the sidebar heart filter without a second pin", () => {
  const games = quickLibrary([], [], {...retro,folders:[]}, [saved], emptyLibraryPreferences());
  assert.equal(games[0].favorite, true);
  assert.deepEqual(filterQuickLibrary(games, {query:"",group:"favorites",source:"all",ready:false,sort:"recent"}).map(game=>game.id), [saved.id]);
  assert.equal(filterQuickLibrary(games, {query:"",group:"favorites",source:"all",ready:true,sort:"recent"}).length, 0);
});

test("installed favorites retain their launch identity while existing pins join the Favorites page", () => {
  const other = {...saved,id:"steam:99",steamId:99,name:"Other edition"};
  const prefs = patchLibraryPreferences(emptyLibraryPreferences(), [saved.id], {pinned:true});
  const games = quickLibrary(installs, [], {...retro,folders:[]}, [other], prefs);
  assert.deepEqual(libraryFavoriteGames([other], games).map(game=>game.id), [other.id,saved.id]);
  const matched = quickLibrary(installs, [], {...retro,folders:[]}, [saved], emptyLibraryPreferences());
  assert.equal(matched.length,1);assert.equal(matched[0].source,"steam");assert.equal(matched[0].favorite,true);
  assert.deepEqual(libraryFavoriteGames([saved], matched), [saved]);
  assert.equal(quickLibrary(installs, [], {...retro,folders:[]}, [], emptyLibraryPreferences())[0].favorite,false);
});

test("a favorite follows an exact linked local game and preserves source provenance", () => {
  const favorite = {...saved,sourceOrigin:{sourceId:"feed",sourceUrl:"https://example.com/games.json",title:"Saved copy Build 42",kind:"game" as const}};
  const local = {id:"local",name:"Local game",config:emptyLaunchConfig(),linked:saved,artwork:null,pinned:false,hidden:false,addedAt:0,lastPlayed:0,measuredSeconds:0};
  const games=quickLibrary([], [local], {...retro,folders:[]}, [favorite], emptyLibraryPreferences());
  assert.equal(games.length,1);assert.equal(games[0].favorite,true);assert.equal(games[0].id,"custom:local");
  assert.equal(libraryFavoriteGames([favorite],games)[0].sourceOrigin?.sourceId,"feed");
  assert.equal(quickLibrary([], [local], {...retro,folders:[]}, [{...saved,id:"steam:99",steamId:99}], emptyLibraryPreferences())[0].favorite,false);
});

test("a newly added local game rises in recent order without inventing play history", () => {
  const local = { id: "new", name: "Nivalis", config: emptyLaunchConfig(), linked: saved, artwork: null, pinned: false, hidden: false, addedAt: Date.now() - 10, lastPlayed: 0, measuredSeconds: 0 };
  const games = quickLibrary(installs, [local], { ...retro, folders: [] }, [], emptyLibraryPreferences());
  const filters = { query: "", group: "all" as const, source: "all" as const, ready: false, sort: "recent" as const };
  assert.equal(filterQuickLibrary(games, filters)[0].id, "custom:new");
  assert.equal(filterQuickLibrary(games, { ...filters, group: "recent" })[0].id, "custom:new");
  assert.equal(filterQuickLibrary(games, { ...filters, sort: "name" })[0].id, "steam:42");
  assert.equal(games[1].lastPlayed, 0); assert.equal(local.measuredSeconds, 0);
  games[0].favorite = true;
  assert.equal(filterQuickLibrary(games, filters)[0].id, "steam:42");
  games[0].favorite = false; local.addedAt = Date.now() + 60_000;
  assert.equal(filterQuickLibrary(games, filters)[0].id, "steam:42");
});

test("local Play identity agrees across catalog aliases without selecting a different Steam edition", () => {
  const local = { id: "new", name: "Nivalis", config: emptyLaunchConfig(), linked: { ...saved, igdbId: 15 }, artwork: null, pinned: false, hidden: false, addedAt: 1, lastPlayed: 0, measuredSeconds: 0 };
  assert.equal(matchingCustomGames([local], { ...saved, id: "igdb:15", steamId: undefined, igdbId: 15 }).length, 1);
  assert.equal(matchingCustomGames([local], { ...saved, id: "steam:99", steamId: 99, igdbId: 15 }).length, 0);
  assert.equal(matchingCustomGames([{ ...local, hidden: true }], saved).length, 0);
});

test("quick library deduplicates saved titles and respects hidden installations without exposing paths", () => {
  const preferences = patchLibraryPreferences(emptyLibraryPreferences(), ["steam:42"], { hidden: true });
  assert.equal(quickLibrary(installs, [], retro, [saved], preferences).some(game => game.id === saved.id), false);
  const games = quickLibrary(installs, [], retro, [saved], emptyLibraryPreferences());
  assert.equal(games.filter(game => game.id === saved.id).length, 1);
  assert.equal(games[0].name, "Installed game");
  assert.equal(games[0].lastPlayed, 20_000);
});

test("filters combine source, favorites, readiness and query across actual libraries", () => {
  const id = romPreferenceId(24, "W:/roms/a.gba");
  const preferences = patchLibraryPreferences(emptyLibraryPreferences(), ["steam:42", id], { pinned: true });
  const local = { id: "local", name: "Local game", config: emptyLaunchConfig(), linked: null, artwork: null, pinned: true, hidden: false, addedAt: 0, lastPlayed: 30_000, measuredSeconds: 0 };
  const games = quickLibrary(installs, [local], retro, [saved], preferences);
  const filters = { query: "", group: "all" as const, source: "all" as const, ready: false, sort: "recent" as const };
  assert.deepEqual(filterQuickLibrary(games, filters).map(game => game.source), ["custom", "steam", "retro"]);
  assert.equal(filterQuickLibrary(games, { ...filters, source: "steam", ready: true, group: "favorites", query: "installed" }).length, 1);
  assert.equal(filterQuickLibrary(games, { ...filters, group: "recent" }).length, 2);
  const missing = quickLibrary([], [], { ...retro, folders: retro.folders.map(folder => ({ ...folder, unavailable: true })) }, [], preferences);
  assert.equal(missing[0].ready, false);
});

test("IGDB saved favorites have their own validated identity", () => {
  const preferences = patchLibraryPreferences(emptyLibraryPreferences(), ["igdb:42"], { pinned: true });
  const games = quickLibrary(installs, [], { ...retro, folders: [] }, [{ id: "igdb:42", igdbId: 42, name: "Classic", capsule: "", platforms: [] }], preferences);
  assert.equal(games.find(game => game.id === "igdb:42")?.favorite, true);
  assert.equal(games.find(game => game.id === "steam:42")?.favorite, false);
  assert.throws(() => patchLibraryPreferences(preferences, ["igdb:../../42"], { pinned: true }));
});

test("FDS keeps external-emulator readiness while supported cartridges can use the embedded core", () => {
  const preferences = emptyLibraryPreferences();
  const folders = retro.folders.map(folder => ({ ...folder, system: 18, games: folder.games.map(game => ({ ...game, system: 18, format: "FDS" })) }));
  assert.equal(quickLibrary([], [], retro, [], preferences)[0].ready, true);
  assert.equal(quickLibrary([], [], { ...retro, folders }, [], preferences)[0].ready, false);
  assert.equal(quickLibrary([], [], { ...retro, folders, profiles: { 18: { kind: "retroarch", path: "W:/retroarch.exe" } } }, [], preferences)[0].ready, true);
});

test("launcher games keep exact native identity and require an installed matching client", () => {
  const scan = { supported: true, clients: [{ launcher: "battlenet" as const, installed: true }], warnings: [], games: [
    { id: "battlenet:wow", launcher: "battlenet" as const, productId: "wow", name: "World of Warcraft", installPath: "W:/WoW", state: "installed" as const, launchMode: "client" as const },
    { id: "battlenet:wow_classic", launcher: "battlenet" as const, productId: "wow_classic", name: "WoW Classic", installPath: "W:/Classic", state: "missing" as const, launchMode: "client" as const }
  ] };
  const prefs = patchLibraryPreferences(emptyLibraryPreferences(), ["battlenet:wow"], { pinned: true });
  const games = quickLibrary([], [], { ...retro, folders: [] }, [{ id: "igdb:123", igdbId: 123, name: "World of Warcraft", capsule: "", platforms: [] }], prefs, scan);
  assert.equal(games.length, 2); assert.equal(games[0].id, "battlenet:wow"); assert.equal(games[0].game?.igdbId, 123); assert.equal(games[0].favorite, true); assert.equal(games[0].ready, true);
  assert.equal(games[1].game?.igdbId, undefined); assert.equal(games[1].ready, false);
  const catalogFavorite = {id:"igdb:123",igdbId:123,name:"World of Warcraft",capsule:"",platforms:[]};
  assert.deepEqual(libraryFavoriteGames([catalogFavorite],games).map(game=>game.id),["igdb:123"]);
  assert(libraryFavoriteKeys(games[0].game!,games).has(catalogFavorite.id));
  assert(libraryFavoriteKeys(catalogFavorite,games).has("battlenet:wow"));
  assert(!libraryFavoriteKeys(catalogFavorite,games).has("battlenet:wow_classic"));
  assert.deepEqual([...libraryFavoriteKeys({...saved,igdbId:123},games)],[saved.id]);
  assert.equal(quickLibrary([], [], { ...retro, folders: [] }, [], prefs, { ...scan, clients: [] })[0].ready, false);
});

test("saved titles, favorites and collections round-trip canonical launcher IDs without merging editions", () => {
  const memory = new Map<string,string>(); globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key,value) => { memory.set(key,value); } } as Storage;
  const games = ["battlenet:wow", "battlenet:wow_classic", "ea:OFB-EAST:55107,Origin.OFR.50.0004111", "ubisoft:1770"].map(id => ({ id, name: id, capsule: "", platforms: ["Windows"] }));
  writeSavedGames("test", games); assert.deepEqual(readSavedGames("test").map(game => game.id), games.map(game => game.id));
  const prefs = patchLibraryPreferences(emptyLibraryPreferences(), games.map(game => game.id), { pinned: true }); assert.equal(Object.keys(prefs.entries).length, 4);
  let store = createPersonalCollection(emptyPersonalCollections(), "Games", "one"); for (const game of games) store = addCollectionGame(store, "one", game);
  assert.equal(Object.keys(parsePersonalCollections(JSON.stringify(store)).games).length, 4);
  assert.throws(() => patchLibraryPreferences(prefs, ["ubisoft:001770"], { pinned: true }));
});
