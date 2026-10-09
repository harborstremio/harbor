import assert from "node:assert/strict";
import test from "node:test";
import { VideoAudioCast } from "../src/lib/player/video-audio-cast.ts";
import type { PlayerBridge, PlayerSnapshot } from "../src/lib/player/bridge.ts";
import type { CastDeviceInfo } from "../src/lib/cast.ts";
import {
  claimCastSession,
  ownsCastSession,
  releaseCastSession,
  stopCastOwner,
  withCastSession,
} from "../src/lib/cast-ownership.ts";

const speaker: CastDeviceInfo = {
  id: "test-speaker",
  name: "Sonos fixture",
  host: "192.0.2.2",
  port: 1400,
  kind: "dlna",
  control_url: "http://192.0.2.2/avtransport",
  model: "Play:5",
  audio_only: true,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(options: { paused?: boolean; muted?: boolean; load?: () => Promise<any> } = {}) {
  const calls: { name: string; value?: any }[] = [];
  let snap = {
    status: options.paused ? "paused" : "playing",
    muted: !!options.muted,
    rate: 1.25,
    positionSec: 20,
    buffering: false,
  } as PlayerSnapshot;
  let status = { connected: true, position_sec: 22, player_state: "PAUSED" };
  let stopFails = false;
  let pauseFails = false;
  let muteIgnored = false;
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  const emit = () => listeners.forEach((listener) => listener(snap));
  const bridge = {
    play: async (options?: { preserveMuted?: boolean }) => {
      calls.push({ name: "local.play", value: options });
      snap = { ...snap, status: "playing", muted: options?.preserveMuted ? snap.muted : false };
      emit();
    },
    pause: () => {
      calls.push({ name: "local.pause" });
      snap = { ...snap, status: "paused" };
      emit();
    },
    seek: (value: number) => {
      calls.push({ name: "local.seek", value });
      snap = { ...snap, positionSec: value };
      emit();
    },
    setMuted: (value: boolean) => {
      calls.push({ name: "local.mute", value });
      if (!muteIgnored) {
        snap = { ...snap, muted: value };
        emit();
      }
    },
    setVolume: (value: number) => {
      calls.push({ name: "local.volume", value });
      snap = { ...snap, muted: false };
      emit();
    },
    setRate: (value: number) => {
      calls.push({ name: "local.rate", value });
      snap = { ...snap, rate: value };
      emit();
    },
    setAudioTrack: (value: string) => calls.push({ name: "local.track", value }),
    load: async (value: unknown) => {
      calls.push({ name: "local.load", value });
    },
    subscribe: (listener: (s: PlayerSnapshot) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as PlayerBridge;
  const ref = { current: bridge as PlayerBridge | null };
  const route = new VideoAudioCast(
    {
      load: async (value) => {
        calls.push({ name: "receiver.load", value });
        return options.load?.() ?? { ok: true, error: null };
      },
      play: async () => {
        calls.push({ name: "receiver.play" });
        status.player_state = "PLAYING";
      },
      pause: async () => {
        calls.push({ name: "receiver.pause" });
        if (pauseFails) throw new Error("pause denied");
        status.player_state = "PAUSED";
      },
      seek: async (value) => {
        calls.push({ name: "receiver.seek", value });
        status.position_sec = value + 1;
      },
      stop: async () => {
        calls.push({ name: "receiver.stop" });
        if (stopFails) throw new Error("stop not confirmed");
      },
      status: async () => {
        calls.push({ name: "receiver.status" });
        return status;
      },
    },
    ref,
    () => snap,
  );
  const start = () =>
    route.start(speaker, {
      url: "https://example.test/exact.mkv",
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      title: "Actual source",
      startTimeSec: 20,
      audioTrackOrdinal: 1,
    });
  return {
    route,
    ref,
    bridge,
    calls,
    start,
    snap: () => snap,
    failStop: (value = true) => {
      stopFails = value;
    },
    failPause: () => {
      pauseFails = true;
    },
    ignoreMute: () => {
      muteIgnored = true;
    },
    status: (value: Partial<typeof status>) => {
      status = { ...status, ...value };
    },
  };
}

test("video speaker handoff pauses picture, waits readiness, confirms mute and aligns before playback", async () => {
  const wait = deferred<{ ok: boolean; error: null }>();
  const f = fixture({ load: () => wait.promise });
  const pending = f.start();
  await tick();
  assert.equal(f.route.getSnapshot().phase, "connecting");
  assert.deepEqual(
    f.calls.map((call) => call.name),
    ["local.pause", "receiver.load"],
  );
  assert.equal(f.snap().muted, false);
  const load = f.calls[1].value;
  assert.equal(load.audioOnly, true);
  assert.equal(load.audioStartPaused, true);
  assert.equal(load.audioTrackOrdinal, 1);
  assert.deepEqual(load.headers, { "Accept-Language": "en-US,en;q=0.9" });
  wait.resolve({ ok: true, error: null });
  await pending;
  assert.deepEqual(
    f.calls.slice(2).map((call) => call.name),
    ["receiver.status", "local.mute", "local.rate", "local.seek", "receiver.play", "local.play"],
  );
  assert.equal(f.snap().positionSec, 22);
  assert.equal(f.snap().muted, true);
  assert.equal(f.route.getSnapshot().phase, "playing");
  assert.deepEqual(f.calls.find((call) => call.name === "local.play")!.value, {
    preserveMuted: true,
  });
  await f.route.stop();
});

test("paused/muted source stays paused; every PC volume/unmute path is guarded", async () => {
  const f = fixture({ paused: true, muted: true });
  await f.start();
  assert.equal(f.route.getSnapshot().phase, "paused");
  f.ref.current!.setVolume(6);
  f.ref.current!.setMuted(false);
  f.ref.current!.setRate(2);
  f.ref.current!.setAudioTrack("3");
  assert.equal(
    f.calls.some((call) => call.name === "local.volume" || call.name === "local.track"),
    false,
  );
  assert.equal(f.snap().muted, true);
  await f.route.returnToComputer();
  assert.equal(f.ref.current, f.bridge);
  assert.equal(f.snap().muted, true);
  assert.equal(f.snap().status, "paused");
  assert.equal(f.snap().rate, 1.25);
});

test("pause, seek, direct bridge controls and return synchronize both transports", async () => {
  const f = fixture();
  await f.start();
  await f.route.pause();
  assert.equal(f.snap().status, "paused");
  await f.route.seek(80);
  assert.equal(f.snap().positionSec, 81);
  assert.equal(f.snap().status, "paused");
  await f.ref.current!.play();
  assert.equal(f.snap().status, "playing");
  await f.route.returnToComputer();
  const stop = f.calls.findLastIndex((call) => call.name === "receiver.stop");
  const unmute = f.calls.findLastIndex(
    (call) => call.name === "local.mute" && call.value === false,
  );
  assert.ok(stop < unmute);
  assert.equal(f.snap().muted, false);
  assert.equal(f.snap().status, "playing");
});

test("failed STOP retains guarded paused local route and permits explicit retry", async () => {
  const f = fixture();
  await f.start();
  f.failStop();
  await assert.rejects(f.route.returnToComputer());
  assert.equal(f.route.getSnapshot().phase, "error");
  assert.equal(f.snap().muted, true);
  assert.equal(f.snap().status, "paused");
  assert.notEqual(f.ref.current, f.bridge);
  f.ref.current!.setMuted(false);
  assert.equal(f.snap().muted, true);
  f.failStop(false);
  await f.route.returnToComputer();
  assert.equal(f.route.getSnapshot().phase, "idle");
  assert.equal(f.snap().muted, false);
});

test("failed LOAD only restores local playback after receiver STOP confirms", async () => {
  const f = fixture({ load: async () => ({ ok: false, error: "receiver failed" }) });
  await assert.rejects(f.start());
  assert.equal(f.route.getSnapshot().device, null);
  assert.equal(f.snap().status, "playing");
  const order = f.calls.map((call) => call.name);
  assert.ok(order.indexOf("receiver.stop") < order.indexOf("local.play"));
  const blocked = fixture({ load: async () => ({ ok: false, error: "receiver failed" }) });
  blocked.failStop();
  await assert.rejects(blocked.start());
  assert.equal(blocked.route.getSnapshot().phase, "error");
  assert.equal(blocked.snap().status, "paused");
  assert.notEqual(blocked.ref.current, blocked.bridge);
  blocked.failStop(false);
  await blocked.route.stop();
});

test("cancel during pending LOAD never mutes or plays local picture before acknowledged STOP", async () => {
  const wait = deferred<{ ok: boolean; error: null }>();
  const f = fixture({ load: () => wait.promise });
  const pending = f.start();
  await tick();
  const stop = f.route.stop();
  wait.resolve({ ok: true, error: null });
  await Promise.all([pending, stop]);
  assert.equal(
    f.calls.some((call) => call.name === "local.play" || call.name === "receiver.play"),
    false,
  );
  assert.equal(f.route.getSnapshot().device, null);
  assert.equal(f.ref.current, f.bridge);
});

test("disconnect or denied pause keeps video silent and cannot report successful playback", async () => {
  const f = fixture();
  await f.start();
  f.status({ connected: false });
  await f.route.poll();
  assert.equal(f.route.getSnapshot().phase, "error");
  assert.equal(f.snap().muted, true);
  assert.equal(f.snap().status, "paused");
  await assert.rejects(f.route.play());
  await f.route.stop();
  const paused = fixture();
  await paused.start();
  paused.failPause();
  await assert.rejects(paused.route.pause());
  assert.equal(paused.route.getSnapshot().phase, "error");
  await paused.route.stop();
});

test("a new source waits for receiver STOP and is rejected if STOP fails", async () => {
  const f = fixture();
  await f.start();
  f.failStop();
  await assert.rejects(f.ref.current!.load({ url: "https://example.test/next.mp4" }));
  assert.equal(
    f.calls.some((call) => call.name === "local.load"),
    false,
  );
  f.failStop(false);
  await f.ref.current!.load({ url: "https://example.test/next.mp4" });
  assert.equal(f.calls.at(-1)!.name, "local.load");
  assert.equal(f.route.getSnapshot().device, null);
});

test("cast singleton transfer waits for STOP; stale commands and cleanup cannot replace new owner", async () => {
  const wait = deferred<void>();
  const order: string[] = [];
  let first = await claimCastSession("music", async () => {
    order.push("stop.music");
    await withCastSession(first, () => wait.promise);
    releaseCastSession(first);
  });
  const pending = claimCastSession("video", async () => {
    order.push("stop.video");
    releaseCastSession(second);
  });
  await tick();
  assert.equal(ownsCastSession(first), true);
  assert.deepEqual(order, ["stop.music"]);
  wait.resolve();
  const second = await pending;
  assert.equal(ownsCastSession(second), true);
  releaseCastSession(first);
  assert.equal(ownsCastSession(second), true);
  await assert.rejects(
    withCastSession(first, async () => {
      order.push("stale");
    }),
  );
  await stopCastOwner("video");
  assert.equal(ownsCastSession(second), false);
  assert.deepEqual(order, ["stop.music", "stop.video"]);
});

test("unacknowledged stop rejects ownership transfer without clearing the prior owner", async () => {
  const lease = await claimCastSession("music", async () => {
    throw new Error("speaker offline");
  });
  await assert.rejects(claimCastSession("video", async () => {}));
  assert.equal(ownsCastSession(lease), true);
  releaseCastSession(lease);
});
