import assert from "node:assert/strict";
import test from "node:test";
import {
  continueActualPlayback,
  continuationFor,
  continuationStream,
  type ContinuationServices,
} from "../src/lib/player/continue-playback";
import type { ActualPlayback } from "../src/lib/playback-history";

function fixture(): ActualPlayback {
  return {
    id: "actual-a",
    actor: { profileId: "one", storageProfileId: "one", accountId: "account" },
    playedAt: 1,
    positionMs: 45000,
    durationMs: 600000,
    completed: false,
    src: { meta: { id: "local:a", type: "movie", name: "A" }, title: "A", url: "C:/fixture/a.mp4" },
  };
}
function services(target: ActualPlayback) {
  const calls: unknown[] = [];
  const api: ContinuationServices = {
    isCurrent: () => true,
    latest: () => target,
    active: () => null,
    localFileExists: async () => true,
    openPlayer: (src) => calls.push(["play", src]),
    openPicker: (...args) => calls.push(["pick", ...args]),
    prepareServer: async (src) => src,
  };
  return { calls, api };
}
test("continues captured A's exact file and position; opening menus on B is irrelevant", async () => {
  const target = fixture();
  const { api, calls } = services(target);
  assert.equal(await continueActualPlayback(target, {}, api), "player-opened");
  const [, src] = calls[0] as [string, { url: string; startPositionMs: number }];
  assert.equal(src.url, target.src.url);
  assert.equal(src.startPositionMs, 45000);
});
test("active target returns through its operation without opening another session", async () => {
  const target = fixture();
  const { api, calls } = services(target);
  api.active = () => ({
    src: target.src,
    resume: async () => {
      calls.push("returned");
    },
  });
  assert.equal(await continueActualPlayback(target, {}, api), "returned");
  assert.deepEqual(calls, ["returned"]);
});
test("completed targets require explicit restart and keep the same item", async () => {
  const target = { ...fixture(), completed: true };
  const { api, calls } = services(target);
  await assert.rejects(continueActualPlayback(target, {}, api), /finished/);
  assert.equal(calls.length, 0);
  await continueActualPlayback(target, { restart: true }, api);
  assert.equal(
    (calls[0] as [string, { startFromZero: boolean; startPositionMs: number }])[1].startPositionMs,
    0,
  );
});

test("completed active target requires confirmation then restarts through that same player", async () => {
  const target = { ...fixture(), completed: true };
  const { api, calls } = services(target);
  api.active = () => ({
    src: target.src,
    resume: async (options) => {
      calls.push(options);
    },
  });
  await assert.rejects(continueActualPlayback(target, {}, api), /finished/);
  assert.deepEqual(calls, []);
  assert.equal(await continueActualPlayback(target, { restart: true }, api), "returned");
  assert.deepEqual(calls, [{ restart: true }]);
});
test("missing unrecognized file fails; recognized source recovery preserves episode and does not autoplay", async () => {
  const target = fixture();
  const { api, calls } = services(target);
  api.localFileExists = async () => false;
  await assert.rejects(continueActualPlayback(target, {}, api), /missing/);
  target.src.meta = { id: "ttfixture", name: "A", type: "series" };
  target.src.episode = { season: 3, episode: 4 };
  assert.equal(await continueActualPlayback(target, {}, api), "picker-opened");
  const call = calls[0] as [
    string,
    unknown,
    unknown,
    { autoPlay: boolean; continuation: { positionMs: number } },
  ];
  assert.deepEqual(call[2], { season: 3, episode: 4 });
  assert.equal(call[3].autoPlay, false);
  assert.equal(call[3].continuation.positionMs, 45000);
});
test("late local check cannot launch after actor or actual last target changes", async () => {
  const target = fixture();
  const { api, calls } = services(target);
  api.localFileExists = async () => {
    api.isCurrent = () => false;
    return true;
  };
  await assert.rejects(continueActualPlayback(target, {}, api), /profile/);
  assert.equal(calls.length, 0);
});

test("continuation remembers the selected torrent file without accepting a different known file", () => {
  const target = fixture();
  target.src.streamRef = { infoHash: "abc", fileIdx: 4 };
  const context = continuationFor(target, target.actor);
  assert.deepEqual(continuationStream({ infoHash: "abc", fileIdx: undefined }, context), {
    infoHash: "abc",
    fileIdx: 4,
  });
  assert.equal(continuationStream({ infoHash: "abc", fileIdx: 6 }, context), null);
  assert.equal(continuationStream({ infoHash: "different", fileIdx: undefined }, context), null);
});

test("home-server preparation receives actual position and explicit restart zero", async () => {
  const target = fixture();
  target.src.url = "https://fixture.invalid/video";
  target.src.homeServer = {
    connectionId: "server",
    itemId: "item",
    versionId: "version",
    quality: "original",
  };
  const { api } = services(target);
  const positions: number[] = [];
  api.prepareServer = async (src, positionMs) => {
    positions.push(positionMs);
    return src;
  };
  await continueActualPlayback(target, {}, api);
  await continueActualPlayback(target, { restart: true }, api);
  assert.deepEqual(positions, [45000, 0]);
});
