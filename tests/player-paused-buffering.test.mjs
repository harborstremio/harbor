import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";

for (const paused of [true, false]) {
  test(`MPV recovery clears a stalled buffer while paused=${paused}`, async () => {
    const h = mpvBridgeHarness();
    await h.bridge.load({ url: "https://media.example/current.mkv" });
    h.emit("pause", paused);
    h.emit("paused-for-cache", true);
    assert.equal(h.snapshot().buffering, true);
    h.emitEvent({ event: "playback-restart" });
    assert.equal(h.snapshot().buffering, false);
    assert.equal(h.snapshot().status, paused ? "paused" : "playing");
    h.emit("paused-for-cache", true);
    assert.equal(h.snapshot().buffering, true, "a later stall is still reported");
    await h.bridge.destroy();
  });
}

test("MPV restart from another media path cannot clear the current stall", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "https://media.example/current.mkv" });
  h.emit("path", "https://media.example/previous.mkv");
  h.emit("paused-for-cache", true);
  h.emitEvent({ event: "playback-restart" });
  assert.equal(h.snapshot().buffering, true);
  await h.bridge.destroy();
});

// Execute the bridge's actual snapshot callback with controlled media-element state.
function html5SnapshotHarness() {
  const source = readFileSync(
    new URL("../src/lib/player/html5/bridge.ts", import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile("bridge.ts", source, ts.ScriptTarget.Latest, true);
  let refresh;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "refreshSnapshot") {
      refresh = node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(refresh);
  const video = {
    currentTime: 10,
    duration: 100,
    readyState: 0,
    paused: true,
    ended: false,
    muted: false,
    playbackRate: 1,
    videoWidth: 0,
    videoHeight: 0,
    error: null,
  };
  const snap = { firstFrameReady: false };
  const run = new Function(
    "video",
    "snap",
    `
    const HTMLMediaElement = { HAVE_FUTURE_DATA: 3, HAVE_CURRENT_DATA: 2 };
    const probeAudio = () => {}, bufferedAhead = () => 0, readHlsAudioTracks = () => null;
    const readAudioTracks = () => [], readCustomSubtitleTracks = () => [];
    const markPlaybackTrace = () => {}, finishPlaybackTrace = () => {}, emit = () => {};
    const pendingVolume = 1, subDelaySec = 0, mapErrorCode = code => code;
    let activeTraceId = null;
    return (${refresh});
  `,
  )(video, snap);
  return { video, snap, run };
}

test("HTML5 stays loading until a frame, then preserves paused state through a stall", () => {
  const h = html5SnapshotHarness();
  h.run();
  assert.equal(h.snap.status, "loading");
  Object.assign(h.video, { readyState: 4, videoWidth: 1920, videoHeight: 1080, paused: false });
  h.run();
  assert.equal(h.snap.status, "playing");
  assert.equal(h.snap.buffering, false);
  Object.assign(h.video, { readyState: 1, paused: true });
  h.run();
  assert.equal(h.snap.status, "paused");
  assert.equal(h.snap.buffering, true);
  h.video.readyState = 3;
  h.run();
  assert.equal(h.snap.status, "paused");
  assert.equal(h.snap.buffering, false);
});

test("HTML5 reports an active stall and does not buffer after playback ends", () => {
  const h = html5SnapshotHarness();
  Object.assign(h.video, { readyState: 2, videoWidth: 1920, paused: false });
  h.run();
  assert.equal(h.snap.status, "playing");
  assert.equal(h.snap.buffering, true);
  Object.assign(h.video, { readyState: 1, paused: true, ended: true });
  h.run();
  assert.equal(h.snap.status, "ended");
  assert.equal(h.snap.buffering, false);
});
