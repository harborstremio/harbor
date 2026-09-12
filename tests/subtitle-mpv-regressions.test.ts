// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  mpvBridgeHarness,
  deferred,
  flushBridge,
  playerSnapshotChanged,
} from "./helpers/mpv-bridge-harness.ts";
import { emptySnapshot } from "../src/lib/player/bridge.ts";

const tracks = [
  { type: "sub", id: 1, lang: "en", selected: true },
  { type: "sub", id: 2, lang: "ar", selected: false },
];

for (const prefs of [
  { volume: 0.35, muted: false },
  { volume: 1, muted: true },
]) {
  test(`mpv initial snapshot stays immutable with saved ${JSON.stringify(prefs)}`, async () => {
    const h = mpvBridgeHarness(prefs);
    const first = h.snapshot();
    await h.bridge.load({ url: "fixture.mkv" });
    h.emit("sub-text", "first cue");
    assert.equal(first.status, "idle");
    assert.equal(first.subText, "");
    assert.equal(first.volume, prefs.volume);
    const firstCue = h.snapshot();
    h.emit("sub-text", "second cue");
    assert.equal(firstCue.subText, "first cue");
    assert.equal(h.snapshot().subText, "second cue");
    h.emit("sub-text", "");
    assert.equal(h.snapshot().subText, "");
    h.emit("secondary-sub-text", "second language");
    assert.equal(h.snapshot().secondarySubText, "second language");
  });
}

test("a pending manual pick is not confirmed until mpv accepts it", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  const blocked = deferred();
  h.resetWith(() => blocked.promise);
  h.bridge.setSubtitleTrack("2");
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "1");
  blocked.resolve();
  await flushBridge();
  assert.deepEqual(h.picks(), [2]);
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "2");
});

test("failed selection leaves the confirmed track selected and reports the failure", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  h.writeWith(async (name) => {
    if (name === "sid") throw new Error("fixture rejection");
  });
  h.bridge.setSubtitleTrack("2");
  await flushBridge();
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "1");
  assert.deepEqual(h.errors, ["selection-failed"]);
  h.writeWith(async () => {});
  h.bridge.setSubtitleTrack("2");
  await flushBridge();
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "2");
});

test("player subscription sees consecutive cues, clears and seeks without mouse activity", async () => {
  const h = mpvBridgeHarness();
  const changed = playerSnapshotChanged();
  let previous = emptySnapshot;
  const rendered: string[] = [];
  h.bridge.subscribe((next) => {
    if (!changed(previous, next)) return;
    previous = next;
    rendered.push(`${next.subText}|${next.secondarySubText}`);
  });
  await h.bridge.load({ url: "fixture.mkv" });
  rendered.length = 0;
  h.emit("time-pos", 1);
  h.emit("sub-text", "first cue");
  h.emit("time-pos", 2);
  h.emit("sub-text", "second cue");
  h.emit("secondary-sub-text", "Arabic cue");
  h.emit("sub-text", "");
  h.emit("secondary-sub-text", "");
  h.bridge.seek(1);
  h.emit("sub-text", "first cue");
  assert.deepEqual(rendered, [
    "first cue|",
    "second cue|",
    "second cue|Arabic cue",
    "|Arabic cue",
    "|",
    "first cue|",
  ]);
});

test("track updates and automatic/restore picks cannot cancel a pending manual pick", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  const blocked = deferred();
  h.resetWith(() => blocked.promise);
  h.bridge.setSubtitleTrack("1", "automatic");
  await flushBridge();
  h.bridge.setSubtitleTrack("2");
  for (let i = 0; i < 10; i += 1) {
    h.emit("track-list", tracks);
    h.bridge.setSubtitleTrack("1", "automatic");
    h.bridge.setSubtitleTrack("1", "restore");
  }
  assert.equal(h.bridge.canAutoSelectSubtitle?.(), false);
  blocked.resolve();
  await flushBridge();
  assert.deepEqual(h.picks(), [2]);
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "2");
});

test("repeated pending picks run one transition while distinct manual picks keep their order", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  const blocked = deferred();
  h.resetWith(() => blocked.promise);
  for (let i = 0; i < 10; i += 1) h.bridge.setSubtitleTrack("2");
  h.bridge.setSubtitleTrack("1");
  h.bridge.setSubtitleTrack("2");
  blocked.resolve();
  await flushBridge();
  assert.deepEqual(h.picks(), [2, 1, 2]);
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "2");
});

test("manual Off stays off when a delayed download and automatic discovery finish", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  const download = deferred<{ playableUrl: string }>();
  h.prepareWith(() => download.promise);
  const pending = h.bridge.addSubtitle("https://example.test/sub.srt", "ar", "Fixture", true);
  h.bridge.setSubtitleTrack(null);
  h.bridge.setSubtitleTrack("1", "automatic");
  download.resolve({ playableUrl: "fixture.srt" });
  assert.equal(await pending, true);
  await h.bridge.addSubtitle("late.srt", "ar", "Late discovery", true, undefined, "automatic");
  await flushBridge();
  assert.deepEqual(h.picks(), ["no"]);
  const adds = h.commands.filter(({ command }) => command === "mpv_sub_add");
  assert.equal(adds.length, 2);
  assert.ok(adds.every(({ args }) => args.select === false));
  assert.equal(
    h.snapshot().subtitleTracks.some((track) => track.selected),
    false,
  );
});

test("a delayed manual download cannot replace a newer manual track", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  const download = deferred<{ playableUrl: string }>();
  h.prepareWith(() => download.promise);
  const pending = h.bridge.addSubtitle("https://example.test/sub.srt", "ar", "Fixture", true);
  h.bridge.setSubtitleTrack("2");
  download.resolve({ playableUrl: "fixture.srt" });
  assert.equal(await pending, true);
  await flushBridge();
  assert.deepEqual(h.picks(), [2]);
  assert.equal(h.commands.find(({ command }) => command === "mpv_sub_add")?.args.select, false);
});

test("automatic upgrades and remembered selections work until a manual choice, and reset per media", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  h.bridge.setSubtitleTrack("1", "automatic");
  await flushBridge();
  h.bridge.setSubtitleTrack("2", "automatic");
  await flushBridge();
  assert.equal(h.bridge.canAutoSelectSubtitle?.(), true);
  h.bridge.setSubtitleTrack(null);
  await flushBridge();
  assert.equal(h.bridge.canAutoSelectSubtitle?.(), false);
  await h.bridge.load({ url: "next-episode.mkv" });
  h.emit("track-list", tracks);
  h.bridge.setSubtitleTrack("2", "restore");
  await flushBridge();
  assert.equal(h.bridge.canAutoSelectSubtitle?.(), true);
  assert.deepEqual(h.picks(), [1, 2, "no", "no", 2]);
});

test("media changes invalidate waiting subtitle transitions and discard old downloads", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  const blocked = deferred();
  h.resetWith(() => blocked.promise);
  h.bridge.setSubtitleTrack("2");
  await flushBridge();
  const download = deferred<{ playableUrl: string; cleanup: () => void }>();
  h.prepareWith(() => download.promise);
  const pending = h.bridge.addSubtitle("https://example.test/sub.srt", "ar", "Fixture", true);
  const nextLoad = h.bridge.load({ url: "next-episode.mkv" });
  let cleaned = false;
  download.resolve({
    playableUrl: "old.srt",
    cleanup: () => {
      cleaned = true;
    },
  });
  blocked.resolve();
  await nextLoad;
  assert.equal(await pending, false);
  await flushBridge();
  assert.deepEqual(h.picks(), ["no"]);
  assert.equal(cleaned, true);
  assert.equal(
    h.commands.some(({ command }) => command === "mpv_sub_add"),
    false,
  );
});

test("a failed FPS reset blocks the native subtitle switch and allows a retry", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  h.emit("track-list", tracks);
  h.resetWith(async () => {
    throw new Error("fixture FPS failure");
  });
  h.bridge.setSubtitleTrack("2");
  await flushBridge();
  assert.deepEqual(h.picks(), []);
  assert.equal(h.snapshot().subtitleTracks.find((track) => track.selected)?.id, "1");
  assert.deepEqual(h.errors, ["selection-failed"]);
  h.resetWith(async () => {});
  h.bridge.setSubtitleTrack("2");
  await flushBridge();
  assert.deepEqual(h.picks(), [2]);
});
