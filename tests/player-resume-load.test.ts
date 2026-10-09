import assert from "node:assert/strict";
import test from "node:test";
import { hookHarness, flushPromises } from "./helpers/hook-harness.ts";
import { playerLoadIdentity } from "../src/lib/player/load-identity.ts";

function harness() {
  const loads: any[] = [];
  let plays = 0, pauses = 0, resolves = 0;
  let resolve = async () => ({ ms: 600000, finished: false });
  const settings = { resumePrompt: false, resumePlayback: true };
  const bridge = { load: async (src: any) => { loads.push(src); }, play: async () => { plays++; }, pause: () => { pauses++; } };
  const args: any = {
    bridgeRef: { current: bridge }, inRoomRef: { current: false }, isHostRef: { current: false },
    bridgeReady: true, bridgeKey: "mpv", transcodedUrl: null, season: 1, episode: 1, authKey: null,
    src: { url: "https://fixture.test/video.mkv", meta: { id: "tt100" }, episode: { runtime: 60 } },
  };
  const h = hookHarness("src/views/player/hooks/use-bridge-load.ts", "useBridgeLoad", {
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/stremio": { cloudWriteId: (id: string) => id },
    "./use-stremio-sync": { videoIdFor: () => "tt100:1:1" },
    "@/lib/player/resume-start": { resolveStartMs: () => { resolves++; return resolve(); } },
    "@/lib/player/startup-profile": { playbackStartupProfile: () => "standard" },
    "@/lib/player/live-src": { isLivePlaybackSrc: (src: any) => !!src.live },
    "@/lib/player/load-identity": { playerLoadIdentity },
    "@/lib/stream-proxy": { releaseStreamProxy() {}, retainStreamProxy() {} },
  });
  return { ...h, args, settings, loads, get plays() { return plays; }, get pauses() { return pauses; },
    get resolves() { return resolves; }, resolver(fn: typeof resolve) { resolve = fn; }, render: () => h.render(args) };
}

test("resume is passed into the initial load and auto-skip stays gated until confirmation", async () => {
  const h = harness(); h.render(); await flushPromises();
  assert.equal(h.loads[0].startAtSec, 600);
  const state = h.render();
  assert.equal(state.pendingSeekSec, 600);
  assert.equal(state.resumeReady, false);
  state.clearPendingSeek();
  assert.equal(h.render().resumeReady, true);
  assert.equal(h.loads.length, 1);
});

test("cancelled resume lookup cannot skip the replacement load, even for the same URL", async () => {
  const h = harness();
  let finish!: (value: any) => void;
  h.resolver(() => new Promise(r => { finish = r; })); h.render();
  h.resolver(async () => ({ ms: 300000, finished: false }));
  h.args.src = { ...h.args.src, subtitles: [] }; h.render(); await flushPromises();
  finish({ ms: 900000, finished: false }); await flushPromises();
  assert.equal(h.loads.length, 1);
  assert.equal(h.loads[0].startAtSec, 300);
  assert.equal(h.render().pendingSeekSec, 300);
});

test("resume prompt waits for the user's choice", async () => {
  const h = harness(); h.settings.resumePrompt = true; h.render(); await flushPromises();
  assert.equal(h.loads[0].startAtSec, undefined);
  const state = h.render();
  assert.equal(state.pendingResumeSec, 600);
  assert.equal(state.resumeReady, false);
  assert.equal(h.plays, 0);
  state.acknowledgeResume("start-over");
  assert.equal(h.render().pendingSeekSec, 0);
});

test("live, start-over, disabled resume and room guests do not load at saved progress", async () => {
  for (const mode of ["live", "start-over", "disabled", "guest"]) {
    const h = harness();
    if (mode === "live") h.args.src.live = true;
    if (mode === "start-over") h.args.src.startFromZero = true;
    if (mode === "disabled") h.settings.resumePlayback = false;
    if (mode === "guest") h.args.inRoomRef.current = true;
    h.render(); await flushPromises();
    assert.equal(h.loads[0].startAtSec, undefined, mode);
    assert.equal(h.render().pendingSeekSec, null, mode);
    if (mode === "guest") assert.equal(h.plays, 0);
  }
});

test("explicit paused source replacement retains its position with auto-resume disabled", async () => {
  const h = harness(); h.settings.resumePlayback = false;
  h.args.src.startPositionMs = 900000; h.args.src.startPaused = true;
  h.render(); await flushPromises();
  assert.equal(h.loads[0].startAtSec, 900);
  assert.equal(h.plays, 0);
});

test("unmount before resume resolution prevents any playback side effects", async () => {
  const h = harness(); let finish!: (value: any) => void;
  h.resolver(() => new Promise(r => { finish = r; }));
  h.render(); h.unmount(); finish({ ms: 600000, finished: false }); await flushPromises();
  assert.equal(h.loads.length, 0); assert.equal(h.plays, 0);
});
