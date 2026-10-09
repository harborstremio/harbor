import assert from "node:assert/strict";
import test from "node:test";
import { mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";

test("first native playback receives resume in mpv_start", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv", startAtSec: 605 });
  const start = h.commands.find((c) => c.command === "mpv_start");
  assert.equal((start?.args.args as any)?.startAtSec, 605);
});

test("reused native playback loads at the saved position and resets it for the next file", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "first.mkv", startAtSec: 605 });
  await h.bridge.load({ url: "second.mkv", startAtSec: 300 });
  await h.bridge.load({ url: "third.mkv" });
  const loads = h.commands.filter((c) => c.command === "mpv_command" && (c.args.cmd as any[])?.[0] === "loadfile");
  assert.deepEqual(loads.map((c) => c.args.cmd), [
    ["loadfile", "second.mkv", "replace", 0, "start=300"],
    ["loadfile", "third.mkv", "replace", 0, "start=0"],
  ]);
});
