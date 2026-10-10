import assert from "node:assert/strict";
import test from "node:test";
import {
  createMusicMeterMonitor,
  musicMeterFraction,
  musicMeterMatchesTrack,
  normalizeMusicMeter,
  type MusicMeterSnapshot,
} from "../src/lib/music/audio-meter.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const measured: MusicMeterSnapshot = {
  trackId: "one",
  connectorId: "local",
  active: true,
  channels: [
    { rmsDb: -9.03, peakDb: -6.02 },
    { rmsDb: -15.05, peakDb: -12.04 },
  ],
  outputSampleRateHz: 48000,
  outputChannels: "stereo",
  outputDevice: "auto",
  outputBackend: "null",
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const waitUntil = async (condition: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(condition(), "meter condition did not settle");
};

test("a transient attachment failure during direct replacement recovers without another click", async () => {
  let attempts = 0;
  let current = measured;
  let fail = false;
  const monitor = createMusicMeterMonitor(
    async <T>(name: string, args?: Record<string, unknown>) => {
      if (args?.enabled) {
        attempts++;
        if (fail) {
          fail = false;
          throw new Error("decoder is changing");
        }
      }
      return (name === "music_audio_meter_snapshot" ? current : undefined) as T;
    },
  );
  const first = monitor.acquire();
  await waitUntil(() => monitor.getSnapshot().status === "ready");
  first();
  current = { ...measured, trackId: "replacement", connectorId: "youtube_music" };
  fail = true;
  const replacement = monitor.acquire();
  try {
    await waitUntil(() => monitor.getSnapshot().data?.trackId === "replacement");
    assert.equal(attempts, 3);
  } finally {
    replacement();
    await flush();
  }
});

test("a retained consumer reconciles a new native track without a disable", async () => {
  let current = measured;
  const requests: unknown[] = [];
  const monitor = createMusicMeterMonitor(
    async <T>(name: string, args?: Record<string, unknown>) => {
      if (name === "music_audio_meter_set_enabled") requests.push(args?.enabled);
      return (name === "music_audio_meter_snapshot" ? current : undefined) as T;
    },
  );
  const close = monitor.acquire();
  try {
    await waitUntil(() => monitor.getSnapshot().status === "ready");
    current = { ...measured, trackId: "two" };
    await waitUntil(() => requests.length === 2);
    assert.deepEqual(requests, [true, true]);
    assert.equal(monitor.getSnapshot().data?.trackId, "two");
  } finally {
    close();
    await flush();
  }
});

test("closing during retry backoff prevents later reattachment", async () => {
  const requests: unknown[] = [];
  const monitor = createMusicMeterMonitor(
    async <T>(_name: string, args?: Record<string, unknown>) => {
      requests.push(args?.enabled);
      if (args?.enabled) throw new Error("unavailable");
      return undefined as T;
    },
  );
  const close = monitor.acquire();
  await waitUntil(() => monitor.getSnapshot().status === "unavailable");
  close();
  await new Promise((resolve) => setTimeout(resolve, 180));
  assert.deepEqual(requests, [true, false]);
  assert.equal(monitor.getSnapshot().status, "off");
});

test("audible PCM with missing frequency data reconciles without inventing bars", async () => {
  const now = Date.now;
  let clockOffset = 0;
  Date.now = () => now() + clockOffset;
  let attempts = 0;
  const monitor = createMusicMeterMonitor(
    async <T>(name: string, args?: Record<string, unknown>) => {
      if (args?.enabled) attempts++;
      return (
        name === "music_audio_meter_snapshot"
          ? { ...measured, spectrumDb: Array(8).fill(attempts > 1 ? -18 : -120) }
          : undefined
      ) as T;
    },
  );
  const close = monitor.acquire();
  try {
    await waitUntil(() => monitor.getSnapshot().status === "ready");
    assert.deepEqual(monitor.getSnapshot().data?.spectrumDb, Array(8).fill(-120));
    clockOffset = 2100;
    await waitUntil(() => monitor.getSnapshot().data?.spectrumDb?.[0] === -18);
    assert.equal(attempts, 2);
  } finally {
    close();
    Date.now = now;
    await flush();
  }
});

test("levels require actual finite measurements and an active matching source", () => {
  assert.equal(musicMeterFraction(-120), 0);
  assert.equal(musicMeterFraction(-30), 0.5);
  assert.equal(musicMeterFraction(-6, false), 0);
  assert.equal(musicMeterFraction(NaN), 0);
  assert.equal(musicMeterFraction(3), 1);
  assert.equal(
    normalizeMusicMeter({ ...measured, channels: [{ rmsDb: NaN, peakDb: 0 }] })?.channels.length,
    0,
  );
  assert.equal(
    normalizeMusicMeter({ ...measured, outputSampleRateHz: Infinity })?.outputSampleRateHz,
    null,
  );
  const track = { id: "one", connectorId: "local" } as MusicTrack;
  assert.equal(musicMeterMatchesTrack(measured, track), true);
  assert.equal(musicMeterMatchesTrack(measured, { ...track, connectorId: "youtube_music" }), false);
  assert.equal(musicMeterMatchesTrack(measured, { ...track, id: "two" }), false);
});

test("shared consumers enable once; closing during a pending read discards stale levels and removes analysis", async () => {
  const calls: { name: string; enabled?: unknown }[] = [];
  let complete: ((value: MusicMeterSnapshot) => void) | undefined;
  const monitor = createMusicMeterMonitor(
    async <T>(name: string, args?: Record<string, unknown>) => {
      calls.push({ name, enabled: args?.enabled });
      if (name === "music_audio_meter_snapshot")
        return (await new Promise<MusicMeterSnapshot>((resolve) => {
          complete = resolve;
        })) as T;
      return undefined as T;
    },
  );
  const closeOne = monitor.acquire();
  const closeTwo = monitor.acquire();
  await flush();
  assert.equal(calls.filter((call) => call.enabled === true).length, 1);
  closeOne();
  await flush();
  assert.equal(calls.filter((call) => call.enabled === false).length, 0);
  closeTwo();
  closeTwo();
  complete?.(measured);
  await flush();
  assert.deepEqual(monitor.getSnapshot(), { status: "off", data: null });
  assert.equal(calls.filter((call) => call.enabled === false).length, 1);
});

test("slow enable followed by close cannot leave native analysis enabled", async () => {
  const enabled: boolean[] = [];
  let finish: (() => void) | undefined;
  const monitor = createMusicMeterMonitor(
    async <T>(name: string, args?: Record<string, unknown>) => {
      assert.equal(name, "music_audio_meter_set_enabled");
      enabled.push(args!.enabled as boolean);
      if (args?.enabled)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      return undefined as T;
    },
  );
  const close = monitor.acquire();
  await flush();
  close();
  finish?.();
  await flush();
  assert.deepEqual(enabled, [true, false]);
  assert.equal(monitor.getSnapshot().status, "off");
});
