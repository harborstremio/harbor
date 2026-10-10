import { resizeAvatar } from "@/views/settings/account/avatar-utils";
import type { AvatarPackItem } from "@/lib/avatars/packs";

export type ImportEntry = { file: File; set: string | null };
export type ImportGroup = { set: string | null; items: AvatarPackItem[] };

const IMG_EXT = ["png", "jpg", "jpeg", "jfif", "webp", "gif", "bmp", "avif", "apng", "heic"];
const IMG_RE = /\.(png|jpe?g|jfif|webp|gif|bmp|avif|apng|heic)$/i;

export function isNativePick(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function baseName(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

function cleanLabel(fileName: string, i: number): string {
  const name = baseName(fileName)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 40);
  return name || `Avatar ${i + 1}`;
}

function mimeFor(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jfif") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  return `image/${ext || "png"}`;
}

export function setSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "set"
  );
}

export function entriesFromFileList(files: FileList | File[]): ImportEntry[] {
  return [...files]
    .filter((f) => f.type.startsWith("image/") || IMG_RE.test(f.name))
    .map((file) => {
      const rel = (file as { webkitRelativePath?: string }).webkitRelativePath || "";
      const parts = rel.split("/").filter(Boolean);
      return { file, set: parts.length >= 3 ? parts[1] : null };
    });
}

async function pathToFile(
  path: string,
  readFile: (p: string) => Promise<Uint8Array>,
): Promise<File | null> {
  try {
    const bytes = await readFile(path);
    const name = baseName(path);
    return new File([bytes as BlobPart], name, { type: mimeFor(name) });
  } catch {
    return null;
  }
}

export async function pickImagesNative(): Promise<ImportEntry[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: true, filters: [{ name: "Images", extensions: IMG_EXT }] });
  const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const out: ImportEntry[] = [];
  for (const p of paths) {
    const file = await pathToFile(p, readFile);
    if (file) out.push({ file, set: null });
  }
  return out;
}

export async function pickFolderNative(): Promise<ImportEntry[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({ directory: true, multiple: false });
  if (typeof dir !== "string") return [];
  const { readDir, readFile } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const out: ImportEntry[] = [];

  const walk = async (path: string, set: string | null) => {
    const entries = await readDir(path).catch(() => [] as Awaited<ReturnType<typeof readDir>>);
    for (const e of entries) {
      const full = await join(path, e.name);
      if (e.isFile && IMG_RE.test(e.name)) {
        const file = await pathToFile(full, readFile);
        if (file) out.push({ file, set });
      } else if (e.isDirectory) {
        await walk(full, set ?? e.name);
      }
    }
  };

  await walk(dir, null);
  return out;
}

export async function buildGroups(
  entries: ImportEntry[],
  onProgress: (done: number, total: number) => void,
): Promise<ImportGroup[]> {
  const total = entries.length;
  onProgress(0, total);
  const bySet = new Map<string | null, AvatarPackItem[]>();
  for (let i = 0; i < entries.length; i++) {
    const { file, set } = entries[i];
    try {
      const data = await resizeAvatar(file, 256);
      const list = bySet.get(set) ?? [];
      list.push({ id: `it_${i}`, name: cleanLabel(file.name, i), data });
      bySet.set(set, list);
    } catch {
      /* skip unreadable image */
    }
    onProgress(i + 1, total);
  }
  const groups: ImportGroup[] = [];
  for (const [set, items] of bySet) if (items.length) groups.push({ set, items });
  return groups;
}
