// @ts-expect-error Node tests run outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node tests run outside the browser-only tsconfig.
import assert from "node:assert/strict";
import { deferred, flushBridge, mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";
import type { PlayerEmbedRect } from "../src/lib/player/bridge.ts";
import { isLivePlaybackSrc } from "../src/lib/player/live-src.ts";

const rect = (left = 0): PlayerEmbedRect => ({
  cssLeft: left, cssTop: 80, cssWidth: 440, cssHeight: 247.5, cssViewW: 1400, cssViewH: 900,
});
async function setup() {
  let bounds = rect();
  const h = mpvBridgeHarness(undefined, {
    anime4k: false, hdrToSdr: true, embed: true, getEmbedRect: () => bounds,
  });
  await h.bridge.load({ url: "fixture.ts", isLive: true });
  h.commands.length = 0;
  return { ...h, setBounds(value: PlayerEmbedRect) { bounds = value; } };
}
test("continuous drag sends every available frame without waiting for the pointer to stop", async () => {
  const h = await setup();
  for (const left of [50, 200, 450, 650]) {
    h.setBounds(rect(left));
    h.emitWindow("harbor:mpv-refresh-geom");
    await flushBridge();
  }
  assert.deepEqual(h.commands.filter(c => c.command === "mpv_set_geometry").map(c => (c.args.geom as PlayerEmbedRect).cssLeft), [50, 200, 450, 650]);
  h.bridge.destroy();
});
test("fast drag commits chrome after native geometry, coalesces pending positions, and keeps the final release", async () => {
  const h = await setup();
  const gate = deferred();
  const committed: number[] = [];
  h.invokeWith(async command => { if (command === "mpv_set_geometry") await gate.promise; });
  const move = (left: number) => h.bridge.moveEmbeddedSurface!(rect(left), () => {
    h.setBounds(rect(left));
    committed.push(left);
    h.emitWindow("harbor:mpv-refresh-geom");
  });
  move(100);
  move(300);
  move(700);
  await flushBridge();
  assert.deepEqual(committed, []);
  assert.equal(h.commands.filter(c => c.command === "mpv_set_geometry").length, 1);
  gate.resolve();
  await flushBridge();
  assert.deepEqual(committed, [100, 700]);
  assert.deepEqual(h.commands.filter(c => c.command === "mpv_set_geometry").map(c => (c.args.geom as PlayerEmbedRect).cssLeft), [100, 700]);
  move(700); // Pointer-up at the same position must still complete the hook's state commit.
  await flushBridge();
  assert.deepEqual(committed, [100, 700, 700]);
  h.bridge.destroy();
});
test("forced resize repairs unchanged bounds and destroy drops in-flight and queued drag commits", async () => {
  const h = await setup();
  h.emitWindow("harbor:mpv-refresh-geom");
  await flushBridge();
  assert.equal(h.commands.length, 0);
  h.emitWindow("harbor:mpv-force-geom");
  h.runFrame();
  await flushBridge();
  assert.equal(h.commands.filter(c => c.command === "mpv_set_geometry").length, 1);
  const gate = deferred();
  let committed = false;
  h.invokeWith(async command => { if (command === "mpv_set_geometry") await gate.promise; });
  h.bridge.moveEmbeddedSurface!(rect(100), () => { committed = true; });
  h.bridge.moveEmbeddedSurface!(rect(400), () => { committed = true; });
  h.bridge.destroy();
  gate.resolve();
  h.runFrame();
  await flushBridge();
  assert.equal(committed, false);
  assert.equal(h.bridge.moveEmbeddedSurface!(rect(700), () => {}), false);
  assert.equal(h.commands.filter(c => c.command === "mpv_set_geometry").length, 2);
});
test("Sports addons remain live in dock and fullscreen while recorded games keep movie controls", () => {
  const meta = { id: "sports:fixture", type: "movie" };
  for (const sportsDocked of [true, false]) {
    const live = { meta, isLive: true, sportsDocked };
    assert.equal(isLivePlaybackSrc(live), true);
  }
  assert.equal(isLivePlaybackSrc({ meta }), false);
  assert.equal(isLivePlaybackSrc({ meta: { id: "iptv:fixture" } }), true);
  assert.equal(isLivePlaybackSrc({ meta: { id: "addon:channel", type: "tv" } }), true);
});
