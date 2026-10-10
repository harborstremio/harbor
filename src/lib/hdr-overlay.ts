import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";
import type { PlayerNavigation } from "@/lib/view";

export type HdrNavigationRequest = {
  [K in keyof PlayerNavigation]: { action: K; args: Parameters<PlayerNavigation[K]> };
}[keyof PlayerNavigation];

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

export async function hdrOverlayOpen(stageId: string): Promise<void> {
  await invoke("hdr_overlay_open", { stageId });
}

export async function hdrOverlayShow(stageId: string): Promise<boolean> {
  return invoke<boolean>("hdr_overlay_show", { stageId });
}

export async function hdrOverlayClose(stageId: string): Promise<void> {
  await invoke("hdr_overlay_close", { stageId });
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

export async function hdrOverlayEmitAction(event: string, payload: unknown): Promise<void> {
  const stageId = new URLSearchParams(window.location.search).get("stageId");
  await invoke("hdr_overlay_emit_action", { event, payload, stageId }).catch(() => {});
}

export function onHdrStageProps<T>(handler: (p: T) => void): Promise<UnlistenFn> {
  return listen<T>("hdr-stage://props", (e) => handler(e.payload));
}

export function onHdrStageReady(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<{ stageId: string }>("hdr-stage://ready", (e) => handler(e.payload.stageId));
}

export function onHdrStageDead(handler: (id: string) => void): Promise<UnlistenFn> {
  return listen<{ stageId: string }>("hdr-stage://dead", (e) => handler(e.payload.stageId));
}
