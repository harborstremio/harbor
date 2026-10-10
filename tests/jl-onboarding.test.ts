import assert from "node:assert/strict";
import test from "node:test";
import {
  JL_DEBRID_OPTIONS,
  JL_TORRENTIO_MANIFEST_URL,
  describeDebridVerification,
  summarizeJlSetup,
  verificationFromFailure,
} from "../src/lib/jl/onboarding.ts";

const NOW_MS = Date.UTC(2026, 9, 6);
const NOW_S = Math.floor(NOW_MS / 1000);

test("a saved but unchecked key is never reported as active", () => {
  const status = describeDebridVerification({ state: "saved" }, NOW_MS);
  assert.equal(status.label, "Key saved — not verified");
  assert.equal(status.tone, "warn");
});

test("a verified premium account reports whole days remaining", () => {
  const status = describeDebridVerification(
    { state: "verified", account: { premium: true, premiumUntil: NOW_S + 30 * 86400 + 3600 } },
    NOW_MS,
  );
  assert.equal(status.label, "Connected — premium, {days} days left");
  assert.deepEqual(status.vars, { days: 30 });
  assert.equal(status.tone, "good");
});

test("an expired premium date clamps to zero days", () => {
  const status = describeDebridVerification(
    { state: "verified", account: { premium: true, premiumUntil: NOW_S - 86400 } },
    NOW_MS,
  );
  assert.deepEqual(status.vars, { days: 0 });
});

test("a verified account without premium is a warning, not a success", () => {
  const status = describeDebridVerification(
    { state: "verified", account: { premium: false } },
    NOW_MS,
  );
  assert.equal(status.tone, "warn");
});

test("only auth failures mark a key as rejected", () => {
  assert.deepEqual(verificationFromFailure(401), { state: "rejected" });
  assert.deepEqual(verificationFromFailure(403), { state: "rejected" });
  assert.deepEqual(verificationFromFailure(0), { state: "unreachable" });
  assert.deepEqual(verificationFromFailure(503), { state: "unreachable" });
});

test("the onboarding Torrentio manifest carries no debrid configuration", () => {
  assert.equal(JL_TORRENTIO_MANIFEST_URL, "https://torrentio.strem.fun/manifest.json");
  for (const option of JL_DEBRID_OPTIONS) {
    assert.ok(option.keyUrl.startsWith("https://"));
  }
});

test("setup summary counts playable playlists and connected services", () => {
  const summary = summarizeJlSetup({
    playlists: [{ kind: "m3u" }, { kind: "xtream" }, { kind: "epg" }, {}],
    rdKey: "  ",
    tbKey: "abc",
    torrentioInstalled: true,
  });
  assert.deepEqual(summary, { playlists: 3, debrid: ["torbox"], torrentio: true });
});
