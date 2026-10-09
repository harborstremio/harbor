import assert from "node:assert/strict";
import test from "node:test";
import {
  createMusicVideoSurfaces,
  musicVideoHandoff,
  musicVideoSessionKey,
  type MusicVideoMount,
} from "../src/lib/music/video-surfaces.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const song = (id: string): MusicTrack => ({
  id,
  connectorId: "youtube",
  title: id,
  artist: "Artist",
  artwork: "",
  durationSeconds: 180,
  durationLabel: "3:00",
  mediaKind: "video",
});
const mount = (key: string, priority: number): MusicVideoMount => ({ key, priority });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("an empty screen parks a live session instead of stopping it", () => {
  assert.deepEqual(musicVideoHandoff([], { key: "youtube:a", live: true, failedKey: "" }), {
    action: "park",
  });
  assert.deepEqual(musicVideoHandoff([], { key: "youtube:a", live: false, failedKey: "" }), {
    action: "stop",
  });
});

test("the expanded pop-out outranks the watch page and adopts the same session", () => {
  const watch = Symbol("watch");
  const popout = Symbol("popout");
  const mounted: Array<[symbol, MusicVideoMount]> = [
    [watch, mount("youtube:a", 0)],
    [popout, mount("youtube:a", 1)],
  ];
  assert.deepEqual(musicVideoHandoff(mounted, { key: "youtube:a", live: true, failedKey: "" }), {
    action: "adopt",
    owner: popout,
    key: "youtube:a",
  });
  assert.deepEqual(
    musicVideoHandoff([mounted[0]], { key: "youtube:a", live: true, failedKey: "" }),
    { action: "adopt", owner: watch, key: "youtube:a" },
  );
});

test("a new track loads, a failed key stays adoptable so retry has something to retry", () => {
  const owner = Symbol("owner");
  assert.deepEqual(
    musicVideoHandoff([[owner, mount("youtube:b", 0)]], {
      key: "youtube:a",
      live: true,
      failedKey: "",
    }),
    { action: "load", owner, key: "youtube:b" },
  );
  assert.deepEqual(
    musicVideoHandoff([[owner, mount("youtube:a", 0)]], {
      key: "youtube:a",
      live: false,
      failedKey: "youtube:a",
    }),
    { action: "adopt", owner, key: "youtube:a" },
  );
  assert.deepEqual(
    musicVideoHandoff([[owner, mount("youtube:a", 0)]], {
      key: "youtube:a",
      live: false,
      failedKey: "",
    }),
    { action: "load", owner, key: "youtube:a" },
  );
});

test("a surface hands over the identity the session is keyed by", () => {
  assert.equal(musicVideoSessionKey(song("a")), "youtube:a");
  assert.equal(musicVideoSessionKey({ id: "a" }), ":a");
});

test("leaving every surface keeps the video playing and reopening adopts it unreloaded", async () => {
  const calls: string[] = [];
  const store = createMusicVideoSurfaces(
    async (track, signal) => {
      calls.push(`load:${track.id}`);
      signal.addEventListener("abort", () => calls.push(`stop:${track.id}`));
    },
    () => () => {},
  );
  const closeWatch = store.register(Symbol("watch"), song("a"));
  await flush();
  assert.equal(store.getSnapshot().status, "playing");

  closeWatch();
  await flush();
  assert.deepEqual(calls, ["load:a"]);
  assert.equal(store.getSnapshot().status, "playing");
  assert.equal(store.getSnapshot().key, "youtube:a");
  assert.equal(store.getSnapshot().owner, null);

  const popout = Symbol("popout");
  const closePopout = store.register(popout, song("a"), 1);
  await flush();
  assert.deepEqual(calls, ["load:a"]);
  assert.equal(store.getSnapshot().owner, popout);
  assert.equal(store.getSnapshot().status, "playing");
  closePopout();
});
