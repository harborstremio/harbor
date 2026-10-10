// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  SUBTITLE_FPS_PRESETS,
  buildSubtitleTimingMediaKey,
  createSubtitleFpsAvailabilityController,
  createSubtitleFpsCoordinator,
  formatSubtitleFps,
  isAutoSyncScopeCurrent,
  matchingSubtitleFpsPreset,
  runAfterSubtitleFpsReset,
  subtitleFpsMatchesVideo,
  subtitleFpsAvailability,
  subtitleFpsToMpvValue,
  validateSubtitleFps,
} from "../src/lib/player/subtitle-fps.ts";
import { isTextSubTrack } from "../src/lib/player/sub-format.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("subtitle FPS presets preserve exact NTSC fractional rates", () => {
  assert.deepEqual(
    SUBTITLE_FPS_PRESETS.map((preset) => preset.label),
    ["23.976", "24", "25", "29.97", "30", "50", "59.94", "60"],
  );
  assert.equal(SUBTITLE_FPS_PRESETS[0].value, 24_000 / 1_001);
  assert.equal(SUBTITLE_FPS_PRESETS[3].value, 30_000 / 1_001);
  assert.equal(SUBTITLE_FPS_PRESETS[6].value, 60_000 / 1_001);
});

test("custom FPS accepts only finite values from 1 through 240", () => {
  assert.deepEqual(validateSubtitleFps("23.976"), { ok: true, value: 23.976 });
  assert.deepEqual(validateSubtitleFps(1), { ok: true, value: 1 });
  assert.deepEqual(validateSubtitleFps(240), { ok: true, value: 240 });

  for (const value of ["", " ", 0, 0.999, 240.001, Number.NaN, Infinity, true]) {
    assert.equal(validateSubtitleFps(value).ok, false, String(value));
  }
});

test("No correction maps to mpv's zero sentinel", () => {
  assert.equal(subtitleFpsToMpvValue("default"), 0);
  assert.equal(subtitleFpsToMpvValue(25), 25);
  assert.throws(() => subtitleFpsToMpvValue(0), RangeError);
});

test("preset matching and formatting keep user-facing rates stable", () => {
  assert.equal(matchingSubtitleFpsPreset(24_000 / 1_001), "23.976");
  assert.equal(matchingSubtitleFpsPreset(24.981469), null);
  assert.equal(formatSubtitleFps(24_000 / 1_001, 6), "23.976");
  assert.equal(formatSubtitleFps(24.981469, 6), "24.981469");
  assert.equal(formatSubtitleFps(null), "-");
});

test("Auto recognizes when subtitle FPS matches the current video", () => {
  assert.equal(subtitleFpsMatchesVideo(24_000 / 1_001, 23.976), true);
  assert.equal(subtitleFpsMatchesVideo(25, 25), true);
  assert.equal(subtitleFpsMatchesVideo(25, 24), false);
  assert.equal(subtitleFpsMatchesVideo(null, 24), false);
});

test("manual control is available only for a selected text track in the primary mpv player", () => {
  const valid = {
    engine: "mpv" as const,
    hasTrack: true,
    textBased: true,
    hasSecondary: false,
    videoFps: 24_000 / 1_001,
    nativeSupported: true,
    autoSyncActive: false,
  };
  assert.deepEqual(subtitleFpsAvailability(valid), { enabled: true, reason: null });

  const cases = [
    [{ hasTrack: false }, "no-track"],
    [{ engine: "html5" as const }, "html5"],
    [{ textBased: false }, "not-text-based"],
    [{ hasSecondary: true }, "secondary-active"],
    [{ videoFps: null }, "video-fps-unavailable"],
    [{ nativeSupported: false }, "native-unavailable"],
    [{ autoSyncActive: true }, "auto-sync-active"],
  ] as const;
  for (const [override, reason] of cases) {
    assert.deepEqual(subtitleFpsAvailability({ ...valid, ...override }), {
      enabled: false,
      reason,
    });
  }
});

test("recognized text formats are eligible and image formats are not", () => {
  const track = (codec: string, title?: string) => ({
    id: "1",
    label: codec,
    kind: "subtitle" as const,
    selected: true,
    codec,
    title,
  });
  for (const codec of ["SUBRIP", "SRT", "WEBVTT", "ASS", "SSA", "MOV_TEXT"]) {
    assert.equal(isTextSubTrack(track(codec)), true, codec);
  }
  for (const codec of ["HDMV_PGS_SUBTITLE", "DVD_SUBTITLE", "VOBSUB", "DVB_SUBTITLE"]) {
    assert.equal(isTextSubTrack(track(codec)), false, codec);
  }
  assert.equal(isTextSubTrack(track("unknown", "external.srt")), true);
  assert.equal(isTextSubTrack(track("unknown")), false);
});

test("FPS writes are serialized and transitions reset only an active correction", async () => {
  const calls: number[] = [];
  const coordinator = createSubtitleFpsCoordinator({
    writeFps: async (value) => {
      calls.push(value);
    },
  });

  await Promise.all([coordinator.apply(25), coordinator.resetForTransition()]);
  assert.deepEqual(calls, [25, 0]);
  assert.equal(coordinator.isActive(), false);

  await coordinator.resetForTransition();
  assert.deepEqual(calls, [25, 0]);
});

test("a stale queued write cannot leak into a newer video or subtitle track", async () => {
  const calls: number[] = [];
  let current = true;
  const coordinator = createSubtitleFpsCoordinator({
    writeFps: async (value) => {
      calls.push(value);
      if (value === 25) current = false;
    },
  });

  await assert.rejects(
    coordinator.apply(25, () => current),
    /context changed/,
  );
  assert.deepEqual(calls, [25, 0]);
  assert.equal(coordinator.isActive(), false);
});

test("the latest rapid choice wins on the same subtitle track", async () => {
  const calls: number[] = [];
  let releaseFirstWrite: (() => void) | null = null;
  let markFirstWriteStarted: (() => void) | null = null;
  const firstWriteStarted = new Promise<void>((resolve) => {
    markFirstWriteStarted = resolve;
  });
  let currentRequest = 1;
  const coordinator = createSubtitleFpsCoordinator({
    writeFps: async (value) => {
      calls.push(value);
      if (value === 25) {
        markFirstWriteStarted?.();
        await new Promise<void>((resolve) => {
          releaseFirstWrite = resolve;
        });
      }
    },
  });

  const first = coordinator.apply(25, () => currentRequest === 1);
  await firstWriteStarted;
  currentRequest = 2;
  const second = coordinator.apply(24, () => currentRequest === 2);
  releaseFirstWrite?.();

  await assert.rejects(first, /context changed/);
  await second;
  assert.deepEqual(calls, [25, 0, 24]);
  assert.equal(coordinator.isActive(), true);
});

test("a failed active reset blocks its transition and remains retryable", async () => {
  let failReset = true;
  const calls: number[] = [];
  const coordinator = createSubtitleFpsCoordinator({
    writeFps: async (value) => {
      calls.push(value);
      if (value === 0 && failReset) throw new Error("reset failed");
    },
  });

  await coordinator.apply(25);
  await assert.rejects(coordinator.resetForTransition(), /reset failed/);
  assert.equal(coordinator.isActive(), true);
  assert.deepEqual(calls, [25, 0]);

  failReset = false;
  await coordinator.resetForTransition();
  assert.deepEqual(calls, [25, 0, 0]);
  assert.equal(coordinator.isActive(), false);
});

test("native reads can wait for an in-flight subtitle FPS transition", async () => {
  let releaseReset: (() => void) | null = null;
  let markResetStarted: (() => void) | null = null;
  const resetStarted = new Promise<void>((resolve) => {
    markResetStarted = resolve;
  });
  const coordinator = createSubtitleFpsCoordinator({
    writeFps: async (value) => {
      if (value !== 0) return;
      markResetStarted?.();
      await new Promise<void>((resolve) => {
        releaseReset = resolve;
      });
    },
  });

  await coordinator.apply(25);
  const reset = coordinator.resetForTransition();
  await resetStarted;

  let settled = false;
  const wait = coordinator.whenSettled().then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);

  releaseReset?.();
  await reset;
  await wait;
  assert.equal(settled, true);
});

test("a completed write from a destroyed mpv session cannot become active", async () => {
  let releaseWrite: (() => void) | null = null;
  let markWriteStarted: (() => void) | null = null;
  const writeStarted = new Promise<void>((resolve) => {
    markWriteStarted = resolve;
  });
  const coordinator = createSubtitleFpsCoordinator({
    writeFps: async () => {
      markWriteStarted?.();
      await new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
    },
  });

  const pending = coordinator.apply(25);
  await writeStarted;
  coordinator.markSessionRecreated();
  releaseWrite?.();

  await assert.rejects(pending, /context changed/);
  assert.equal(coordinator.isActive(), false);
});

test("Auto Sync waits for the FPS reset and surfaces reset failures", async () => {
  const order: string[] = [];
  let releaseReset: (() => void) | null = null;
  const pending = runAfterSubtitleFpsReset(
    async () => {
      order.push("reset");
      await new Promise<void>((resolve) => {
        releaseReset = resolve;
      });
    },
    () => {
      order.push("action");
    },
    () => {
      order.push("error");
    },
  );

  await Promise.resolve();
  assert.deepEqual(order, ["reset"]);
  releaseReset?.();
  assert.equal(await pending, true);
  assert.deepEqual(order, ["reset", "action"]);

  const failure = new Error("reset failed");
  let actionRan = false;
  let reported: unknown = null;
  assert.equal(
    await runAfterSubtitleFpsReset(
      async () => {
        throw failure;
      },
      () => {
        actionRan = true;
      },
      (error) => {
        reported = error;
      },
    ),
    false,
  );
  assert.equal(actionRan, false);
  assert.equal(reported, failure);
});

test("Auto Sync drops an action when its media changes during the FPS reset", async () => {
  let current = true;
  let actionRan = false;
  const result = await runAfterSubtitleFpsReset(
    async () => {
      current = false;
    },
    () => {
      actionRan = true;
    },
    () => assert.fail("reset should succeed"),
    () => current,
  );

  assert.equal(result, false);
  assert.equal(actionRan, false);
});

test("Auto Sync reports a stale result when its media changes during the action", async () => {
  let current = true;
  const result = await runAfterSubtitleFpsReset(
    async () => {},
    () => {
      current = false;
    },
    () => assert.fail("reset should succeed"),
    () => current,
  );

  assert.equal(result, false);
});

test("stale asynchronous FPS reads cannot commit after a playback boundary", async () => {
  const reads: Array<(supported: boolean) => void> = [];
  const commits: boolean[] = [];
  const controller = createSubtitleFpsAvailabilityController({
    read: () =>
      new Promise<boolean>((resolve) => {
        reads.push(resolve);
      }),
    commit: (supported) => commits.push(supported),
  });

  const stale = controller.refresh();
  controller.invalidate();
  const latest = controller.refresh();
  reads[1](true);
  assert.equal(await latest, true);
  reads[0](false);
  assert.equal(await stale, false);
  assert.deepEqual(commits, [true]);
});

test("subtitle timing media identity distinguishes episodes that reuse a stream URL", () => {
  const episode1 = buildSubtitleTimingMediaKey({
    sourceUrl: "https://stream/shared",
    mediaId: "series:1",
    season: 1,
    episode: 1,
  });
  const episode2 = buildSubtitleTimingMediaKey({
    sourceUrl: "https://stream/shared",
    mediaId: "series:1",
    season: 1,
    episode: 2,
  });

  assert.notEqual(episode1, episode2);
  assert.equal(
    episode1,
    buildSubtitleTimingMediaKey({
      sourceUrl: "https://stream/shared",
      mediaId: "series:1",
      season: 1,
      episode: 1,
    }),
  );
});

test("Auto Sync status applies only to its current media and subtitle track", () => {
  const scope = { mediaKey: "episode-1", trackId: "2" };
  assert.equal(
    isAutoSyncScopeCurrent(scope, {
      mediaKey: "episode-1",
      trackId: "2",
      syncedTrack: false,
    }),
    true,
  );
  assert.equal(
    isAutoSyncScopeCurrent(scope, {
      mediaKey: "episode-2",
      trackId: "2",
      syncedTrack: false,
    }),
    false,
  );
  assert.equal(
    isAutoSyncScopeCurrent(scope, {
      mediaKey: "episode-1",
      trackId: "3",
      syncedTrack: false,
    }),
    false,
  );
  assert.equal(
    isAutoSyncScopeCurrent(scope, {
      mediaKey: "episode-1",
      trackId: "9",
      syncedTrack: true,
    }),
    true,
  );
});

test("the feature reuses Playback Stats FPS properties and only writes mpv sub-fps", () => {
  const stats = read("src/components/player/stats-overlay.tsx");
  const properties = read("src/lib/player/mpv-properties.ts");
  assert.match(stats, /"estimated-vf-fps"/);
  assert.match(stats, /"container-fps"/);
  assert.match(properties, /"estimated-vf-fps"/);
  assert.match(properties, /"container-fps"/);
  assert.match(properties, /readMpvBoolean\("idle-active"\)/);
  assert.match(properties, /"sub-fps"/);
  assert.doesNotMatch(properties, /sub-delay|ffprobe|ffmpeg|MediaInfo/i);
});

test("manual FPS scope contains no calibration or delay ownership", () => {
  const logic = read("src/lib/player/subtitle-fps.ts");
  const panel = read("src/components/player/subtitle-menu/subtitle-fps-panel.tsx");
  assert.doesNotMatch(logic, /calibr|sub-delay|SubtitleTimingPoint/i);
  assert.doesNotMatch(panel, /calibr|early point|late point|manual offset|sub-delay/i);
});

test("the FPS control stays in the active main mpv player and does no per-frame work", () => {
  const header = read("src/components/player/subtitle-menu/menu-header.tsx");
  const menuTypes = read("src/components/player/subtitle-menu/types.ts");
  const controls = read("src/components/player/subtitle-menu/subtitle-fps-control.tsx");
  const panel = read("src/components/player/subtitle-menu/subtitle-fps-panel.tsx");
  const renderer = read("src/components/player/transport/control-renderer.tsx");
  const stremioRenderer = read("src/components/player/transport/control-renderer-stremio.tsx");
  assert.match(header, /<SyncControl[\s\S]*<SubtitleFpsControl/);
  assert.match(menuTypes, /engine\?: "html5" \| "mpv"/);
  assert.match(renderer, /<SubtitleMenu[\s\S]*engine=\{ctx\.engine\}/);
  assert.match(stremioRenderer, /<SubtitleMenu[\s\S]*engine=\{ctx\.engine\}/);
  assert.match(controls, /getCurrentWindow\(\)\.label === "main"/);
  assert.match(controls, /engine !== "mpv"/);
  assert.match(controls, /triggerRef\.current\?\.focus\(\)/);
  assert.match(controls, /listen<MpvPlaybackEvent>\("mpv:\/\/event"/);
  assert.match(controls, /createSubtitleFpsAvailabilityController/);
  for (const event of ["file-loaded", "end-file", "shutdown"]) {
    assert.match(controls, new RegExp(`"${event}"`), event);
  }
  assert.match(controls, /SubtitleFpsPanel/);
  assert.match(controls, /Subtitle FPS/);
  assert.doesNotMatch(panel, /engine: "mpv"/);
  assert.doesNotMatch(`${controls}\n${panel}`, /requestAnimationFrame|requestVideoFrameCallback/);
  assert.doesNotMatch(read("src/components/player/subtitle-menu/sync-control.tsx"), /SubtitleFps/);
});

test("the FPS trigger uses the dedicated vector subtitle timing icon", () => {
  const controls = read("src/components/player/subtitle-menu/subtitle-fps-control.tsx");
  const icon = read("src/components/player/subtitle-menu/subtitle-fps-icon.tsx");

  assert.match(controls, /<SubtitleFpsIcon/);
  assert.doesNotMatch(controls, /\bGauge\b/);
  assert.match(icon, /<svg/);
  assert.match(icon, /currentColor/);
  assert.match(icon, /aria-hidden="true"/);
});

test("the panel refreshes after Auto Sync or secondary subtitles reset the native value", () => {
  const controls = read("src/components/player/subtitle-menu/subtitle-fps-control.tsx");
  const panel = read("src/components/player/subtitle-menu/subtitle-fps-panel.tsx");
  assert.match(panel, /\[autoSyncActive, hasSecondary, track\?\.id\]/);
  assert.match(panel, /resetByPlayer[\s\S]*autoSyncActive[\s\S]*hasSecondary/);
  assert.match(controls, /onBeforeApply=\{autoSync\?\.stop\}/);
  assert.match(panel, /onBeforeApply\?\.\(\)[\s\S]*writeMpvSubtitleFps/);
  assert.match(panel, /value: "auto",\s*label:/);
  assert.match(panel, /applySourceFps\(videoFps, "auto"\)/);
});

test("mpv lifecycle and Auto Sync boundaries reset only subtitle FPS", () => {
  const properties = read("src/lib/player/mpv-properties.ts");
  const autoSyncStore = read("src/components/player/autosync/autosync-store.ts");
  const bridge = read("src/lib/player/mpv.ts");
  const forwardingBridge = read("src/lib/player/mpv-forward.ts");
  const hdrStageBridge = read("src/views/player/hdr-stage-bridge.tsx");
  const autoSync = read("src/views/player/hooks/use-auto-sync.ts");
  const player = read("src/views/player.tsx");

  assert.doesNotMatch(properties, /listen<MpvEvent>\("mpv:\/\/event"/);
  assert.match(properties, /await coordinator\.whenSettled\(\)/);
  assert.match(bridge, /resetMpvSubtitleFpsForTransition/);
  assert.match(bridge, /markMpvSubtitleFpsSessionRecreated/);
  assert.match(
    bridge,
    /setSecondarySubtitleTrack\(id\)[\s\S]*const requestMediaRevision = mediaRevision[\s\S]*await resetSubtitleFpsBeforeMpvTransition\([\s\S]*requestMediaRevision !== mediaRevision[\s\S]*name: "secondary-sid"/,
  );
  assert.match(
    bridge,
    /could not select a subtitle after resetting subtitle FPS[\s\S]*SUBTITLE_FPS_TRANSITION_FAILED_EVENT/,
  );
  assert.match(
    bridge,
    /could not select a secondary subtitle after resetting subtitle FPS[\s\S]*SUBTITLE_FPS_TRANSITION_FAILED_EVENT/,
  );
  assert.match(player, /SUBTITLE_FPS_TRANSITION_FAILED_EVENT/);
  assert.match(player, /Couldn't switch subtitles\. Try again\./);
  assert.match(
    bridge,
    /could not reset subtitle FPS before loading media[\s\S]*markMpvSubtitleFpsSessionRecreated\(\)[\s\S]*mpvStarted = false/,
  );
  assert.match(bridge, /let mediaRevision = 0/);
  assert.match(bridge, /async load\(src[\s\S]*mediaRevision \+= 1/);
  assert.match(
    bridge,
    /async addSubtitle[\s\S]*const requestMediaRevision = mediaRevision[\s\S]*requestMediaRevision !== mediaRevision[\s\S]*resetSubtitleFpsBeforeMpvTransition\(\)[\s\S]*requestMediaRevision !== mediaRevision[\s\S]*"mpv_sub_add"/,
  );
  assert.match(
    forwardingBridge,
    /setSubtitleTrack\(id\)[\s\S]*\{ id, mediaKey \}[\s\S]*HDR_STAGE_SET_SUBTITLE_TRACK/,
  );
  assert.match(
    forwardingBridge,
    /setSecondarySubtitleTrack\(id\)[\s\S]*\{ id, mediaKey \}[\s\S]*HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK/,
  );
  assert.match(forwardingBridge, /async addSubtitle[\s\S]*forwardSubtitleAdd\(\{[\s\S]*mediaKey/);
  assert.doesNotMatch(forwardingBridge, /name: "sid"|name: "secondary-sid"|"mpv_sub_add"/);
  assert.match(
    hdrStageBridge,
    /HDR_STAGE_SET_SUBTITLE_TRACK[\s\S]*isCurrentMediaRequest[\s\S]*setSubtitleTrack/,
  );
  assert.match(
    hdrStageBridge,
    /HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK[\s\S]*isCurrentMediaRequest[\s\S]*setSecondarySubtitleTrack/,
  );
  assert.match(
    hdrStageBridge,
    /HDR_STAGE_ADD_SUBTITLE[\s\S]*isCurrentMediaRequest[\s\S]*addSubtitle[\s\S]*HDR_STAGE_ADD_SUBTITLE_RESULT/,
  );
  for (const boundary of [
    "async load",
    "setSubtitleTrack",
    "setSecondarySubtitleTrack",
    "async addSubtitle",
    "destroy",
  ]) {
    assert.match(bridge, new RegExp(boundary), boundary);
  }
  assert.doesNotMatch(autoSyncStore, /resetMpvSubtitleFpsForTransition/);
  assert.match(autoSync, /resetMpvSubtitleFpsForTransition/);
  assert.match(autoSync, /runAfterSubtitleFpsReset/);
  assert.match(autoSync, /subtitle FPS reset failed[\s\S]*setStatus\("error"\)/);
  assert.match(autoSync, /handleOutcome[\s\S]*runWithSubtitleFpsReset/);
  assert.match(autoSync, /applyOffer[\s\S]*isCurrentAutoSyncScope/);
  assert.match(autoSync, /type AppliedState = \{[\s\S]*scope: AutoSyncScope \| null/);
  assert.match(
    autoSync,
    /const canRevert = a\.changed && isCurrentAutoSyncScope\(a\.scope\)[\s\S]*if \(b && canRevert\)/,
  );
  assert.match(autoSync, /changed: boolean/);
  assert.match(autoSync, /a\.changed = true/);
  assert.match(
    autoSync,
    /setSubDelay: \(s\) => \{[\s\S]*isCurrentAutoSyncScope\(a\.scope\)[\s\S]*b\.setSubDelay\(s\)[\s\S]*a\.changed = true/,
  );
  assert.doesNotMatch(autoSync, /readMpvSubtitleDelay/);
});

test("the FPS save state respects reduced motion and is announced", () => {
  const panel = read("src/components/player/subtitle-menu/subtitle-fps-panel.tsx");
  assert.match(panel, /motion-reduce:animate-none/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /aria-label=\{tr\("Saving"\)\}/);
});
