import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticNotificationPermission } from "../src/lib/notification-permission.ts";

test("native permission governs native delivery without confusing WebView browser denial", async () => {
  assert.equal(await automaticNotificationPermission(true, "denied", async () => true), true);
  assert.equal(await automaticNotificationPermission(true, "granted", async () => false), false);
  assert.equal(await automaticNotificationPermission(true, "granted", async () => null), false);
  assert.equal(await automaticNotificationPermission(true, "granted", async () => { throw Error("unavailable"); }), false);
});

test("browser notifications use browser permission and never query or request native permission", async () => {
  const native = async () => { throw Error("must not be called"); };
  for (const value of [undefined, "default", "denied"] as const) assert.equal(await automaticNotificationPermission(false, value, native), false);
  assert.equal(await automaticNotificationPermission(false, "granted", native), true);
});
