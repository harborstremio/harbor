// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import test from "node:test";
import { canOpenProfile, registerProfileDestination } from "../src/lib/social/open-profile.ts";

test("profile actions compare normalized destination and meaningful overlay outcome", () => {
  let current: string | null = "Alice";
  const release = registerProfileDestination(() => current);
  assert.equal(canOpenProfile(" alice "), false);
  assert.equal(canOpenProfile("bob"), true);
  assert.equal(canOpenProfile("alice", { fromOverlay: true }), true);
  assert.equal(canOpenProfile(" "), false);
  current = null;
  assert.equal(canOpenProfile("alice"), true);
  release();
});

test("cleanup from an old navigation owner cannot erase its replacement", () => {
  const old = registerProfileDestination(() => "alice");
  const next = registerProfileDestination(() => "bob");
  old();
  assert.equal(canOpenProfile("bob"), false);
  next();
});
