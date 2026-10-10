import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import { readMusicPreference, writeMusicPreference } from "./preferences";
import { broadcastWindowState, subscribeWindowState } from "./window-sync";
import { DEFAULT_MIKU_MODEL, normalizeMikuModel, type MikuModel } from "./miku-models";
import { normalizeGifTiming, type GifTiming } from "./gif-clock";

const KEY = "harbor.music.appearance.v1";
type Appearance = {
  artworkColors: boolean;
  levels: boolean;
  dockVisualizer: boolean;
  mikuVisualizer: boolean;
  mikuModel: MikuModel;
  gifVisualizer: boolean;
  gifId: string | null;
  gifName: string;
  gifSize: number;
  gifTiming: GifTiming;
  immersive: boolean;
};
function read(): Appearance {
  try {
    const value = JSON.parse(readMusicPreference(KEY) ?? "{}");
    return {
      artworkColors: value.artworkColors !== false,
      levels: value.levels !== false,
      dockVisualizer: value.dockVisualizer === true,
      mikuVisualizer: value.mikuVisualizer === true,
      mikuModel: normalizeMikuModel(value.mikuModel),
      gifVisualizer: value.gifVisualizer === true,
      gifId: typeof value.gifId === "string" ? value.gifId : null,
      gifName: typeof value.gifName === "string" ? value.gifName : "",
      gifSize: typeof value.gifSize === "number" && Number.isFinite(value.gifSize) ? Math.max(64, Math.min(220, value.gifSize)) : 126,
      gifTiming: normalizeGifTiming(value.gifTiming),
      immersive: value.immersive === true,
    };
  } catch {
    return { artworkColors: true, levels: true, dockVisualizer: false, mikuVisualizer: false, mikuModel: DEFAULT_MIKU_MODEL, gifVisualizer: false, gifId: null, gifName: "", gifSize: 126, gifTiming: "auto", immersive: false };
  }
}
let appearance = read();
const listeners = new Set<() => void>();
const APPEARANCE_CHANNEL = "harbor://music-appearance";

subscribeWindowState<Appearance>(APPEARANCE_CHANNEL, (value) => {
  appearance = { ...appearance, ...value, mikuModel: normalizeMikuModel(value?.mikuModel ?? appearance.mikuModel) };
  listeners.forEach((listener) => listener());
});

export function setMusicAppearance(patch: Partial<Appearance>) {
  appearance = { ...appearance, ...patch };
  writeMusicPreference(KEY, JSON.stringify(appearance));
  broadcastWindowState(APPEARANCE_CHANNEL, appearance);
  listeners.forEach((listener) => listener());
}
export function useMusicAppearance() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => appearance,
    () => appearance,
  );
}

export type MusicArtworkColor = { color: string; ink: "#111111" | "#ffffff" };
/** A dominant color from actual artwork pixels, with a readable control foreground. */
export function musicArtworkColor(pixels: ArrayLike<number>): MusicArtworkColor | null {
  const buckets = new Map<string, { rgb: number[]; weight: number; count: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const peak = Math.max(...rgb),
      low = Math.min(...rgb);
    if (peak < 24 || low > 235) continue;
    const key = rgb.map((value) => Math.floor(value / 32)).join(":");
    const bucket = buckets.get(key) ?? { rgb: [0, 0, 0], weight: 0, count: 0 };
    rgb.forEach((value, channel) => {
      bucket.rgb[channel] += value;
    });
    bucket.count += 1;
    bucket.weight += 0.2 + (peak - low) / 255;
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!best) return null;
  const rgb = best.rgb.map((value) => Math.round(value / best.count));
  const linear = rgb.map((value) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return { color: `rgb(${rgb.join(" ")})`, ink: luminance > 0.192 ? "#111111" : "#ffffff" };
}

const colors = new Map<string, MusicArtworkColor | null>();
const pending = new Map<string, Promise<MusicArtworkColor | null>>();
const MAX_BYTES = 4 * 1024 * 1024;
export async function readMusicArtworkBlob(
  response: Response,
  maximumBytes = MAX_BYTES,
): Promise<Blob | null> {
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/") ||
    Number(response.headers.get("content-length") ?? 0) > maximumBytes
  ) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new Blob(chunks, { type: response.headers.get("content-type")! });
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
}

async function artworkBytes(src: string): Promise<Blob | null> {
  try {
    const response = await fetch(src, {
      cache: "force-cache",
      credentials: "omit",
      signal: AbortSignal.timeout(6000),
    });
    // A readable HTTP response needs no second download through native fetch.
    return await readMusicArtworkBlob(response);
  } catch {
    /* Hosts without CORS can use the existing native image fetch. */
  }
  if (!("__TAURI_INTERNALS__" in window) || !/^https?:\/\//i.test(src)) return null;
  try {
    const response = await invoke<{ ok: boolean; body: string; contentType?: string }>(
      "harbor_fetch",
      {
        args: {
          url: src,
          method: "GET",
          responseType: "base64",
          timeoutMs: 6000,
          maxResponseBytes: MAX_BYTES,
        },
      },
    );
    if (!response.ok || response.body.length > Math.ceil(MAX_BYTES / 3) * 4) return null;
    const bytes = Uint8Array.from(atob(response.body), (char) => char.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) return null;
    return new Blob([bytes], { type: response.contentType ?? "image/jpeg" });
  } catch {
    return null;
  }
}
async function artworkPixels(src: string): Promise<Uint8ClampedArray | null> {
  try {
    const blob = await artworkBytes(src);
    if (!blob) return null;
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: 24,
      resizeHeight: 24,
      resizeQuality: "high",
    });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, 24, 24).data;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function extract(src: string): Promise<MusicArtworkColor | null> {
  const pixels = await artworkPixels(src);
  return pixels ? musicArtworkColor(pixels) : null;
}
function hueOf(rgb: number[]): number {
  const [r, g, b] = rgb.map((value) => value / 255);
  const peak = Math.max(r, g, b);
  const span = peak - Math.min(r, g, b);
  if (span < 0.0001) return 0;
  const raw =
    peak === r ? ((g - b) / span) % 6 : peak === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return (((raw * 60) % 360) + 360) % 360;
}

function lumaOf(rgb: number[]): number {
  return (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
}

function vividOf(rgb: number[]): number {
  const peak = Math.max(...rgb);
  return peak === 0 ? 0 : (peak - Math.min(...rgb)) / peak;
}

/** Distinct dominant colors from real artwork pixels, ordered dark to bright. */
export function musicArtworkPalette(pixels: ArrayLike<number>, wanted = 3): string[] {
  const buckets = new Map<string, { rgb: number[]; weight: number; count: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const peak = Math.max(...rgb);
    const low = Math.min(...rgb);
    if (peak < 24 || low > 235) continue;
    const key = rgb.map((value) => Math.floor(value / 24)).join(":");
    const bucket = buckets.get(key) ?? { rgb: [0, 0, 0], weight: 0, count: 0 };
    rgb.forEach((value, channel) => {
      bucket.rgb[channel] += value;
    });
    bucket.count += 1;
    bucket.weight += 0.15 + ((peak - low) / 255) * 1.6;
    buckets.set(key, bucket);
  }
  const ranked = [...buckets.values()]
    .map((bucket) => ({
      rgb: bucket.rgb.map((value) => Math.round(value / bucket.count)),
      weight: bucket.weight,
    }))
    .sort((a, b) => b.weight - a.weight);
  if (!ranked.length) return [];

  const picked: number[][] = [];
  for (const gap of [56, 34, 18, 0]) {
    for (const candidate of ranked) {
      if (picked.length >= wanted) break;
      const distinct = picked.every((seen) => {
        const delta = Math.abs(hueOf(seen) - hueOf(candidate.rgb));
        const hueGap = Math.min(delta, 360 - delta);
        return hueGap > gap || Math.abs(lumaOf(seen) - lumaOf(candidate.rgb)) > 0.26;
      });
      if (distinct) picked.push(candidate.rgb);
    }
    if (picked.length >= wanted) break;
  }
  while (picked.length && picked.length < wanted) {
    const base = picked[picked.length - 1];
    const lift = 0.34 + picked.length * 0.12;
    picked.push(base.map((value) => Math.round(Math.min(255, value + (255 - value) * lift))));
  }
  return picked
    .map((rgb) => {
      const boost = vividOf(rgb) < 0.28 ? 1.35 : 1.12;
      const mean = (rgb[0] + rgb[1] + rgb[2]) / 3;
      return rgb.map((value) =>
        Math.round(Math.max(0, Math.min(255, mean + (value - mean) * boost))),
      );
    })
    .sort((a, b) => lumaOf(a) - lumaOf(b))
    .map((rgb) => `rgb(${rgb.join(" ")})`);
}

const palettes = new Map<string, string[]>();
const palettePending = new Map<string, Promise<string[]>>();

export function useMusicArtworkPalette(src: string | undefined, enabled: boolean): string[] {
  const [result, setResult] = useState<{ src: string; value: string[] } | null>(null);
  useEffect(() => {
    if (!enabled || !src) return;
    let alive = true;
    const cached = palettes.get(src);
    if (cached) {
      setResult({ src, value: cached });
      return;
    }
    const job =
      palettePending.get(src) ??
      artworkPixels(src)
        .then((pixels) => {
          const value = pixels ? musicArtworkPalette(pixels) : [];
          palettes.set(src, value);
          palettePending.delete(src);
          return value;
        })
        .catch(() => {
          palettePending.delete(src);
          return [] as string[];
        });
    palettePending.set(src, job);
    void job.then((value) => {
      if (alive) setResult({ src, value });
    });
    return () => {
      alive = false;
    };
  }, [src, enabled]);
  return enabled && src && result?.src === src ? result.value : [];
}

export function useMusicArtworkColor(src: string | undefined, enabled: boolean) {
  const [result, setResult] = useState<{ src: string; value: MusicArtworkColor | null } | null>(
    null,
  );
  useEffect(() => {
    if (!enabled || !src) return;
    let alive = true;
    if (colors.has(src)) {
      setResult({ src, value: colors.get(src)! });
      return;
    }
    const task =
      pending.get(src) ??
      extract(src).then((value) => {
        // A transient fetch/decode failure must be retryable when the user re-enables colors.
        if (value) colors.set(src, value);
        pending.delete(src);
        while (colors.size > 80) colors.delete(colors.keys().next().value!);
        return value;
      });
    pending.set(src, task);
    void task.then((value) => {
      if (alive) setResult({ src, value });
    });
    return () => {
      alive = false;
    };
  }, [src, enabled]);
  return enabled && result && result.src === src ? result.value : null;
}
