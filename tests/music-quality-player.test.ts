import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { queueTrackKey } from "../src/lib/music/queue-order.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

type Player = typeof import("../src/lib/music/player.ts");

const track: MusicTrack = {
  id: "same-recording",
  connectorId: "local",
  sourceId: "C:\\Music\\one.flac",
  title: "One",
  artist: "Artist",
  artwork: "",
  durationSeconds: 120,
  durationLabel: "2:00",
};

function player() {
  const source = readFileSync(new URL("../src/lib/music/player.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const callbacks = new Map<string, (event: { payload: Record<string, unknown> }) => void>();
  const module = { exports: {} };
  const mocks: Record<string, unknown> = {
    "@/lib/cast-ownership": { stopCastOwner: async () => {} },
    "@tauri-apps/api/core": {
      invoke: async (command: string) =>
        command === "music_db_init"
          ? { queue: [track], recents: [track], likedTracks: [track], likedIds: [track.id] }
          : undefined,
    },
    "@tauri-apps/api/event": {
      listen: async (
        name: string,
        callback: (event: { payload: Record<string, unknown> }) => void,
      ) => {
        callbacks.set(name, callback);
        return () => callbacks.delete(name);
      },
    },
    react: {},
    "./catalog": {},
    "./queue-order": { queueTrackKey },
    "./liked": {
      isMusicLiked: (ids: readonly string[], t: any) => !!t && ids.includes(t.id),
      likedIdsFor: (t: any) => (t ? [t.id] : []),
      withoutLiked: (ids: readonly string[], t: any) => ids.filter((id: string) => id !== t.id),
    },
    "./source-consent": { musicSourceAllowed: () => true, requestMusicSourceConsent: () => {} },
    "./queue-insert": {
      insertIntoQueue: (q: unknown[], t: unknown, at: number) => [
        ...q.slice(0, at),
        t,
        ...q.slice(at),
      ],
      markManuallyQueued: () => {},
      queueInsertIndex: (q: unknown[], i: number) => (i < 0 ? 0 : i + 1),
    },
    "./session-checkpoint": {
      newerCheckpoint: () => null,
      readCheckpointFromDb: async () => null,
      usableCheckpointPosition: () => 0,
      writeCheckpointToDb: () => {},
    },
    "./playback-origin": {
      getMusicPlaybackOrigin: () => null,
      restoreMusicPlaybackOrigin: () => {},
    },
    "./preferences": { readMusicPreference: () => null, writeMusicPreference: () => {} },
    "./hidden-recents": { unhideMusicRecent: () => {} },
    "./audio-settings": {
      initializeMusicAudioSettings: async () => {},
      clampMusicVolume: (value: number) => Math.max(0, Math.min(1, value)),
      subscribeMusicAudioSettings: () => () => {},
    },
    "./casting": {
      getMusicSpeakerState: () => ({ active: false }),
      subscribeMusicSpeakerState: () => () => {},
    },
  };
  const require = (name: string) => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
    return mocks[name];
  };
  new Function("require", "module", "exports", "localStorage", "navigator", outputText)(
    require,
    module,
    module.exports,
    { getItem: () => null },
    {},
  );
  return {
    store: module.exports as Player,
    event: (payload: Record<string, unknown>) => callbacks.get("music://event")?.({ payload }),
  };
}

test("quality events update only the active recording and matching connector", async () => {
  const { store, event } = player();
  const otherConnector = { ...track, connectorId: "plex" };
  await store.playMusic(track, [track, otherConnector]);
  const before = store.getMusicState();
  const quality = { codec: "flac", sampleRateHz: 96_000, bitDepth: 24, bitrateKbps: 1432 };
  event({ event: "audio-quality", trackId: "older-track", connectorId: "local", quality });
  event({ event: "audio-quality", trackId: track.id, connectorId: "plex", quality });
  assert.equal(store.getMusicState(), before);
  event({ event: "audio-quality", trackId: track.id, connectorId: "local", quality });
  const measured = store.getMusicState();
  assert.deepEqual(measured.current?.quality, quality);
  assert.deepEqual(measured.queue[0].quality, quality);
  assert.equal(measured.queue[1], otherConnector);
  assert.deepEqual(measured.recents[0].quality, quality);
  assert.deepEqual(measured.likedTracks[0].quality, quality);

  // Fresh decoder measurements replace old source measurements after a transcode.
  event({
    event: "audio-quality",
    trackId: track.id,
    connectorId: "local",
    quality: { codec: "aac", bitrateKbps: 256, bitDepth: NaN, sampleRateHz: -1, lossless: true },
  });
  assert.deepEqual(store.getMusicState().current?.quality, { codec: "aac", bitrateKbps: 256 });
});

test("initial and stale pause observations cannot complete loading or erase an error", async () => {
  const { store, event } = player();
  await store.playMusic(track);
  assert.equal(store.getMusicState().phase, "resolving");
  event({ event: "property-change", name: "pause", data: false });
  assert.equal(store.getMusicState().phase, "resolving");
  event({ event: "file-loaded" });
  assert.equal(store.getMusicState().phase, "playing");
  event({ event: "property-change", name: "pause", data: true });
  assert.equal(store.getMusicState().phase, "paused");
  event({ event: "player-failure", reason: "decode failed" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  event({ event: "property-change", name: "pause", data: false });
  assert.equal(store.getMusicState().phase, "error");
  assert.equal(store.getMusicState().error, "decode failed");

  // A music video deliberately started paused reports that pause before the file opens, so the
  // opened file must not be announced as playing over a still frame.
  await store.playMusic(track);
  event({ event: "property-change", name: "pause", data: true });
  assert.equal(store.getMusicState().phase, "resolving");
  event({ event: "file-loaded" });
  assert.equal(store.getMusicState().phase, "paused");
});

test("opening source recovery cannot falsely pause a playing song", async () => {
  const { store, event } = player();
  await store.playMusic(track);
  event({ event: "file-loaded" });
  store.clearMusicError();
  assert.equal(store.getMusicState().phase, "playing");
  event({ event: "player-failure", reason: "decode failed" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  store.clearMusicError();
  assert.equal(store.getMusicState().phase, "paused");
  assert.equal(store.getMusicState().error, null);
});
