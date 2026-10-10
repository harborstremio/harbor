import assert from "node:assert/strict";
import test from "node:test";
import { deferred, flushBridge, mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";

const reloads = (h) => h.commands.filter(
  ({ command, args }) => command === "mpv_command" && args.cmd?.[0] === "ao-reload",
);

for (const trigger of ["focus", "visibility"]) {
  test(`${trigger} restoration does not reset paused audio before resume`, async (t) => {
    let now = 0;
    t.mock.method(Date, "now", () => now);
    const h = mpvBridgeHarness();
    await h.bridge.load({ url: "https://media.example/current.mkv" });
    h.emit("pause", true);
    h.emitWindow("blur");
    h.emitVisibility("hidden");
    now = 140_000;
    if (trigger === "focus") h.emitWindow("focus");
    else h.emitVisibility("visible");
    h.runTimers();
    await flushBridge();
    assert.equal(reloads(h).length, 0);
    await h.bridge.play();
    assert.ok(h.commands.some(({ args }) => args.name === "pause" && args.value === false));
    h.emit("pause", false);
    h.emitEvent({ event: "playback-restart" });
    h.runTimers();
    await flushBridge();
    assert.equal(reloads(h).length, 0, "focus alone must not queue recovery for resume");
    await h.bridge.destroy();
  });
}

test("returning to active playback still recovers the audio output", async (t) => {
  let now = 0;
  t.mock.method(Date, "now", () => now);
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("pause", false);
  h.emitWindow("blur");
  h.emitVisibility("hidden");
  now = 140_000;
  h.emitWindow("focus");
  h.emitVisibility("visible");
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 1);
  await h.bridge.destroy();
});

test("pausing before the wake recovery timer fires cancels the speculative reset", async (t) => {
  let now = 0;
  t.mock.method(Date, "now", () => now);
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("pause", false);
  h.emitWindow("blur");
  now = 140_000;
  h.emitWindow("focus");
  h.emit("pause", true);
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 0);
  h.emit("pause", false);
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 0, "a cancelled wake reset must stay cancelled after resume");
  await h.bridge.destroy();
});

test("paused device changes defer all audio writes and recover once after mpv confirms resume", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("pause", true);
  h.emit("track-list", [{ id: 1, type: "audio", selected: true }]);
  h.emit("audio-device-list", [{ name: "auto" }]);
  h.emit("audio-device-list", [{ name: "auto" }, { name: "wasapi/test" }]);
  const beforeResume = h.commands.length;
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 0);
  assert.equal(h.commands.length, beforeResume);
  await h.bridge.play();
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 0, "the play request alone cannot authorize a reload");
  h.emit("pause", false);
  h.emitEvent({ event: "playback-restart" });
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 1);
  const index = h.commands.indexOf(reloads(h)[0]);
  assert.ok(h.commands.slice(index + 1).some(({ args }) => args.name === "aid" && args.value === "1"));
  h.emit("pause", false);
  h.emitEvent({ event: "playback-restart" });
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 1, "resume notifications cannot repeat the recovery");
  await h.bridge.destroy();
});

test("destroy cancels pending audio device recovery", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("pause", false);
  h.emit("audio-device-list", [{ name: "auto" }]);
  await h.bridge.destroy();
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 0);
});

test("wake notifications cannot cancel a pending device change recovery", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("pause", false);
  h.emit("audio-device-list", [{ name: "auto" }]);
  h.emitVisibility("visible");
  h.emit("pause", true);
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 0);
  h.emit("pause", false);
  h.runTimers();
  await flushBridge();
  assert.equal(reloads(h).length, 1);
  await h.bridge.destroy();
});

for (const transition of ["load", "destroy", "player-failure", "end-file"]) {
  test(`${transition} discards recovery deferred during a pause`, async () => {
    const h = mpvBridgeHarness();
    await h.bridge.load({ url: "https://media.example/current.mkv" });
    h.emit("pause", true);
    h.emit("audio-device-list", [{ name: "auto" }]);
    if (transition === "load") await h.bridge.load({ url: "https://media.example/next.mkv" });
    else if (transition === "destroy") await h.bridge.destroy();
    else h.emitEvent({ event: transition, reason: transition === "end-file" ? "eof" : "unavailable" });
    h.emit("pause", false);
    h.emitEvent({ event: "playback-restart" });
    h.runTimers();
    await flushBridge();
    assert.equal(reloads(h).length, 0);
    if (transition !== "destroy") await h.bridge.destroy();
  });
}

test("a stream change invalidates recovery waiting for an audio property write", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("pause", false);
  const write = deferred();
  h.writeWith((name) => name === "audio-device" ? write.promise : Promise.resolve());
  h.emit("audio-device-list", [{ name: "auto" }]);
  h.runTimers();
  await flushBridge();
  await h.bridge.load({ url: "https://media.example/next.mkv" });
  h.emit("pause", false);
  write.resolve();
  await flushBridge();
  assert.equal(reloads(h).length, 0);
  await h.bridge.destroy();
});
