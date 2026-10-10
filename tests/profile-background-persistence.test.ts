// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import "./_indexeddb-stub.ts";
import {
  deleteProfileBgImage,
  loadBgImage,
  saveBgImage,
  themeKvPut,
} from "../src/lib/theme-storage.ts";

test("profiles have independent backgrounds", async () => {
  await saveBgImage("image_a", "profileA");
  await saveBgImage("image_b", "profileB");
  assert.equal(await loadBgImage("profileA"), "image_a");
  assert.equal(await loadBgImage("profileB"), "image_b");
});

test("switching profiles preserves each profile's background", async () => {
  await saveBgImage("image_a", "profileA");
  await saveBgImage("image_b", "profileB");

  assert.equal(await loadBgImage("profileA"), "image_a");
  assert.equal(await loadBgImage("profileB"), "image_b");
  assert.equal(await loadBgImage("profileA"), "image_a");
});

test("deleting a profile removes only its background", async () => {
  await saveBgImage("image_a", "profileA");
  await saveBgImage("image_b", "profileB");

  await deleteProfileBgImage("profileA");

  assert.equal(await loadBgImage("profileA"), null);
  assert.equal(await loadBgImage("profileB"), "image_b");
});

test("saving null clears a profile's background", async () => {
  await saveBgImage("image_a", "profileA");
  await saveBgImage(null, "profileA");
  assert.equal(await loadBgImage("profileA"), null);
});

test("a pre-profile-scoping global background migrates into the first profile that loads it", async () => {
  await themeKvPut("bg", "legacy_image");

  assert.equal(await loadBgImage("profileNew"), "legacy_image");
  // The global key is retired after the first migration, so a second
  // profile finds nothing left to claim.
  assert.equal(await loadBgImage("profileOther"), null);
  // The migrated profile keeps its (now scoped) image on subsequent loads.
  assert.equal(await loadBgImage("profileNew"), "legacy_image");
});
