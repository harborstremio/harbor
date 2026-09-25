import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { castOwnershipFixture } from "./helpers/cast-ownership.ts";
import { queueTrackKey } from "../src/lib/music/queue-order.ts";

const track = {
  id: "youtube:one",
  connectorId: "youtube_music",
  title: "One",
  artist: "Artist",
  artwork: "",
  durationSeconds: 120,
  durationLabel: "2:00",
};
const device = {
  id: "speaker",
  name: "Speaker",
  kind: "dlna",
  host: "192.0.2.1",
  port: 1400,
  control_url: "http://192.0.2.1/control",
  model: null,
  audio_only: true,
};

function fixture(respond?: (command: string, args?: any) => unknown, realCasting = false) {
  const source = readFileSync(new URL("../src/lib/music/player.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const callbacks = new Map();
  const calls: { command: string; args?: any }[] = [];
  let speaker: any = {
    active: false,
    device: null,
    track: null,
    phase: "idle",
    positionSec: 0,
    errorKey: null,
  };
  let listener = () => {};
  let failed = false;
  const update = (patch: any) => {
    speaker = { ...speaker, ...patch };
    listener();
  };
  const mocks: Record<string, any> = {
    "@/lib/cast-ownership": castOwnershipFixture(),
    "@tauri-apps/api/core": {
      invoke: async (command: string, args?: any) => {
        calls.push({ command, args });
        const response = respond?.(command, args);
        if (response !== undefined) return response;
        if (command === "music_db_init")
          return { queue: [], recents: [], likedTracks: [], likedIds: [] };
        if (command === "music_resolve_stream")
          return { url: "https://example.test/audio.mp3", mimeType: "audio/mpeg" };
        if (command === "cast_status")
          return { connected: true, player_state: "PLAYING", position_sec: 20 };
        return undefined;
      },
    },
    "@tauri-apps/api/event": {
      listen: async (name: string, fn: any) => {
        callbacks.set(name, fn);
        return () => {};
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
      clampMusicVolume: (n: number) => Math.max(0, Math.min(1, n)),
      subscribeMusicAudioSettings: () => () => {},
    },
    "./casting": {
      getMusicSpeakerState: () => speaker,
      subscribeMusicSpeakerState: (fn: () => void) => {
        listener = fn;
        return () => {};
      },
      loadMusicOnSpeaker: async (next: any, target: any, positionSec = 0) => {
        calls.push({ command: "speaker_load", args: { next, target, positionSec } });
        if (failed) throw new Error("Receiver unavailable");
        update({ active: true, device: target, track: next, phase: "unknown", positionSec });
        return speaker;
      },
      refreshMusicSpeakerStatus: async () => {
        update({ phase: "playing" });
        return speaker;
      },
      pauseMusicSpeaker: async () => {
        calls.push({ command: "speaker_pause" });
      },
      playMusicSpeaker: async () => {
        calls.push({ command: "speaker_play" });
      },
      seekMusicSpeaker: async (sec: number) => {
        calls.push({ command: "speaker_seek", args: { sec } });
      },
      stopMusicSpeaker: async () => {
        calls.push({ command: "speaker_stop" });
        update({ active: false, device: null, phase: "idle" });
      },
    },
  };
  if (realCasting) {
    const castingSource = readFileSync(
      new URL("../src/lib/music/casting.ts", import.meta.url),
      "utf8",
    );
    const castingOutput = ts.transpileModule(castingSource, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const castingModule = { exports: {} };
    new Function("require", "module", "exports", "window", castingOutput)(
      (name: string) => {
        assert.ok(name in mocks, name);
        return mocks[name];
      },
      castingModule,
      castingModule.exports,
      { __TAURI_INTERNALS__: {} },
    );
    mocks["./casting"] = castingModule.exports;
  }
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    "localStorage",
    "navigator",
    "setTimeout",
    "clearTimeout",
    output,
  )(
    (name: string) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    module,
    module.exports,
    { getItem: () => null },
    {},
    () => 1,
    () => {},
  );
  return {
    player: module.exports as typeof import("../src/lib/music/player.ts"),
    casting: mocks["./casting"] as typeof import("../src/lib/music/casting.ts"),
    calls,
    update,
    fail: () => {
      failed = true;
    },
    event: (payload: any) => callbacks.get("music://event")?.({ payload }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("speaker handoff routes controls and ignores paused local-engine events", async () => {
  const f = fixture();
  await f.player.playMusic(track);
  f.event({ event: "file-loaded" });
  f.event({ event: "property-change", name: "time-pos", data: 32 });
  await f.player.playMusicOnSpeaker(device as any);
  assert.equal(f.player.getMusicState().phase, "playing");
  const load = f.calls.findIndex((c) => c.command === "speaker_load");
  assert.equal(f.calls[load - 1].command, "music_engine_pause");
  assert.equal(f.calls[load].args.positionSec, 32);
  f.event({ event: "property-change", name: "pause", data: true });
  assert.equal(f.player.getMusicState().phase, "playing");
  f.player.toggleMusicPlayback();
  f.player.seekMusic(50);
  const before = f.calls.length;
  f.player.setMusicVolume(5);
  assert.equal(f.calls.length, before, "PC boost must not reach a network speaker");
  assert.ok(f.calls.some((c) => c.command === "speaker_pause"));
  assert.ok(f.calls.some((c) => c.command === "speaker_seek" && c.args.sec === 50));
  f.update({ positionSec: 44 });
  await f.player.returnMusicToComputer();
  f.event({ event: "file-loaded" });
  assert.ok(f.calls.some((c) => c.command === "music_engine_seek" && c.args.position === 44));
});

test("a failed receiver transfer restores local playback", async () => {
  const f = fixture();
  await f.player.playMusic(track);
  f.event({ event: "file-loaded" });
  f.fail();
  await assert.rejects(f.player.playMusicOnSpeaker(device as any), /Receiver unavailable/);
  assert.equal(f.player.getMusicState().phase, "playing");
  assert.deepEqual(f.calls.at(-1), { command: "music_engine_pause", args: { paused: false } });
});

test("disconnection leaves an actionable error without automatically playing locally", async () => {
  const f = fixture();
  await f.player.playMusic(track);
  await f.player.playMusicOnSpeaker(device as any);
  const before = f.calls.length;
  f.update({ active: false, phase: "disconnected", errorKey: "music.cast.disconnected" });
  assert.equal(f.player.getMusicState().error, "music.cast.disconnected");
  assert.equal(f.player.getMusicState().phase, "error");
  assert.equal(f.calls.length, before);
});

test("selecting a new track during receiver resolution cannot leave the old track playing remotely", async () => {
  const pendingStream = deferred<any>();
  const f = fixture(
    (command) => (command === "music_resolve_stream" ? pendingStream.promise : undefined),
    true,
  );
  await f.player.playMusic(track);
  f.event({ event: "file-loaded" });
  let transferError: unknown;
  const transfer = f.player.playMusicOnSpeaker(device as any).catch((error) => {
    transferError = error;
  });
  await tick();
  const next = { ...track, id: "youtube:two", title: "Two" };
  const selection = f.player.playMusic(next);
  await tick();
  pendingStream.resolve({ url: "https://example.test/audio.mp3", mimeType: "audio/mpeg" });
  await Promise.all([transfer, selection]);
  assert.equal(
    transferError,
    undefined,
    "superseded transfer must not display a failure after the new selection succeeds",
  );
  assert.equal(f.player.getMusicState().current?.id, next.id);
  const speaker = f.casting.getMusicSpeakerState();
  assert.ok(
    !speaker.active || speaker.track?.id === next.id,
    "old track must not remain active on receiver after new selection",
  );
});

test("returning to computer cannot overwrite a new track selected while receiver stop is pending", async () => {
  const pendingStop = deferred<void>();
  const f = fixture((command) => (command === "cast_stop" ? pendingStop.promise : undefined), true);
  await f.player.playMusic(track);
  await f.player.playMusicOnSpeaker(device as any);
  const returning = f.player.returnMusicToComputer();
  await tick();
  const next = { ...track, id: "youtube:two", title: "Two" };
  const selection = f.player.playMusic(next);
  await tick();
  pendingStop.resolve();
  await Promise.all([returning, selection]);
  assert.equal(
    f.player.getMusicState().current?.id,
    next.id,
    "new selection must win over captured return track",
  );
});

test("an older transfer cannot load after a newer selection wins during local pause", async () => {
  const pendingPause = deferred<void>();
  const f = fixture(
    (command) => (command === "music_engine_pause" ? pendingPause.promise : undefined),
    true,
  );
  await f.player.playMusic(track);
  f.event({ event: "file-loaded" });
  const transfer = f.player.playMusicOnSpeaker(device as any).catch(() => {});
  await tick();
  const next = { ...track, id: "youtube:two", title: "Two" };
  await f.player.playMusic(next);
  pendingPause.resolve();
  await transfer;
  assert.equal(f.player.getMusicState().current?.id, next.id);
  assert.equal(f.casting.getMusicSpeakerState().track?.id, next.id);
  assert.equal(
    f.calls.filter((call) => call.command === "cast_load").length,
    1,
    "superseded transfer must not load the old track",
  );
});
