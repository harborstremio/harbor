import { convertFileSrc } from "@tauri-apps/api/core";
import type { Quality } from "@/lib/trailer";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type SaveOutcome = { saved: boolean; path: string | null };

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

export async function saveBinaryToDisk(
  bytes: Uint8Array,
  filename: string,
  ext: string,
  mime: string,
): Promise<SaveOutcome> {
  if (IS_TAURI) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const { invoke } = await import("@tauri-apps/api/core");
    const review = "__HARBOR_CONTEXT_REVIEW__" in window;
    const defaultPath = review
      ? `${await invoke<string>("harbor_download_dir")}/${filename}`
      : filename;
    const path = await save({ defaultPath, filters: [{ name: "Harbor", extensions: [ext] }] });
    if (!path) return { saved: false, path: null };
    if (review) await invoke("harbor_validate_review_path", { path });
    await writeFile(path, bytes);
    return { saved: true, path };
  }
  return browserSave(bytes, filename, mime);
}

export async function saveImageToDisk(url: string, baseName: string): Promise<SaveOutcome> {
  const { saveContextImage } = await import("@/lib/context-image");
  return saveContextImage({ src: url, filename: baseName });
}

export async function saveTrailerToDisk(
  ytId: string,
  quality: Quality,
  baseName: string,
): Promise<SaveOutcome> {
  if (!IS_TAURI) return { saved: false, path: null };
  const { fetchTrailer } = await import("@/lib/trailer");
  const info = await fetchTrailer(ytId, quality);
  if (!info) return { saved: false, path: null };
  const res = await fetch(convertFileSrc(info.file_path));
  const bytes = new Uint8Array(await res.arrayBuffer());
  return saveBinaryToDisk(bytes, `${baseName}.mp4`, "mp4", "video/mp4");
}
