import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CATALOG_FILTERS } from "../src/lib/games/catalog-filters.ts";
import { createUnifiedGameSearch, hasSteamSearchFilters, mergeGameSearchResults, unifiedIgdbQuery } from "../src/lib/games/unified-game-search.ts";
import type { GameSummary } from "../src/lib/games/types.ts";

const game = (id: string, name: string, extra: Partial<GameSummary> = {}): GameSummary => ({ id, name, capsule: "", platforms: [], ...extra });
const empty = { games: [], total: 0, nextOffset: null };
const sources = (extra = {}) => ({ steam: async () => empty, igdb: async () => [], savedSteam: async () => null, savedIgdb: async () => null, ...extra });

test("exact names precede variants and fuzzy Steam matches, preserving Classic and remakes", () => {
  const results = mergeGameSearchResults("world of warcraft", [
    game("steam:1", "World of Warships", { steamId: 1 }),
    game("igdb:2", "World of Warcraft Classic"),
    game("igdb:3", "World of Warcraft: Midnight"),
    game("igdb:123", "World of Warcraft"),
  ]);
  assert.deepEqual(results.map(game => game.id), ["igdb:123", "igdb:2", "igdb:3", "steam:1"]);
  const pokemon = mergeGameSearchResults("pokemon unbound", [game("igdb:6", "Pokémon Unbound: Battle Frontier"), game("igdb:5", "Pokémon™ Unbound")]);
  assert.equal(pokemon[0].id, "igdb:5");
  assert.equal(mergeGameSearchResults("Resident Evil", [game("igdb:7", "Resident Evil"), game("igdb:8", "Resident Evil")]).length, 2);
});

test("Steam identity dedup retains IGDB detail identity, art and platform evidence", () => {
  const games = mergeGameSearchResults("Hades", [
    game("steam:1145360", "Hades", { steamId: 1145360, capsule: "steam.jpg", platforms: ["Windows", "macOS"] }),
    game("steam:1145360", "Hades", { steamId: 1145360, igdbId: 113112, portrait: "igdb.jpg", platforms: ["PC (Microsoft Windows)", "Mac", "Nintendo Switch"] }),
    game("igdb:9", "Hades"),
  ]);
  assert.equal(games.length, 2);
  const merged = games.find(g => g.steamId)!;
  assert.equal(merged.igdbId, 113112); assert.equal(merged.capsule, "steam.jpg"); assert.equal(merged.portrait, "igdb.jpg");
  assert.deepEqual(merged.platforms, ["Windows", "macOS", "Nintendo Switch"]);
});

test("search queries retain hacks, missing artwork and editions while escaping syntax", () => {
  const query = unifiedIgdbQuery(' x"; where id=7; \\ \n ', { ...DEFAULT_CATALOG_FILTERS, platform: "mac", mode: "9" }, 30);
  assert.equal((query.match(/"/g) ?? []).length, 2);
  assert.match(query, /platforms = \(14\)/); assert.match(query, /game_modes = \(3\)/); assert.match(query, /offset 30;/);
  assert.doesNotMatch(query, /cover !=|version_parent|game_type\s*=/);
  assert.match(query, /game_type,total_rating_count/);
  assert.match(unifiedIgdbQuery("Hades", { ...DEFAULT_CATALOG_FILTERS, sort: "Released_DESC" }), /sort first_release_date desc;.*name ~ \*"Hades"\*/);
});

test("MMO maps to IGDB's MMO mode while MMORPG tags retain Steam-only semantics", () => {
  const filters = { ...DEFAULT_CATALOG_FILTERS, mode: "20" as const };
  assert.equal(hasSteamSearchFilters(filters),false);
  assert.match(unifiedIgdbQuery("Warcraft",filters),/game_modes = \(5\)/);
  assert.equal(hasSteamSearchFilters({ ...filters, tags:[1754] }),true);
});

test("Steam-only filter meanings never get silently applied to IGDB", async () => {
  for (const overrides of [{ tags: [19] }, { controller: true }, { price: "offers" }, { mode: "39" }, { features: [{ id: 22, name: "Achievements" }] }, { sort: "Reviews_DESC" }, { publisher: "2K" }]) {
    const filters = { ...DEFAULT_CATALOG_FILTERS, ...overrides } as typeof DEFAULT_CATALOG_FILTERS;
    assert.equal(hasSteamSearchFilters(filters), true);
    let called = false;
    const search = createUnifiedGameSearch(sources({ igdb: async () => { called = true; throw Error("must not request IGDB"); } }));
    assert.deepEqual(await search.load("Warcraft", filters), empty); assert.equal(called, false);
  }
  assert.equal(hasSteamSearchFilters({ ...DEFAULT_CATALOG_FILTERS, platform: "win", mode: "2" }), false);
});

test("source cursors advance independently without refetching an exhausted provider", async () => {
  const calls: number[] = [], queries: string[] = [];
  const search = createUnifiedGameSearch(sources({
    steam: async (_q: string, _f: unknown, offset: number) => { calls.push(offset); return { games: [game("steam:1", "Hades", { steamId: 1 })], total: 1, nextOffset: null }; },
    igdb: async (body: string) => { queries.push(body); return body.includes("offset 0;") ? Array.from({ length: 30 }, (_, i) => ({ id: i + 2, name: `Hades ${i}` })) : [{ id: 33, name: "Hades final" }]; },
  }));
  const first = await search.load("Hades", DEFAULT_CATALOG_FILTERS);
  assert.deepEqual(first.searchCursor, { steam: null, igdb: 30 });
  const next = await search.load("Hades", DEFAULT_CATALOG_FILTERS, first.searchCursor);
  assert.equal(next.nextOffset, null); assert.deepEqual(calls, [0]); assert.equal(queries.filter(body=>body.includes('offset 30;')).length,2);
});

test("one failed provider retains useful results and its cursor so retry cannot skip matches", async () => {
  let failure = true;
  const search = createUnifiedGameSearch(sources({
    steam: async () => { if (failure) throw Error("Steam offline"); return empty; },
    igdb: async () => [{ id: 123, name: "World of Warcraft" }],
  }));
  const first = await search.load("world of warcraft", DEFAULT_CATALOG_FILTERS);
  assert.equal(first.games[0].id, "igdb:123"); assert.deepEqual(first.unavailable, ["Steam"]);
  assert.deepEqual(first.searchCursor, { steam: 0, igdb: null });
  failure = false;
  const retry = await search.load("world of warcraft", DEFAULT_CATALOG_FILTERS, first.searchCursor);
  assert.equal(retry.nextOffset, null); assert.deepEqual(retry.unavailable, []);
});

test("two failed providers are an error, never a false no-results state", async () => {
  const search = createUnifiedGameSearch(sources({ steam: async () => { throw Error("offline"); }, igdb: async () => { throw Error("offline"); } }));
  await assert.rejects(search.load("Warcraft", DEFAULT_CATALOG_FILTERS), /unavailable/);
});

test("aborting superseded work cannot publish even if a provider finishes successfully", async () => {
  const controller = new AbortController();
  const search = createUnifiedGameSearch(sources({ igdb: async () => { controller.abort(); return [{ id: 123, name: "World of Warcraft" }]; } }));
  await assert.rejects(search.load("Warcraft", DEFAULT_CATALOG_FILTERS, undefined, controller.signal), { name: "AbortError" });
});

test("cached results preserve age and missing-provider cursors without claiming fresh completeness", async () => {
  const rows = Object.assign([{ id: 123, name: "World of Warcraft", cachedAt: 1000 }], { cachedAt: 1000 });
  const search = createUnifiedGameSearch(sources({ savedIgdb: async () => rows }));
  const result = await search.snapshot("Warcraft", DEFAULT_CATALOG_FILTERS);
  assert.equal(result?.cachedAt, 1000); assert.equal(result?.games[0].cachedAt, 1000);
  assert.deepEqual(result?.searchCursor, { steam: 0, igdb: null });
});

test("external source and Steam UID must be from the same IGDB record", async () => {
  const search = createUnifiedGameSearch(sources({ igdb: async () => [{ id: 123, name: "World of Warcraft", external_games: [{ external_game_source: 14, uid: "1145360" }, { external_game_source: 1, uid: "invalid" }] }] }));
  const result = await search.load("Warcraft", DEFAULT_CATALOG_FILTERS);
  assert.equal(result.games[0].id, "igdb:123"); assert.equal(result.games[0].steamId, undefined);
});

test('unfinished names rank before substring matches and Steam autocomplete survives empty full search',async()=>{
 const warframe=game('steam:230410','Warframe',{steamId:230410});
 const search=createUnifiedGameSearch(sources({suggest:async()=>[game('steam:2','Special Warframe Pack',{steamId:2}),warframe]}));
 const page=await search.load('warfra',DEFAULT_CATALOG_FILTERS);
 assert.equal(page.games[0].id,warframe.id);assert.equal(page.nextOffset,null);
 assert.equal(mergeGameSearchResults('pokémon unb',[game('igdb:2','Unbound Worlds'),game('igdb:1','Pokémon Unbound')])[0].id,'igdb:1');
});
test('name and alias matches include partial non-Steam names and keep their continuation',async()=>{
 const offsets:number[]=[];
 const search=createUnifiedGameSearch(sources({igdb:async(body:string)=>{
  if(body.startsWith('search '))return[];
  assert.match(body,/alternative_names.name/);const offset=Number(body.match(/offset (\d+)/)![1]);offsets.push(offset);
  return offset===0?Array.from({length:30},(_,i)=>({id:i+1,name:`Warcraft ${i}`})):[{id:31,name:'World of Warcraft'}];
 }}));
 const first=await search.load('warcra',DEFAULT_CATALOG_FILTERS);assert.equal(first.games.length,30);assert.equal(first.searchCursor?.igdb,30);
 const next=await search.load('warcra',DEFAULT_CATALOG_FILTERS,first.searchCursor);assert.equal(next.games[0].name,'World of Warcraft');assert.equal(next.nextOffset,null);assert.deepEqual(offsets,[0,30]);
});
test('early suggestions publish while full providers are pending, and aborted work cannot publish',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});const previews:GameSummary[][]=[];
 const search=createUnifiedGameSearch(sources({steam:async()=>{await gate;return empty},igdb:async()=>{await gate;return[]},suggest:async()=>[game('steam:230410','Warframe',{steamId:230410})]}));
 const controller=new AbortController();const pending=search.load('warfra',DEFAULT_CATALOG_FILTERS,undefined,controller.signal,games=>previews.push(games));
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(previews[0][0].name,'Warframe');controller.abort();release();await assert.rejects(pending,{name:'AbortError'});assert.equal(previews.length,1);
});
test('suggestion failure remains retryable and constraints never acquire unfiltered suggestions',async()=>{
 const search=createUnifiedGameSearch(sources({suggest:async()=>{throw Error('offline')}}));
 const page=await search.load('warfra',DEFAULT_CATALOG_FILTERS);assert.deepEqual(page.unavailable,['Steam']);assert.equal(page.searchCursor?.steam,0);
 for(const overrides of [{platform:'mac'},{mode:'9'},{sort:'Name_ASC'},{controller:true}]){
  let called=false;const filtered=createUnifiedGameSearch(sources({suggest:async()=>{called=true;return[]}}));
  await filtered.load('warfra',{...DEFAULT_CATALOG_FILTERS,...overrides} as typeof DEFAULT_CATALOG_FILTERS);assert.equal(called,false);
 }
});


test("broad Pokemon searches rank recognizable releases before alphabetic fan titles, keeping exact hacks findable", async () => {
  const rows = [
    { id: 250467, name: "Pokemon Bois", game_type: 0 },
    { id: 2, name: "Pokemon Alchemist", game_type: 5, total_rating_count: 900 },
    { id: 1517, name: "Pokémon Emerald Version", game_type: 10, total_rating_count: 634 },
    { id: 1561, name: "Pokémon Red Version", game_type: 0, total_rating_count: 604 },
    { id: 5, name: "Pokémon Unbound", game_type: 5, total_rating_count: 80 },
  ];
  const search = createUnifiedGameSearch(sources({ igdb: async () => rows, savedIgdb: async () => rows }));
  for (const page of [await search.load("pokemon", DEFAULT_CATALOG_FILTERS), await search.snapshot("pokémon", DEFAULT_CATALOG_FILTERS)]) {
    assert.deepEqual(page!.games.slice(0, 2).map(g => g.igdbId), [1517, 1561]);
    assert.equal(page!.games.length, 5);
    assert.equal(mergeGameSearchResults("pokemon unbound", page!.games)[0].igdbId, 5);
    assert.equal(mergeGameSearchResults("pokemon unb", page!.games)[0].igdbId, 5);
    assert.equal(mergeGameSearchResults("pokemon", page!.games, "Name_ASC")[0].igdbId, 2);
  }
});

test("merged Steam cards retain ranking evidence and invalid provider popularity never becomes a score", async () => {
  const search = createUnifiedGameSearch(sources({ igdb: async () => [
    { id: 1, name: "Example", game_type: 5, total_rating_count: -100 },
    { id: 2, name: "Example B", total_rating_count: "999999" },
  ] }));
  const page = await search.load("example", DEFAULT_CATALOG_FILTERS);
  assert.ok(page.games.every(g => g.igdbRatingCount === undefined));
  const merged = mergeGameSearchResults("Example", [game("steam:1", "Example", { steamId: 1 }), game("steam:1", "Example", { steamId: 1, igdbId: 4, gameType: 0, igdbRatingCount: 400 })]);
  assert.equal(merged[0].gameType, 0); assert.equal(merged[0].igdbRatingCount, 400);
});
