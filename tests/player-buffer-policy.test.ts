// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import type { Settings } from "../src/lib/settings/types.ts";
import { compileMpvOptions, svpMpvLines } from "../src/lib/player/mpv-tuning.ts";
import { resolvePlaybackDownloadedFraction } from "../src/lib/player/playback-clock.ts";

test("only the P2P engine reports whole-file download progress", () => {
  assert.equal(
    resolvePlaybackDownloadedFraction({
      isP2pEngine: true,
      streamProgress: 50,
      streamLen: 100,
    }),
    0.5,
  );
  assert.equal(
    resolvePlaybackDownloadedFraction({
      isP2pEngine: false,
      streamProgress: 100,
      streamLen: 100,
    }),
    0,
  );
  assert.equal(
    resolvePlaybackDownloadedFraction({
      isP2pEngine: true,
      streamProgress: 50,
      streamLen: 0,
    }),
    0,
  );
});

test("bigger buffer mode increases Harbor defaults and waits for a useful reserve", () => {
  const settings = {
    mpvQuality: "balanced",
    mpvHwdec: "auto",
    mpvBufferBoost: true,
    mpvDownmixStereo: false,
    audioDevice: "auto",
    playerDisplayPanel: "standard",
    playerHdrToSdr: true,
    mpvTweaks: {},
  } as unknown as Settings;

  const options = compileMpvOptions(settings).split("\n");
  assert.ok(options.includes("cache=yes"));
  assert.ok(options.includes("cache-secs=600"));
  assert.ok(options.includes("demuxer-max-bytes=1GiB"));
  assert.ok(options.includes("demuxer-readahead-secs=600"));
  assert.ok(options.includes("cache-pause-initial=yes"));
  assert.ok(options.includes("cache-pause-wait=10"));
  assert.ok(!options.includes("demuxer-max-bytes=150MiB"));
  assert.ok(!options.includes("demuxer-readahead-secs=20"));
});

test("SVP uses a removable labeled VapourSynth filter", () => {
  const settings = { svpVpyPath: "/home/user/.local/share/harbor/svp/svp.vpy" } as Settings;
  const options = svpMpvLines(settings, true).split("\n");
  assert.equal(
    options[0],
    "vf=@harbor-svp:vapoursynth=[/home/user/.local/share/harbor/svp/svp.vpy]",
  );
  assert.ok(options.includes("hwdec=auto-copy"));
});
