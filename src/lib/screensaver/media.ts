import { convertFileSrc } from "@tauri-apps/api/core";
import type { ScreensaverMedia, ScreensaverMediaKind } from "@/lib/settings/types";

export const SCREENSAVER_VIDEO_EXT = ["mp4", "m4v", "webm", "mov"];
export const SCREENSAVER_GIF_EXT = ["gif"];
export const SCREENSAVER_IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "avif", "bmp"];
export const SCREENSAVER_EXT = [
  ...SCREENSAVER_VIDEO_EXT,
  ...SCREENSAVER_GIF_EXT,
  ...SCREENSAVER_IMAGE_EXT,
];

const PREVIEW_EVENT = "harbor:screensaver-preview";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function screensaverFileName(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

export function screensaverKind(path: string): ScreensaverMediaKind | null {
  const ext = screensaverFileName(path).split(".").pop()?.toLowerCase() ?? "";
  if (SCREENSAVER_VIDEO_EXT.includes(ext)) return "video";
  if (SCREENSAVER_GIF_EXT.includes(ext)) return "gif";
  if (SCREENSAVER_IMAGE_EXT.includes(ext)) return "image";
  return null;
}

export function screensaverMediaSrc(path: string): string {
  if (!isTauri()) return path;
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

export function sanitizeScreensaverMedia(value: unknown): ScreensaverMedia[] {
  if (!Array.isArray(value)) return [];
  const out: ScreensaverMedia[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Partial<ScreensaverMedia>;
    if (typeof m.id !== "string" || !m.id || seen.has(m.id)) continue;
    if (typeof m.path !== "string" || !m.path) continue;
    const kind =
      m.kind === "video" || m.kind === "gif" || m.kind === "image"
        ? m.kind
        : screensaverKind(m.path);
    if (!kind) continue;
    seen.add(m.id);
    out.push({
      id: m.id,
      path: m.path,
      kind,
      name: typeof m.name === "string" && m.name ? m.name : screensaverFileName(m.path),
    });
  }
  return out;
}

export function activeScreensaverMedia(
  list: ScreensaverMedia[],
  selectedId: string | null,
): ScreensaverMedia | null {
  if (list.length === 0) return null;
  return list.find((m) => m.id === selectedId) ?? list[0];
}

export function newScreensaverMedia(path: string): ScreensaverMedia | null {
  const kind = screensaverKind(path);
  if (!kind) return null;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, path, kind, name: screensaverFileName(path) };
}

export async function pickScreensaverFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    multiple: true,
    filters: [{ name: "Video, GIF, or image", extensions: SCREENSAVER_EXT }],
  });
  if (!picked) return [];
  const list = Array.isArray(picked) ? picked : [picked];
  return list.filter((p): p is string => typeof p === "string" && p.length > 0);
}

export function previewScreensaver(): void {
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT));
}

export function onScreensaverPreview(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(PREVIEW_EVENT, listener);
  return () => window.removeEventListener(PREVIEW_EVENT, listener);
}
