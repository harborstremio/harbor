import { invoke } from "@tauri-apps/api/core";
import { useEffect, useSyncExternalStore } from "react";
import type { MusicTrack } from "./types";

export type MusicMeterChannel = { rmsDb: number; peakDb: number };
export type MusicMeterSnapshot = {
  trackId: string;
  connectorId: string | null;
  active: boolean;
  channels: MusicMeterChannel[];
  spectrumDb?: number[];
  outputSampleRateHz: number | null;
  outputChannels: string | null;
  outputDevice: string | null;
  outputBackend: string | null;
};
export type MusicAudioMeterState = {
  status: "off" | "loading" | "ready" | "unavailable";
  data: MusicMeterSnapshot | null;
};
const OFF: MusicAudioMeterState = { status: "off", data: null };

export function normalizeMusicMeter(value: MusicMeterSnapshot | null): MusicMeterSnapshot | null {
  if (!value || typeof value.trackId !== "string" || !Array.isArray(value.channels)) return null;
  const channels = value.channels
    .slice(0, 8)
    .filter((channel) => Number.isFinite(channel?.rmsDb) && Number.isFinite(channel?.peakDb))
    .map((channel) => ({
      rmsDb: Math.max(-120, Math.min(24, channel.rmsDb)),
      peakDb: Math.max(-120, Math.min(24, channel.peakDb)),
    }));
  const spectrumDb =
    Array.isArray(value.spectrumDb) && value.spectrumDb.length === 8
      ? value.spectrumDb.map((db) =>
          Number.isFinite(db) ? Math.max(-120, Math.min(24, db)) : -120,
        )
      : [];
  return {
    ...value,
    channels,
    spectrumDb,
    active: value.active === true,
    outputSampleRateHz:
      Number.isFinite(value.outputSampleRateHz) &&
      value.outputSampleRateHz! > 0 &&
      value.outputSampleRateHz! <= 3_072_000
        ? value.outputSampleRateHz
        : null,
  };
}

export function musicMeterMatchesTrack(
  data: MusicMeterSnapshot | null,
  track: MusicTrack | null | undefined,
): boolean {
  return (
    !!data &&
    !!track &&
    data.trackId === track.id &&
    (data.connectorId ?? null) === (track.connectorId ?? null)
  );
}

/** Decibel scale: silence and stopped playback stay empty; never synthesize movement. */
export function musicMeterFraction(db: number, active = true): number {
  return active && Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0;
}

type NativeInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export function createMusicMeterMonitor(call: NativeInvoke = invoke) {
  let state = OFF;
  let users = 0;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let changes = Promise.resolve();
  let attached = false;
  let retryMs = 100;
  let repairAt = 0;
  let trackKey: string | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: MusicAudioMeterState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const poll = async (ticket: number) => {
    if (!users || ticket !== generation) return;
    const started = performance.now();
    let delay = 50;
    try {
      if (!attached) {
        const enabling = changes.then(async () => {
          if (users && ticket === generation)
            await call("music_audio_meter_set_enabled", { enabled: true });
        });
        changes = enabling.catch(() => {});
        await enabling;
        if (!users || ticket !== generation) return;
        attached = true;
        repairAt = Date.now() + 2000;
      }
      const data = normalizeMusicMeter(
        await call<MusicMeterSnapshot | null>("music_audio_meter_snapshot"),
      );
      if (!users || ticket !== generation) return;
      retryMs = 100;
      const nextKey = data ? JSON.stringify([data.connectorId, data.trackId]) : null;
      const changedTrack = trackKey !== null && nextKey !== null && nextKey !== trackKey;
      if (nextKey !== null) trackKey = nextKey;
      const missingSpectrum =
        data?.active &&
        data.channels.some((channel) => channel.rmsDb > -90) &&
        (!data.spectrumDb?.length || data.spectrumDb.every((db) => db <= -119));
      // A replacement decoder or transient filter failure must not strand a live consumer.
      // Reconcile idempotently; never disable processing or fabricate frequency values.
      if (changedTrack || ((!data?.channels.length || missingSpectrum) && Date.now() >= repairAt))
        attached = false;
      publish({ status: data?.channels.length ? "ready" : "unavailable", data });
      // The native analysis produces 50 ms windows. Include IPC time in that
      // cadence instead of adding another 50 ms after every completed read.
      // Reads remain serial, with breathing room when the native call is slow.
      delay = Math.max(8, 50 - (performance.now() - started));
    } catch {
      if (!users || ticket !== generation) return;
      attached = false;
      delay = retryMs;
      retryMs = Math.min(2000, retryMs * 2);
      publish({ status: "unavailable", data: null });
    }
    if (users && ticket === generation)
      timer = setTimeout(() => {
        void poll(ticket);
      }, delay);
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    acquire() {
      users += 1;
      if (users === 1) {
        const ticket = ++generation;
        attached = false;
        retryMs = 100;
        trackKey = null;
        publish({ status: "loading", data: null });
        void poll(ticket);
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        users -= 1;
        if (users) return;
        ++generation;
        clearTimeout(timer);
        publish(OFF);
        // Serialize enable/disable: a slow enable cannot leave analysis running after close.
        changes = changes.then(async () => {
          try {
            await call("music_audio_meter_set_enabled", { enabled: false });
          } catch {
            /* A closed native session needs no cleanup. */
          }
        });
      };
    },
  };
}

const monitor = createMusicMeterMonitor();
export function acquireMusicMeter(listener: (state: MusicAudioMeterState) => void): () => void {
  const stop = monitor.subscribe(() => listener(monitor.getSnapshot()));
  const release = monitor.acquire();
  listener(monitor.getSnapshot());
  return () => {
    stop();
    release();
  };
}
export function useMusicAudioMeter(
  track: MusicTrack | null | undefined,
  enabled = false,
): MusicAudioMeterState {
  const state = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, monitor.getSnapshot);
  const allowed = enabled && !!track && track.connectorId !== "spotify";
  useEffect(() => {
    if (!allowed) return;
    let release: (() => void) | undefined;
    const visibility = () => {
      if (document.hidden) {
        release?.();
        release = undefined;
      } else if (!release) release = monitor.acquire();
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      release?.();
    };
  }, [allowed]);
  if (!allowed) return OFF;
  return state.data && !musicMeterMatchesTrack(state.data, track)
    ? { status: "loading", data: null }
    : state;
}
