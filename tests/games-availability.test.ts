import test from "node:test";
import assert from "node:assert/strict";
import { gameAvailability, gameAvailabilityIndex, releaseAvailability } from "../src/lib/games/availability.ts";
import type { GameSummary } from "../src/lib/games/types.ts";
import type { UnifiedLibraryGame } from "../src/lib/games/unified-library.ts";
import type { GameTransfer } from "../src/lib/games/transfers.ts";
import type { GameTorrent } from "../src/lib/games/torrents.ts";
import type { SourceRelease } from "../src/lib/games/sources.ts";
const game: GameSummary = { id: "steam:1488490", steamId: 1488490, name: "Nivalis Nights", capsule: "", platforms: ["Windows"] };
const entry = (state: UnifiedLibraryGame["state"], extra: Partial<UnifiedLibraryGame> = {}): UnifiedLibraryGame => ({ id: game.id, name: game.name, game, source: "steam", state, favorite: false, hidden: false, lastPlayed: 0, ...extra });
const transfer = (status: GameTransfer["status"], extra: Partial<GameTransfer> = {}) => ({ id: "download", profile: "me", url: "https://example.org/game.zip", createdAt: 1, game: { id: game.id, name: game.name }, status, ...extra }) as GameTransfer;
const release: SourceRelease = { id: "r", title: "Nivalis Nights", kind: "game", files: [{ kind: "direct", name: "archive", url: "https://example.org/game.zip" }] };
test("installed, owned, custom/launcher linked identity and wishlist absence remain distinct", () => {
  for (const state of ["notInstalled", "unknown", "unavailable", "setup"] as const) assert.equal(gameAvailability(gameAvailabilityIndex("me", [entry(state)], [], []), game), "library");
  assert.equal(gameAvailability(gameAvailabilityIndex("me", [entry("ready", { source: "custom", id: "custom:one" })], [], []), game), "installed");
  assert.equal(gameAvailability(gameAvailabilityIndex("me", [entry("ready", { source: "retro" })], [], []), game), "library");
  assert.equal(gameAvailability(gameAvailabilityIndex("me", [], [], []), game), undefined);
  const index = gameAvailabilityIndex("me", [entry("ready", { game: { ...game, id: "epic:native", steamId: undefined, catalogSteamId: 1488490 } })], [], []);
  assert.equal(gameAvailability(index, game), "installed");
  assert.equal(gameAvailability(index, { ...game, id: "steam:20", steamId: 20 }), undefined, "same title alone is not ownership");
});
test("live transfer states update without claiming an installation or leaking another profile", () => {
  for (const [status, expected] of [["complete", "downloaded"], ["downloading", "downloading"], ["queued", "downloading"], ["paused", "paused"], ["failed", undefined], ["canceled", undefined]] as const) {
    assert.equal(gameAvailability(gameAvailabilityIndex("me", [], [transfer(status)], []), game), expected);
  }
  assert.equal(gameAvailability(gameAvailabilityIndex("other", [], [transfer("complete")], []), game), undefined);
  assert.equal(gameAvailability(gameAvailabilityIndex("me", [entry("ready")], [transfer("complete")], []), game), "installed");
});
test("legacy completed source URLs are recognized without name matching; wrong mirrors and profiles are not", () => {
  const records = [transfer("complete", { game: undefined })];
  assert.equal(releaseAvailability(release, "me", records, []), "downloaded");
  assert.equal(releaseAvailability(release, "other", records, []), undefined);
  assert.equal(releaseAvailability({ ...release, files: [{ ...release.files[0], url: "https://example.org/different.zip" }] }, "me", records, []), undefined);
});
test("FitGirl torrent receipts match normalized infohash even before catalog linking", () => {
  const hash = "a".repeat(40);
  const torrent = { profile: "me", id: "t", infoHash: hash, status: "complete" } as GameTorrent;
  const file = { kind: "magnet" as const, name: "torrent", url: "magnet:?xt=urn:btih:" + hash.toUpperCase() + "&dn=Nivalis" };
  assert.equal(releaseAvailability({ ...release, files: [file] }, "me", [], [torrent]), "downloaded");
  assert.equal(releaseAvailability({ ...release, files: [file] }, "me", [], [{ ...torrent, infoHash: "b".repeat(40) }]), undefined);
  assert.equal(releaseAvailability({ ...release, files: [file] }, "me", [], [{ ...torrent, status: "downloading" }]), "downloading");
});
