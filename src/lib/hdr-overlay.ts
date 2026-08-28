import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";

export const HDR_OVERLAY_WINDOW_LABEL = "harbor-hdr-overlay";
export const HDR_STAGE_SET_SUBTITLE_TRACK = "hdr-stage://set-subtitle-track";
export const HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK = "hdr-stage://set-secondary-subtitle-track";
export const HDR_STAGE_ADD_SUBTITLE = "hdr-stage://add-subtitle";
export const HDR_STAGE_ADD_SUBTITLE_RESULT = "hdr-stage://add-subtitle-result";

export type HdrStageSubtitleTrackRequest = {
  mediaKey: string;
  id: string | null;
};

export type HdrStageAddSubtitleRequest = {
  requestId: string;
  mediaKey: string;
  url: string;
  lang?: string;
  title?: string;
  select?: boolean;
  metadata?: SubtitleLoadMetadata;
};

export type HdrStageAddSubtitleResult = {
  requestId: string;
  ok: boolean;
};

export async function hdrOverlayOpen(): Promise<void> {
  await invoke("hdr_overlay_open").catch(() => {});
}

export async function hdrOverlayClose(): Promise<void> {
  await invoke("hdr_overlay_close").catch(() => {});
}

export async function hdrOverlayHide(): Promise<void> {
  await invoke("hdr_overlay_hide").catch(() => {});
}

export async function hdrOverlaySync(): Promise<void> {
  await invoke("hdr_overlay_sync").catch(() => {});
}

export async function hdrOverlayEmitProps(payload: unknown): Promise<void> {
  await invoke("hdr_overlay_emit_props", { payload }).catch(() => {});
}

export async function hdrOverlayEmitClock(positionSec: number, bufferedSec: number): Promise<void> {
  await invoke("hdr_overlay_emit_clock", { payload: { positionSec, bufferedSec } }).catch(() => {});
}

export async function hdrOverlayEmitAction(event: string, payload: unknown): Promise<void> {
  await invoke("hdr_overlay_emit_action", { event, payload }).catch(() => {});
}

export function onHdrStageProps<T>(handler: (p: T) => void): Promise<UnlistenFn> {
  return listen<T>("hdr-stage://props", (e) => handler(e.payload));
}

export function onHdrStageClock(
  handler: (clock: { positionSec: number; bufferedSec: number }) => void,
): Promise<UnlistenFn> {
  return listen<{ positionSec: number; bufferedSec: number }>("hdr-stage://clock", (e) =>
    handler(e.payload),
  );
}

export function onHdrStageReady(handler: () => void): Promise<UnlistenFn> {
  return listen("hdr-stage://ready", () => handler());
}

export function onHdrStageDead(handler: () => void): Promise<UnlistenFn> {
  return listen("hdr-stage://dead", () => handler());
}
