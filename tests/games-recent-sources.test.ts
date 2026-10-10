import assert from "node:assert/strict";
import test from "node:test";
import { recentSourceReleases, recentSourceReleasesAsync } from "../src/lib/games/recent-sources.ts";
import type { GameSource, SourceRelease } from "../src/lib/games/sources.ts";
const now = Date.parse("2026-10-02T12:00:00Z");
const release = (title: string, date?: string, extra: Partial<SourceRelease> = {}): SourceRelease => ({ id: title, title, date, kind: "game", files: [{ name: "Game.zip", url: "https://example.org/game.zip", kind: "direct" }], ...extra });
const source = (entries: SourceRelease[], extra: Partial<GameSource> = {}): GameSource => ({ id: "a", name: "Source", url: "https://example.org/catalog", format: "harbor", entries, enabled: true, checkedAt: now, skipped: 0, ...extra });

test('large recent-release scans yield, retain the final upload and cancel abandoned work', async () => {
  const entries = Array.from({ length: 150000 }, (_, index) => release('Project ' + index, '2024-01-01'));
  entries[149999] = release('Latest game', '2026-10-01');
  const list = [source(entries)]; let heartbeat = false;
  const timer = setTimeout(() => { heartbeat = true; }, 0);
  const actual = await recentSourceReleasesAsync(list, new AbortController().signal, now); clearTimeout(timer);
  assert.equal(heartbeat, true); assert.deepEqual(actual, recentSourceReleases(list, now)); assert.equal(actual[0].release.title, 'Latest game');
  const controller = new AbortController(); const pending = recentSourceReleasesAsync(list, controller.signal, now); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test("source uploads sort newest first; import/check time never masquerades as an addition", () => {
  const result = recentSourceReleases([source([release("Older", "2024-01-01"), release("Newest", "2026-10-01"), release("No date"), release("Invalid date", "invalid"), release("Future", "2027-01-01"), release("Patch", "2026-10-02", { kind: "patch" }), release("No files", "2026-10-02", { files: [] })]), source([release("Disabled", "2026-10-02")], { enabled: false })], now);
  assert.deepEqual(result.map(item => item.release.title), ["Newest", "Older"]);
});
test("newest build wins across enabled catalogs without collapsing named editions or platforms", () => {
  const result = recentSourceReleases([source([release("Game – v1.0", "2026-09-01"), release("Game Remastered", "2026-09-01"), release("Game", "2026-09-01", { platform: "SNES" })]), source([release("Game – v2.0", "2026-10-01")], { id: "b" })], now);
  assert.equal(result.length, 3);
  assert.equal(result[0].release.title, "Game – v2.0");
  assert.equal(result[0].source.id, "b");
  assert(result.some(item => item.release.platform === "SNES"));
});
test("explicit provider IDs retain distinct games, but platform aliases deduplicate", () => {
  const result = recentSourceReleases([source([release("Renamed", "2026-10-01", { steamId: 10, platform: "win" }), release("Original", "2026-09-01", { steamId: 10, platform: "Windows" }), release("Renamed", "2026-10-01", { steamId: 20, platform: "win" }), release("Renamed", "2026-10-01", { steamId: 10, platform: "Linux" })])], now);
  assert.equal(result.length, 3);
});
test("bounded shelf keeps the actual latest uploads even when a large catalog is oldest first", () => {
  const entries = Array.from({ length: 10000 }, (_, i) => release("Game " + i, new Date(now - (10000 - i) * 1000).toISOString()));
  const result = recentSourceReleases([source(entries)], now);
  assert.equal(result.length, 36);
  assert.equal(result[0].release.title, "Game 9999");
  assert.equal(result.at(-1)?.release.title, "Game 9964");
  assert.equal(recentSourceReleases([source(entries)], now, 0).length, 0);
});
test("removed and disabled sources disappear without retaining another profile's entries", () => {
  const list = [source([release("Game", "2026-10-01")])];
  assert.equal(recentSourceReleases(list, now).length, 1);
  assert.deepEqual(recentSourceReleases([], now), []);
  assert.deepEqual(recentSourceReleases([{ ...list[0], enabled: false }], now), []);
});
