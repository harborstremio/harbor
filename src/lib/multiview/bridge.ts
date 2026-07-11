import { invoke } from "@tauri-apps/api/core";

export const MAX_SLOTS = 4;

export type CellRect = {
  slot: number;
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  cssViewW: number;
  cssViewH: number;
};

export type OpenRect = {
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  cssViewW: number;
  cssViewH: number;
};

export function multiviewSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("__TAURI__" in window || "__TAURI_INTERNALS__" in window)) return false;
  return navigator.userAgent.toLowerCase().includes("windows");
}

export async function mvOpen(slot: number, rect: OpenRect, url: string, userAgent?: string): Promise<void> {
  await invoke("multiview_open", {
    args: {
      slot,
      cssLeft: rect.cssLeft,
      cssTop: rect.cssTop,
      cssWidth: rect.cssWidth,
      cssHeight: rect.cssHeight,
      cssViewW: rect.cssViewW,
      cssViewH: rect.cssViewH,
      url,
      userAgent,
    },
  });
}

export async function mvPrespawn(count: number): Promise<void> {
  await invoke("multiview_prespawn", { count });
}

export async function mvGeometry(r: CellRect): Promise<void> {
  await invoke("multiview_geometry", {
    args: {
      slot: r.slot,
      cssLeft: r.cssLeft,
      cssTop: r.cssTop,
      cssWidth: r.cssWidth,
      cssHeight: r.cssHeight,
      cssViewW: r.cssViewW,
      cssViewH: r.cssViewH,
    },
  });
}

export async function mvAudioFocus(focus: number): Promise<void> {
  await invoke("multiview_audio_focus", { focus });
}

export async function mvClose(slot: number): Promise<void> {
  await invoke("multiview_close", { slot });
}

export async function mvVisibility(visible: boolean): Promise<void> {
  await invoke("multiview_visibility", { visible });
}

export async function mvStopAll(): Promise<void> {
  await invoke("multiview_stop_all");
}
