import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStreamBlockerRules } from "../scripts/build-stream-blocker.mjs";

const resource = new URL("../src-tauri/resources/harbor-stream-blocker/", import.meta.url);
const read = (name) => readFileSync(new URL(name, resource), "utf8");

test("bundled request rules match Harbor's local blocklist and stay provider scoped", () => {
  const source = readFileSync(new URL("../src/lib/privacy/blocklist.ts", import.meta.url), "utf8");
  const rules = buildStreamBlockerRules(source);
  assert.deepEqual(JSON.parse(read("rules.json")), rules);
  assert(rules.length > 0);
  assert(rules.some((rule) => rule.condition.urlFilter === "||doubleclick.net^"));
  assert(!rules.some((rule) => ["||graph.facebook.com^", "||yandex.ru^"].includes(rule.condition.urlFilter)));
  assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.equal(rule.action.type, "block");
    assert.deepEqual(rule.condition.initiatorDomains, ["twitch.tv", "kick.com"]);
    assert.deepEqual(rule.condition.excludedResourceTypes, ["main_frame"]);
  }
});

test("blocker generation rejects missing lists and protected playback hosts", () => {
  assert.throws(() => buildStreamBlockerRules(""), /not found/);
  for (const domain of ["twitch.tv", ".ttvnw.net", "player.kick.com", "cloudfront.net"]) {
    assert.throws(() => buildStreamBlockerRules(`const BLOCKED_HOSTS = new Set(["${domain}"]); const BLOCKED_SUFFIXES = [];`), /Refusing to block/);
  }
});

test("manifest uses local, early Twitch hooks and a bundled MIT licensed script", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["declarativeNetRequest"]);
  assert.deepEqual(manifest.content_scripts, [{
    matches: ["https://*.twitch.tv/*"], js: ["twitch-vaft.js"],
    run_at: "document_start", world: "MAIN", all_frames: true,
  }]);
  for (const rule of manifest.declarative_net_request.rule_resources) {
    assert.equal(rule.enabled, true);
    assert.doesNotThrow(() => JSON.parse(read(rule.path)));
  }
  assert.match(read("LICENSE-TwitchAdSolutions"), /MIT License/);
  const script = read("twitch-vaft.js");
  assert.match(script, /@version\s+37\.0\.0/);
  assert.match(read("README.md"), /c51ef2fe8f667f9dc9216eb550924cf0d732ce27/);
});
