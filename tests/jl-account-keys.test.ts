import assert from "node:assert/strict";
import test from "node:test";
import { hashValue, mergeKeys, settingKeyFromSecret } from "../src/lib/jl/account/keys.ts";

test("a new device takes the account's keys, and its own keys go up", () => {
  const out = mergeKeys({}, { tmdbKey: "local-tmdb" }, { rdKey: "rd-123" });
  assert.deepEqual(out.apply, { rdKey: "rd-123" });
  assert.deepEqual(out.push, { tmdbKey: "local-tmdb" });
  assert.equal(out.base.rdKey, hashValue("rd-123"));
});

test("a key cleared on this device is cleared in the account", () => {
  const base = { rdKey: hashValue("rd-123") };
  const out = mergeKeys(base, { rdKey: "" }, { rdKey: "rd-123" });
  assert.deepEqual(out.push, { rdKey: "" });
  assert.deepEqual(out.apply, {});
  assert.equal(out.base.rdKey, undefined);
});

test("a key changed on another device replaces the old one here", () => {
  const base = { tbKey: hashValue("old") };
  const out = mergeKeys(base, { tbKey: "old" }, { tbKey: "new" });
  assert.deepEqual(out.apply, { tbKey: "new" });
  assert.deepEqual(out.push, {});
});

test("when both sides changed, the account wins", () => {
  const base = { tbKey: hashValue("old") };
  const out = mergeKeys(base, { tbKey: "mine" }, { tbKey: "theirs" });
  assert.deepEqual(out.apply, { tbKey: "theirs" });
});

test("only known setting secrets are read back", () => {
  assert.equal(settingKeyFromSecret("setting:rdKey"), "rdKey");
  assert.equal(settingKeyFromSecret("setting:theme"), null);
  assert.equal(settingKeyFromSecret("rdKey"), null);
});
