import assert from "node:assert/strict";
import test from "node:test";
import { LAUNCHER_DISCOVERY, launcherDiscoveryGame } from "../src/lib/games/launcher-discovery.ts";

test("non-Steam editorial picks use generic IGDB identity, never Steam or fabricated installed IDs", () => {
  for (const launcher of LAUNCHER_DISCOVERY) for (const game of launcher.games) {
    if (launcher.id === "steam") {
      assert.ok(game.steamId);
      assert.equal(game.id, `steam:${game.steamId}`);
    } else {
      assert.equal(game.id, `igdb:${game.igdbId}`, `${launcher.id}: ${game.name}`);
      assert.equal(Object.hasOwn(game, "steamId"), false);
    }
  }
  assert.deepEqual(LAUNCHER_DISCOVERY.find(item => item.id === "bsg")!.games.map(game => game.id), ["igdb:15536", "igdb:203610"]);
});

test("live metadata normalization preserves rich atlas data and leaves the provider object intact", () => {
  const provider = { id: "steam:3932890", steamId: 3932890, igdbId: 15536, name: "Escape from Tarkov", capsule: "cover", platforms: ["Windows"],
    platformLinks: [{ id: 6, name: "PC (Microsoft Windows)" }], hero: "official-hero", screenshots: ["screenshot"],
    videos: [{ id: "video", title: "Trailer" }], officialUrl: "https://www.escapefromtarkov.com/", genreNames: ["Shooter"] };
  const result = launcherDiscoveryGame(provider, "bsg");
  assert.equal(result.id, "igdb:15536");
  assert.equal(Object.hasOwn(result, "steamId"), false);
  assert.deepEqual(result.platformLinks, provider.platformLinks);
  assert.deepEqual(result.screenshots, provider.screenshots);
  assert.deepEqual(result.videos, provider.videos);
  assert.equal(result.officialUrl, provider.officialUrl);
  assert.equal(provider.id, "steam:3932890");
  assert.equal(provider.steamId, 3932890);
  const steam = launcherDiscoveryGame(provider, "steam");
  assert.equal(steam.id, provider.id);
  assert.ok("steamId" in steam && steam.steamId === provider.steamId);
});

test("Squadron 42 uses its own verified hero for its discovery cover without changing other games", () => {
  const games = LAUNCHER_DISCOVERY.find(item => item.id === "rsi")!.games;
  const squadron = games.find(game => game.igdbId === 19128)!;
  assert.equal(squadron.portrait, squadron.hero);
  assert.ok(squadron.hero?.startsWith("https://images.igdb.com/"));
  const star = games.find(game => game.igdbId === 1595)!;
  assert.notEqual(star.portrait, squadron.portrait);
  assert.ok(star.logo?.endsWith("star-citizen-logo.svg"));
});

test("missing game identities cannot become generic discovery IDs", () => {
  assert.throws(() => launcherDiscoveryGame({ id: "steam:1", name: "Unknown", capsule: "", platforms: [] }, "bsg"), /Missing discovery identity/);
});

test("known white title-card artwork cannot override the inspected discovery scene", () => {
  const game = { id: "igdb:300976", igdbId: 300976, name: "Assassin's Creed Shadows", platforms: ["Windows"],
    capsule: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3mk0.jpg", hero: "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/ar3mk0.jpg" };
  const result = launcherDiscoveryGame(game, "ubisoft");
  assert.equal(result.hero, "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/scs6j4.jpg");
  assert.equal(result.capsule, result.hero);
  assert.equal(game.hero.endsWith("ar3mk0.jpg"), true);
});
