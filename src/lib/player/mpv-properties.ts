import { invoke } from "@tauri-apps/api/core";
import {
  createSubtitleFpsCoordinator,
  validateSubtitleFps,
  type SubtitleFpsChoice,
} from "./subtitle-fps";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
let subtitleFpsGeneration = 0;

async function readMpvNumber(name: string): Promise<number | null> {
  if (!isTauri) return null;
  try {
    const value = await invoke<number | string>("mpv_get_property", { name });
    if (value == null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readMpvBoolean(name: string): Promise<boolean | null> {
  if (!isTauri) return null;
  try {
    const value = await invoke<boolean | number | string>("mpv_get_property", { name });
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = value.trim().toLowerCase();
    if (normalized === "yes" || normalized === "true" || normalized === "1") return true;
    if (normalized === "no" || normalized === "false" || normalized === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export async function readMpvVideoFps(): Promise<number | null> {
  const estimated = await readMpvNumber("estimated-vf-fps");
  if (estimated != null && estimated > 0) return estimated;
  const container = await readMpvNumber("container-fps");
  return container != null && container > 0 ? container : null;
}

export async function readMpvSubtitleFps(): Promise<{
  supported: boolean;
  value: number | null;
}> {
  if ((await readMpvBoolean("idle-active")) !== false) {
    return { supported: false, value: null };
  }
  await waitForMpvSubtitleFpsTransitions();
  if ((await readMpvBoolean("idle-active")) !== false) {
    return { supported: false, value: null };
  }
  const raw = await readMpvNumber("sub-fps");
  if ((await readMpvBoolean("idle-active")) !== false) {
    return { supported: false, value: null };
  }
  if (raw == null) return { supported: false, value: null };
  if (raw === 0) return { supported: true, value: null };
  const result = validateSubtitleFps(raw);
  return result.ok ? { supported: true, value: result.value } : { supported: false, value: null };
}

async function writeMpvSubtitleFpsValue(value: number): Promise<void> {
  if (!isTauri) throw new Error("mpv is unavailable outside the desktop player.");
  await invoke("mpv_set_property", { name: "sub-fps", value });
}

const coordinator = createSubtitleFpsCoordinator({ writeFps: writeMpvSubtitleFpsValue });

async function waitForMpvSubtitleFpsTransitions(): Promise<void> {
  while (true) {
    const generation = subtitleFpsGeneration;
    await coordinator.whenSettled();
    if (generation === subtitleFpsGeneration) return;
  }
}

export async function writeMpvSubtitleFps(
  choice: SubtitleFpsChoice,
  generation: number,
): Promise<void> {
  await coordinator.apply(choice, () => generation === subtitleFpsGeneration);
}

export async function resetMpvSubtitleFpsForTransition(
  onResetError?: (error: unknown) => void,
): Promise<void> {
  invalidateMpvSubtitleFpsContext();
  await coordinator.resetForTransition(onResetError);
}

export function markMpvSubtitleFpsSessionRecreated(): void {
  invalidateMpvSubtitleFpsContext();
  coordinator.markSessionRecreated();
}

export function invalidateMpvSubtitleFpsContext(): number {
  subtitleFpsGeneration += 1;
  return subtitleFpsGeneration;
}

export function getMpvSubtitleFpsGeneration(): number {
  return subtitleFpsGeneration;
}
