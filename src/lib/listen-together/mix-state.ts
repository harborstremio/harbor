import type { MusicAudioSettingsValue } from "@/lib/music/audio-settings";
import { clampNumber } from "@/lib/music/parametric-eq";

export type ListenMix = {
  speed: number;
  pitch: number;
  reverb: number;
  keepPitch: boolean;
  eqEnabled: boolean;
  eqMode: "graphic" | "parametric";
  eqBands: number[];
};

export type ListenMixPayload = {
  p?: number;
  r?: number;
  k?: 1;
  e?: 1;
  m?: "p";
  b?: number[];
};

const LISTEN_MIX_BANDS = 10;

export const DEFAULT_LISTEN_MIX: ListenMix = {
  speed: 1,
  pitch: 0,
  reverb: 0,
  keepPitch: false,
  eqEnabled: false,
  eqMode: "graphic",
  eqBands: Array(LISTEN_MIX_BANDS).fill(0),
};

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function normalizeBands(bands: unknown): number[] {
  const source = Array.isArray(bands) ? (bands as unknown[]) : [];
  return Array.from({ length: LISTEN_MIX_BANDS }, (_, index) =>
    round(clampNumber(source[index], -12, 12, 0), 1),
  );
}

function flatBands(bands: number[]): boolean {
  return bands.every((band) => band === 0);
}

export function readListenMix(settings: MusicAudioSettingsValue): ListenMix {
  return {
    speed: round(clampNumber(settings?.speed, 0.5, 1.6, 1), 3),
    pitch: round(clampNumber(settings?.pitch, -12, 12, 0), 2),
    reverb: round(clampNumber(settings?.reverb, 0, 1, 0), 2),
    keepPitch: settings?.keepPitch === true,
    eqEnabled: settings?.eqEnabled === true,
    eqMode: settings?.eqMode === "parametric" ? "parametric" : "graphic",
    eqBands: normalizeBands(settings?.eqBands),
  };
}

export function writeListenMix(
  settings: MusicAudioSettingsValue,
  mix: ListenMix,
): MusicAudioSettingsValue {
  return {
    ...settings,
    speed: mix.speed,
    pitch: mix.pitch,
    reverb: mix.reverb,
    keepPitch: mix.keepPitch,
    eqEnabled: mix.eqEnabled,
    eqMode: mix.eqMode,
    eqBands: [...mix.eqBands],
  };
}

export function listenMixMatches(settings: MusicAudioSettingsValue, mix: ListenMix): boolean {
  const own = readListenMix(settings);
  return (
    own.speed === mix.speed &&
    own.pitch === mix.pitch &&
    own.reverb === mix.reverb &&
    own.keepPitch === mix.keepPitch &&
    own.eqEnabled === mix.eqEnabled &&
    own.eqMode === mix.eqMode &&
    own.eqBands.every((band, index) => band === mix.eqBands[index])
  );
}

export function packListenMix(mix: ListenMix): ListenMixPayload | null {
  const out: ListenMixPayload = {};
  if (mix.pitch !== 0) out.p = round(mix.pitch, 2);
  if (mix.reverb !== 0) out.r = round(mix.reverb, 2);
  if (mix.keepPitch) out.k = 1;
  if (mix.eqEnabled) out.e = 1;
  if (mix.eqMode === "parametric") out.m = "p";
  if (mix.eqEnabled && !flatBands(mix.eqBands)) out.b = mix.eqBands.map((band) => round(band, 1));
  return Object.keys(out).length > 0 ? out : null;
}

export function unpackListenMix(payload: unknown): Omit<ListenMix, "speed"> {
  const value =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const eqEnabled = value?.e === 1;
  return {
    pitch: round(clampNumber(value?.p, -12, 12, 0), 2),
    reverb: round(clampNumber(value?.r, 0, 1, 0), 2),
    keepPitch: value?.k === 1,
    eqEnabled,
    eqMode: value?.m === "p" ? "parametric" : "graphic",
    eqBands: eqEnabled ? normalizeBands(value?.b) : [...DEFAULT_LISTEN_MIX.eqBands],
  };
}
