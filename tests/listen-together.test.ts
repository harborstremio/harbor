import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTEN_ROOM_LENGTH,
  generateListenRoomCode,
  isListenRoomCode,
  isWatchRoomCode,
  listenRoomIsComplete,
  normalizeListenRoomCode,
} from "../src/lib/listen-together/room";
import {
  listenMixFromState,
  listenStateFromTrack,
  listenStateMatchesTrack,
  listenTrackFromState,
  packListenMediaId,
  packListenTitle,
  unpackListenMediaId,
  unpackListenTitle,
} from "../src/lib/listen-together/track-state";
import {
  DEFAULT_LISTEN_MIX,
  listenMixMatches,
  readListenMix,
  writeListenMix,
  type ListenMix,
} from "../src/lib/listen-together/mix-state";
import { createListenMixFollower } from "../src/lib/listen-together/mix-follow";
import type { MusicAudioSettingsValue } from "../src/lib/music/audio-settings";
import {
  LISTEN_DRIFT_SECONDS,
  listenActionFor,
  listenShouldPublish,
} from "../src/lib/listen-together/session";
import { ROOM_CODE_LENGTH, generateRoomCode } from "../src/lib/together/protocol";

test("a listen code can never be mistaken for a watch code, or the reverse", () => {
  for (let i = 0; i < 200; i += 1) {
    const listen = generateListenRoomCode();
    const watch = generateRoomCode();
    assert.equal(isListenRoomCode(listen), true, listen);
    assert.equal(isWatchRoomCode(listen), false, listen);
    assert.equal(isListenRoomCode(watch), false, watch);
    assert.equal(isWatchRoomCode(watch), true, watch);
    assert.notEqual(listen, watch);
  }
});

test("listen codes stay inside what the relay will route", () => {
  // worker.js: ALLOWED_PATH = /^\/r\/([A-Z0-9]{4,8})$/
  const code = generateListenRoomCode();
  assert.equal(code.length, LISTEN_ROOM_LENGTH);
  assert.ok(code.length >= 4 && code.length <= 8);
  assert.match(code, /^[A-Z0-9]+$/);
  assert.ok(LISTEN_ROOM_LENGTH > ROOM_CODE_LENGTH);
});

test("typing a code by hand lands on the same room however it is written", () => {
  assert.equal(normalizeListenRoomCode("lt k4m2 x9"), "LTK4M2X9");
  assert.equal(normalizeListenRoomCode("LTK4M2X9"), "LTK4M2X9");
  assert.equal(normalizeListenRoomCode("k4m2x9"), "LTK4M2X9");
  assert.equal(normalizeListenRoomCode("LTK4M2X9EXTRA"), "LTK4M2X9");
  assert.equal(listenRoomIsComplete("k4m2x9"), true);
  assert.equal(listenRoomIsComplete("k4m2"), false);
});

test("a track identity survives the round trip through one relay field", () => {
  for (const track of [
    { id: "4x7abc", connectorId: "spotify" },
    { id: "id with spaces", connectorId: "youtube_music" },
    { id: "local/path/to file.flac", connectorId: null },
    { id: "colon:in:id", connectorId: "deezer" },
  ]) {
    const packed = packListenMediaId(track);
    assert.deepEqual(unpackListenMediaId(packed), { id: track.id, connectorId: track.connectorId });
  }
});

test("titles and artists with separators in them survive intact", () => {
  for (const [title, artist] of [
    ["You the One", "YoungBoy Never Broke Again"],
    ["Song / With / Slashes", "A, B & C"],
    ['quote" and \\ backslash', "artist"],
    ["", ""],
  ]) {
    const packed = packListenTitle(title, artist);
    assert.deepEqual(unpackListenTitle(packed), { title, artist });
  }
});

test("a plain string title still shows rather than vanishing", () => {
  assert.deepEqual(unpackListenTitle("Just A Title"), { title: "Just A Title", artist: "" });
  assert.deepEqual(unpackListenTitle(null), { title: "", artist: "" });
});

test("a published state carries what the relay validates and no episode", () => {
  const track = {
    id: "t1",
    connectorId: "spotify",
    title: "You the One",
    artist: "YB",
    artwork: "art.jpg",
  };
  const state = listenStateFromTrack(
    track as never,
    42.5,
    true,
    "client-a",
    "client-a",
    1_700_000_000_000,
  );
  assert.equal(state.episode, null);
  assert.equal(state.playing, true);
  assert.equal(state.positionSeconds, 42.5);
  assert.equal(state.posterUrl, "art.jpg");
  assert.equal(state.updatedBy, "client-a");
  assert.equal(typeof state.mediaId, "string");
  assert.equal(typeof state.mediaTitle, "string");
  assert.equal(typeof state.updatedAt, "number");
});

test("a nonsense position never reaches the relay, which would reject the whole state", () => {
  const track = { id: "t1", connectorId: null, title: "x", artist: "y", artwork: null };
  for (const bad of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
    const state = listenStateFromTrack(track as never, bad, false, "c", null, 1);
    assert.ok(Number.isFinite(state.positionSeconds) && state.positionSeconds >= 0, String(bad));
  }
});

test("the room tells you which track is playing, and which is not", () => {
  const track = { id: "t1", connectorId: "spotify", title: "A", artist: "B", artwork: null };
  const state = listenStateFromTrack(track as never, 1, true, "c", null, 1);
  assert.deepEqual(listenTrackFromState(state), {
    id: "t1",
    connectorId: "spotify",
    title: "A",
    artist: "B",
    artwork: null,
  });
  assert.equal(listenStateMatchesTrack(state, track), true);
  assert.equal(listenStateMatchesTrack(state, { id: "t1", connectorId: "deezer" }), false);
  assert.equal(listenStateMatchesTrack(state, { id: "t2", connectorId: "spotify" }), false);
  assert.equal(listenStateMatchesTrack(null, track), false);
  assert.equal(listenStateMatchesTrack(state, null), false);
});

const HOST_TRACK = { id: "t1", connectorId: "spotify", title: "A", artist: "B", artwork: null };

function hostState(overrides: Partial<ReturnType<typeof listenStateFromTrack>> = {}) {
  return {
    ...listenStateFromTrack(HOST_TRACK as never, 30, true, "host", "host", 1),
    ...overrides,
  };
}

test("a guest on a different track is told to load the host's one", () => {
  const action = listenActionFor(hostState(), {
    track: { id: "other", connectorId: "spotify" },
    positionSeconds: 0,
    playing: false,
  });
  assert.equal(action.kind, "load");
  if (action.kind === "load") {
    assert.equal(action.track.id, "t1");
    assert.equal(action.positionSeconds, 30);
    assert.equal(action.playing, true);
  }
});

test("a guest with nothing playing is told to load", () => {
  assert.equal(
    listenActionFor(hostState(), { track: null, positionSeconds: 0, playing: false }).kind,
    "load",
  );
});

test("small drift is left alone so nobody is nudged every tick", () => {
  const local = {
    track: HOST_TRACK,
    positionSeconds: 30 + LISTEN_DRIFT_SECONDS - 0.1,
    playing: true,
  };
  assert.equal(listenActionFor(hostState(), local).kind, "none");
});

test("real drift is corrected", () => {
  const local = {
    track: HOST_TRACK,
    positionSeconds: 30 + LISTEN_DRIFT_SECONDS + 5,
    playing: true,
  };
  const action = listenActionFor(hostState(), local);
  assert.equal(action.kind, "seek");
  if (action.kind === "seek") assert.equal(action.positionSeconds, 30);
});

test("play and pause follow the host once the track and position already agree", () => {
  assert.equal(
    listenActionFor(hostState(), { track: HOST_TRACK, positionSeconds: 30, playing: false }).kind,
    "play",
  );
  assert.equal(
    listenActionFor(hostState({ playing: false }), {
      track: HOST_TRACK,
      positionSeconds: 30,
      playing: true,
    }).kind,
    "pause",
  );
  assert.equal(
    listenActionFor(hostState(), { track: HOST_TRACK, positionSeconds: 30, playing: true }).kind,
    "none",
  );
});

test("no room state means the local player is left entirely alone", () => {
  assert.equal(
    listenActionFor(null, { track: HOST_TRACK, positionSeconds: 5, playing: true }).kind,
    "none",
  );
});

test("a host publishes on real changes and stays quiet while a song simply plays", () => {
  const first = hostState();
  assert.equal(listenShouldPublish(null, first), true);
  assert.equal(listenShouldPublish(first, { ...first, positionSeconds: 31 }), false);
  assert.equal(
    listenShouldPublish(first, { ...first, positionSeconds: 30 + LISTEN_DRIFT_SECONDS + 1 }),
    true,
  );
  assert.equal(listenShouldPublish(first, { ...first, playing: false }), true);
  const other = listenStateFromTrack(
    { ...HOST_TRACK, id: "t2" } as never,
    30,
    true,
    "host",
    "host",
    2,
  );
  assert.equal(listenShouldPublish(first, other), true);
});

const MIX_BANDS = [4, 0, -2.5, 0, 0, 1.5, 0, 0, 0, -6];

function makeSettings(over: Partial<MusicAudioSettingsValue> = {}): MusicAudioSettingsValue {
  return {
    device: "auto",
    eqEnabled: false,
    eqBands: Array(10).fill(0),
    boostEnabled: false,
    volumeLimit: 1,
    balance: 0,
    autoHeadroom: true,
    equipmentLabel: "",
    replayGain: "off",
    eqMode: "graphic",
    peqFilters: [],
    eqStrength: 1,
    preampDb: 0,
    crossfeed: 0,
    dspBypass: false,
    exclusive: false,
    sampleRate: 0,
    speed: 1,
    keepPitch: false,
    reverb: 0,
    pitch: 0,
    broadcastEnabled: false,
    broadcastDevice: "auto",
    ...over,
  } as MusicAudioSettingsValue;
}

const DJ_MIX: ListenMix = {
  speed: 1.35,
  pitch: -4.25,
  reverb: 0.6,
  keepPitch: true,
  eqEnabled: true,
  eqMode: "parametric",
  eqBands: MIX_BANDS,
};

test("the whole DJ mix survives the round trip through one relay field", () => {
  const state = listenStateFromTrack(HOST_TRACK as never, 12, true, "host", "host", 1, DJ_MIX);
  assert.equal(state.speed, 1.35);
  assert.deepEqual(unpackListenTitle(state.mediaTitle), { title: "A", artist: "B" });
  assert.deepEqual(listenMixFromState(state), DJ_MIX);
});

test("a mix at its defaults adds nothing to the payload an older client already reads", () => {
  const plain = packListenTitle("Song", "Artist", DEFAULT_LISTEN_MIX);
  assert.equal(plain, packListenTitle("Song", "Artist"));
  assert.equal(plain.includes('"d"'), false);
});

test("a disabled equaliser never ships its curve, and speed still travels", () => {
  const quiet: ListenMix = { ...DEFAULT_LISTEN_MIX, speed: 0.9, eqEnabled: false, eqBands: MIX_BANDS };
  const state = listenStateFromTrack(HOST_TRACK as never, 0, true, "host", "host", 1, quiet);
  const read = listenMixFromState(state);
  assert.equal(read?.speed, 0.9);
  assert.equal(read?.eqEnabled, false);
  assert.deepEqual(read?.eqBands, Array(10).fill(0));
});

test("a host that never sends a mix leaves every listener's own mix alone", () => {
  const state = listenStateFromTrack(HOST_TRACK as never, 0, true, "host", "host", 1);
  assert.equal(state.speed, undefined);
  assert.equal(listenMixFromState(state), null);
  assert.equal(listenMixFromState(null), null);
});

test("a host republishes when the mix moves and stays quiet when it repeats", () => {
  const base = listenStateFromTrack(HOST_TRACK as never, 30, true, "host", "host", 1, DJ_MIX);
  const same = listenStateFromTrack(HOST_TRACK as never, 30.4, true, "host", "host", 2, DJ_MIX);
  assert.equal(listenShouldPublish(base, same), false);
  for (const moved of [
    { ...DJ_MIX, speed: 1.1 },
    { ...DJ_MIX, pitch: 2 },
    { ...DJ_MIX, reverb: 0 },
    { ...DJ_MIX, keepPitch: false },
    { ...DJ_MIX, eqMode: "graphic" as const },
    { ...DJ_MIX, eqBands: Array(10).fill(0) },
  ]) {
    const next = listenStateFromTrack(HOST_TRACK as never, 30.4, true, "host", "host", 3, moved);
    assert.equal(listenShouldPublish(base, next), true, JSON.stringify(moved));
  }
});

test("a mix read off local settings writes back onto them unchanged", () => {
  const settings = makeSettings({
    speed: 1.2,
    pitch: 3,
    reverb: 0.25,
    keepPitch: true,
    eqEnabled: true,
    eqBands: MIX_BANDS,
  });
  const mix = readListenMix(settings);
  assert.equal(listenMixMatches(settings, mix), true);
  assert.deepEqual(writeListenMix(settings, mix), settings);
});

function followerOn(start: MusicAudioSettingsValue) {
  let live = start;
  const writes: MusicAudioSettingsValue[] = [];
  const follower = createListenMixFollower({
    read: () => live,
    write: (next) => {
      live = next;
      writes.push(next);
      return Promise.resolve(next);
    },
  });
  return { follower, writes, current: () => live };
}

test("a guest's own mix comes back the moment the room ends", async () => {
  const own = makeSettings({
    speed: 1.2,
    pitch: 3,
    reverb: 0.25,
    keepPitch: true,
    eqEnabled: true,
    eqBands: MIX_BANDS,
    equipmentLabel: "my cans",
  });
  const { follower, writes, current } = followerOn(own);
  follower.begin();
  await follower.apply(DJ_MIX);
  assert.equal(listenMixMatches(current(), DJ_MIX), true);
  await follower.end();
  assert.deepEqual(current(), own);
  assert.equal(writes.length, 2);
});

test("a redundant begin never lets the host's mix become what gets restored", async () => {
  const own = makeSettings({ speed: 0.75, pitch: -2, eqEnabled: true, eqBands: MIX_BANDS });
  const { follower, current } = followerOn(own);
  follower.begin();
  await follower.apply(DJ_MIX);
  follower.begin();
  await follower.apply({ ...DJ_MIX, speed: 1.6 });
  follower.begin();
  await follower.end();
  assert.deepEqual(current(), own);
});

test("nothing is written to disk for a guest the host never mixed", async () => {
  const own = makeSettings({ speed: 1.1, pitch: 5 });
  const { follower, writes, current } = followerOn(own);
  follower.begin();
  await follower.apply(null);
  await follower.apply(readListenMix(own));
  await follower.end();
  assert.equal(writes.length, 0);
  assert.deepEqual(current(), own);
});

test("a mix arriving before the guest snapshot is taken is not applied", async () => {
  const own = makeSettings({ speed: 1.1 });
  const { follower, writes, current } = followerOn(own);
  await follower.apply(DJ_MIX);
  assert.equal(writes.length, 0);
  assert.deepEqual(current(), own);
  follower.begin();
  await follower.apply(DJ_MIX);
  assert.equal(listenMixMatches(current(), DJ_MIX), true);
  await follower.end();
  assert.deepEqual(current(), own);
});

test("leaving twice never writes the host's mix back over the guest's", async () => {
  const own = makeSettings({ speed: 0.8, reverb: 0.5 });
  const { follower, writes, current } = followerOn(own);
  follower.begin();
  await follower.apply(DJ_MIX);
  await follower.end();
  await follower.end();
  assert.deepEqual(current(), own);
  assert.equal(writes.length, 2);
});
