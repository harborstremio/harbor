import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { castOwnershipFixture } from "./helpers/cast-ownership.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";
import type { CastDeviceInfo } from "../src/lib/cast.ts";

type Casting = typeof import("../src/lib/music/casting.ts");
const track: MusicTrack = {
  id: "soundcloud:1",
  connectorId: "soundcloud",
  title: "Song",
  artist: "Artist",
  artwork: "https://example.test/art.jpg",
  durationSeconds: 180,
  durationLabel: "3:00",
};
const speaker: CastDeviceInfo = {
  id: "dlna:1",
  name: "Marantz",
  host: "192.0.2.10",
  port: 0,
  model: "Test model",
  kind: "dlna",
  control_url: "http://192.0.2.10/AVTransport",
  audio_only: true,
};
const stream = {
  url: "https://example.test/song?signature=real-source-value",
  mimeType: "audio/mpeg",
  httpHeaders: { "User-Agent": "Provider-issued user agent" },
};

function fixture(
  respond: (command: string, args: any) => unknown = () => undefined,
  desktop = true,
) {
  const calls: { command: string; args: any }[] = [];
  const source = readFileSync(new URL("../src/lib/music/casting.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const ownership = castOwnershipFixture();
  new Function("require", "module", "exports", "window", outputText)(
    (name: string) => {
      if (name === "@/lib/cast-ownership") return ownership;
      assert.equal(name, "@tauri-apps/api/core");
      return {
        invoke: async (command: string, args: any) => {
          calls.push({ command, args });
          const response = respond(command, args);
          if (response !== undefined) return response;
          if (command === "music_resolve_stream") return stream;
          if (command === "cast_discover") return [speaker];
          if (command === "cast_status")
            return { connected: true, position_sec: 27, player_state: "PLAYING" };
          return null;
        },
      };
    },
    module,
    module.exports,
    desktop ? { __TAURI_INTERNALS__: {} } : {},
  );
  return { casting: module.exports as Casting, calls, ownership };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("speaker discovery is explicit, preserves model data and reports native errors", async () => {
  const { casting, calls } = fixture((command) =>
    command === "cast_discover"
      ? [{ ...speaker, id: "air", kind: "airplay", name: "AirPlay speaker" }, speaker, speaker]
      : undefined,
  );
  assert.equal(calls.length, 0);
  const devices = await casting.discoverMusicSpeakers();
  assert.equal(devices.length, 2);
  assert.deepEqual(devices[0], speaker);
  assert.equal(casting.musicSpeakerCompatibility(devices[1]), "music.cast.airplay");
  const failure = fixture(() => {
    throw new Error("Network denied");
  });
  await assert.rejects(failure.casting.discoverMusicSpeakers(), {
    key: "music.cast.discoveryFailed",
  });
  await assert.rejects(fixture(undefined, false).casting.discoverMusicSpeakers(), {
    key: "music.cast.desktop",
  });
});

test("DRM, local tracks and unsupported device protocols never trigger native playback", async () => {
  const { casting, calls } = fixture();
  await assert.rejects(casting.loadMusicOnSpeaker({ ...track, connectorId: "spotify" }, speaker), {
    key: "music.cast.spotify",
  });
  await assert.rejects(casting.loadMusicOnSpeaker({ ...track, connectorId: "local" }, speaker), {
    key: "music.cast.local",
  });
  await assert.rejects(casting.loadMusicOnSpeaker(track, { ...speaker, kind: "airplay" }), {
    key: "music.cast.airplay",
  });
  await assert.rejects(casting.loadMusicOnSpeaker(track, { ...speaker, control_url: null }), {
    key: "music.cast.invalidDevice",
  });
  assert.equal(calls.length, 0);
});

test("only the resolved audio URL, MIME and real headers are forwarded through cast_load", async () => {
  const { casting, calls } = fixture();
  const loaded = await casting.loadMusicOnSpeaker(
    { ...track, playbackUrl: "https://ignored.test/old" },
    speaker,
    21,
  );
  assert.equal(loaded.active, true);
  assert.equal(loaded.phase, "unknown");
  assert.equal(calls[0].command, "music_resolve_stream");
  const load = calls.find((call) => call.command === "cast_load")!.args;
  assert.equal(load.url, stream.url);
  assert.equal(load.contentType, "audio/mpeg");
  assert.deepEqual(load.headers, stream.httpHeaders);
  assert.equal(load.startTimeSec, 21);
  assert.equal(load.transcode, false);
  assert.equal(load.controlUrl, speaker.control_url);
  assert.equal(load.host, speaker.host);
  assert.equal(load.poster, track.artwork);
  assert.equal((await casting.refreshMusicSpeakerStatus()).phase, "playing");
  assert.equal(casting.getMusicSpeakerState().positionSec, 27);
});

test("transferring a finished song starts it again while mid-song transfers retain position", async () => {
  for (const [position, expected] of [
    [0, 0],
    [72, 72],
    [179.7, 0],
    [180, 0],
    [400, 0],
    [NaN, 0],
    [-2, 0],
  ]) {
    const { casting, calls } = fixture();
    await casting.loadMusicOnSpeaker(track, speaker, position);
    assert.equal(calls.find((call) => call.command === "cast_load")!.args.startTimeSec, expected);
    assert.equal(casting.getMusicSpeakerState().positionSec, expected);
  }
});

test("file paths, pseudo URLs and unsupported MIME never reach a speaker", async () => {
  for (const resolved of [
    { url: "D:\\Music\\song.flac", mimeType: "audio/flac" },
    { url: "file:///music/song.mp3", mimeType: "audio/mpeg" },
    { url: "spotify:track:1", mimeType: "audio/mpeg" },
    { url: "https://example.test/page", mimeType: "text/html" },
    { url: "https://example.test/video", mimeType: "video/mp4" },
  ]) {
    const { casting, calls } = fixture((command) =>
      command === "music_resolve_stream" ? resolved : undefined,
    );
    await assert.rejects(casting.loadMusicOnSpeaker(track, speaker));
    assert.equal(casting.getMusicSpeakerState().active, false);
    assert.equal(
      calls.some((call) => call.command === "cast_load"),
      false,
    );
  }
});

test("failed native LOAD never becomes an active speaker session", async () => {
  const { casting } = fixture((command) => {
    if (command === "cast_load") throw new Error("Unsupported codec");
  });
  await assert.rejects(casting.loadMusicOnSpeaker(track, speaker), {
    key: "music.cast.loadFailed",
  });
  assert.equal(casting.getMusicSpeakerState().active, false);
  assert.equal(casting.getMusicSpeakerState().phase, "error");
});

test("uncertain receiver cleanup retains ownership and blocks replacing it until Stop confirms", async () => {
  let stopFails = true;
  const { casting, ownership } = fixture((command) => {
    if (command === "cast_load")
      throw new Error("CAST_AUDIO_STOP_UNCONFIRMED: receiver did not acknowledge");
    if (command === "cast_stop" && stopFails) throw new Error("Stop not confirmed");
  });
  await assert.rejects(casting.loadMusicOnSpeaker(track, speaker));
  assert.equal(casting.getMusicSpeakerState().active, true);
  await assert.rejects(ownership.claimCastSession("video", async () => {}));
  assert.equal(casting.getMusicSpeakerState().device?.id, speaker.id);
  stopFails = false;
  const video = await ownership.claimCastSession("video", async () => {});
  assert.equal(ownership.ownsCastSession(video), true);
  assert.equal(casting.getMusicSpeakerState().active, false);
});

test("replacing Music with video prevents stale Music controls reaching the new receiver", async () => {
  const { casting, ownership, calls } = fixture();
  await casting.loadMusicOnSpeaker(track, speaker);
  const video = await ownership.claimCastSession("video", async () => {});
  const before = calls.length;
  await assert.rejects(casting.playMusicSpeaker());
  await casting.stopMusicSpeaker();
  assert.equal(calls.length, before);
  assert.equal(ownership.ownsCastSession(video), true);
});

test("actual status distinguishes pause, buffering, idle, unknown and disconnect", async () => {
  let status: any = { connected: true, position_sec: 12, player_state: "PAUSED_PLAYBACK" };
  const { casting } = fixture((command) => (command === "cast_status" ? status : undefined));
  await casting.loadMusicOnSpeaker(track, speaker);
  for (const [native, expected] of [
    ["PAUSED_PLAYBACK", "paused"],
    ["TRANSITIONING", "buffering"],
    ["IDLE", "stopped"],
    ["UNRECOGNIZED", "unknown"],
  ]) {
    status.player_state = native;
    assert.equal((await casting.refreshMusicSpeakerStatus()).phase, expected);
    assert.equal(casting.getMusicSpeakerState().active, true);
  }
  status = null;
  await casting.refreshMusicSpeakerStatus();
  assert.equal(casting.getMusicSpeakerState().active, false);
  assert.equal(casting.getMusicSpeakerState().errorKey, "music.cast.disconnected");
  assert.equal(casting.getMusicSpeakerState().track?.id, track.id);
});

test("controls propagate failure and stop only clears state after native confirmation", async () => {
  let rejectStop = true;
  const { casting, calls } = fixture((command) => {
    if (command === "cast_pause" || (command === "cast_stop" && rejectStop))
      throw new Error("Not confirmed");
  });
  await casting.loadMusicOnSpeaker(track, speaker);
  await assert.rejects(casting.pauseMusicSpeaker(), { key: "music.cast.controlFailed" });
  assert.equal(casting.getMusicSpeakerState().active, true);
  await casting.playMusicSpeaker();
  await casting.seekMusicSpeaker(-3);
  assert.equal(calls.find((call) => call.command === "cast_seek")?.args.sec, 0);
  await assert.rejects(casting.stopMusicSpeaker(), { key: "music.cast.controlFailed" });
  assert.equal(casting.getMusicSpeakerState().active, true);
  rejectStop = false;
  await casting.stopMusicSpeaker();
  assert.equal(casting.getMusicSpeakerState().active, false);
  assert.equal(casting.getMusicSpeakerState().device, null);
});

test("a late status reply cannot resurrect a stopped session", async () => {
  const response = deferred<any>();
  const { casting } = fixture((command) =>
    command === "cast_status" ? response.promise : undefined,
  );
  await casting.loadMusicOnSpeaker(track, speaker);
  const pending = casting.refreshMusicSpeakerStatus();
  await casting.stopMusicSpeaker();
  response.resolve({ connected: true, position_sec: 99, player_state: "PLAYING" });
  await pending;
  assert.equal(casting.getMusicSpeakerState().phase, "idle");
  assert.equal(casting.getMusicSpeakerState().active, false);
});

test("stop queues after an in-flight native LOAD and prevents stale activation", async () => {
  const response = deferred<null>();
  const { casting, calls } = fixture((command) =>
    command === "cast_load" ? response.promise : undefined,
  );
  const loading = casting.loadMusicOnSpeaker(track, speaker);
  const rejected = assert.rejects(loading, { key: "music.cast.cancelled" });
  await tick();
  const stopping = casting.stopMusicSpeaker();
  assert.equal(
    calls.some((call) => call.command === "cast_stop"),
    false,
  );
  response.resolve(null);
  await rejected;
  await stopping;
  assert.deepEqual(
    calls.map((call) => call.command),
    ["music_resolve_stream", "cast_load", "cast_stop"],
  );
  assert.equal(casting.getMusicSpeakerState().active, false);
  assert.equal(casting.getMusicSpeakerState().phase, "idle");
});

test("status errors disconnect honestly and stale resolution cannot issue LOAD", async () => {
  const statusFailure = fixture((command) => {
    if (command === "cast_status") throw new Error("Offline");
  });
  await statusFailure.casting.loadMusicOnSpeaker(track, speaker);
  await assert.rejects(statusFailure.casting.refreshMusicSpeakerStatus(), {
    key: "music.cast.disconnected",
  });
  assert.equal(statusFailure.casting.getMusicSpeakerState().active, false);
  const response = deferred<typeof stream>();
  const { casting, calls } = fixture((command) =>
    command === "music_resolve_stream" ? response.promise : undefined,
  );
  const loading = casting.loadMusicOnSpeaker(track, speaker);
  const rejected = assert.rejects(loading, { key: "music.cast.cancelled" });
  await tick();
  const stopping = casting.stopMusicSpeaker();
  response.resolve(stream);
  await rejected;
  await stopping;
  assert.equal(
    calls.some((call) => call.command === "cast_load"),
    false,
  );
});
