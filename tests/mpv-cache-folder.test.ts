import assert from "node:assert/strict";
import test from "node:test";
import { flushBridge, mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";

test("the chosen playback cache folder reaches native startup", async () => {
  const h = mpvBridgeHarness();
  const bridge = h.createBridge({ anime4k: false, hdrToSdr: false, cacheDir: " W:/video-cache " });
  await bridge.load({ url: "https://example.com/video.mkv" });
  const start = h.commands.find(c => c.command === "mpv_start");
  assert.equal((start?.args.args as { cacheDir: string }).cacheDir, "W:/video-cache");
  bridge.destroy();
  await flushBridge();
});

for (const nextFolder of ["W:/second-cache", ""]) {
  test(`changing the cache folder to ${nextFolder || "default"} recreates a retained player`, async () => {
    const h = mpvBridgeHarness();
    h.invokeWith(async command => command === "mpv_release_media" ? true : undefined);
    const options = { anime4k: false, hdrToSdr: false, embed: true, cacheDir: "W:/first-cache" };
    const first = h.createBridge(options);
    await first.load({ url: "https://example.com/first.mkv" });
    first.destroy();
    await flushBridge();
    const same = h.createBridge(options);
    await same.load({ url: "https://example.com/second.mkv" });
    assert.equal(h.commands.filter(c => c.command === "mpv_start").length, 1, "same folder can reuse");
    same.destroy();
    await flushBridge();
    const changed = h.createBridge({ ...options, cacheDir: nextFolder });
    await changed.load({ url: "https://example.com/third.mkv" });
    const starts = h.commands.filter(c => c.command === "mpv_start");
    assert.equal(starts.length, 2, "do not retain the old native cache directory");
    assert.equal((starts[1].args.args as { cacheDir: string | null }).cacheDir, nextFolder || null);
    changed.destroy();
    await flushBridge();
  });
}
