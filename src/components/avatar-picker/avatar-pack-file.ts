import { resizeAvatar } from "@/views/settings/account/avatar-utils";
import type { AvatarPackItem } from "@/lib/avatars/packs";
import {
  AvatarPackError,
  itemLabel,
  parseAvatarPackJson,
  type AvatarPackJsonItem,
  type ParsedPack,
} from "@/lib/avatars/pack-json";
import { isNativePick } from "./avatar-import";
import type { ImportGroup } from "./avatar-import";

const MAX_ITEMS = 500;

function dirOf(path: string): string {
  const cut = path.replace(/[\\/][^\\/]*$/, "");
  return cut === path ? "" : cut;
}

function fileFromBytes(bytes: Uint8Array, name: string): File {
  const ext = (name.split(".").pop() || "png").toLowerCase();
  const mime = ext === "jpg" || ext === "jfif" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
  return new File([bytes as BlobPart], name, { type: mime });
}

async function blobFromUrl(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") || blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

async function resolveOne(
  item: AvatarPackJsonItem,
  baseDir: string,
  index: number,
): Promise<AvatarPackItem | null> {
  const name = itemLabel(item, index);
  try {
    if (item.data) {
      const blob = await blobFromUrl(item.data);
      if (!blob) return null;
      return { id: `it_${index}`, name, data: await resizeAvatar(blob as File, 256) };
    }
    if (item.url) {
      const blob = await blobFromUrl(item.url);
      if (!blob) return null;
      return { id: `it_${index}`, name, data: await resizeAvatar(blob as File, 256) };
    }
    if (item.file && baseDir) {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const { join } = await import("@tauri-apps/api/path");
      const rel = item.file.replace(/^[\\/]+/, "").split(/[\\/]/);
      const full = await join(baseDir, ...rel);
      const bytes = await readFile(full);
      return {
        id: `it_${index}`,
        name,
        data: await resizeAvatar(fileFromBytes(bytes, rel[rel.length - 1] ?? "image.png"), 256),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export type PackImportResult = { pack: ParsedPack; groups: ImportGroup[]; skipped: number };

export async function resolvePackGroups(
  pack: ParsedPack,
  baseDir: string,
  onProgress: (done: number, total: number) => void,
): Promise<PackImportResult> {
  const flat: Array<{ set: string | null; item: AvatarPackJsonItem }> = [];
  for (const set of pack.sets) for (const item of set.items) flat.push({ set: set.name, item });
  const capped = flat.slice(0, MAX_ITEMS);
  const total = capped.length;
  onProgress(0, total);

  const bySet = new Map<string | null, AvatarPackItem[]>();
  let skipped = flat.length - capped.length;
  for (let i = 0; i < capped.length; i++) {
    const { set, item } = capped[i];
    const built = await resolveOne(item, baseDir, i);
    if (built) {
      const list = bySet.get(set) ?? [];
      list.push(built);
      bySet.set(set, list);
    } else {
      skipped += 1;
    }
    onProgress(i + 1, total);
  }

  const groups: ImportGroup[] = [];
  for (const [set, items] of bySet) if (items.length) groups.push({ set: set ?? pack.name, items });
  return { pack, groups, skipped };
}

export async function readPackFromFile(file: File): Promise<{ pack: ParsedPack; baseDir: string }> {
  return { pack: parseAvatarPackJson(await file.text()), baseDir: "" };
}

export async function pickPackNative(): Promise<{ pack: ParsedPack; baseDir: string } | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: false, filters: [{ name: "Avatar pack", extensions: ["json"] }] });
  if (typeof picked !== "string") return null;
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const text = await readTextFile(picked);
  return { pack: parseAvatarPackJson(text), baseDir: dirOf(picked) };
}

export async function savePackJson(fileName: string, json: string): Promise<boolean> {
  if (isNativePick()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const target = await save({ defaultPath: fileName, filters: [{ name: "Avatar pack", extensions: ["json"] }] });
    if (typeof target !== "string") return false;
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(target, json);
    return true;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export { AvatarPackError };
