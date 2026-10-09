import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { musicVideoSyncCorrection, MUSIC_VIDEO_RATE_TRIM } from "../src/lib/music/video-sync";

const source = readFileSync(
  new URL("../src/components/music/music-video-surface.tsx", import.meta.url),
  "utf8",
);
const hostSource = readFileSync(new URL("../src/lib/music/video-host.ts", import.meta.url), "utf8");

test("a picture inside the ignore band is left alone at the audio's own rate", () => {
  const steady = musicVideoSyncCorrection({ audioTime: 10, videoTime: 10, baseRate: 1 });
  assert.equal(steady.kind, "hold");
  assert.equal(steady.seekTo, null);
  assert.equal(steady.rate, 1);
  const close = musicVideoSyncCorrection({ audioTime: 10.03, videoTime: 10, baseRate: 1 });
  assert.equal(close.kind, "hold");
  assert.equal(close.rate, 1);
});

test("small drift is trimmed through the picture's rate and never through the audio", () => {
  const behind = musicVideoSyncCorrection({ audioTime: 10.12, videoTime: 10, baseRate: 1 });
  assert.equal(behind.kind, "trim");
  assert.equal(behind.seekTo, null);
  assert.ok(behind.rate > 1, `expected a faster picture, got ${behind.rate}`);
  assert.equal(behind.rate, 1 + MUSIC_VIDEO_RATE_TRIM);
  const ahead = musicVideoSyncCorrection({ audioTime: 10, videoTime: 10.12, baseRate: 1 });
  assert.equal(ahead.kind, "trim");
  assert.ok(ahead.rate < 1, `expected a slower picture, got ${ahead.rate}`);
});

test("the trim follows a non-unit base rate rather than snapping back to 1x", () => {
  const behind = musicVideoSyncCorrection({ audioTime: 20.2, videoTime: 20, baseRate: 1.5 });
  assert.equal(behind.kind, "trim");
  assert.equal(behind.rate, 1.5 * (1 + MUSIC_VIDEO_RATE_TRIM));
  const settled = musicVideoSyncCorrection({ audioTime: 20, videoTime: 20, baseRate: 1.5 });
  assert.equal(settled.rate, 1.5);
});

test("a gap no trim can close hard-seeks the picture to the audio clock", () => {
  const far = musicVideoSyncCorrection({ audioTime: 45, videoTime: 12, baseRate: 1 });
  assert.equal(far.kind, "seek");
  assert.equal(far.seekTo, 45);
  assert.equal(far.rate, 1);
  const behind = musicVideoSyncCorrection({ audioTime: 10, videoTime: 10.4, baseRate: 1 });
  assert.equal(behind.kind, "seek");
  assert.equal(behind.seekTo, 10);
});

test("the single element case has no clock to chase and is never corrected", () => {
  const alone = musicVideoSyncCorrection({ audioTime: null, videoTime: 33, baseRate: 1 });
  assert.equal(alone.kind, "hold");
  assert.equal(alone.seekTo, null);
  assert.equal(alone.rate, 1);
  const broken = musicVideoSyncCorrection({ audioTime: Number.NaN, videoTime: 33, baseRate: 1 });
  assert.equal(broken.kind, "hold");
  assert.equal(broken.seekTo, null);
  const unset = musicVideoSyncCorrection({ audioTime: null, videoTime: 0, baseRate: 0 });
  assert.equal(unset.rate, 1);
});

test("the surface plays through media elements in the document, not a chased native window", () => {
  assert.match(hostSource, /document\.createElement\("video"\)/);
  assert.match(hostSource, /document\.createElement\("audio"\)/);
  assert.match(hostSource, /playsInline = true/);
  assert.match(hostSource, /document\.body\.appendChild\(park\)/);
  assert.match(hostSource, /musicVideoSyncCorrection/);
  for (const banned of ["mpv_", "setMusicVideoRect", "getBoundingClientRect"]) {
    assert.equal(
      hostSource.includes(banned),
      false,
      `${banned} still chases a native window in video-host.ts`,
    );
    assert.equal(
      source.includes(banned),
      false,
      `${banned} still chases a native window in music-video-surface.tsx`,
    );
  }
});

test("the dock wiring outlives the surface, so an unmounted screen never strands the transport", () => {
  assert.match(hostSource, /setMusicVideoController/);
  assert.match(hostSource, /addEventListener\("timeupdate"/);
  assert.match(hostSource, /addEventListener\("ended"/);
  assert.match(hostSource, /reportMusicVideoPlayback\(\{ ended: true \}\)/);
  assert.equal(
    source.includes("setMusicVideoController"),
    false,
    "the surface still owns the dock controller",
  );
  assert.equal(
    source.includes("reportMusicVideoPlayback"),
    false,
    "the surface still owns playback reporting",
  );
});

test("re-adopting a live session reuses the stream it already holds instead of resolving again", () => {
  assert.match(hostSource, /export function musicVideoHostSource/);
  const resolve = source.slice(
    source.indexOf("const held ="),
    source.indexOf("musicVideoStream(track, attempt > 0)"),
  );
  assert.match(resolve, /musicVideoHostSource\(key\)/);
  assert.match(resolve, /if \(held\) \{[^}]*return;/);
});

test("every piece of the geometry chase is gone from the surface", () => {
  for (const banned of [
    "getBoundingClientRect",
    "mpv_set_geometry",
    "setMusicVideoRect",
    "clipPath",
    "createPortal",
    "requestAnimationFrame",
    'addEventListener("scroll"',
  ]) {
    assert.equal(
      source.includes(banned),
      false,
      `${banned} still chases geometry in music-video-surface.tsx`,
    );
  }
});

test("a picture that is already seeking or starved is left alone instead of being re-seeked", () => {
  const busy = musicVideoSyncCorrection({
    audioTime: 45,
    videoTime: 12,
    baseRate: 1,
    pictureBusy: true,
  });
  assert.equal(busy.kind, "hold");
  assert.equal(busy.seekTo, null);
  assert.equal(busy.rate, 1);
  const free = musicVideoSyncCorrection({
    audioTime: 45,
    videoTime: 12,
    baseRate: 1,
    pictureBusy: false,
  });
  assert.equal(free.kind, "seek");
  assert.equal(free.seekTo, 45);
  assert.match(hostSource, /pictureBusy: picture\.seeking \|\| picture\.readyState < 2/);
});

test("the session drives the dock's transport rather than leaving it wired to a dead engine", () => {
  assert.match(hostSource, /setMusicVideoController\(\{/);
  assert.match(hostSource, /setPaused:/);
  assert.match(hostSource, /seek:/);
  assert.match(hostSource, /setVolume:/);
  assert.match(hostSource, /reportMusicVideoPlayback\(\{ ended: true \}\)/);
});
