import { launchHealthObservation } from "../src/lib/games/custom-launch-health.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { changeUnifiedLibrarySelection, filterUnifiedLibrary, pickUnifiedGame, unifiedLibrary, unifiedLibraryDefaults, type UnifiedLibraryInput } from "../src/lib/games/unified-library.ts";
import { emptyLibraryPreferences, patchLibraryPreferences, romPreferenceId } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION, folderKey } from "../src/lib/games/emulation.ts";
import { changeCustomLibrary, customLibraryKey, emptyCustomLibrary, emptyLaunchConfig, readCustomLibrary, updateCustomGames } from "../src/lib/games/custom-library.ts";
import { changeLibraryPreferences, libraryPreferenceKey, readLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { quickLibrary } from "../src/lib/games/quick-library.ts";

const now = 1_790_812_800_000;
const summary = { id: "steam:42", steamId: 42, name: "Pokémon", capsule: "", platforms: [] };
const install = { appId: 42, name: "Pokémon", installPath: "W:/games/42", libraryPath: "W:/games", sizeBytes: 100, lastPlayed: now / 1000 - 800, state: "installed" as const };
const owned = { appId: 42, name: "Pokémon", minutes: 300, recentMinutes: 10, lastPlayed: now / 1000 - 400 };
const local = { id: "local", name: "Pokémon", config: emptyLaunchConfig(), linked: summary, artwork: null, pinned: false, hidden: false, addedAt: 0, lastPlayed: now - 900_000, measuredSeconds: 0 };
const cartridge = { path: "W:/roms/a.gba", name: "Pokémon", system: 24, available: true, format: "gba", discs: 1, sizeBytes: 100 };
const input = (): UnifiedLibraryInput => ({ installed: [install], steamKnown: true, custom: [], retro: EMPTY_EMULATION(), launchersKnown: true, preferences: emptyLibraryPreferences(), account: { steamId: "123", name: "Fixture", avatar: "", libraryVisible: true, updatedAt: now / 1000, games: [owned] } });
const ids = (games: ReturnType<typeof unifiedLibrary>) => games.map(game => game.id);

test("recent library order includes a new install while playtime and explicit title order remain intact", () => {
  const data = input();
  data.custom = [{ ...local, name: "Z newly installed", addedAt: now - 10, lastPlayed: 0 }];
  const games = unifiedLibrary(data, now), filters = unifiedLibraryDefaults();
  assert.equal(filterUnifiedLibrary(games, filters)[0].id, "custom:local");
  assert.equal(games[1].lastPlayed, 0);
  assert.equal(filterUnifiedLibrary(games, { ...filters, sort: "name" })[0].id, "steam:42");
  games[0].favorite = true;
  assert.equal(filterUnifiedLibrary(games, filters)[0].id, "steam:42");
  data.custom[0].addedAt = now + 1;
  assert.equal(filterUnifiedLibrary(unifiedLibrary(data, now), filters)[0].id, "steam:42");
});

test("only an exact Steam app merges ownership; custom installs and cartridges keep independent identities", () => {
  const data = input(); data.custom = [local];
  data.retro.folders = [{ id: "folder", root: "W:/roms", system: 24, games: [cartridge], skipped: 0, limited: false, scannedAt: now }];
  data.retro.matches[folderKey(cartridge.path, 24)] = summary;
  const before = structuredClone(data), games = unifiedLibrary(data, now);
  assert.equal(games.length, 3);
  assert.deepEqual(ids(games), ["steam:42", "custom:local", romPreferenceId(24, cartridge.path)]);
  assert.equal(games[0].lastPlayed, owned.lastPlayed * 1000);
  assert.equal(games[0].owned?.appId, 42);
  assert.deepEqual(data, before);
});

test("failed or partial scans cannot assert that an owned title is uninstalled", () => {
  const data = input(); data.account!.games.push({ ...owned, appId: 99 });
  assert.deepEqual(unifiedLibrary(data, now).map(game => game.state), ["ready", "notInstalled"]);
  assert.deepEqual(unifiedLibrary({ ...data, steamKnown: false }, now).map(game => game.state), ["unknown", "unknown"]);
  assert.deepEqual(unifiedLibrary({ ...data, steamComplete: false }, now).map(game => game.state), ["ready", "unknown"]);
  assert.deepEqual(unifiedLibrary({ ...data, installed: [{ ...install, state: "updating" }] }, now).map(game => game.state), ["updating", "notInstalled"]);
  assert.equal(unifiedLibrary({ ...data, installed: [{ ...install, state: "missing" }] }, now)[0].state, "unavailable");
});

test("a private account never leaks a previously cached ownership list", () => {
  const data = input(); data.account!.libraryVisible = false; data.account!.games.push({ ...owned, appId: 99 });
  assert.deepEqual(ids(unifiedLibrary(data)), ["steam:42"]);
});

test("launcher editions and a client-opening action remain distinct from ready-to-play installations", () => {
  const data = input();
  data.launchers = { supported: true, clients: [{ launcher: "battlenet", installed: true }, { launcher: "ubisoft", installed: true }], warnings: [], games: [
    { id: "battlenet:wow", launcher: "battlenet", productId: "wow", name: "World of Warcraft", installPath: "W:/WoW", state: "installed", launchMode: "client" },
    { id: "battlenet:wow_classic", launcher: "battlenet", productId: "wow_classic", name: "World of Warcraft", installPath: "W:/Classic", state: "missing", launchMode: "client" },
    { id: "ubisoft:1770", launcher: "ubisoft", productId: "1770", name: "The Division", installPath: "W:/Division", state: "installed", launchMode: "play" }
  ] };
  const games = unifiedLibrary(data);
  assert.equal(games.find(game => game.id === "battlenet:wow")?.state, "client");
  assert.equal(games.find(game => game.id === "battlenet:wow_classic")?.state, "unavailable");
  assert.deepEqual(ids(filterUnifiedLibrary(games, { ...unifiedLibraryDefaults(), availability: "ready" })), ["steam:42", "ubisoft:1770"]);
  assert.equal(unifiedLibrary({ ...data, launchers: { ...data.launchers, clients: [] } }).find(game => game.id === "battlenet:wow")?.state, "setup");
  assert.equal(unifiedLibrary({ ...data, launchersKnown: false }).find(game => game.id === "ubisoft:1770")?.state, "unknown");
});

test("an offline ROM folder overrides old available flags, while unsupported formats require setup", () => {
  const data = input(); data.retro.folders = [{ id: "folder", root: "W:/roms", system: 24, games: [cartridge], skipped: 0, limited: false, scannedAt: now, unavailable: true }];
  assert.equal(unifiedLibrary(data).find(game => game.source === "retro")?.state, "unavailable");
  data.retro.folders[0].unavailable = false;
  data.retro.folders[0].system = 18;
  data.retro.folders[0].games = [{ ...cartridge, system: 18, format: "FDS" }];
  assert.equal(unifiedLibrary(data).find(game => game.source === "retro")?.state, "setup");
});

test("hidden preferences remain available to the unified filter but stay hidden from the quick dock", () => {
  const data = input(); data.preferences = patchLibraryPreferences(data.preferences, ["steam:42"], { hidden: true, pinned: true }); data.custom = [{ ...local, hidden: true }];
  const games = unifiedLibrary(data), filters = unifiedLibraryDefaults();
  assert.equal(filterUnifiedLibrary(games, filters).length, 0);
  assert.equal(filterUnifiedLibrary(games, { ...filters, visibility: "hidden" }).length, 2);
  assert.equal(quickLibrary(data.installed, data.custom, data.retro, [], data.preferences).length, 0);
  assert.equal(quickLibrary(data.installed, data.custom, data.retro, [], data.preferences, undefined, { includeHidden: true }).length, 2);
});

test("accent-insensitive search intersects source, availability and pinned filters without changing the original pool", () => {
  const data = input(); data.custom = [{ ...local, pinned: true }]; data.customHealth = {[local.id]:launchHealthObservation(local.config)};
  data.account!.games.push({ ...owned, appId: 99 });
  const games = unifiedLibrary(data, now), before = structuredClone(games), filters = { ...unifiedLibraryDefaults(), query: " pokemon ", availability: "ready" as const, visibility: "pinned" as const };
  assert.deepEqual(ids(filterUnifiedLibrary(games, filters)), ["custom:local"]);
  assert.equal(filterUnifiedLibrary(games, { ...filters, source: "steam" }).length, 0);
  assert.deepEqual(games, before);
});

test("future or unrecorded play times cannot move a game to the top of recently played", () => {
  const data = input(); data.installed[0] = { ...install, lastPlayed: now / 1000 + 999 }; data.account!.games[0] = { ...owned, minutes: 0, lastPlayed: now / 1000 - 20 };
  data.custom = [{ ...local, lastPlayed: Number.NaN }];
  assert.deepEqual(unifiedLibrary(data, now).map(game => game.lastPlayed), [0, 0]);
});

test("Pick uses the entire filtered pool, includes unlinked local copies and avoids an immediate repeat", () => {
  const data = input(); data.installed = []; data.custom = [{ ...local, linked: null }]; data.account!.games = Array.from({ length: 80 }, (_, index) => ({ ...owned, appId: index + 1 }));
  const games = unifiedLibrary(data, now);
  assert.equal(pickUnifiedGame(games, undefined, () => 0.999)?.id, "steam:80");
  assert.notEqual(pickUnifiedGame(games, "steam:80", () => 0.999)?.id, "steam:80");
  assert.equal(pickUnifiedGame(games.filter(game => game.source === "custom"))?.id, "custom:local");
  assert.equal(pickUnifiedGame([games[1]], games[1].id)?.id, games[1].id);
});

test("mixed library selection saves exact install identities and survives profile-store reload", async () => {
  const memory = new Map<string,string>();
  globalThis.localStorage = {getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)} as Storage;
  const data=input(); data.custom=[{...local,id:"00000000-0000-4000-8000-000000000001",config:{...emptyLaunchConfig(),executable:"W:/Games/game.exe"},linked:{...summary,igdbId:42}}];
  data.retro.folders=[{id:"folder",root:"W:/roms",system:24,games:[cartridge],skipped:0,limited:false,scannedAt:now}];
  memory.set(customLibraryKey("batch"),JSON.stringify({...emptyCustomLibrary(),games:data.custom}));
  const games=unifiedLibrary(data,now), selected=ids(games);
  const stores={preferences:async(ids:string[],patch:{hidden?:boolean;pinned?:boolean})=>{await changeLibraryPreferences("batch",ids,patch);return true;},custom:async(ids:string[],patch:{hidden?:boolean;pinned?:boolean})=>{await changeCustomLibrary("batch",store=>updateCustomGames(store,ids,patch));return true;}};
  assert.deepEqual(new Set((await changeUnifiedLibrarySelection(games,[...selected,selected[0]],{hidden:true,pinned:true},stores)).completed),new Set(selected));
  const prefs=readLibraryPreferences("batch"), custom=readCustomLibrary("batch");
  assert.deepEqual(Object.keys(prefs.entries).sort(),["steam:42",romPreferenceId(24,cartridge.path)].sort());
  assert.ok(Object.values(prefs.entries).every(value=>value.hidden&&value.pinned));
  assert.equal(custom.games[0].hidden,true); assert.equal(custom.games[0].pinned,true);
  assert.deepEqual(custom.games[0].config,data.custom[0].config); assert.equal(custom.games[0].lastPlayed,data.custom[0].lastPlayed);
  assert.equal(readCustomLibrary("other").games.length,0); assert.deepEqual(readLibraryPreferences("other").entries,{});
  assert.equal(filterUnifiedLibrary(unifiedLibrary({...data,custom:custom.games,preferences:prefs},now),{...unifiedLibraryDefaults(),visibility:"hidden"}).length,3);
});

test("a failed store reports only successful IDs; retry does not alter successful rows again", async () => {
  const data=input(); data.custom=[local]; const games=unifiedLibrary(data,now), writes:string[][]=[];
  const stores={preferences:async(ids:string[])=>{writes.push(ids);return true;},custom:async()=>{throw Error("QuotaExceededError");}};
  const result=await changeUnifiedLibrarySelection(games,ids(games),{pinned:true},stores);
  assert.deepEqual(result.completed,["steam:42"]);
  const retry=ids(games).filter(id=>!result.completed.includes(id));
  assert.deepEqual((await changeUnifiedLibrarySelection(games,retry,{pinned:true},{...stores,custom:async(ids)=>{writes.push(ids);return true;}})).completed,["custom:local"]);
  assert.deepEqual(writes,[["steam:42"],["local"]]);
});

test("a removed selected game prevents silent partial targeting and an empty selection performs no writes", async () => {
  let writes=0; const write=async()=>{writes++;return true;},games=unifiedLibrary(input(),now);
  assert.deepEqual(await changeUnifiedLibrarySelection(games,["steam:42","steam:99"],{hidden:true},{preferences:write,custom:write}),{completed:[]});
  assert.deepEqual(await changeUnifiedLibrarySelection(games,[],{hidden:true},{preferences:write,custom:write}),{completed:[]});
  assert.equal(writes,0);
});

test("storage refusal preserves both libraries and leaves all selected IDs retryable", async () => {
  const memory=new Map<string,string>(),data=input();data.custom=[{...local,id:"00000000-0000-4000-8000-000000000001",config:{...emptyLaunchConfig(),executable:"W:/Games/game.exe"},linked:{...summary,igdbId:42}}];
  memory.set(customLibraryKey("denied"),JSON.stringify({...emptyCustomLibrary(),games:data.custom}));
  memory.set(libraryPreferenceKey("denied"),JSON.stringify(emptyLibraryPreferences()));
  const before=[...memory];
  globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:()=>{throw Error("QuotaExceededError");}} as Storage;
  const games=unifiedLibrary(data,now);
  const result=await changeUnifiedLibrarySelection(games,ids(games),{hidden:true},{
    preferences:async(ids,patch)=>{await changeLibraryPreferences("denied",ids,patch);return true;},
    custom:async(ids,patch)=>{await changeCustomLibrary("denied",store=>updateCustomGames(store,ids,patch));return true;},
  });
  assert.deepEqual(result.completed,[]);assert.deepEqual([...memory],before);
});
