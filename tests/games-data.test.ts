import assert from "node:assert/strict";
import test from "node:test";
import { gameImage, parseSteamArtwork, parseSteamDetail, parseSteamDiscovery, parseSteamSearchIds, parseSteamStoreItems, plainGameText, steamSummary } from "../src/lib/games/steam-data.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";
import { gameDescriptionHtml } from "../src/lib/games/steam-data.ts";
import { decodeGameMetadata } from "../src/lib/games/metadata-records.ts";

const item = { id: 123, name: "A game", header_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/header.jpg", platforms: { windows: true, linux: true }, final_price: 2999, currency: "USD" };

test("Steam discovery rejects hardware and duplicates without presenting an empty response as success", () => {
  const parsed = parseSteamDiscovery({ top_sellers: { items: [item, item, { ...item, id: 124, name: "Steam Frame" }, { ...item, id: -1 }] } }, 400);
  assert.equal(parsed.shelves[0].games.length, 1);
  assert.equal(parsed.fetchedAt, 400);
  assert.throws(() => parseSteamDiscovery({}));
  assert.equal(steamSummary({ ...item, type: 1, name: "A founder's pack" }), null);
  assert.equal(parseSteamDiscovery({ coming_soon: { items: [{ ...item, final_price: 0 }] } }).shelves[2].games[0].price, undefined);
});

test("store selections use validated app metadata and never label an unpriced preorder free", () => {
  const assets = { asset_url_format: "steam/apps/123/${FILENAME}", main_capsule: "abc/capsule.jpg", library_capsule: "abc/portrait.jpg" };
  const upcoming = { appid: 123, success: 1, item_type: 0, type: 0, visible: true, name: "Coming game", is_free: true, release: { is_coming_soon: true }, assets };
  const parsed = parseSteamStoreItems({ response: { store_items: [upcoming] } }, [123]);
  assert.equal(parsed[0].price, undefined);
  assert.ok(parsed[0].portrait?.endsWith("abc/portrait.jpg"));
  assert.equal(parseSteamStoreItems({ response: { store_items: [{ ...upcoming, type: 4 }] } }, [123]).length, 0);
  assert.equal(parseSteamStoreItems({ response: { store_items: [{ ...upcoming, visible: false }] } }, [123]).length, 0);
  assert.equal(parseSteamStoreItems({ response: { store_items: [{ ...upcoming, release: {} }] } }, [123])[0].price?.amount, 0);
});

test("remote search extracts only positive app IDs, never executable markup or package identities", () => {
  assert.deepEqual(parseSteamSearchIds({ success: 1, results_html: '<a data-ds-appid="123"></a><a data-ds-appid="123"></a><a data-ds-packageid="456"></a><script>bad()</script><a data-ds-appid="0">' }), [123]);
  assert.throws(() => parseSteamSearchIds({ success: 0, results_html: "" }));
});

test("media URLs must belong to Steam over HTTPS", () => {
  assert.equal(gameImage("https://steamstatic.com.evil.example/image.png"), "");
  assert.equal(gameImage("javascript:alert(1)"), "");
  assert.equal(gameImage("http://cdn.akamai.steamstatic.com/image.png"), "");
  assert.ok(gameImage(item.header_image));
});

test("details validate identity and product type; preserve new HLS trailers", () => {
  const detail = { ...item, steam_appid: 123, type: "game", short_description: "Hello &amp; welcome", screenshots: [{ path_full: item.header_image }], movies: [{ name: "Trailer", hls_h264: "https://video.akamai.steamstatic.com/trailer.m3u8", thumbnail: item.header_image }] };
  const parsed = parseSteamDetail({ "123": { success: true, data: detail } }, 123);
  assert.equal(parsed.description, "Hello & welcome");
  assert.ok(parsed.trailers[0].url.endsWith(".m3u8"));
  assert.throws(() => parseSteamDetail({ "123": { success: true, data: { ...detail, type: "dlc" } } }, 123));
  assert.throws(() => parseSteamDetail({ "123": { success: true, data: { ...detail, id: 987 } } }, 123));
});

test("hashed artwork comes from the matching Steam record", () => {
  const value = { response: { store_items: [{ appid: 123, success: 1, assets: { asset_url_format: "steam/apps/123/${FILENAME}?t=1", library_hero: "abc/library_hero.jpg" } }] } };
  assert.equal(parseSteamArtwork(value, 123).libraryHero, "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/abc/library_hero.jpg?t=1");
  assert.deepEqual(parseSteamArtwork(value, 999), {});
  value.response.store_items[0].assets.library_hero = "../../elsewhere.jpg";
  assert.deepEqual(parseSteamArtwork(value, 123), {});
});

test("Steam screenshots retain exact provider thumbnails, deduplicate and reject foreign image URLs", () => {
  const full = item.header_image.replace("header.jpg", "ss_a.jpg"), thumb = full.replace(".jpg", ".600x338.jpg");
  const parsed = parseSteamDetail({ 123: { success: true, data: { ...item, steam_appid: 123, type: "game", screenshots: [{ path_full: full, path_thumbnail: thumb }, { path_full: full, path_thumbnail: thumb }, { path_full: "https://evil.test/a.jpg", path_thumbnail: thumb }, { path_full: item.header_image, path_thumbnail: "javascript:bad()" }] } } }, 123);
  assert.deepEqual(parsed.screenshots, [full, item.header_image]); assert.deepEqual(parsed.screenshotThumbnails, { [full]: thumb });
});

test("publisher logo corrections survive old disk records without crossing game identities", () => {
  const live = (id: number) => parseSteamDetail({ [id]: { success: true, data: { ...item, id, steam_appid: id, type: "game" } } }, id);
  const cs = live(730);
  assert.ok(cs.logo.endsWith("logo_counterstrike2_white.svg"));
  const old = { ...cs, logo: "https://cdn.akamai.steamstatic.com/steam/apps/730/logo.png" };
  assert.equal((decodeGameMetadata("game:730", old) as typeof cs).logo, cs.logo);
  assert.equal(decodeGameMetadata("game:570", old), null);
  assert.equal(live(1145350).logo, "/games/publisher/hades-ii-logo.png");
  assert.equal(live(1422450).logo, "https://cdn.akamai.steamstatic.com/steam/apps/1422450/logo.png");
});

test("description markup becomes readable plain text", () => {
  assert.equal(plainGameText("<p>First &amp; second</p><script>bad()</script><p>Next<br>line</p>"), "First & second\nNext\nline");
});

test("saved games retain platforms and price across reload without leaking between profiles", () => {
  const memory = new Map<string, string>();
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
  try {
    const game = steamSummary(item)!;
    writeSavedGames("one", [game]);
    assert.deepEqual(readSavedGames("one"), [game]);
    assert.deepEqual(readSavedGames("two"), []);
    writeSavedGames("local", [{ ...game, capsule: "https://asset.localhost/W%3A%5Csteam%5Cart.jpg" }]);
    assert.equal(readSavedGames("local")[0].steamId, game.steamId);
    assert.ok(readSavedGames("local")[0].capsule.startsWith("https://shared.akamai.steamstatic.com/"));
    memory.set("harbor.games.saved.v1:one", JSON.stringify([{ steamId: 5, name: "Bad", capsule: "javascript:x" }, { ...game, platforms: 2 }]));
    assert.equal(readSavedGames("one").length, 1);
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("new-release badges require a known recent date and exclude future or coming-soon games", async () => {
 const {isRecentGameRelease}=await import('../src/lib/games/steam-data.ts');
 const now=Date.UTC(2026,8,30),game=steamSummary(item)!;
 assert.equal(isRecentGameRelease(game,now),false);
 assert.equal(isRecentGameRelease({...game,releaseTimestamp:now/1000+86400},now),false);
 assert.equal(isRecentGameRelease({...game,releaseTimestamp:now/1000-91*86400},now),false);
 assert.equal(isRecentGameRelease({...game,releaseTimestamp:now/1000-86400,comingSoon:true},now),false);
 assert.equal(isRecentGameRelease({...game,releaseTimestamp:now/1000-86400},now),true);
});

test("complete publisher markup is bounded in UTF-8 and retained separately through cache decoding", () => {
  const markup = '<h2>Explore</h2><p>A world</p><img src="https://shared.akamai.steamstatic.com/art.jpg">';
  const parsed = parseSteamDetail({ "123": { success: true, data: { ...item, steam_appid: 123, type: "game", about_the_game: markup } } }, 123);
  assert.equal(parsed.aboutHtml, markup);
  assert.equal((decodeGameMetadata("game:123", parsed) as typeof parsed).aboutHtml, markup);
  assert.equal(parsed.about, "Explore\nA world");
  assert.equal(gameDescriptionHtml(""), undefined);
  assert.equal(gameDescriptionHtml("é".repeat(300000)), undefined);
  assert.equal(gameDescriptionHtml("x".repeat(512 * 1024 + 1)), undefined);
  assert.equal(gameDescriptionHtml("x".repeat(512 * 1024))?.length, 512 * 1024);
});
test("hero microtrailers validate the matching game's identity and reject foreign paths", async () => {
 const {parseSteamMicrotrailer}=await import('../src/lib/games/steam-data.ts');
 const payload=(appid:number,filename:string)=>({response:{store_items:[{appid,success:1,trailers:{highlights:[{microtrailer:[{type:'video/webm',filename}]}]}}]}});
 assert.equal(parseSteamMicrotrailer(payload(123,'123/clip/micro.webm'),123),'https://video.akamai.steamstatic.com/store_trailers/123/clip/micro.webm');
 assert.equal(parseSteamMicrotrailer(payload(123,'999/clip/micro.webm'),123),'');
 assert.equal(parseSteamMicrotrailer(payload(123,'123/../999/micro.webm'),123),'');
 assert.equal(parseSteamMicrotrailer(payload(999,'123/clip/micro.webm'),123),'');
});
