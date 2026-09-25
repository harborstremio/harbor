// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
import ts from "typescript";

function read(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

const one = {
  id: "v1",
  connectorId: "yt",
  title: "One",
  artist: "A",
  mediaKind: "video",
  durationSeconds: 200,
} as any;
const two = {
  id: "v2",
  connectorId: "yt",
  title: "Two",
  artist: "A",
  mediaKind: "video",
  durationSeconds: 180,
} as any;

function loadPlayer() {
  const calls: Array<{ command: string; args: any }> = [];
  const source = ts.transpileModule(read("lib/music/player.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const resolve = (name: string): any => {
    if (name === "@tauri-apps/api/core")
      return {
        invoke: async (command: string, args: any) => {
          calls.push({ command, args });
          if (command === "music_db_init")
            return { likedIds: [], likedTracks: [], recents: [], queue: [one, two] };
          if (command === "music_source_candidates") return [];
          return undefined;
        },
      };
    if (name === "@tauri-apps/api/event") return { listen: async () => () => {} };
    if (name === "react") return { useSyncExternalStore: () => undefined };
    if (name === "./queue-order")
      return { queueTrackKey: (track: any) => `${track.connectorId}:${track.id}` };
    if (name === "./liked")
      return {
        isMusicLiked: (ids: readonly string[], t: any) => !!t && ids.includes(t.id),
        likedIdsFor: (t: any) => (t ? [t.id] : []),
        withoutLiked: (ids: readonly string[], t: any) => ids.filter((id: string) => id !== t.id),
      };
    if (name === "./source-consent")
      return { musicSourceAllowed: () => true, requestMusicSourceConsent: () => {} };
    if (name === "./queue-insert")
      return {
        insertIntoQueue: (q: any[], t: any, at: number) => [...q.slice(0, at), t, ...q.slice(at)],
        markManuallyQueued: () => {},
        queueInsertIndex: (q: any[], i: number) => (i < 0 ? 0 : i + 1),
      };
    if (name === "./preferences")
      return { readMusicPreference: () => null, writeMusicPreference: () => {} };
    if (name === "./audio-settings")
      return {
        clampMusicVolume: (value: number) => value,
        initializeMusicAudioSettings: async () => {},
        subscribeMusicAudioSettings: () => () => {},
      };
    if (name === "./session-checkpoint")
      return {
        newerCheckpoint: () => null,
        readCheckpointFromDb: async () => null,
        usableCheckpointPosition: () => 0,
        writeCheckpointToDb: () => {},
      };
    if (name === "./hidden-recents") return { unhideMusicRecent: () => {} };
    if (name === "./playback-origin")
      return { getMusicPlaybackOrigin: () => null, restoreMusicPlaybackOrigin: () => {} };
    if (name === "@/lib/cast-ownership") return { stopCastOwner: () => {} };
    if (name === "./casting")
      return {
        getMusicSpeakerState: () => ({ active: false, device: null, positionSec: 0 }),
        loadMusicOnSpeaker: async () => {},
        pauseMusicSpeaker: async () => {},
        playMusicSpeaker: async () => {},
        refreshMusicSpeakerStatus: async () => {},
        seekMusicSpeaker: async () => {},
        stopMusicSpeaker: async () => {},
        subscribeMusicSpeakerState: () => () => {},
      };
    throw Error(name);
  };
  const module = { exports: {} as any };
  new Function("require", "module", "exports", source)(resolve, module, module.exports);
  return {
    api: module.exports,
    calls,
    commands: (): string[] => calls.map((call) => call.command),
  };
}

function spyController() {
  const seen: Array<[string, unknown]> = [];
  return {
    seen,
    controller: {
      setPaused: (paused: boolean) => seen.push(["setPaused", paused]),
      seek: (position: number) => seen.push(["seek", position]),
      setVolume: (volume: number) => seen.push(["setVolume", volume]),
    },
  };
}

const settle = async (rounds = 24) => {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
};

async function activeVideo() {
  const loaded = loadPlayer();
  await loaded.api.initializeMusic();
  await loaded.api.activateMusicVideo(one.id);
  assert.equal(loaded.api.isMusicVideoActive(), true, "the video never took ownership of the dock");
  return loaded;
}

test("taking the picture hands the song over so the engine and the elements never sound at once", async () => {
  const { api, calls } = await activeVideo();
  const handover = calls.filter((call) => call.command === "music_engine_pause");
  assert.equal(handover.length, 1, `expected one engine pause, saw ${handover.length}`);
  assert.deepEqual(handover[0].args, { paused: true });
  assert.equal(api.getMusicState().phase, "resolving");
});

test("the elements report playback, so the phase leaves resolving and the scrubber moves", async () => {
  const { api } = await activeVideo();
  api.reportMusicVideoPlayback({ phase: "playing", currentTime: 3.5, duration: 201 });
  const state = api.getMusicState();
  assert.equal(state.phase, "playing");
  assert.equal(state.currentTime, 3.5);
  assert.equal(state.duration, 201);
  api.reportMusicVideoPlayback({ currentTime: 12 });
  assert.equal(api.getMusicState().currentTime, 12);
});

test("play, pause, seek and volume reach the media elements and never a native player", async () => {
  const { api, commands } = await activeVideo();
  const { seen, controller } = spyController();
  api.setMusicVideoController(controller);
  api.reportMusicVideoPlayback({ phase: "playing", currentTime: 1, duration: 200 });
  api.toggleMusicPlayback();
  assert.deepEqual(
    seen.at(-1),
    ["setPaused", true],
    "the dock pause button did not reach the picture",
  );
  api.reportMusicVideoPlayback({ phase: "paused", currentTime: 1 });
  api.toggleMusicPlayback();
  assert.deepEqual(
    seen.at(-1),
    ["setPaused", false],
    "the dock play button did not reach the picture",
  );
  api.seekMusic(42.5);
  assert.deepEqual(seen.at(-1), ["seek", 42.5]);
  api.setMusicVolume(0.4);
  assert.deepEqual(seen.at(-1), ["setVolume", 0.4]);
  assert.equal(
    commands().some((command) => command.startsWith("mpv")),
    false,
    `mpv was commanded: ${commands().join(",")}`,
  );
});

test("a picture that reached the end advances the queue instead of stopping dead", async () => {
  const { api, calls, commands } = await activeVideo();
  api.reportMusicVideoPlayback({ phase: "playing", currentTime: 199, duration: 200 });
  api.reportMusicVideoPlayback({ ended: true });
  await settle();
  const played = calls.filter((call) => call.command === "music_play_track");
  assert.equal(played.length, 1, `expected the next track to start, saw ${played.length}`);
  assert.equal(played[0].args.track.id, two.id);
  assert.equal(
    commands().some((command) => command.startsWith("mpv")),
    false,
  );
});

test("closing the player during a video never stops the movie player's decoder", async () => {
  const { api, commands } = await activeVideo();
  const { seen, controller } = spyController();
  api.setMusicVideoController(controller);
  await api.closeMusicPlayer();
  assert.deepEqual(seen.at(-1), ["setPaused", true]);
  assert.equal(commands().includes("mpv_stop"), false, "closing the music dock still stops mpv");
  assert.equal(commands().includes("music_engine_stop"), true);
  assert.equal(api.isMusicVideoActive(), false);
});

test("a report from a picture that no longer owns the dock is ignored", async () => {
  const { api } = await activeVideo();
  await api.closeMusicPlayer();
  const before = api.getMusicState();
  api.reportMusicVideoPlayback({ phase: "playing", currentTime: 99 });
  assert.equal(api.getMusicState().phase, before.phase);
  assert.equal(api.getMusicState().currentTime, before.currentTime);
});

test("the music player carries no mpv command and no mpv event listener at all", () => {
  const source = read("lib/music/player.ts");
  for (const banned of [
    "mpv_set_property",
    "mpv_command",
    "mpv_stop",
    "mpv_start",
    "mpv://event",
  ]) {
    assert.equal(source.includes(banned), false, `${banned} still drives the music path`);
  }
});

test("the session host is the production caller of the controller and of the report", () => {
  const host = read("lib/music/video-host.ts");
  assert.match(host, /setMusicVideoController\(/);
  assert.match(host, /reportMusicVideoPlayback\(/);
  assert.match(host, /addEventListener\("ended"/);
  assert.match(host, /addEventListener\("timeupdate"/);
  const surface = read("components/music/music-video-surface.tsx");
  assert.equal(
    surface.includes("setMusicVideoController"),
    false,
    "a React surface owning the controller dies with the page",
  );
  assert.equal(
    surface.includes("reportMusicVideoPlayback"),
    false,
    "a React surface owning the report dies with the page",
  );
});

test("the fullscreen overlay stopped chasing a rectangle and stopped poking a native window", () => {
  const overlay = read("components/music/music-video-fullscreen.tsx");
  const banned = [
    "getBoundingClientRect",
    "mpv_force_below",
    "harbor:mpv-force-geom",
    "harbor:mpv-refresh-geom",
    "webview_reapply_transparency",
    "enterWindowFullscreen",
    'addEventListener("scroll"',
  ];
  for (const value of banned) {
    assert.equal(overlay.includes(value), false, `${value} still positions the music overlay`);
  }
});
