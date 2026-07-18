import { invoke } from "@tauri-apps/api/core";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type CastDeviceInfo = {
  id: string;
  name: string;
  host: string;
  port: number;
  model: string | null;
  kind: "chromecast" | "dlna" | "roku" | "airplay";
  control_url: string | null;
  audio_only: boolean;
};

export type TranscodeProfile = {
  max_height: number;
  force_h264: boolean;
  force_aac: boolean;
  force_stereo: boolean;
  max_video_kbps?: number;
};

export type CastStatus = {
  position_sec: number;
  player_state: string;
  connected: boolean;
};

export type CastSubStyle = {
  font_size: number;
  font_color: string;
  border_color: string;
  border_size: number;
  margin_y: number;
  align_x: "left" | "center" | "right";
};

export type CastSubInfo = {
  kind: "external" | "embedded";
  url?: string;
  src_index?: number;
  format?: "srt" | "ass" | "ssa" | "vtt";
  off: boolean;
};

export async function discoverCastDevices(): Promise<CastDeviceInfo[]> {
  if (!isTauri) return [];
  try {
    return await invoke<CastDeviceInfo[]>("cast_discover");
  } catch (e) {
    console.warn("[cast] discover failed", e);
    return [];
  }
}

export async function castLoad(opts: {
  host: string;
  port: number;
  url: string;
  title?: string;
  poster?: string;
  contentType?: string;
  startTimeSec?: number;
  kind?: "chromecast" | "dlna" | "roku" | "airplay";
  controlUrl?: string | null;
  headers?: Record<string, string>;
  transcode?: boolean;
  profile?: TranscodeProfile;
  subtitle?: CastSubInfo | null;
  subStyle?: CastSubStyle | null;
}): Promise<{ ok: boolean; error: string | null }> {
  if (!isTauri) return { ok: false, error: "Casting requires the desktop build." };
  try {
    await invoke("cast_load", {
      host: opts.host,
      port: opts.port,
      url: opts.url,
      title: opts.title ?? null,
      poster: opts.poster ?? null,
      contentType: opts.contentType ?? null,
      startTimeSec: opts.startTimeSec ?? null,
      kind: opts.kind ?? "chromecast",
      controlUrl: opts.controlUrl ?? null,
      headers: opts.headers ?? null,
      transcode: opts.transcode ?? false,
      profile: opts.profile ?? null,
      subtitle: opts.subtitle ?? null,
      subStyle: opts.subStyle ?? null,
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function castPlay(): Promise<void> {
  if (!isTauri) return;
  await invoke("cast_play").catch((e) => console.warn("[cast] play", e));
}

export async function castPause(): Promise<void> {
  if (!isTauri) return;
  await invoke("cast_pause").catch((e) => console.warn("[cast] pause", e));
}

export async function castSeek(sec: number): Promise<void> {
  if (!isTauri) return;
  await invoke("cast_seek", { sec }).catch((e) => console.warn("[cast] seek", e));
}

export async function castStop(): Promise<void> {
  if (!isTauri) return;
  await invoke("cast_stop").catch((e) => console.warn("[cast] stop", e));
}

export async function castStatus(): Promise<CastStatus | null> {
  if (!isTauri) return null;
  try {
    return (await invoke<CastStatus | null>("cast_status")) ?? null;
  } catch {
    return null;
  }
}

let ffmpegPresentCache: boolean | null = null;
export async function isFfmpegPresent(): Promise<boolean> {
  if (!isTauri) return false;
  if (ffmpegPresentCache != null) return ffmpegPresentCache;
  try {
    ffmpegPresentCache = await invoke<boolean>("cast_ffmpeg_present");
  } catch {
    ffmpegPresentCache = false;
  }
  return ffmpegPresentCache;
}

function mimeFromExt(s: string): string | undefined {
  const lower = s.toLowerCase().split("?")[0];
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  if (lower.endsWith(".avi")) return "video/x-msvideo";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".mpd")) return "application/dash+xml";
  if (lower.endsWith(".ts")) return "video/mp2t";
  return undefined;
}

export function guessContentType(url: string, fallbackName?: string): string {
  return mimeFromExt(url) ?? (fallbackName ? mimeFromExt(fallbackName) : undefined) ?? "video/mp4";
}
