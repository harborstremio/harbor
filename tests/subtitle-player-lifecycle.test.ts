// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { PreparedSubtitleCleanupRegistry } from "../src/lib/player/prepared-subtitle-cleanups.ts";
import { SubtitleSelectionCoordinator } from "../src/lib/player/subtitle-selection.ts";
import {
  SubtitleAutoloadRunCoordinator,
  subtitleAutoloadLateSelectionAllowed,
  subtitleAutoloadSelectionLeaseValid,
} from "../src/lib/subtitles/autoload-run.ts";
import { PreparedSubtitleSeedBatch } from "../src/lib/subtitles/seed-batch.ts";
import { automaticAutoSyncMayStart } from "../src/lib/subtitles/autosync/preflight-gate.ts";
import {
  pickDesiredSubtitleTrack,
  subtitleAutoSelectionSignature,
} from "../src/lib/subtitles/track-selection.ts";

const mpvSource = readFileSync(new URL("../src/lib/player/mpv.ts", import.meta.url), "utf8");
const html5Source = readFileSync(
  new URL("../src/lib/player/html5/bridge.ts", import.meta.url),
  "utf8",
);
const autoloadSource = readFileSync(
  new URL("../src/views/player/hooks/use-track-autoload.ts", import.meta.url),
  "utf8",
);
const playerMediaSource = readFileSync(
  new URL("../src/views/player/hooks/use-player-media.ts", import.meta.url),
  "utf8",
);
const autoSyncSource = readFileSync(
  new URL("../src/views/player/hooks/use-auto-sync.ts", import.meta.url),
  "utf8",
);
const mediaServerPlaybackSource = readFileSync(
  new URL("../src/lib/media-server/playback.ts", import.meta.url),
  "utf8",
);
const mediaServerLibrarySource = readFileSync(
  new URL("../src/views/library/media-servers-tab.tsx", import.meta.url),
  "utf8",
);

test("only the latest async subtitle selection may commit", () => {
  const coordinator = new SubtitleSelectionCoordinator();
  const first = coordinator.begin(4, "slow", "original");
  const second = coordinator.begin(4, "fast", "original");
  const available = (id: string) => ["original", "slow", "fast"].includes(id);

  assert.deepEqual(coordinator.settle(first, 4, true, available), { current: false });
  assert.deepEqual(coordinator.settle(second, 4, true, available), {
    current: true,
    selectedId: "fast",
  });
});

test("a current failed subtitle selection rolls back only to an available track", () => {
  const coordinator = new SubtitleSelectionCoordinator();
  const recoverable = coordinator.begin(7, "broken", "previous");
  assert.deepEqual(
    coordinator.settle(recoverable, 7, false, (id) => id === "previous"),
    {
      current: true,
      selectedId: "previous",
    },
  );

  const missingPrevious = coordinator.begin(7, "also-broken", "removed");
  assert.deepEqual(
    coordinator.settle(missingPrevious, 7, false, () => false),
    {
      current: true,
      selectedId: null,
    },
  );
});

test("media replacement and explicit clearing invalidate pending selections", () => {
  const coordinator = new SubtitleSelectionCoordinator();
  const oldMedia = coordinator.begin(2, "subtitle", null);
  assert.deepEqual(
    coordinator.settle(oldMedia, 3, true, () => true),
    { current: false },
  );

  const cleared = coordinator.begin(3, "subtitle", null);
  coordinator.invalidate();
  assert.deepEqual(
    coordinator.settle(cleared, 3, true, () => true),
    { current: false },
  );
});

test("prepared subtitle resources are released by media generation exactly once", () => {
  const registry = new PreparedSubtitleCleanupRegistry();
  const calls: string[] = [];
  registry.register(() => calls.push("old"), 1);
  registry.register(() => {
    calls.push("old-throws");
    throw new Error("cleanup failure");
  }, 1);
  registry.register(() => calls.push("current"), 2);

  registry.clearBefore(2);
  assert.deepEqual(calls, ["old", "old-throws"]);

  registry.clearBefore(2);
  assert.deepEqual(calls, ["old", "old-throws"]);

  registry.clearAll();
  registry.clearAll();
  assert.deepEqual(calls, ["old", "old-throws", "current"]);
});

test("a newer subtitle autoload run invalidates an overlapping run for the same media", () => {
  const coordinator = new SubtitleAutoloadRunCoordinator();
  const stale = coordinator.begin("episode");
  const current = coordinator.begin("episode");

  assert.equal(coordinator.isCurrent(stale, "episode"), false);
  assert.equal(coordinator.isCurrent(current, "episode"), true);
  assert.equal(coordinator.isCurrent(current, "other-episode"), false);

  coordinator.invalidate();
  assert.equal(coordinator.isCurrent(current, "episode"), false);
});

test("delayed hash enrichment may upgrade only the current automatic selection", () => {
  const base = {
    leaseRevision: 2,
    leaseSelectedId: null,
    currentRevision: 3,
    currentSelectedId: "selected-track",
  };

  assert.equal(
    subtitleAutoloadSelectionLeaseValid({
      ...base,
      currentSelectionIsAutomatic: true,
    }),
    true,
  );
  assert.equal(
    subtitleAutoloadSelectionLeaseValid({
      ...base,
      currentSelectionIsAutomatic: false,
    }),
    false,
  );
  assert.equal(
    subtitleAutoloadLateSelectionAllowed({
      currentSelectedId: "automatic",
      currentSelectionIsAutomatic: true,
      autoUpgradeEnabled: false,
    }),
    false,
  );
  assert.equal(
    subtitleAutoloadLateSelectionAllowed({
      currentSelectedId: "automatic",
      currentSelectionIsAutomatic: true,
      autoUpgradeEnabled: true,
    }),
    true,
  );
  assert.equal(
    subtitleAutoloadLateSelectionAllowed({
      currentSelectedId: "user-selection",
      currentSelectionIsAutomatic: false,
      autoUpgradeEnabled: true,
    }),
    false,
  );
  assert.equal(
    subtitleAutoloadLateSelectionAllowed({
      currentSelectedId: null,
      currentSelectionIsAutomatic: false,
      autoUpgradeEnabled: false,
    }),
    true,
  );
});

test("mpv serializes same-media subtitle selection commits through generation guards", () => {
  assert.match(mpvSource, /mainSubtitleSelection\.begin\(/);
  assert.match(mpvSource, /enqueueSubtitleTransition\(async \(\) =>/);
  assert.match(mpvSource, /if \(requestMediaRevision !== mediaRevision\) return;/);
});

test("prepared player-source seeds publish eligibility only after each bridge settles its batch", () => {
  assert.match(mpvSource, /const seedBatch = new PreparedSubtitleSeedBatch\(orderedSeeds\)/);
  assert.match(mpvSource, /autoSelectionEligible: false/);
  assert.match(
    mpvSource,
    /if \(cleanup\) \{[\s\S]*preparedSubtitleCleanups\.register[\s\S]*\}\s*seedBatch\.markReady\(subtitle\)/,
  );
  assert.match(mpvSource, /metadata\.prepared = true/);
  assert.match(mpvSource, /seedBatch\.commit\(/);
  assert.match(html5Source, /const seedBatch = new PreparedSubtitleSeedBatch\(seedTracks\)/);
  assert.match(html5Source, /Promise\.all\([\s\S]*seedBatch\.commit\(/);
});

test("trusted local and home-server subtitle seeds bypass only the provider URL gate", () => {
  assert.match(
    mpvSource,
    /subtitle\.trustedSource !== true && !isSafeProviderSubtitleUrl\(originalUrl\)/,
  );
  assert.match(html5Source, /s\.trustedSource !== true && !isSafeProviderSubtitleUrl\(s\.url\)/);
  assert.match(html5Source, /providerDerived: s\.trustedSource !== true/);
  assert.equal(
    [...mediaServerPlaybackSource.matchAll(/trustedSource: true/g)].length,
    2,
    "initial and quality-switched home-server subtitles must stay trusted",
  );
  assert.match(
    mediaServerLibrarySource,
    /subtitles: source\.subtitles\?\.map[\s\S]*trustedSource: true/,
  );
});

test("reversed seed completion cannot lock a lower-priority language before batch publish", () => {
  const english = {
    id: "english-first",
    lang: "en",
    external: true,
    prepared: true,
    autoSelectionEligible: false,
  };
  const arabic = {
    id: "arabic-second",
    lang: "ar",
    external: true,
    prepared: true,
    autoSelectionEligible: false,
  };
  const batch = new PreparedSubtitleSeedBatch([english, arabic]);
  const pendingSignature = subtitleAutoSelectionSignature([english, arabic]);

  batch.markReady(english);
  assert.equal(pickDesiredSubtitleTrack([english, arabic], ["ar"], false), null);
  batch.markReady(arabic);
  batch.commit(
    () => true,
    (ready) => {
      for (const track of ready) track.autoSelectionEligible = true;
    },
  );

  assert.notEqual(subtitleAutoSelectionSignature([english, arabic]), pendingSignature);
  assert.equal(pickDesiredSubtitleTrack([english, arabic], ["ar"], false)?.id, arabic.id);
});

test("moviehash enrichment is independent of timing autosync and uses the late-upgrade lease", () => {
  assert.doesNotMatch(autoloadSource, /settings\.subtitleAutoSync\s*&&/);
  assert.match(autoloadSource, /canResolveVideoHash\(src\)/);
  assert.match(autoloadSource, /shouldAutoSelect: shouldAutoSelectLateHash/);
  assert.match(autoloadSource, /error instanceof Error \? error\.name : "unknown"/);
});

test("delayed candidate preflight blocks structural autosync and an aligned result keeps it blocked", () => {
  const inferior = {
    external: true,
    lang: "ar",
    prepared: true,
    timingStatus: "fixed-offset" as const,
  };
  const aligned = {
    external: true,
    lang: "ar",
    prepared: true,
    timingStatus: "aligned" as const,
  };
  const alignedEnglish = {
    external: true,
    lang: "en",
    prepared: true,
    timingStatus: "aligned" as const,
  };

  assert.equal(
    automaticAutoSyncMayStart({
      preflightSettled: false,
      tracks: [inferior],
      selectedLanguage: "ar",
    }),
    false,
  );
  assert.equal(
    automaticAutoSyncMayStart({
      preflightSettled: false,
      tracks: [inferior, aligned],
      selectedLanguage: "ar",
    }),
    false,
  );
  assert.equal(
    automaticAutoSyncMayStart({
      preflightSettled: true,
      tracks: [inferior, aligned],
      selectedLanguage: "ar",
    }),
    false,
  );
  assert.equal(
    automaticAutoSyncMayStart({
      preflightSettled: true,
      tracks: [inferior],
      selectedLanguage: "ar",
    }),
    true,
  );
  assert.equal(
    automaticAutoSyncMayStart({
      preflightSettled: true,
      tracks: [inferior, alignedEnglish],
      selectedLanguage: "ar",
    }),
    true,
  );

  assert.match(autoloadSource, /subtitlePreflightSettled:/);
  assert.match(playerMediaSource, /subtitlePreflightSettled,/);
  assert.match(autoSyncSource, /automaticAutoSyncMayStart\(\{/);
});

test("mpv autosync reuses retained prepared cues and paths", () => {
  assert.match(mpvSource, /const transferredPrepared = takePreparedSubtitle\(url\)/);
  assert.match(mpvSource, /cues: preparedCues/);
  assert.match(mpvSource, /urlByExternalFilename\.get\([\s\S]*\)\?\.cues \?\? null/);
  assert.match(
    mpvSource,
    /if \(sel\.prepared && sel\.externalFilename\) return sel\.externalFilename/,
  );
});
