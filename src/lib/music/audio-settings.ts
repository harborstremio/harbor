import { invoke } from "@tauri-apps/api/core";
import { useEffect, useSyncExternalStore } from "react";
import { clampNumber, normalizePeq, type PeqFilter } from "./parametric-eq";
import { broadcastWindowState, subscribeWindowState } from "./window-sync";

const AUDIO_CHANNEL = "harbor://music-audio-settings";

export const MUSIC_EQ_FREQUENCIES = [
  31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;
export type MusicAudioSettingsValue = {
  device: string;
  eqEnabled: boolean;
  eqBands: number[];
  boostEnabled: boolean;
  volumeLimit: number;
  balance: number;
  autoHeadroom: boolean;
  equipmentLabel: string;
  replayGain: "off" | "track" | "album";
  eqMode: "graphic" | "parametric";
  peqFilters: PeqFilter[];
  eqStrength: number;
  preampDb: number;
  crossfeed: number;
  dspBypass: boolean;
  exclusive: boolean;
  sampleRate: number;
  speed: number;
  keepPitch: boolean;
  reverb: number;
  /** Semitones, independent of speed. */
  pitch: number;
  broadcastEnabled: boolean;
  broadcastDevice: string;
};
export type MusicAudioDevice = { name: string; description: string };
export const DEFAULT_MUSIC_AUDIO: MusicAudioSettingsValue = {
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
};

// eslint-disable-next-line no-control-regex
const DEVICE_CONTROL = /[\x00-\x1f]/;
const deviceName = (value: unknown): string =>
  typeof value === "string" && value.length > 0 && value.length <= 500 && !DEVICE_CONTROL.test(value)
    ? value
    : "auto";

export function normalizeMusicAudio(
  value: Partial<MusicAudioSettingsValue> | null,
): MusicAudioSettingsValue {
  const boostEnabled = value?.boostEnabled === true;
  return {
    eqMode: value?.eqMode === "parametric" ? "parametric" : "graphic",
    peqFilters: normalizePeq(value?.peqFilters),
    eqStrength: clampNumber(value?.eqStrength, 0, 1, 1),
    preampDb: clampNumber(value?.preampDb, -60, 12, 0),
    crossfeed: clampNumber(value?.crossfeed, 0, 1, 0),
    speed: clampNumber(value?.speed, 0.5, 1.6, 1),
    keepPitch: value?.keepPitch === true,
    reverb: clampNumber(value?.reverb, 0, 1, 0),
    pitch: clampNumber(value?.pitch, -12, 12, 0),
    dspBypass: value?.dspBypass === true,
    exclusive: value?.exclusive === true,
    sampleRate: [0, 44100, 48000, 88200, 96000, 176400, 192000].includes(value?.sampleRate ?? -1)
      ? value!.sampleRate!
      : 0,
    device: deviceName(value?.device),
    broadcastEnabled: value?.broadcastEnabled === true,
    broadcastDevice: deviceName(value?.broadcastDevice),
    eqEnabled: value?.eqEnabled === true,
    eqBands: MUSIC_EQ_FREQUENCIES.map((_, i) =>
      Number.isFinite(value?.eqBands?.[i]) ? Math.max(-12, Math.min(12, value!.eqBands![i])) : 0,
    ),
    boostEnabled,
    volumeLimit:
      boostEnabled && Number.isFinite(value?.volumeLimit)
        ? Math.max(1, Math.min(5, value!.volumeLimit!))
        : 1,
    balance: Number.isFinite(value?.balance) ? Math.max(-1, Math.min(1, value!.balance!)) : 0,
    autoHeadroom: value?.autoHeadroom !== false,
    equipmentLabel:
      typeof value?.equipmentLabel === "string"
        ? // Strip nonprinting controls from the user-visible equipment label.
          // eslint-disable-next-line no-control-regex
          [...value.equipmentLabel.replace(/[\u0000-\u001f\u007f]/g, "")]
            .slice(0, 100)
            .join("")
            .trim()
        : "",
    replayGain:
      value?.replayGain === "track" || value?.replayGain === "album" ? value.replayGain : "off",
  };
}

type AudioSnapshot = {
  settings: MusicAudioSettingsValue;
  ready: boolean;
  saving: boolean;
  error: boolean;
};
let snapshot: AudioSnapshot = {
  settings: normalizeMusicAudio(null),
  ready: false,
  saving: false,
  error: false,
};
const listeners = new Set<() => void>();
subscribeWindowState<MusicAudioSettingsValue>(AUDIO_CHANNEL, (settings) => {
  snapshot = { ...snapshot, settings: normalizeMusicAudio(settings), ready: true };
  listeners.forEach((listener) => listener());
});
let initialization: Promise<void> | null = null;
const publish = (next: Partial<AudioSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
};
export const subscribeMusicAudioSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getMusicAudioSettingsSnapshot = () => snapshot;

export function initializeMusicAudioSettings(force = false): Promise<void> {
  if (initialization && !force) return initialization;
  initialization = invoke<MusicAudioSettingsValue>("music_audio_settings_get").then(
    (settings) => publish({ settings: normalizeMusicAudio(settings), ready: true, error: false }),
    () => {
      publish({ ready: true, error: true });
    },
  );
  return initialization;
}

export function useMusicAudioSettings() {
  const value = useSyncExternalStore(
    subscribeMusicAudioSettings,
    getMusicAudioSettingsSnapshot,
    getMusicAudioSettingsSnapshot,
  );
  useEffect(() => {
    void initializeMusicAudioSettings();
  }, []);
  return value;
}

export function musicVolumeCeiling(connectorId?: string | null): number {
  return connectorId === "spotify" ? 1 : snapshot.settings.volumeLimit;
}
export function clampMusicVolume(value: number, connectorId?: string | null): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(musicVolumeCeiling(connectorId), value))
    : 0.82;
}

export async function saveMusicAudioSettings(
  settings: MusicAudioSettingsValue,
): Promise<MusicAudioSettingsValue> {
  if (snapshot.saving) throw new Error("Music audio settings are being saved");
  publish({ saving: true, error: false });
  try {
    const saved = normalizeMusicAudio(
      await invoke<MusicAudioSettingsValue>("music_audio_settings_set", {
        settings: normalizeMusicAudio(settings),
      }),
    );
    publish({ settings: saved, saving: false, ready: true });
    broadcastWindowState(AUDIO_CHANNEL, saved);
    return saved;
  } catch (error) {
    publish({ saving: false, error: true });
    throw error;
  }
}

export const loadMusicAudioDevices = () => invoke<MusicAudioDevice[]>("music_audio_devices");
