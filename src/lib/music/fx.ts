import { invoke } from "@tauri-apps/api/core";

export type MusicFxKind = "off" | "echo" | "delay" | "spiral" | "wide";

export type MusicFx = {
  kind: MusicFxKind;
  depth: number;
  beats: number;
  bpm: number;
};

export const FX_OFF: MusicFx = { kind: "off", depth: 0.5, beats: 0.5, bpm: 120 };

export const FX_KINDS: MusicFxKind[] = ["echo", "delay", "spiral", "wide"];

export const FX_DIVISIONS = [0.0625, 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8, 16];

const DIVISION_LABELS: Record<string, string> = {
  "0.0625": "1/16",
  "0.125": "1/8",
  "0.25": "1/4",
  "0.5": "1/2",
  "0.75": "3/4",
  "1": "1",
  "1.5": "3/2",
  "2": "2",
  "4": "4",
  "8": "8",
  "16": "16",
};

export function divisionLabel(beats: number): string {
  return DIVISION_LABELS[String(beats)] ?? String(beats);
}

export function beatMs(bpm: number, beats: number): number {
  const tempo = Number.isFinite(bpm) && bpm > 0 ? Math.min(220, Math.max(40, bpm)) : 120;
  const span = Number.isFinite(beats) ? Math.min(16, Math.max(0.0625, beats)) : 0.5;
  return (60000 / tempo) * span;
}

export function setMusicFx(fx: MusicFx): Promise<MusicFx> {
  return invoke<MusicFx>("music_fx_set", { fx });
}

export function clearMusicFx(): Promise<MusicFx> {
  return invoke<MusicFx>("music_fx_clear");
}

export async function getMusicFx(): Promise<MusicFx> {
  try {
    return await invoke<MusicFx>("music_fx_get");
  } catch {
    return FX_OFF;
  }
}
