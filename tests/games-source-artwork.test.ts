import assert from "node:assert/strict";
import test from "node:test";
import { sourceDownloadTitle, uniqueSourceDownloadGame } from "../src/lib/games/source-download-context.ts";
import { matchSourceArtwork, sourceArtworkTitles, uniqueLinkedSteamId } from "../src/lib/games/source-display.ts";
import { sourceRomArtworkUrls } from "../src/lib/games/source-rom-artwork.ts";
import { parseSteamStoreItems } from "../src/lib/games/steam-data.ts";
import { decodeGameMetadata } from "../src/lib/games/metadata-records.ts";
import { parseAtlasSummary } from "../src/lib/games/igdb-data.ts";
import type { GameSummary } from "../src/lib/games/types.ts";
import type { SourceRelease } from "../src/lib/games/sources.ts";
const game = (name: string, steamId = 10): GameSummary => ({ id: "steam:" + steamId, steamId, name, capsule: "https://cdn.akamai.steamstatic.com/steam/apps/" + steamId + "/header.jpg", platforms: ["Windows"] });
const release = (title: string, extra: Partial<SourceRelease> = {}): SourceRelease => ({ id: "r", title, kind: "game", files: [], ...extra });
const match = (title: string, games: GameSummary[], linked?: number) => matchSourceArtwork(release(title), { search: async () => games, linkedSteamId: async () => linked }, new AbortController().signal);
test("real source packaging normalizes without changing named editions", () => {
  for (const [raw, clean] of [
    ["Little Nightmares III: Deluxe Edition,", "Little Nightmares III: Deluxe Edition"],
    ["Crusader Kings III: Collection,", "Crusader Kings III: Collection"],
    ["Secret Glory Hole Free Download [Build-25643182]", "Secret Glory Hole"],
    ["Growing My Manhole Free Download", "Growing My Manhole"],
    ["Endless Rails Free Download", "Endless Rails"],
    ["Supermarket Simulator – V 1.7.1(232) /", "Supermarket Simulator"],
    ["Tears of Metal – V 0.17.60380 /", "Tears of Metal"],
    ["Le Mans Ultimate – V 1.4.2.3 /", "Le Mans Ultimate"],
    ["Heroes of Might and Magic: Olden Era – V 0.81.02 /", "Heroes of Might and Magic: Olden Era"],
  ]) assert.equal(sourceDownloadTitle(raw), clean);
});
test("edition fallback borrows artwork only; exact named editions win", async () => {
  const raw = "Little Nightmares III: Deluxe Edition,";
  const result = await match(raw, [game("Little Nightmares III")]);
  assert.equal(result.art?.match, "base"); assert.equal(result.art?.game.id, "steam:10");
  assert.equal(uniqueSourceDownloadGame(release(raw), [game("Little Nightmares III")]), undefined);
  const exact = await match(raw, [game("Little Nightmares III: Deluxe Edition", 20), game("Little Nightmares III")]);
  assert.equal(exact.art?.match, "exact"); assert.equal(exact.art?.game.steamId, 20);
  assert.deepEqual(sourceArtworkTitles("Crusader Kings III: Collection,"), ["Crusader Kings III: Collection", "Crusader Kings III"]);
});

test("tracker release tags do not pollute catalog lookups or erase game editions", () => {
  // Published records from the connected RuTracker/Rutor catalogs.
  for (const [raw, clean] of [
    ["Warhammer 40,000: Space Marine II [P] [RUS + ENG + 15 / RUS + ENG + 5] (2024, TPS) (15.0.0.1 + 28 DLC) [Portable]", "Warhammer 40,000: Space Marine II"],
    ["Warhammer: Dark Omen [L] [ENG + 3 / ENG + 3] (1998, RTS) (1.8) [GOG]", "Warhammer: Dark Omen"],
    ["Tempest Rising: Gold Edition [v 2.0.0+60710 + DLCs] (2025) PC | RePack от FitGirl", "Tempest Rising: Gold Edition"],
    ["Test Drive Unlimited (2007) PC", "Test Drive Unlimited"],
    ["Need for Speed: Most Wanted (2005) PC | Лицензия", "Need for Speed: Most Wanted"],
    ["Project Zomboid [x86, amd64] [Multi] [Java] [GOG]", "Project Zomboid"],
    ["Serious Sam: Shatterverse (2026) (v.1.0.3.1854971) [RUS + ENG + 10]", "Serious Sam: Shatterverse"],
  ]) assert.equal(sourceDownloadTitle(raw), clean);
  for (const name of ["Game 4", "Game: Chapter 4", "Game (2020)", "Game [Redux]", "Game [P]", "Game [ч. 4]", "Game: Remastered", "Game Definitive Edition"]) assert.equal(sourceDownloadTitle(name), name);
});

test("tracker chapter annotations and translated aliases can find art without claiming exact identity", async () => {
  const raw = "Hidden Land of Ana: Ghostly Realm [ч. 4] [P] [ENG + 5] (2026, Quest) [P2P]";
  const found = await match(raw, [game("Hidden Land of Ana: Ghostly Realm"), game("Hidden Land of Ana")]);
  assert.equal(found.art?.game.name, "Hidden Land of Ana: Ghostly Realm");
  assert.equal(found.art?.match, "artwork");
  assert.equal(uniqueSourceDownloadGame(release(raw), [game("Hidden Land of Ana: Ghostly Realm")]), undefined);
  assert.equal((await match("Game [ч. 4]", [game("Game")])).art, undefined);
  const localized = await match("Порт Рояль 2 / Port Royale 2 (2004) PC", [game("Port Royale 2")]);
  assert.equal(localized.art?.game.name, "Port Royale 2");
  assert.equal(localized.art?.match, "artwork");
  assert.equal((await match("Port Royale 2 (2004) PC", [game("Port Royale")])).art, undefined);
  const duplicate = await match(raw, [game("Hidden Land of Ana: Ghostly Realm", 10), game("Hidden Land of Ana: Ghostly Realm", 20)]);
  assert.equal(duplicate.art, undefined); assert.equal(duplicate.ambiguous, true);
});

test("accented and Russian alternatives resolve without fuzzy sequel matching", async () => {
  const queried: string[] = [];
  const accented = await matchSourceArtwork(release("Café Rouge (Build 11281572)"), {
    search: async title => { queried.push(title); return title === "Cafe Rouge" ? [game("Café Rouge", 1294680)] : []; },
    linkedSteamId: async () => undefined,
  }, new AbortController().signal);
  assert.equal(accented.art?.game.steamId, 1294680);
  assert.deepEqual(queried, ["Café Rouge", "Cafe Rouge"]);
  for (const title of ["Echoes of Polis / Эхо Полиса", "Эхо Полиса / Echoes of Polis [P] [RUS] (2026, RTS)"]) {
    assert.equal((await match(title, [game("Echoes of Polis")])).art?.game.name, "Echoes of Polis");
    assert.equal((await match(title, [game("Echoes of Polis 2")])).art, undefined);
  }
});

test("parenthesized tracker translations borrow the exact game's cover without collapsing editions", async () => {
  const raw = "S.T.A.L.K.E.R: Shadow of Chernobyl (Тень Чернобыля) [P] [RUS / RUS] (2007, RPG) [Oblivion Lost Remake, 3.1.3, Mod]";
  const original = game("S.T.A.L.K.E.R.: Shadow of Chernobyl", 4500);
  const found = await match(raw, [original, game("S.T.A.L.K.E.R.: Shadow of Chernobyl - Enhanced Edition", 2427410)]);
  assert.equal(found.art?.game.steamId, 4500);
  assert.equal(found.art?.match, "artwork");
  assert.equal(uniqueSourceDownloadGame(release(raw), [original]), undefined);
  assert.equal((await match(raw, [game("S.T.A.L.K.E.R. 2: Heart of Chornobyl")])).art, undefined);
  for (const name of ["Game (Definitive Edition) [P] [ENG] (2010, RPG)", "Game (Тень Чернобыля)"]) {
    assert.equal((await match(name, [game("Game")])).art, undefined);
  }
});

test("IGDB release years distinguish the two Dante's Inferno games for artwork only", async () => {
  const candidates: GameSummary[] = [
    parseAtlasSummary({id:28854,name:"Dante's Inferno",cover:{image_id:"co2115"},first_release_date:536371200})!,
    parseAtlasSummary({id:6958,name:"Dante's Inferno",cover:{image_id:"co28oa"},first_release_date:1265241600})!,
  ];
  const raw = "Dante's Inferno [P] [RUS / ENG] (2010, Horror)";
  const found = await match(raw, candidates);
  assert.equal(found.art?.game.igdbId, 6958);
  assert.equal(found.art?.match, "artwork");
  assert.equal(uniqueSourceDownloadGame(release(raw), candidates), undefined);
  assert.equal((await match("Dante's Inferno", candidates)).ambiguous, true);
});

test("a published official link resolves a game omitted from search, with platform and cancellation checks", async () => {
  let reads = 0;
  const providers = { search: async () => [], linkedSteamId: async () => { reads++; return 1294680; }, linkedGame: async () => game("Café Rouge", 1294680) };
  const result = await matchSourceArtwork(release("Кафе Руж [P] [RUS] (2020, Visual Novel)"), providers, new AbortController().signal);
  assert.equal(result.art?.game.steamId, 1294680); assert.equal(result.art?.match, "artwork"); assert.equal(reads, 1);
  assert.equal((await matchSourceArtwork(release("Кафе Руж", { platform: "SNES" }), providers, new AbortController().signal)).art, undefined);
  assert.equal((await matchSourceArtwork(release("Кафе Руж"), { ...providers, linkedGame: async () => game("Other", 99) }, new AbortController().signal)).art, undefined);
});
test("real collections, remasters, sequels and named subtitles never collapse", async () => {
  for (const title of ["Halo: The Master Chief Collection", "Mega Man Legacy Collection", "Skyrim Special Edition", "Game Remastered", "Game Definitive Edition", "Game 2", "Game: Final Chapter"]) {
    assert.deepEqual(sourceArtworkTitles(title), [title]);
    assert.equal((await match(title, [game("Game")])).art, undefined);
  }
});
test("identically named games require a matching official source-page identity", async () => {
  const candidates = [game("Supermarket Simulator", 1532910), game("Supermarket Simulator", 2670630)];
  assert.deepEqual(await match("Supermarket Simulator – V 1.7.1(232) /", candidates), { ambiguous: true });
  const result = await match("Supermarket Simulator – V 1.7.1(232) /", candidates, 2670630);
  assert.equal(result.art?.game.steamId, 2670630);
  assert.equal((await match("Supermarket Simulator", candidates, 999)).art, undefined);
  assert.equal((await match("Different game", candidates, 2670630)).art, undefined);
});
test("official links must be unambiguous and cannot be spoofed by paths, credentials or domains", () => {
  const correct = "https://store.steampowered.com/app/2670630/Supermarket_Simulator/";
  assert.equal(uniqueLinkedSteamId([correct, correct + "?l=en"]), 2670630);
  assert.equal(uniqueLinkedSteamId([correct, "https://store.steampowered.com/app/1532910/"]), undefined);
  for (const url of ["https://store.steampowered.com.evil.test/app/2670630/", "https://evil.test/?steam=https://store.steampowered.com/app/2670630/", "https://steamdb.info/app/2670630/", "https://name:pass@store.steampowered.com/app/2670630/"]) assert.equal(uniqueLinkedSteamId([url]), undefined);
});
test("platforms constrain matches and canceled lookups cannot publish artwork", async () => {
  const providers = { search: async () => [game("Game")], linkedSteamId: async () => undefined };
  assert.equal((await matchSourceArtwork(release("Game", { platform: "SNES" }), providers, new AbortController().signal)).art, undefined);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(matchSourceArtwork(release("Game"), providers, controller.signal), { name: "AbortError" });
});
test("Steam adult descriptors survive caches; general mature content and suggestive names do not trigger NSFW", () => {
  // Real descriptor sets from Steam GetItems on 2026-10-02; final row exercises descriptor 4 alone.
  const samples = [
    { appid: 3192650, name: "Secret Glory Hole", content_descriptorids: [1, 2, 3, 4, 5], adult: true },
    { appid: 4415120, name: "Growing My Manhole", adult: false },
    { appid: 1158310, name: "Crusader Kings III", content_descriptorids: [1, 5], adult: false },
    { appid: 1392860, name: "Little Nightmares III", content_descriptorids: [5], adult: false },
    { appid: 20, name: "Frequent sexual content", content_descriptorids: [4], adult: true },
    { appid: 21, name: "Malformed rating", content_descriptorids: ["3"], adult: undefined },
  ];
  const response = { response: { store_items: samples.map(item => ({ ...item, success: 1, item_type: 0, type: 0, platforms: { windows: true }, assets: { asset_url_format: "steam/apps/" + item.appid + "/$" + "{FILENAME}", main_capsule: "header.jpg", library_capsule: "library_600x900.jpg" } })) } };
  const games = parseSteamStoreItems(response, samples.map(item => item.appid));
  assert.deepEqual(games.map(item => item.adultContent), samples.map(item => item.adult));
  for (const key of ["highlights:v3:3192650", "search:games-prefix:v2:secret"]) {
    const cached = decodeGameMetadata(key, games) as GameSummary[];
    assert.deepEqual(cached.map(item => item.adultContent), samples.map(item => item.adult));
  }
  assert.equal((decodeGameMetadata("search:legacy", [game("Unknown")]) as GameSummary[])[0].adultContent, undefined);
});


test('reported duplicate titles use published identities, regardless of search order', async () => {
 for(const [name,correct,other] of [['RetroSpace',2067820,2907560],['Needle In A Haystack',5085740,5160300]] as const) {
  const result=await match(name+' Free Download [V1.0.0]',[game(name,other),game(name,correct)],correct);
  assert.equal(result.art?.game.steamId,correct);
  assert.equal(result.art?.match,'exact');
 }
});

test('dated uploads may borrow the sole released cover without establishing download identity', async () => {
 const name='Supermarket Simulator', uploaded='2026-10-01T15:58:00Z';
 const current={...game(name,2670630),comingSoon:false,releaseTimestamp:1750355007};
 const future={...game(name,1532910),comingSoon:true};
 const input=release(name+' – V 1.7.1(232)',{date:uploaded});
 const providers={search:async()=>[future,current],linkedSteamId:async()=>undefined};
 const result=await matchSourceArtwork(input,providers,new AbortController().signal);
 assert.equal(result.art?.game.steamId,2670630);
 assert.equal(result.art?.match,'artwork');
 assert.equal(uniqueSourceDownloadGame(input,[future,current]),undefined);
 const exact=await matchSourceArtwork(input,{...providers,linkedSteamId:async()=>2670630},new AbortController().signal);
 assert.equal(exact.art?.match,'exact');
 for(const candidates of [[current,{...future,comingSoon:false,releaseTimestamp:1750355007}],[current,{...future,comingSoon:undefined}],[{...current,releaseTimestamp:undefined},future]]) {
  assert.equal((await matchSourceArtwork(input,{...providers,search:async()=>candidates},new AbortController().signal)).art,undefined);
 }
 for(const date of [undefined,'invalid','2020-01-01','2099-01-01']) {
  assert.equal((await matchSourceArtwork({...input,date},providers,new AbortController().signal)).art,undefined);
 }
 assert.equal((await matchSourceArtwork(input,{...providers,linkedSteamId:async()=>999},new AbortController().signal)).art,undefined);
});


test("tracker year disambiguates artwork, not download identity or same-year duplicates", async () => {
  const input = release("Reach [P] [ENG + 5] (2025, Action) (build 22888515, VR Only) [Portable]");
  const current = { ...game("Reach", 3273480), releaseTimestamp: 1760626886 };
  const older = { ...game("Reach", 1234930), releaseTimestamp: 1582090757 };
  const providers = { search: async () => [older, current], linkedSteamId: async () => undefined };
  const result = await matchSourceArtwork(input, providers, new AbortController().signal);
  assert.equal(result.art?.game.steamId, 3273480); assert.equal(result.art?.match, "artwork");
  assert.equal(uniqueSourceDownloadGame(input, [older, current]), undefined);
  for (const candidate of [{...older, releaseTimestamp: current.releaseTimestamp}, {...older, releaseTimestamp: undefined}]) {
    assert.equal((await matchSourceArtwork(input, {...providers, search: async () => [candidate, current]}, new AbortController().signal)).art, undefined);
  }
  assert.equal((await matchSourceArtwork(release("Reach (2025)"), providers, new AbortController().signal)).art, undefined);
});


test("an edition's published base-game link supplies artwork without exact edition identity", async () => {
  const result = await matchSourceArtwork(release("Example: Deluxe Edition"), {
    search:async()=>[], linkedSteamId:async()=>10, linkedGame:async()=>game("Example"),
  }, new AbortController().signal);
  assert.equal(result.art?.game.steamId, 10); assert.equal(result.art?.match, "base");
});


test("console packaging is an artwork-only lookup and preserves platform/edition boundaries", async () => {
  for (const [title, name] of [["[PS-PS3] Front Mission 3 [USA/FULLRUS] [PSCD|Piligrimus Team] [Ver.1.1.0.1]", "Front Mission 3"], ["0 Story (Japan) (Disc 1)", "0 Story"]]) {
    const input = release(title, {platform:"ps3"});
    const candidate = {id:"igdb:1502",igdbId:1502,name,capsule:"",platforms:["PlayStation 3"]};
    const result = await matchSourceArtwork(input, {search:async()=>[candidate],linkedSteamId:async()=>undefined}, new AbortController().signal);
    assert.equal(result.art?.game.igdbId,1502); assert.equal(result.art?.match,"artwork");
    assert.equal(uniqueSourceDownloadGame(input,[candidate]),undefined);
  }
});

test("Libretro artwork uses exact ROM filename/system, keeps hacks distinct, and bounds requests", () => {
  const urls = sourceRomArtworkUrls({title:"0 Story (Japan) (Disc 1)",platform:"ps2"});
  assert.equal(urls.length,2);
  assert.equal(decodeURIComponent(new URL(urls[0]).pathname),"/Sony - PlayStation 2/Named_Boxarts/0 Story (Japan) (Disc 1).png");
  const hack = sourceRomArtworkUrls({title:"Contra (Asia) (Pirate)",platform:"nes"});
  assert.match(decodeURIComponent(hack[0]),/Contra \(Asia\) \(Pirate\)/);
  assert.deepEqual(sourceRomArtworkUrls({title:"Reach",platform:"windows"}),[]);
  assert.deepEqual(sourceRomArtworkUrls({title:"x".repeat(301),platform:"nes"}),[]);
  assert.deepEqual(sourceRomArtworkUrls({title:"x"+String.fromCharCode(0),platform:"nes"}),[]);
});
