import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeMusicAudio,
  saveMusicAudioSettings,
  useMusicAudioSettings,
  type MusicAudioSettingsValue,
} from "@/lib/music/audio-settings";

const FLUSH_MS = 90;

const NEUTRAL_MIX: Partial<MusicAudioSettingsValue> = {
  speed: 1,
  pitch: 0,
  reverb: 0,
  keepPitch: false,
  eqBands: Array(10).fill(0),
  peqFilters: [],
};

export function useLiveAudio() {
  const store = useMusicAudioSettings();
  const stored = store.settings;
  const [draft, setDraft] = useState<Partial<MusicAudioSettingsValue>>({});
  const pending = useRef<Partial<MusicAudioSettingsValue>>({});
  const timer = useRef(0);
  const latest = useRef(stored);

  const settings = useMemo(() => ({ ...stored, ...draft }), [stored, draft]);
  latest.current = settings;

  useEffect(() => {
    setDraft((current) => {
      const next: Partial<MusicAudioSettingsValue> = {};
      let changed = false;
      for (const [key, value] of Object.entries(current)) {
        const live = stored[key as keyof MusicAudioSettingsValue];
        if (JSON.stringify(live) === JSON.stringify(value)) changed = true;
        else Object.assign(next, { [key]: value });
      }
      return changed ? next : current;
    });
  }, [stored]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const set = useCallback((patch: Partial<MusicAudioSettingsValue>) => {
    pending.current = { ...pending.current, ...patch };
    setDraft((current) => ({ ...current, ...patch }));
    if (timer.current) return;
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      const batch = pending.current;
      pending.current = {};
      void saveMusicAudioSettings(normalizeMusicAudio({ ...latest.current, ...batch })).catch(
        () => {},
      );
    }, FLUSH_MS);
  }, []);

  const reset = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = 0;
    pending.current = {};
    setDraft(NEUTRAL_MIX);
    void saveMusicAudioSettings(
      normalizeMusicAudio({ ...latest.current, ...NEUTRAL_MIX, eqBands: Array(10).fill(0) }),
    ).catch(() => {});
  }, []);

  return { settings, set, reset };
}

export function useDeckClock(currentTime: number, playing: boolean, speed: number) {
  const anchor = useRef({ at: 0, time: 0 });
  anchor.current = useMemo(
    () => ({ at: typeof performance === "undefined" ? 0 : performance.now(), time: currentTime }),
    [currentTime],
  );
  return useCallback(() => {
    const { at, time } = anchor.current;
    if (!playing) return time;
    return time + ((performance.now() - at) / 1000) * Math.max(speed, 0.05);
  }, [playing, speed]);
}

export function useDeckTicker(active: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let alive = true;
    const step = () => {
      if (!alive) return;
      setTick((value) => value + 1);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [active]);
  return tick;
}

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function preciseClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00.0";
  const tenths = Math.floor((seconds % 1) * 10);
  return `${clock(seconds)}.${tenths}`;
}
