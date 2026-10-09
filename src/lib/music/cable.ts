import { invoke } from "@tauri-apps/api/core";

export type CableStatus = {
  supported: boolean;
  active: boolean;
  backend: string;
  sinkName: string;
  monitorName: string;
  monitorLabel: string;
  micName: string;
  micLabel: string;
  micReady: boolean;
  monitorReady: boolean;
  spec: string | null;
  rate: number | null;
  format: string | null;
  channels: number | null;
  requestedRate: number | null;
  graphRate: number | null;
  bitPerfect: boolean;
  resampledBy: string | null;
  outputDevice: string | null;
  detail: string | null;
};

export const IDLE_CABLE: CableStatus = {
  supported: false,
  active: false,
  backend: "none",
  sinkName: "",
  monitorName: "",
  monitorLabel: "",
  micName: "",
  micLabel: "",
  micReady: false,
  monitorReady: false,
  spec: null,
  rate: null,
  format: null,
  channels: null,
  requestedRate: null,
  graphRate: null,
  bitPerfect: false,
  resampledBy: null,
  outputDevice: null,
  detail: null,
};

export async function cableStatus(): Promise<CableStatus> {
  try {
    return await invoke<CableStatus>("music_cable_status");
  } catch {
    return IDLE_CABLE;
  }
}

export function cableCreate(rate?: number): Promise<CableStatus> {
  return invoke("music_cable_create", { rate: rate ?? null });
}

export function cableDestroy(): Promise<CableStatus> {
  return invoke("music_cable_destroy");
}

export function cableHertz(rate: number | null): string {
  if (!rate || rate <= 0) return "";
  const khz = rate / 1000;
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`;
}

const DEPTHS: Array<[string, string]> = [
  ["float64", "music.cable.depth.float64"],
  ["f64", "music.cable.depth.float64"],
  ["float32", "music.cable.depth.float32"],
  ["f32", "music.cable.depth.float32"],
  ["s32", "music.cable.depth.int32"],
  ["s24", "music.cable.depth.int24"],
  ["s16", "music.cable.depth.int16"],
];

export function cableDepthKey(format: string | null): string | null {
  if (!format) return null;
  const lower = format.toLowerCase();
  return DEPTHS.find(([needle]) => lower.startsWith(needle))?.[1] ?? null;
}

const RESAMPLERS: Record<string, string> = {
  graph: "music.cable.resampledGraph",
  server: "music.cable.resampledServer",
  format: "music.cable.resampledFormat",
};

export function cableResampleKey(by: string | null): string {
  if (!by) return "music.cable.resampledOther";
  return RESAMPLERS[by] ?? "music.cable.resampledOther";
}

export function cableErrorKey(error: unknown): string {
  return String(error).replace(/^Error:\s*/, "").trim();
}
