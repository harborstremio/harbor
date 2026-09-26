import { invoke } from "@tauri-apps/api/core";

/**
 * A display as reported by the Rust `list_monitors` command. `id` is the
 * stable-ish persistence key; the rest is for the picker label and for the Rust
 * side to re-resolve the monitor even if it moved or was replugged.
 */
export type MonitorInfo = {
  id: string;
  deviceName: string;
  deviceId: string;
  name: string;
  isPrimary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
};

/**
 * A per-mode display choice. `auto` follows Harbor (current behaviour); `explicit`
 * targets the stored monitor, falling back to auto when it is no longer
 * connected.
 */
export type DisplaySelection = { mode: "auto" } | { mode: "explicit"; monitor: MonitorInfo };

export const AUTO_DISPLAY: DisplaySelection = { mode: "auto" };

export async function listMonitors(): Promise<MonitorInfo[]> {
  try {
    return await invoke<MonitorInfo[]>("list_monitors");
  } catch {
    return [];
  }
}

/**
 * Move Harbor's main window onto a chosen monitor (used when Open in Big Picture
 * should start on a specific screen). Resolves to false when the monitor is gone.
 */
export async function moveMainToMonitor(monitor: MonitorInfo): Promise<boolean> {
  try {
    return await invoke<boolean>("move_main_to_monitor", { monitor });
  } catch {
    return false;
  }
}

/** "3840 × 2160" */
export function monitorResolution(m: MonitorInfo): string {
  return `${m.width} × ${m.height}`;
}

/**
 * A monitor's display title: the model name when Windows reports one, otherwise
 * a readable, unique fallback from the GDI device name (`\\.\DISPLAY2` ->
 * `DISPLAY2`). Windows leaves the model name empty when the monitor's EDID never
 * reached the driver, so every card would otherwise read the same.
 */
export function monitorCardName(m: MonitorInfo): string {
  const named = m.name.trim();
  if (named) return named;
  const device = m.deviceName.replace(/^\\\\\.\\/, "").trim();
  return device || m.id;
}

/** Coerce a stored value back into a valid display choice, defaulting to auto. */
export function sanitizeDisplaySelection(value: unknown): DisplaySelection {
  if (!value || typeof value !== "object") return AUTO_DISPLAY;
  const v = value as { mode?: unknown; monitor?: unknown };
  if (v.mode !== "explicit" || !v.monitor || typeof v.monitor !== "object") return AUTO_DISPLAY;
  const m = v.monitor as Record<string, unknown>;
  if (
    typeof m.id !== "string" ||
    typeof m.deviceName !== "string" ||
    typeof m.x !== "number" ||
    typeof m.y !== "number" ||
    typeof m.width !== "number" ||
    typeof m.height !== "number"
  ) {
    return AUTO_DISPLAY;
  }
  return {
    mode: "explicit",
    monitor: {
      id: m.id,
      deviceName: m.deviceName,
      deviceId: typeof m.deviceId === "string" ? m.deviceId : "",
      name: typeof m.name === "string" ? m.name : "",
      isPrimary: m.isPrimary === true,
      x: m.x,
      y: m.y,
      width: m.width,
      height: m.height,
      scaleFactor: typeof m.scaleFactor === "number" ? m.scaleFactor : 1,
    },
  };
}
