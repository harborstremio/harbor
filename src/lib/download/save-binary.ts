import { convertFileSrc } from "@tauri-apps/api/core";
import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";
import { fetchTrailer, type Quality } from "@/lib/trailer";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type SaveOutcome = { saved: boolean; path: string | null };

function extFromUrl(url: string, fallback: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0) return fallback;
  const ext = clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,4}$/.test(ext) ? ext : fallback;
}

function browserSave(bytes: Uint8Array, filename: string, mime: string): SaveOutcome {
  const view = new Uint8Array(bytes);
  const blob = new Blob([view.buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true, path: null };
}

async function writeBytes(
  bytes: Uint8Array,
  filename: string,
  ext: string,
  mime: string,
): Promise<SaveOutcome> {
  if (IS_TAURI) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "Harbor", extensions: [ext] }],
    });
    if (!path) return { saved: false, path: null };
    await writeFile(path, bytes);
    return { saved: true, path };
  }
  return browserSave(bytes, filename, mime);
}

export async function saveImageToDisk(url: string, baseName: string): Promise<SaveOutcome> {
  const ext = extFromUrl(url, "jpg");
  const res = IS_TAURI ? await tauriHttpFetch(url) : await fetch(url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  return writeBytes(bytes, `${baseName}.${ext}`, ext, mime);
}

export async function saveTrailerToDisk(
  ytId: string,
  quality: Quality,
  baseName: string,
): Promise<SaveOutcome> {
  if (!IS_TAURI) return { saved: false, path: null };
  const info = await fetchTrailer(ytId, quality);
  if (!info) return { saved: false, path: null };
  const res = await fetch(convertFileSrc(info.file_path));
  const bytes = new Uint8Array(await res.arrayBuffer());
  return writeBytes(bytes, `${baseName}.mp4`, "mp4", "video/mp4");
}
