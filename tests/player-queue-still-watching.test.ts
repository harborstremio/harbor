// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import * as queue from "../src/lib/queue.ts";
import * as stillWatching from "../src/lib/still-watching.ts";

const firstMeta = { id: "tt-first", type: "series", name: "First" } as const;
const secondMeta = { id: "tt-second", type: "movie", name: "Second" } as const;
const thirdMeta = { id: "tt-third", type: "series", name: "Third" } as const;
const firstEpisode = { season: 1, episode: 1 };
const thirdEpisode = { season: 2, episode: 4 };
const playerSource = readFileSync(new URL("../src/views/player.tsx", import.meta.url), "utf8");
const queueAdvanceSource = readFileSync(
  new URL("../src/views/player/hooks/use-queue-advance.ts", import.meta.url),
  "utf8",
);
const queuePanelSource = readFileSync(
  new URL("../src/components/player/cast-modal/queue-panel.tsx", import.meta.url),
  "utf8",
);

test("queue positional helpers use media and episode identity without removing entries", () => {
  assert.equal(typeof (queue as Record<string, unknown>).queueIndexOf, "function");
  assert.equal(typeof (queue as Record<string, unknown>).queueItemAfter, "function");
  assert.equal(typeof (queue as Record<string, unknown>).queueItemBefore, "function");

  queue.queueClear();
  queue.queueAdd(firstMeta, firstEpisode);
  queue.queueAdd(secondMeta);
  queue.queueAdd(thirdMeta, thirdEpisode);

  assert.equal(queue.queueIndexOf(firstMeta, { ...firstEpisode }), 0);
  assert.equal(queue.queueIndexOf(firstMeta, { season: 1, episode: 2 }), -1);
  assert.equal(queue.queueIndexOf({ ...secondMeta }), 1);
  assert.equal(queue.queueIndexOf({ ...thirdMeta }, { ...thirdEpisode }), 2);
  assert.equal(queue.queueIndexOf({ id: "missing", type: "movie", name: "Missing" }), -1);

  assert.equal(queue.queueItemBefore(firstMeta, firstEpisode), null);
  assert.equal(queue.queueItemAfter(firstMeta, firstEpisode)?.meta.id, secondMeta.id);
  assert.equal(queue.queueItemBefore(thirdMeta, thirdEpisode)?.meta.id, secondMeta.id);
  assert.equal(queue.queueItemAfter(thirdMeta, thirdEpisode), null);
  assert.equal(queue.queueItemAfter({ id: "missing", type: "movie", name: "Missing" }), null);

  assert.equal(queue.queueIndexOf(firstMeta, firstEpisode), 0);
  assert.equal(queue.queueIndexOf(secondMeta), 1);
  assert.equal(queue.queueIndexOf(thirdMeta, thirdEpisode), 2);
  queue.queueClear();
});

test("completing a queued item removes it and returns its successor", () => {
  queue.queueClear();
  queue.queueAdd(firstMeta, firstEpisode);
  queue.queueAdd(secondMeta);
  queue.queueAdd(thirdMeta, thirdEpisode);

  const next = queue.queueCompleteCurrent(firstMeta, firstEpisode);

  assert.equal(next?.meta.id, secondMeta.id);
  assert.equal(queue.queueIndexOf(firstMeta, firstEpisode), -1);
  assert.equal(queue.queueIndexOf(secondMeta), 0);
  assert.equal(queue.queueCompleteCurrent({ id: "missing", type: "movie", name: "Missing" }), null);
  assert.equal(queue.queueIndexOf(secondMeta), 0);
  queue.queueClear();
});

test("starting a queued item keeps it available until playback completes", () => {
  assert.doesNotMatch(
    queuePanelSource,
    /onClick=\{\(\) => \{\s*queueRemove\(item\.id\);\s*onPlay\(item\.meta, item\.episode\);/,
  );
  assert.match(queuePanelSource, /onClick=\{\(\) => onPlay\(item\.meta, item\.episode\)\}/);
  assert.match(
    queueAdvanceSource,
    /const nextItem = queueCompleteCurrent\(src\.meta, src\.episode\);/,
  );
});

test("queue suggestions do not synchronously clear state inside an effect", () => {
  assert.doesNotMatch(queuePanelSource, /useEffect\(\(\) => \{[\s\S]*?setUpcoming\(\[\]\);/);
});

test("Still Watching clamps its threshold to the supported range", () => {
  assert.equal(stillWatching.clampStillWatchingThreshold(-3), 1);
  assert.equal(stillWatching.clampStillWatchingThreshold(4.6), 5);
  assert.equal(stillWatching.clampStillWatchingThreshold(99), 10);
  assert.equal(stillWatching.clampStillWatchingThreshold(Number.NaN), 3);
});

test("Still Watching allows N automatic advances and asks before N+1", () => {
  const initialState = stillWatching.initialStillWatchingState<{
    season: number;
    episode: number;
  }>();
  const first = stillWatching.requestStillWatchingAdvance(
    initialState,
    { season: 1, episode: 2 },
    true,
    3,
  );
  const second = stillWatching.requestStillWatchingAdvance(
    first.state,
    { season: 1, episode: 3 },
    true,
    3,
  );
  const third = stillWatching.requestStillWatchingAdvance(
    second.state,
    { season: 1, episode: 4 },
    true,
    3,
  );
  const fourth = stillWatching.requestStillWatchingAdvance(
    third.state,
    { season: 1, episode: 5 },
    true,
    3,
  );

  assert.deepEqual([first.held, second.held, third.held, fourth.held], [false, false, false, true]);
  assert.equal(fourth.state.runCount, 3);
  assert.deepEqual(fourth.state.pending, { season: 1, episode: 5 });
});

test("Still Watching run survives store re-reads across simulated player remounts", () => {
  const key = "series:tt-persist";
  stillWatching.clearStillWatchingState(key);

  const held = [2, 3, 4, 5].map((episode) => {
    const beforeRemount = stillWatching.getStillWatchingState<{
      season: number;
      episode: number;
    }>(key);
    const result = stillWatching.requestStillWatchingAdvance(
      beforeRemount,
      { season: 1, episode },
      true,
      stillWatching.DEFAULT_STILL_WATCHING_THRESHOLD,
    );
    stillWatching.setStillWatchingState(key, result.state);
    assert.deepEqual(stillWatching.getStillWatchingState(key), result.state);
    return result.held;
  });

  assert.deepEqual(held, [false, false, false, true]);
  assert.deepEqual(stillWatching.getStillWatchingState(key), {
    runCount: 3,
    pending: { season: 1, episode: 5 },
  });
  stillWatching.clearStillWatchingState(key);
});

test("Still Watching interaction and decisions reset the automatic run", () => {
  const started = stillWatching.requestStillWatchingAdvance(
    { runCount: 0, pending: null },
    { season: 1, episode: 2 },
    true,
    2,
  );
  const interacted = stillWatching.resetStillWatchingRun(started.state);
  assert.deepEqual(interacted, { runCount: 0, pending: null });

  const allowed = stillWatching.requestStillWatchingAdvance(
    interacted,
    { season: 1, episode: 3 },
    true,
    1,
  );
  const held = stillWatching.requestStillWatchingAdvance(
    allowed.state,
    { season: 1, episode: 4 },
    true,
    1,
  );
  const resolved = stillWatching.resolveStillWatchingPrompt(held.state);
  assert.deepEqual(resolved.pending, { season: 1, episode: 4 });
  assert.deepEqual(resolved.state, { runCount: 0, pending: null });

  const disabled = stillWatching.requestStillWatchingAdvance(
    { runCount: 8, pending: null },
    { season: 1, episode: 5 },
    false,
    2,
  );
  assert.equal(disabled.held, false);
  assert.deepEqual(disabled.state, { runCount: 0, pending: null });
});

test("queue ownership suppresses adjacent Up Next while preserving queued natural advance", () => {
  assert.match(
    playerSource,
    /const queueOwnsCurrent = queueIndexOf\(src\.meta, src\.episode\) >= 0;/,
  );
  assert.match(
    playerSource,
    /const showAdjacentUpNext =\s*!queueOwnsCurrent && canChangeEpisode && !autoNextCancelled;/,
  );
  assert.match(
    playerSource,
    /hasNextEpDisplay: showAdjacentUpNext && !!adjacent\.next,\s*nextEp: showAdjacentUpNext \? adjacent\.next : null,/,
  );
  assert.match(
    queueAdvanceSource,
    /const nextItem = queueCompleteCurrent\(src\.meta, src\.episode\);/,
  );
  assert.match(
    queueAdvanceSource,
    /if \(nextItem\) \{[\s\S]*?openPicker\(nextItem\.meta, nextItem\.episode, \{[^}]*autoPlay: true,[^}]*resume: true[^}]*\}\);/,
  );
});

test("Still Watching Stop always uses the confirmed close path", () => {
  assert.match(
    playerSource,
    /const requestStillWatchingStop = useCallback\(\(\) => \{[\s\S]*?requestPlayerClose\(\{[\s\S]*?closePlayer,[\s\S]*?playerEscExitsFullscreen: false,[\s\S]*?playerConfirmLeave: true,[\s\S]*?onRememberConfirmLeave: \(\) => update\(\{ playerConfirmLeave: false \}\),/,
  );
  assert.match(
    playerSource,
    /useStillWatching\(\{[\s\S]*?onContinue: goToEpisode,[\s\S]*?onStop: requestStillWatchingStop,/,
  );
});

test("remote and HDR-stage input reset the uninterrupted Still Watching run", () => {
  const remoteBinding = readFileSync(
    new URL("../src/lib/remote/use-remote-playback-binding.ts", import.meta.url),
    "utf8",
  );
  const remoteSession = readFileSync(
    new URL("../src/lib/remote/session.ts", import.meta.url),
    "utf8",
  );
  const hdrBridge = readFileSync(
    new URL("../src/views/player/hdr-stage-bridge.tsx", import.meta.url),
    "utf8",
  );
  const hdrOverlay = readFileSync(
    new URL("../src/views/hdr-overlay-app.tsx", import.meta.url),
    "utf8",
  );

  assert.match(remoteBinding, /onActivity\?: \(\) => void/);
  assert.match(
    remoteSession,
    /command\.action !== "ping" && command\.action !== "castDiscover"[\s\S]*?b\?\.onActivity\?\.\(\)/,
  );
  assert.match(hdrBridge, /onInput\?: \(\) => void/);
  assert.match(hdrBridge, /onInputRef\.current\?\.\(\)/);
  assert.match(hdrBridge, /await bind\("hdr-stage:\/\/menu-open"/);
  assert.doesNotMatch(hdrBridge, /bindInput\("hdr-stage:\/\/menu-open"/);
  assert.match(hdrOverlay, /window\.addEventListener\("pointerdown", onInput/);
  assert.match(hdrOverlay, /window\.addEventListener\("keydown", onInput/);
  assert.match(playerSource, /onActivity: resetStillWatching/);
  assert.match(playerSource, /onInput=\{resetStillWatching\}/);
});
