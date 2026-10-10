import assert from "node:assert/strict";
import test from "node:test";
import { artworkBinding, backgroundArtwork, igdbArtworkCatalog, igdbArtworkUrl, matchingLibraryArtwork, parseLibraryArtwork, randomArtwork, type LibraryArtwork } from "../src/lib/games/igdb-artwork.ts";
import { decodeIgdbRows } from "../src/lib/games/igdb-records.ts";
import { ATLAS_DETAIL_FIELDS, ATLAS_SUMMARY_FIELDS, parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import { changeLibraryArtwork, changeLibraryPreferences, emptyLibraryPreferences, parseLibraryPreferences, patchLibraryArtwork, patchLibraryLinkOrders, patchLibraryMetadata, patchLibraryPreferences, readLibraryPreferences } from "../src/lib/games/library-preferences.ts";

const raw = { id: 42, name: "Edition", cover: { image_id: "cover", width: 900, height: 1200 }, artworks: [{ image_id: "wide", width: 3840, height: 2160 }, { image_id: "small", width: 1200, height: 600 }], screenshots: [{ image_id: "shot", width: 1920, height: 1080 }] };
const art: LibraryArtwork = { binding: "steam:7:", igdbId: 42, cover: { kind: "cover", imageId: "cover", width: 900, height: 1200 }, background: { kind: "artwork", imageId: "wide", width: 3840, height: 2160 } };
test("detail queries and bounded cache decoding preserve original dimensions without enlarging browse queries", () => {
  for (const field of ["cover.width", "cover.height", "artworks.width", "artworks.height", "screenshots.width", "screenshots.height"]) assert.ok(ATLAS_DETAIL_FIELDS.includes(field));
  assert.doesNotMatch(ATLAS_SUMMARY_FIELDS, /\.width|\.height/);
  const decoded = decodeIgdbRows([raw])!;
  assert.equal(parseAtlasGame(decoded[0]).artwork?.length, 4);
  assert.deepEqual(parseAtlasGame(decodeIgdbRows(decoded)![0]).artwork, igdbArtworkCatalog(raw));
  const damaged = igdbArtworkCatalog({ cover: { image_id: "cover", width: -1, height: 1e9, url: "https://other.test/a" }, artworks: [{ image_id: "../bad" }, { image_id: "x" }, { image_id: "x" }] });
  assert.deepEqual(damaged, [{ imageId: "cover", kind: "cover" }, { imageId: "x", kind: "artwork" }]);
  assert.equal(igdbArtworkCatalog({ artworks: Array.from({ length: 500 }, (_, i) => ({ image_id: `a${i}` })) }).length, 100);
});
test("backgrounds prefer artwork and allow screenshots only as a fallback; random includes the last candidate", () => {
  const catalog = igdbArtworkCatalog(raw), backgrounds = backgroundArtwork(catalog);
  assert.deepEqual(backgrounds.map(image => image.imageId), ["wide", "small"]);
  const shots = catalog.filter(image => image.kind !== "artwork");
  assert.deepEqual(backgroundArtwork(shots).map(image => image.imageId), ["shot"]);
  assert.deepEqual(backgroundArtwork(shots, false), []);
  assert.equal(randomArtwork(backgrounds, () => .999)?.imageId, "small");
  assert.equal(randomArtwork(backgrounds, () => 0)?.imageId, "wide");
  assert.equal(randomArtwork([]), undefined);
});
test("thumbnail transforms stay bounded; full preview preserves small originals and caps larger or unknown images", () => {
  assert.match(igdbArtworkUrl(art.background!), /t_1080p\/wide\.jpg$/);
  assert.match(igdbArtworkUrl(art.background!, true), /t_screenshot_med\/wide\.jpg$/);
  assert.match(igdbArtworkUrl(art.cover!, true), /t_cover_big_2x\/cover\.jpg$/);
  assert.match(igdbArtworkUrl({ kind: "artwork", imageId: "small", width: 1200, height: 600 }), /t_original/);
  assert.match(igdbArtworkUrl({ kind: "artwork", imageId: "unknown" }), /t_1080p/);
  assert.match(igdbArtworkUrl({kind:"artwork",imageId:"panorama",width:100000,height:700}),/t_1080p/);
  assert.equal(igdbArtworkUrl({ kind: "cover", imageId: "../outside" }), "");
});
test("stored selections reject invalid image identities and rebuild only known presentation fields", () => {
  assert.deepEqual(parseLibraryArtwork({ ...art, steamId: 999, executable: "anything", cover: { ...art.cover, url: "https://other.test" } }), art);
  for (const bad of [{ ...art, igdbId: 0 }, { ...art, binding: "" }, { ...art, cover: { ...art.cover, width: -1 } }, { ...art, background: { imageId: "wide", kind: "cover" } }, { ...art, cover: { imageId: "../x", kind: "cover" } }, { binding: "steam:7:", igdbId: 42 }]) assert.throws(() => parseLibraryArtwork(bad), /library_prefs_read/);
});
test("artwork persists across unrelated edits and reset keeps local cover, title, status and pin", () => {
  let store = patchLibraryPreferences(emptyLibraryPreferences(), ["steam:7"], { cover: "D:/Art/local.png", title: "Mine", playStatus: "playing", pinned: true });
  store = patchLibraryArtwork(store, "steam:7", art);
  store = patchLibraryLinkOrders(store, [{ id: "steam:7", order: [] }]);
  assert.deepEqual(parseLibraryPreferences(JSON.stringify(store)).entries["steam:7"].artwork, art);
  store = patchLibraryArtwork(store, "steam:7", null, art);
  assert.deepEqual(store.entries["steam:7"], { cover: "D:/Art/local.png", pinned: true, hidden: false, title: "Mine", playStatus: "playing" });
  const onlyArt = patchLibraryArtwork(emptyLibraryPreferences(), "steam:7", art);
  assert.deepEqual(patchLibraryLinkOrders(onlyArt, [{ id: "steam:7", order: [] }]).entries["steam:7"].artwork, art);
  assert.deepEqual(patchLibraryArtwork(onlyArt, "steam:7", null, art).entries, {});
});
test("conflicting artwork or metadata cannot silently replace a newer review", () => {
  const store = patchLibraryArtwork(emptyLibraryPreferences(), "steam:7", art);
  assert.throws(() => patchLibraryArtwork(store, "steam:7", null), /library_artwork_conflict/);
  const match = { igdbId: 99, name: "Other edition", capsule: "", platforms: [] };
  const changed = patchLibraryMetadata(store, "steam:7", match);
  assert.throws(() => patchLibraryArtwork(changed, "steam:7", null, art), /library_artwork_conflict/);
  assert.equal(matchingLibraryArtwork(changed.entries["steam:7"].artwork, artworkBinding("steam:7", undefined, 99)), undefined);
});
test("ROM copies, catalog associations and reviewed metadata have distinct bindings without changing launch identity", () => {
  const linked = { id: "igdb:42", igdbId: 42, name: "Game", capsule: "", platforms: [] };
  assert.notEqual(artworkBinding("rom:24:D:/one", linked), artworkBinding("rom:24:D:/one", { ...linked, id: "igdb:99", igdbId: 99 }));
  assert.equal(artworkBinding("rom:24:D:/one"), "");
  assert.notEqual(artworkBinding("gog:7", { ...linked, catalogSteamId: 8 }), artworkBinding("gog:7", { ...linked, catalogSteamId: 9 }));
  assert.equal(artworkBinding("steam:7", linked, 99), "igdb:99");
  assert.equal(linked.id, "igdb:42");
});
test("serialized writes preserve profile separation and unrelated concurrent preferences", async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  await Promise.all([changeLibraryArtwork("one", "steam:7", art), changeLibraryPreferences("one", ["steam:7"], { hidden: true })]);
  assert.equal(readLibraryPreferences("one").entries["steam:7"].hidden, true);
  assert.deepEqual(readLibraryPreferences("one").entries["steam:7"].artwork, art);
  assert.deepEqual(readLibraryPreferences("two").entries, {});
  await assert.rejects(changeLibraryArtwork("one", "steam:7", null), /library_artwork_conflict/);
});
