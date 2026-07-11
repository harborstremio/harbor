import type { Settings } from "@/lib/settings";
import { useSyncExternalStore } from "react";

export type SubPreset = {
  id: string;
  name: string;
  values: Pick<
    Settings,
    | "subStyle"
    | "subFontFamily"
    | "subFontSize"
    | "subFontColor"
    | "subBorderColor"
    | "subBorderSize"
    | "subMarginY"
    | "subAlignX"
    | "subAssOverride"
    | "subBoxOpacity"
    | "subBoxColor"
    | "subOpacity"
    | "subLineSpacing"
  >;
};

const KEY = "harbor.sub.presets.v1";

export const SEED_PRESETS: SubPreset[] = [
  {
    id: "english",
    name: "English",
    values: {
      subStyle: "shadow",
      subFontFamily: "inter",
      subFontSize: 28,
      subFontColor: "#FFFFFF",
      subBorderColor: "#000000",
      subBorderSize: 0,
      subMarginY: 10,
      subAlignX: "center",
      subAssOverride: "scale",
      subBoxOpacity: 0.6,
      subBoxColor: "#000000",
      subOpacity: 1,
      subLineSpacing: 0,
    },
  },
  {
    id: "foreign",
    name: "Foreign",
    values: {
      subStyle: "outline",
      subFontFamily: "inter",
      subFontSize: 40,
      subFontColor: "#FFFFFF",
      subBorderColor: "#000000",
      subBorderSize: 2,
      subMarginY: 14,
      subAlignX: "center",
      subAssOverride: "scale",
      subBoxOpacity: 0.6,
      subBoxColor: "#000000",
      subOpacity: 1,
      subLineSpacing: 0,
    },
  },
  {
    id: "arabic",
    name: "Arabic",
    values: {
      subStyle: "outline",
      subFontFamily: "arabic",
      subFontSize: 40,
      subFontColor: "#FFFFFF",
      subBorderColor: "#000000",
      subBorderSize: 2,
      subMarginY: 14,
      subAlignX: "center",
      subAssOverride: "force",
      subBoxOpacity: 0.6,
      subBoxColor: "#000000",
      subOpacity: 1,
      subLineSpacing: 0,
    },
  },
];

export function loadSubPresets(): SubPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return SEED_PRESETS;
    const list = JSON.parse(raw) as SubPreset[];
    return Array.isArray(list) ? list : SEED_PRESETS;
  } catch {
    return SEED_PRESETS;
  }
}

export function saveSubPresets(list: SubPreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
  } catch {}
}

export function snapshotSub(s: Settings): SubPreset["values"] {
  return {
    subStyle: s.subStyle,
    subFontFamily: s.subFontFamily,
    subFontSize: s.subFontSize,
    subFontColor: s.subFontColor,
    subBorderColor: s.subBorderColor,
    subBorderSize: s.subBorderSize,
    subMarginY: s.subMarginY,
    subAlignX: s.subAlignX,
    subAssOverride: s.subAssOverride,
    subBoxOpacity: s.subBoxOpacity,
    subBoxColor: s.subBoxColor,
    subOpacity: s.subOpacity,
    subLineSpacing: s.subLineSpacing ?? 0,
  };
}

let barOpen = false;
const listeners = new Set<() => void>();

export function openStyleBar(): void {
  if (barOpen) return;
  barOpen = true;
  listeners.forEach((l) => l());
}

export function closeStyleBar(): void {
  if (!barOpen) return;
  barOpen = false;
  listeners.forEach((l) => l());
}

export function useStyleBarOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => barOpen,
    () => false,
  );
}
