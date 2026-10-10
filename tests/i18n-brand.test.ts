import test from "node:test";
import assert from "node:assert/strict";
import { applyBrand } from "../src/lib/i18n/brand.ts";
import { defaultAvatarFor } from "../src/lib/avatars/default-avatar.ts";

test("the product name is rewritten in resolved strings", () => {
  assert.equal(applyBrand("Close Harbor?", "en"), "Close JL Media Vision?");
  assert.equal(applyBrand("Harbor's player.", "en"), "JL Media Vision's player.");
  assert.equal(
    applyBrand("Installed: Harbor {version}", "en"),
    "Installed: JL Media Vision {version}",
  );
  assert.equal(applyBrand("Harbor-Konto", "de"), "JL Media Vision-Konto");
  assert.equal(applyBrand("Harbor에서", "ko"), "JL Media Vision에서");
  assert.equal(applyBrand("他のHarborの", "ja"), "他のJL Media Visionの");
  assert.equal(applyBrand("War Harbors ursprüngliche", "de"), "War JL Media Visions ursprüngliche");
  assert.equal(applyBrand("Saves to Pictures/Harbor.", "en"), "Saves to Pictures/JL Media Vision.");
});

test("hosts, paths and identifiers are left alone", () => {
  for (const s of [
    "harbor.site",
    "https://example.com/Harbor/x",
    "see www.example.com/Harbor",
    "games.unified.playtime.zeroHarbor",
    "HarborDVR",
    "Harbor.exe",
  ]) {
    assert.equal(applyBrand(s, "en"), s);
  }
});

test("a profile without a picture gets a stable JL avatar", () => {
  const a = defaultAvatarFor("profile-1");
  assert.match(a ?? "", /^\/avatars\/jl\/jl_[a-z_]+\.webp$/);
  assert.equal(defaultAvatarFor("profile-1"), a);
  assert.equal(defaultAvatarFor(null), null);
  const picks = new Set(["a", "b", "c", "d", "e", "f"].map((id) => defaultAvatarFor(id)));
  assert.ok(picks.size > 1);
});
