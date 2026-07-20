// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { fnv1a64, isSyncableKey } from "../src/lib/sync/keys.ts";

test("accepts only syncable Harbor keys", () => {
  assert.equal(isSyncableKey("harbor.settings"), true);
  assert.equal(isSyncableKey("harbor.installed-addons"), true);
  assert.equal(isSyncableKey("harbor.localcw.v1.abc"), true);
  // The Stremio session carries across devices (E2E-encrypted like all docs).
  assert.equal(isSyncableKey("harbor.auth"), true);
  assert.equal(isSyncableKey("harbor.auth.x"), true);
  // The downloads catalog syncs; the device-local registry (paths/URLs) doesn't.
  assert.equal(isSyncableKey("harbor.downloads.catalog.v1"), true);
  assert.equal(isSyncableKey("harbor.downloads.v1"), false);

  assert.equal(isSyncableKey("harbor.sync.session.v1"), false);
  assert.equal(isSyncableKey("harbor.together.clientId"), false);
  assert.equal(isSyncableKey("settings"), false);

  for (const key of [
    "harbor.animefillercache.tt123",
    "harbor.anime.hero.hosted.v1",
    "harbor.anime.toppicks.shown.v1",
    "harbor.anilist.collection.user",
    "harbor.dead-streams.v1",
    "harbor.calendar.webhook.last.v1",
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
