// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  memoryControlsHarness,
  restoreHarness,
  subtitleTrack,
} from "./helpers/subtitle-memory-harness.ts";
import { deferred, flushBridge } from "./helpers/mpv-bridge-harness.ts";
import { rememberedFromChoice, type SubChoiceInput } from "../src/lib/subtitles/subtitle-memory.ts";

const five = subtitleTrack("5");
const six = subtitleTrack("6");
const rememberedSix = {
  ...rememberedFromChoice(six),
  streamKey: "torrent:fixture:0",
  updatedAt: 1,
};

test("restore does not substitute subtitle 5 while waiting for the exact saved subtitle 6", async () => {
  const h = restoreHarness(rememberedSix, [{ ...five, selected: false }]);
  h.run();
  await flushBridge();
  assert.deepEqual(h.picks, []);
});

test("a cached subtitle 6 loads immediately even when subtitle 5 with the same release arrives first", async () => {
  const h = restoreHarness(
    { ...rememberedSix, source: "C:/fixture/selected-six.srt", imported: true },
    [{ ...five, selected: false }],
  );
  h.run();
  await flushBridge();
  assert.deepEqual(h.picks, []);
  assert.deepEqual(h.adds, ["C:/fixture/selected-six.srt"]);
  assert.deepEqual(h.timers, []);
});

test("caching waits for native confirmation instead of copying subtitle 5 under subtitle 6's identity", async () => {
  const h = memoryControlsHarness();
  const player = h.mount(five, six);
  player.rememberSubChoice(six);
  await flushBridge();
  assert.equal(h.cacheRequests.length, 0);
  player.select(six);
  await flushBridge();
  assert.equal(h.cacheRequests.length, 1);
  assert.equal(h.cacheRequests[0].playableUrl, "prepared-6.srt");
});

test("the final selected subtitle starts caching before a delayed React render or player exit", async () => {
  const h = memoryControlsHarness();
  const player = h.mount(six, five);
  player.rememberSubChoice(six);
  await flushBridge();
  assert.equal(h.cacheRequests.length, 1);
  assert.equal(h.saved.get("fixture||")?.source, "cached-6.srt");
});

test("an older player cache completion cannot overwrite a newer choice after reopening", async () => {
  const h = memoryControlsHarness();
  const oldWrite = deferred<SubChoiceInput | null>();
  h.cacheWith(async (input) =>
    input.choice.id === "5"
      ? oldWrite.promise
      : { ...input.choice, source: "cached-6.srt", imported: true },
  );
  h.mount(five).rememberSubChoice(five);
  await flushBridge();
  h.mount(six).rememberSubChoice(six);
  await flushBridge();
  oldWrite.resolve({ ...five, source: "cached-5.srt", imported: true });
  await flushBridge();
  assert.equal(h.saved.get("fixture||")?.subId, "provider:6");
  assert.equal(h.saved.get("fixture||")?.source, "cached-6.srt");
});

test("switching 5 to 6 keeps the final choice even when 5 finishes caching later", async () => {
  const h = memoryControlsHarness();
  const oldWrite = deferred<SubChoiceInput | null>();
  h.cacheWith(async (input) =>
    input.choice.id === "5"
      ? oldWrite.promise
      : { ...input.choice, source: "cached-6.srt", imported: true },
  );
  const player = h.mount(five);
  player.rememberSubChoice(five);
  player.rememberSubChoice(six);
  player.select(six);
  await flushBridge();
  player.unmount();
  oldWrite.resolve({ ...five, source: "cached-5.srt", imported: true });
  await flushBridge();
  assert.equal(h.saved.get("fixture||")?.source, "cached-6.srt");
  assert.equal(player.listenerCount(), 0);
  assert.equal(h.timers.size, 0);
});

test("a confirmed choice can finish copying after exit without losing the local cache", async () => {
  const h = memoryControlsHarness();
  const copying = deferred<SubChoiceInput | null>();
  h.cacheWith(() => copying.promise);
  const player = h.mount(six, five);
  player.rememberSubChoice(six);
  player.unmount();
  copying.resolve({ ...six, source: "cached-6.srt", imported: true });
  await flushBridge();
  assert.equal(h.saved.get("fixture||")?.source, "cached-6.srt");
});

test("Off cancels a waiting cache and cannot be overwritten by an older file copy", async () => {
  const h = memoryControlsHarness();
  const copying = deferred<SubChoiceInput | null>();
  h.cacheWith(() => copying.promise);
  const player = h.mount(five);
  player.rememberSubChoice(five);
  player.rememberSubChoice(six);
  assert.equal(player.listenerCount(), 1);
  player.rememberSubChoice(null);
  player.select(six);
  copying.resolve({ ...five, source: "cached-5.srt", imported: true });
  await flushBridge();
  assert.equal(h.saved.get("fixture||")?.off, true);
  assert.equal(h.cacheRequests.length, 1);
  assert.equal(player.listenerCount(), 0);
  assert.equal(h.timers.size, 0);
});

test("a pending cache listener is released when leaving before native selection completes", async () => {
  const h = memoryControlsHarness();
  const player = h.mount(five);
  player.rememberSubChoice(six);
  assert.equal(player.listenerCount(), 1);
  player.unmount();
  player.select(six);
  await flushBridge();
  assert.equal(h.cacheRequests.length, 0);
  assert.equal(player.listenerCount(), 0);
  assert.equal(h.timers.size, 0);
});

test("provider results cannot displace an exact cached file with the same provider ID", async () => {
  const source = "C:/fixture/selected-six.srt";
  const h = restoreHarness({ ...rememberedSix, source, imported: true }, [
    { ...six, selected: false },
  ]);
  h.run();
  await flushBridge();
  assert.deepEqual(h.picks, []);
  assert.deepEqual(h.adds, [source]);
  h.scope.snap.subtitleTracks.push({
    ...six,
    id: "local-six",
    url: source,
    externalFilename: source,
    selected: true,
  });
  h.run();
  await flushBridge();
  assert.deepEqual(h.picks, []);
  assert.deepEqual(h.adds, [source]);
  assert.equal(h.scope.autoSubIdRef.current, "local-six");
});

test("remote memories can match an exact stable ID after a signed URL changes", () => {
  const h = restoreHarness(rememberedSix, [
    { ...five, selected: false },
    { ...six, id: "new-six", url: "https://example.test/6.srt?renewed=1", selected: false },
  ]);
  h.run();
  assert.deepEqual(h.picks, ["new-six"]);
});

test("a cached Windows path matches its normalized player path without adding a duplicate", () => {
  const source = "C:\\fixture\\selected-six.srt";
  const h = restoreHarness({ ...rememberedSix, source, imported: true }, [
    {
      ...six,
      id: "local-six",
      selected: false,
      url: undefined,
      externalFilename: "C:/fixture/selected-six.srt",
    },
  ]);
  h.run();
  assert.deepEqual(h.picks, ["local-six"]);
  assert.deepEqual(h.adds, []);
});
