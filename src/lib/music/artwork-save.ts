import { safeFetch } from "@/lib/safe-fetch";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const SQUARE = /\/(\d{2,4})x\1-/;
const TMDB_SIZE = /\/t\/p\/w\d+\//;
const MAX_BYTES = 24 * 1024 * 1024;

export function largestArtwork(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".dzcdn.net")) return url.replace(SQUARE, "/1500x1500-");
    if (parsed.hostname === "image.tmdb.org") return url.replace(TMDB_SIZE, "/t/p/original/");
    return url;
  } catch {
    return url;
  }
}

function safePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function artworkFileName(title: string, artist: string, extension: string): string {
  const left = safePart(artist);
  const right = safePart(title) || "Artwork";
  const base = (left ? `${left} - ${right}` : right).slice(0, 120).trim() || "Artwork";
  return `${base}.${extension}`;
}

function extensionOf(url: string, type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  const guess = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return /^(jpe?g|png|webp|avif)$/.test(guess) ? guess.replace("jpeg", "jpg") : "jpg";
}

export async function saveArtwork(
  url: string | undefined,
  title: string,
  artist = "",
): Promise<boolean> {
  if (!url) throw new Error("music.artwork.none");
  const best = largestArtwork(url);
  let res = await safeFetch(best).catch(() => null);
  if (!res?.ok && best !== url) res = await safeFetch(url).catch(() => null);
  if (!res?.ok) throw new Error("music.artwork.failed");
  const type = res.headers.get("content-type") ?? "";
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) throw new Error("music.artwork.failed");
  const bytes = new Uint8Array(buffer);
  const extension = extensionOf(best, type);
  const name = artworkFileName(title, artist, extension);

  if (IS_TAURI) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: name,
      filters: [{ name: "Image", extensions: [extension] }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }

  const blob = new Blob([bytes], { type: type || "image/jpeg" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return true;
}
