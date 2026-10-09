import test from "node:test";
import assert from "node:assert/strict";
import { MAJOR_UPDATE_BYTES, defaultLibraryBadges, libraryBadge, parseLibraryBadges } from "../src/lib/games/library-badges.ts";

const gigabytes = (count: number) => count * 1024 ** 3;

test("a pending Steam update is named by its size, not by the install state", () => {
  const installed = { state: "ready" } as const;
  assert.equal(libraryBadge({ ...installed, update: "queued", bytesToDownload: gigabytes(1) })?.badge, "updateQueued");
  assert.equal(libraryBadge({ ...installed, update: "queued", bytesToDownload: MAJOR_UPDATE_BYTES })?.badge, "majorUpdate");
  assert.equal(libraryBadge({ ...installed, update: "queued", bytesToDownload: gigabytes(40), bytesDownloaded: gigabytes(39) })?.badge, "updateQueued");
  assert.equal(libraryBadge({ ...installed, update: "queued" })?.badge, "updateQueued");
});

test("active work reports progress only when the provider gives both byte counts", () => {
  const downloading = libraryBadge({ state: "ready", update: "downloading", bytesToDownload: 400, bytesDownloaded: 100 });
  assert.equal(downloading?.badge, "downloading");
  assert.equal(downloading?.tone, "active");
  assert.equal(downloading?.progress, .25);
  assert.equal(libraryBadge({ state: "ready", update: "downloading" })?.progress, null);
  assert.equal(libraryBadge({ state: "ready", update: "downloading", bytesToDownload: 10, bytesDownloaded: 99 })?.progress, 1);
  assert.equal(libraryBadge({ state: "ready", update: "paused", bytesToDownload: 10, bytesDownloaded: 5 })?.tone, "pending");
});

test("every other reported lane maps to one badge, and a ready game gets none", () => {
  assert.equal(libraryBadge({ state: "ready", update: "validating" })?.badge, "validating");
  assert.equal(libraryBadge({ state: "ready", update: "repair" })?.badge, "repair");
  assert.equal(libraryBadge({ state: "ready", update: "uninstalling" })?.badge, "uninstalling");
  assert.equal(libraryBadge({ state: "setup" })?.badge, "needsSetup");
  assert.equal(libraryBadge({ state: "unavailable" })?.badge, "unavailable");
  assert.equal(libraryBadge({ state: "notInstalled" })?.badge, "notInstalled");
  assert.equal(libraryBadge({ state: "updating" })?.badge, "downloading");
  assert.equal(libraryBadge({ state: "ready" }), null);
  assert.equal(libraryBadge({ state: "ready", update: "none" }), null);
  assert.equal(libraryBadge({ state: "client" }), null);
  assert.equal(libraryBadge({ state: "unknown" }), null);
});

test("saved choices survive a partial or corrupt store without losing the defaults", () => {
  const defaults = defaultLibraryBadges();
  assert.equal(defaults.notInstalled, false);
  assert.equal(defaults.updateQueued, true);
  assert.deepEqual(parseLibraryBadges(null), defaults);
  assert.deepEqual(parseLibraryBadges("not json"), defaults);
  assert.deepEqual(parseLibraryBadges("[]"), defaults);
  assert.equal(parseLibraryBadges('{"updateQueued":false}').updateQueued, false);
  assert.equal(parseLibraryBadges('{"updateQueued":false}').majorUpdate, true);
  assert.equal(parseLibraryBadges('{"updateQueued":"no","nonsense":true}').updateQueued, true);
});
