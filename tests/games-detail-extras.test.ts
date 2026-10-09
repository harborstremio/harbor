import assert from "node:assert/strict";
import test from "node:test";
import { detailExtrasRequest, parseDetailExtras, parseDeckCompatibility, parsePublicAchievements, parseGameBroadcasts, requirementRows } from "../src/lib/games/detail-extras-data";

test("supplemental details verify app identity and keep exact language support", () => {
  const item = { appid: 42, success: 1, supported_languages: [{ elanguage: 0, eadditionallanguage: -1, supported: true, full_audio: true, subtitles: true }, { elanguage: 2, eadditionallanguage: -1, supported: true, subtitles: true }, { elanguage: 999, supported: true }, { elanguage: 1, supported: false }, { elanguage: 0, supported: true }], categories: { controller_categoryids: [18] } };
  const extras = parseDetailExtras({ response: { store_items: [item] } }, 42);
  assert.deepEqual(extras.languages, [{ code: "en", interface: true, audio: true, subtitles: true }, { code: "fr", interface: true, audio: false, subtitles: true }]);
  assert.equal(extras.controller, "partial"); assert.equal(extras.rating, undefined);
  assert.throws(() => parseDetailExtras({ response: { store_items: [item] } }, 41));
  assert.equal(new URL(detailExtrasRequest(42)).hostname, "api.steampowered.com");
  assert.throws(() => detailExtrasRequest(-1));
});

test("rating art must come from Steam and missing support is never invented", () => {
  const raw = { appid: 42, success: 1, game_rating: { rating: "m", image_url: "public/shared/images/game_ratings/ESRB/m.png", descriptors: ["Violence"], interactive_elements: "Users Interact" } };
  const value = parseDetailExtras({ response: { store_items: [raw] } }, 42);
  assert.equal(value.rating?.agency, "ESRB"); assert.equal(value.rating?.image, "https://store.akamai.steamstatic.com/public/shared/images/game_ratings/ESRB/m.png"); assert.equal(value.controller, undefined);
  assert.equal(parseDetailExtras({ response: { store_items: [{ ...raw, game_rating: { ...raw.game_rating, image_url: "https://evil.test/ESRB/m.png" } }] } }, 42).rating, undefined);
});

const publicPage = `<a href="https://steamcommunity.com/app/42/">Game</a><div class="achieveRow "><div class="achieveImgHolder"><img src="https://shared.akamai.steamstatic.com/community_assets/images/apps/42/icon.jpg"></div><div class="achievePercent">85.4%</div><div class="achieveTxt"><h3>First &amp; best</h3><h5>Reach &lt;the&gt; end.</h5></div></div>`;
test("public achievement rows preserve global rates, sanitize text and reject foreign artwork", () => {
  assert.deepEqual(parsePublicAchievements(publicPage, 42), [{ name: "First & best", description: "Reach <the> end.", icon: "https://shared.akamai.steamstatic.com/community_assets/images/apps/42/icon.jpg", percent: 85.4 }]);
  assert.equal(parsePublicAchievements(publicPage + publicPage, 42).length, 1);
  assert.throws(() => parsePublicAchievements(publicPage, 41));
  assert.throws(() => parsePublicAchievements(publicPage.replace("/apps/42/", "/apps/43/"), 42));
  assert.throws(() => parsePublicAchievements("<html>Sign in</html>", 42));
});

test("hidden achievement descriptions stay blank and malformed percentages stay unknown", () => {
  const result = parsePublicAchievements(publicPage.replace("Reach &lt;the&gt; end.", "").replace("85.4%", "200%"), 42);
  assert.equal(result[0].description, ""); assert.equal(result[0].percent, undefined);
});

test("Deck compatibility validates identity and distinguishes unknown from unsupported", () => {
  assert.equal(parseDeckCompatibility({ success: 1, results: { appid: 42, resolved_category: 0 } }, 42), "unknown");
  assert.equal(parseDeckCompatibility({ success: 1, results: { appid: 42, resolved_category: 2 } }, 42), "playable");
  assert.throws(() => parseDeckCompatibility({ success: 1, results: { appid: 41, resolved_category: 3 } }, 42));
  assert.throws(() => parseDeckCompatibility({ success: 1, results: { appid: 42, resolved_category: 9 } }, 42));
});

test("broadcast feed retains app identity, uint64 Steam identity, and only verified CDN thumbnails", () => {
  const item = { appid: 42, broadcaststeamid: "76561199682269519", viewer_count: 100, store_title: "Watch the developer", thumbnail_http_address: "https://steambroadcast.akamaized.net/broadcast/76561199682269519/123/thumbnail/", left_panel: "https://shared.akamai.steamstatic.com/left.jpg" };
  const result = parseGameBroadcasts({ success: 1, filtered: [item, item, { ...item, appid: 43, broadcaststeamid: "76561199682269520", thumbnail_http_address: "https://evil.test/thumbnail" }] });
  assert.equal(result.length, 2); assert.equal(result[0].url, "https://steamcommunity.com/broadcast/watch/76561199682269519"); assert.equal(result[1].appId, 43); assert.equal(result[1].thumbnail, "");
  assert.throws(() => parseGameBroadcasts({ success: 0 }));
});

test("requirement rows retain complete specs and unmatched publisher notes", () => {
  assert.deepEqual(requirementRows("Minimum:\nRequires a 64-bit processor and operating system\nOS: Windows 10\nGraphics: GTX 770\nStorage: 150 GB\nOther publisher detail"), {
    specs: [{ label: "OS", value: "Windows 10" }, { label: "Graphics", value: "GTX 770" }, { label: "Storage", value: "150 GB" }],
    notes: ["Requires a 64-bit processor and operating system", "Other publisher detail"],
  });
});
