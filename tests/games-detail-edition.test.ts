import assert from "node:assert/strict";
import test from "node:test";
import { detailEditionTarget, resolveDetailEdition } from "../src/lib/games/detail-edition.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import type { GameDetail, GameSummary } from "../src/lib/games/types.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";

const original = parseAtlasGame({ id: 42, name: "Original console edition", summary: "The original adventure.", first_release_date: 694224000, platforms: [{ id: 19, name: "Super Nintendo" }], cover: { image_id: "original" }, artworks: [{ image_id: "originalhero" }], external_games: [{ uid: "99", external_game_source: 1 }], involved_companies: [{ developer: true, company: { id: 8, name: "Original studio" } }] });
const port: GameDetail = { id: "steam:99", steamId: 99, name: "Modern PC port", capsule: "pc-cover", platforms: ["Windows"], description: "Modern edition description", about: "Modern edition about", aboutHtml: "<p>PC port</p>", hero: "pc-hero", libraryHero: "pc-library-hero", logo: "pc-logo", screenshots: ["pc-shot"], trailers: [], genres: [], features: [], developers: ["Port studio"], publishers: [], release: "2026", releaseTimestamp: 1767225600, comingSoon: false, requirements: { minimum: "Windows 11", recommended: "RTX GPU" }, languages: "English", achievements: 40 };
const selected: GameSummary = { ...original, id: "igdb:42" };

test("an explicit IGDB edition keeps original metadata even when its Steam port is loaded", () => {
  const result = resolveDetailEdition(selected, port, original);
  assert.equal(result.target.steamId, undefined);
  assert.equal(result.storeDetail, null);
  assert.equal(result.detail?.description, original.description);
  assert.equal(result.detail?.hero, original.hero);
  assert.equal(result.detail?.libraryHero, undefined);
  assert.equal(result.detail?.aboutHtml, undefined);
  assert.equal(result.detail?.achievements, undefined);
  assert.deepEqual(result.detail?.platforms, ["Super Nintendo"]);
  assert.deepEqual(result.detail?.developers, ["Original studio"]);
  assert.deepEqual(result.detail?.requirements, { minimum: "", recommended: "" });
  assert.ok(result.detail?.release.includes("1992"));
  assert.equal(result.steamLinkId, 99);
});

test("missing or stale atlas data cannot fall back to another edition or validate its Steam link", () => {
  for (const atlas of [null, { ...original, igdbId: 43 }]) {
    const result = resolveDetailEdition(selected, port, atlas);
    assert.equal(result.detail, null);
    assert.equal(result.steamLinkId, undefined);
    assert.equal(result.portableGame.id, "igdb:42");
    assert.equal(result.portableGame.steamId, undefined);
  }
  assert.equal(resolveDetailEdition(selected, port, { ...original, steamId: undefined }).steamLinkId, undefined);
});

test("saved ROM identity stays IGDB before and after enrichment and survives persistence", () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
  const before = resolveDetailEdition(selected, port, null).portableGame;
  const after = resolveDetailEdition(selected, port, original).portableGame;
  assert.equal(before.id, after.id);
  assert.equal(after.igdbId, 42);
  assert.equal(after.steamId, undefined);
  writeSavedGames("edition-fixture", [after]);
  assert.equal(readSavedGames("edition-fixture")[0]?.id, "igdb:42");
  assert.equal(readSavedGames("edition-fixture")[0]?.name, original.name);
  writeSavedGames("raw-rom-fixture", [selected, port]);
  assert.deepEqual(readSavedGames("raw-rom-fixture").map(game => game.id), ["igdb:42", "steam:99"]);
  data.set("harbor.games.saved.v1:legacy-rom", JSON.stringify([selected]));
  assert.equal(readSavedGames("legacy-rom")[0]?.id, "igdb:42");
});

test("Steam-origin pages keep their store metadata while linked launcher identity remains stable", () => {
  const steam = resolveDetailEdition(port, port, original);
  assert.equal(steam.detail, port);
  assert.equal(steam.storeDetail, port);
  assert.equal(steam.portableGame.id, "steam:99");
  assert.equal(steam.steamLinkId, 99);
  const launcher = { ...port, id: "epic:owned-copy" };
  assert.equal(resolveDetailEdition(launcher, port, original).portableGame.id, launcher.id);
  assert.equal(resolveDetailEdition(port, { ...port, steamId: 100 }, null).detail, null);
});

test("the explicit route ID is the authority for the IGDB request", () => {
  assert.deepEqual(detailEditionTarget({ ...selected, igdbId: 777 }), { ...selected, igdbId: 42, steamId: undefined });
  assert.equal(detailEditionTarget(port), port);
});

test("repeated Steam controller labels render once without dropping category identities", () => {
  // Hades II's public appdetails assigns these different IDs identical labels.
  const featureCategories = [
    { id: 28, name: "Full controller support" },
    { id: 55, name: "DualShock Controller Support" },
    { id: 56, name: "DualShock Controller Support" },
    { id: 57, name: "DualSense Controller Support" },
    { id: 58, name: "DualSense Controller Support" },
    { id: 23, name: "Steam Cloud" },
  ];
  const source: GameDetail = { ...port, featureCategories, features: featureCategories.map(category => category.name) };
  for (const detail of [source, { ...source, cachedAt: 1234 }]) {
    const result = resolveDetailEdition(port, detail, null);
    assert.deepEqual(result.detail?.features, ["Full controller support", "DualShock Controller Support", "DualSense Controller Support", "Steam Cloud"]);
    assert.equal(result.storeDetail, detail);
    assert.equal(result.detail?.featureCategories, featureCategories);
    assert.deepEqual(result.detail?.featureCategories?.map(category => category.id), [28, 55, 56, 57, 58, 23]);
    assert.equal(detail.features.length, 6);
    assert.equal(result.detail?.cachedAt, detail.cachedAt);
  }
});

test("repeated atlas feature labels preserve distinct metadata routes and edition identity", () => {
  const atlas = { ...original, modes: [{ id: 1, name: "Single player" }, { id: 1, name: "Single player" }], perspectives: [{ id: 2, name: "Side view" }] };
  const result = resolveDetailEdition(selected, port, atlas);
  assert.deepEqual(result.detail?.features, ["Single player", "Side view"]);
  assert.equal(result.atlas, atlas);
  assert.equal(result.atlas?.modes.length, 2);
  assert.equal(result.portableGame.id, selected.id);
  assert.equal(result.storeDetail, null);
});
