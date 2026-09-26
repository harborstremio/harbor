// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

import {
  decodeCloudPreferences,
  encodeCloudPreferences,
  hasCloudPreference,
} from "../src/lib/settings/cloud-preferences.ts";
import type { Settings } from "../src/lib/settings/types.ts";
import {
  configureRosterStore,
  rosterSettingsLinkState,
} from "../src/lib/profile-sync/roster-store.ts";

test("cloud preferences round-trip without credentials or device settings", () => {
  const local = {
    uiLanguage: "en",
    preferredSubLangs: ["Hungarian", "English"],
    autoSkipIntro: true,
    tmdbKey: "secret-tmdb-key",
    rdKey: "secret-debrid-key",
    traktAccessToken: "secret-token",
    mpvExtraOptions: "--unsafe-option",
    streamCacheDir: "C:/private/media",
  } as unknown as Settings;
  const wire = encodeCloudPreferences(local);
  const restored = decodeCloudPreferences(wire);
  assert.equal(restored?.autoSkipIntro, true);
  assert.deepEqual(restored?.preferredSubLangs, ["Hungarian", "English"]);
  for (const secret of ["secret-tmdb-key", "secret-debrid-key", "secret-token", "C:/private/media", "--unsafe-option"]) {
    assert.equal(wire.includes(secret), false);
  }
  assert.equal(hasCloudPreference({ autoSkipIntro: true }), true);
  assert.equal(hasCloudPreference({ tmdbKey: "not-synced" }), false);
});

test("cloud decoder ignores unknown fields and rejects invalid values", () => {
  const wire = JSON.stringify({
    version: 1,
    values: {
      autoSkipIntro: true,
      subFontSize: 100000,
      episodeLayout: "dangerous-layout",
      preferredSubLangs: ["English", 42],
      rdKey: "must-stay-local",
    },
  });
  assert.deepEqual(decodeCloudPreferences(wire), { autoSkipIntro: true });
  assert.equal(decodeCloudPreferences('{"version":2,"values":{"autoSkipIntro":true}}'), null);
  assert.equal(decodeCloudPreferences("x".repeat(20_001)), null);
});

test("a malformed cloud document cannot apply settings", () => {
  assert.equal(decodeCloudPreferences("not json"), null);
  assert.equal(decodeCloudPreferences(JSON.stringify({ version: 1, values: { rdKey: "secret" } })), null);
  assert.equal(decodeCloudPreferences(JSON.stringify({ version: 1, values: [] })), null);
});

test("settings link state reads the live roster before its storage mirror is persisted", () => {
  configureRosterStore({
    read: () => [{
      id: "new-profile",
      name: "New profile",
      avatar: null,
      color: "green",
      isPrimary: false,
      kid: null,
      hideContent: null,
      lockedTabs: null,
      settingsLinked: false,
      createdAt: 1,
    }],
    apply: () => {},
  });
  try {
    assert.equal(rosterSettingsLinkState("new-profile"), false);
    assert.equal(rosterSettingsLinkState("not-on-this-account"), null);
  } finally {
    configureRosterStore(null);
  }
});
