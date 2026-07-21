// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { fnv1a64, isSyncableKey } from "../src/lib/sync/keys.ts";

test("accepts only syncable Harbor keys", () => {
  // User state roams across devices.
  for (const key of [
    "harbor.settings",
    "harbor.installed-addons",
    "harbor.localcw.v1.abc",
    "harbor.profiles.v1",
    "harbor.curated-collections",
    "harbor.playback-history.v1",
    "harbor.watchedby.v1",
    "harbor.iptv.stats.v1",
    "harbor.resume",
    "harbor.manualwatched.meta.v1",
    // The Stremio session carries across devices (E2E-encrypted like all docs).
    "harbor.auth",
    "harbor.auth.x",
    // The downloads catalog syncs; the device-local registry (paths/URLs) doesn't.
    "harbor.downloads.catalog.v1",
  ]) {
    assert.equal(isSyncableKey(key), true, key);
  }

  assert.equal(isSyncableKey("harbor.downloads.v1"), false);
  assert.equal(isSyncableKey("harbor.sync.session.v1"), false);
  assert.equal(isSyncableKey("harbor.together.clientId"), false);
  assert.equal(isSyncableKey("settings"), false);

  // Rebuildable caches stay device-local: they can exceed the server's
  // per-doc 413 limit and burn the account's doc quota.
  for (const key of [
    "harbor.animefillercache.tt123",
    "harbor.anime_awards.metas.v6",
    "harbor.anime.hero.hosted.v1",
    "harbor.anime.hero.v2",
    "harbor.anime.herologos.v2",
    "harbor.anime.toppicks.shown.v1",
    "harbor.anime.toppicks.cache.v2",
    "harbor.anime.recs_by_mal.v1",
    "harbor.anime.mal_id_by_franchise.v1",
    "harbor.anime.detected.v1",
    "harbor.anilist.collection.user",
    "harbor.jikancatalog",
    "harbor.jikancatalog2",
    "harbor.malscorecache",
    "harbor.armcache",
    "harbor.armkitsucache",
    "harbor.armsrcmalcache",
    "harbor.extkitsucache",
    "harbor.anidbtvdbcache",
    "harbor.tmdb.imdb.v1",
    "harbor.tmdb.personName.v1",
    "harbor.imdb.tmdb.v1",
    "harbor.omdb.v1",
    "harbor.omdb.misses",
    "harbor.omdb.budget",
    "harbor.awards.wikidata.v10",
    "harbor.mdblist.cards",
    "harbor.snap.tt36631539",
    "harbor.snap.index",
    "harbor.picker-cache.v5",
    "harbor.discover.awards.v1",
    "harbor.discover.v1",
    "harbor.shows.hero.pool.v2",
    "harbor.lastseason.v1",
    "harbor.surprise.recent.v1",
    "harbor.build.rating.v1",
    "harbor.stremio-addons.velocity.v1",
    "harbor.dead-streams.v1",
    "harbor.calendar.webhook.last.v1",
    "harbor.webhook.lastTick",
    "harbor.scroll.v1",
    "harbor.iptv.hydration.v2",
    "harbor.iptv.epgmap.v1",
    "harbor.addons.seeded.v1",
    "harbor.scope.seeded.v1",
  ]) {
    assert.equal(isSyncableKey(key), false, key);
  }
});

test("hashes strings with stable 64-bit FNV-1a output", () => {
  assert.equal(fnv1a64("hello"), "a430d84680aabd0b");
  assert.equal(fnv1a64("hello"), fnv1a64("hello"));
  assert.match(fnv1a64("Harbor"), /^[0-9a-f]{16}$/);
  assert.notEqual(fnv1a64("Harbor"), fnv1a64("harbor"));
});
