import type { PlayerSrc } from "@/lib/view";

export function safeName(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80) || "Harbor";
}

export function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    "_" +
    String(d.getMilliseconds()).padStart(3, "0")
  );
}

export function formatPosition(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

export function captureBaseTitle(src: PlayerSrc): string {
  if (src.episode && typeof src.episode.season === "number" && typeof src.episode.episode === "number") {
    return `${src.meta.name} S${String(src.episode.season).padStart(2, "0")}E${String(src.episode.episode).padStart(2, "0")}`;
  }
  return src.meta.name;
}

export async function captureDir(): Promise<string | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    const pathMod = await import("@tauri-apps/api/path");
    const pictures = await pathMod.pictureDir();
    return await pathMod.join(pictures, "Harbor");
  } catch {
    return null;
  }
}

export async function joinPath(dir: string, name: string): Promise<string> {
  try {
    const pathMod = await import("@tauri-apps/api/path");
    return await pathMod.join(dir, name);
  } catch {
    return `${dir}/${name}`;
  }
}
