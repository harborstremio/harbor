import assert from "node:assert/strict";
import test from "node:test";
import { sourceListingGame, sourceListingId } from "../src/lib/games/source-listing.ts";
import { sourcePageSnapshot } from "../src/lib/games/source-page-snapshots.ts";
import { resolveDetailEdition } from "../src/lib/games/detail-edition.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";
import { collectionGame } from "../src/lib/games/personal-collections.ts";
import { sourceAlertGame } from "../src/lib/games/source-alerts.ts";
import { patchLibraryPreferences, emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { sourceMatch } from "../src/lib/games/sources.ts";
import type { GameSummary } from "../src/lib/games/types.ts";

const game: GameSummary = { id: "source:tracker:echoes", name: "Echoes of Polis / Эхо Полиса", capsule: "https://images.example/echoes.png", portrait: "https://images.example/echoes.png", platforms: [], sourceListing: { page: "https://rutracker.org/forum/viewtopic.php?t=6914600", sourceName: "RuTracker & Rutor", description: "A city-building strategy game.", screenshots: [] } };
test("unindexed releases open source-backed details without asserting a store identity or release date", () => {
  const result = resolveDetailEdition(game, null, null);
  assert.equal(result.detail?.description, game.sourceListing!.description);
  assert.equal(result.detail?.hero, game.capsule);
  assert.equal(result.steamLinkId, undefined); assert.equal(result.portableGame.steamId, undefined);
  assert.equal(result.portableGame.igdbId, undefined); assert.equal(result.detail?.release, "");
  assert.equal(sourceMatch({ id: "echoes", title: "Echoes of Polis / Эхо Полиса [P] [RUS] (2026, RTS) (1.7) [Portable]", kind: "game", files: [] }, result.portableGame), "title");
});
test("source-backed artwork and provenance survive save/reload and collections", () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
  writeSavedGames("source-fixture", [game]);
  assert.deepEqual(readSavedGames("source-fixture"), [sourceListingGame(game)]);
  assert.deepEqual(collectionGame(game), sourceListingGame(game));
  assert.equal(readSavedGames("different-profile").length, 0);
});
test("source snapshots require the exact published page and game name", () => {
  const page = "https://rutracker.org/forum/viewtopic.php?t=6914600";
  assert.ok(sourcePageSnapshot(page, "Echoes of Polis / Эхо Полиса [P] [RUS] (2026, RTS)")?.portrait);
  assert.equal(sourcePageSnapshot(page, "Echoes of Polis 2 [P] [RUS] (2026, RTS)"), undefined);
  assert.equal(sourcePageSnapshot(page + "0", game.name), undefined);
  assert.equal(sourcePageSnapshot("https://other.example/forum/viewtopic.php?t=6914600", game.name), undefined);
});
test("saved source metadata rejects active URLs, mixed identities and oversized identity keys", () => {
  for (const value of [{ ...game, steamId: 10 }, { ...game, igdbId: 20 }, { ...game, id: "source:" + "x".repeat(501) }, { ...game, capsule: "javascript:alert(1)" }, { ...game, sourceListing: { ...game.sourceListing, page: "file:///private" } }]) assert.equal(sourceListingGame(value), null);
});


test("source detail favorites and alert references retain their original source", () => {
  assert.deepEqual(sourceAlertGame(game), sourceListingGame(game));
  const prefs = patchLibraryPreferences(emptyLibraryPreferences(), [game.id], {pinned:true});
  assert.equal(prefs.entries[game.id].pinned, true);
  for (const id of ["source:", "source:only", "source:a:b" + String.fromCharCode(127)]) {
    assert.throws(() => patchLibraryPreferences(emptyLibraryPreferences(), [id], {pinned:true}));
  }
});


test("source detail identity survives feed reordering and unavailable covers", async () => {
  const id = await sourceListingId("tracker", game.sourceListing!.page, "Echoes of Polis [P] [RUS] (2026, RTS)");
  assert.equal(id, await sourceListingId("tracker", game.sourceListing!.page, "Echoes of Polis [P] [RUS] (2026, RTS) (1.8)"));
  assert.notEqual(id, await sourceListingId("tracker", game.sourceListing!.page, "Echoes of Polis 2"));
  assert.ok(sourceListingGame({...game, id, capsule:"", portrait:undefined}));
});
