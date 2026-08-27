// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(at(path), "utf8");

const bridge = read("src/lib/player/bridge.ts");
const mpv = read("src/lib/player/mpv.ts");
const html5 = read("src/lib/player/html5/bridge.ts");
const loader = read("src/views/player/cinematic-player-loader.tsx");
const picker = read("src/views/play-picker.tsx");
const bridgeLoad = read("src/views/player/hooks/use-bridge-load.ts");
const autoRetry = read("src/views/player/hooks/use-auto-retry.ts");
const sync = read("src/views/player/hooks/use-stremio-sync.ts");
const nativeMpv = read("src-tauri/src/mpv.rs");
const controls = read("src/views/player/hooks/use-playback-controls.ts");

test("player snapshots expose a resettable first-frame readiness signal", () => {
  assert.match(bridge, /firstFrameReady: boolean/);
  assert.match(bridge, /firstFrameReady: false/);
  assert.match(mpv, /snap\.firstFrameReady = false/);
  assert.match(html5, /snap\.firstFrameReady = false/);
});

test("mpv uses PlaybackRestart rather than FileLoaded as first-frame readiness", () => {
  const fileLoaded = mpv.slice(
    mpv.indexOf('raw.event === "file-loaded"'),
    mpv.indexOf('raw.event === "playback-restart"'),
  );
  const playbackRestart = mpv.slice(
    mpv.indexOf('raw.event === "playback-restart"'),
    mpv.indexOf("return {", mpv.indexOf('raw.event === "playback-restart"')),
  );
  assert.doesNotMatch(fileLoaded, /firstFrameReady = true/);
  assert.match(playbackRestart, /firstFrameReady = true/);
  assert.match(loader, /snap\.firstFrameReady/);
});

test("seek restart preserves mpv pause state and user seeks use fast keyframes", () => {
  assert.match(mpv, /observedPaused = data/);
  assert.match(mpv, /snap\.status = observedPaused === true \? "paused" : "playing"/);
  assert.match(mpv, /"absolute\+keyframes"/);
  assert.match(mpv, /"absolute\+exact"/);
  assert.match(controls, /seek\(target, "keyframes"\)/);
});

test("cinematic loader cannot hide from playback time before the first frame", () => {
  assert.match(loader, /if \(snap\.firstFrameReady\)/);
  assert.doesNotMatch(loader, /getPlaybackPosition|usePlaybackFlag|hasProgress/);
});

test("first-frame readiness ignores a stale event from the previous media path", () => {
  assert.match(nativeMpv, /\("path", 20, PropertyKind::String\)/);
  assert.match(mpv, /expectedMediaPath = src\.url/);
  assert.match(mpv, /observedMediaPath &&/);
  assert.match(mpv, /normalizeMediaPath\(expectedMediaPath\)/);
});

test("native startup logs classify sources without printing private playback URLs", () => {
  assert.match(nativeMpv, /start source_kind=\{\}/);
  assert.match(nativeMpv, /loadfile source_kind=\{\}/);
  assert.doesNotMatch(nativeMpv, /start url=\{\}/);
  assert.doesNotMatch(nativeMpv, /loadfile \{\}", args\.url/);
});

test("startup subtitle downloads no longer block the initial media load", () => {
  assert.match(mpv, /subtitles: \[\]/);
  assert.match(mpv, /void addSeedSubtitles\(src\.subtitles, activeLoadId\)/);
  const coldStart = mpv.indexOf('await invoke("mpv_start"');
  const deferredSubtitles = mpv.indexOf("void addSeedSubtitles", coldStart);
  assert.ok(coldStart >= 0 && deferredSubtitles > coldStart);
});

test("mpv starts each media load without an automatically selected embedded subtitle", () => {
  const retainedStop = mpv.indexOf('await invoke("mpv_command", { cmd: ["stop"] })');
  const retainedSidReset = mpv.indexOf('name: "sid", value: "no"', retainedStop);
  const retainedLoad = mpv.indexOf('"loadfile",', retainedStop);
  assert.ok(
    retainedStop >= 0 && retainedSidReset > retainedStop && retainedSidReset < retainedLoad,
  );

  const nativeSidReset = nativeMpv.indexOf('mpv.set_property("sid", "no")');
  const nativeLoad = nativeMpv.indexOf('&["loadfile", &args.url, "replace"]');
  assert.ok(nativeSidReset >= 0 && nativeSidReset < nativeLoad);
  assert.match(nativeMpv, /mpv\.set_property\("secondary-sid", "no"\)/);
});

test("mpv capability probing is shared for the application lifetime", () => {
  assert.match(mpv, /let mpvProbePromise: Promise<MpvProbe> \| null = null/);
  assert.match(mpv, /if \(mpvProbePromise\) return mpvProbePromise/);
});

test("resume state is prefetched and shared instead of duplicated on play", () => {
  assert.match(picker, /prefetchResumeStart\(/);
  assert.match(bridgeLoad, /resolveStartMs\(/);
  assert.match(sync, /resumeLibraryGetOne\(authKey, canonicalId\)/);
});

test("manual HTTP sources are not killed by the short startup retry timer", () => {
  const stuckLoadEffect = autoRetry.slice(
    autoRetry.indexOf('triggerAutoRetry("stuck on load")') - 700,
    autoRetry.indexOf('triggerAutoRetry("stuck on load")') + 200,
  );
  assert.match(stuckLoadEffect, /if \(!instantPlay && !inRoom\) return/);
  assert.doesNotMatch(autoRetry, /fetch\(url/);
});
