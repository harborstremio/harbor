import type { AvatarPack, AvatarPackItem } from "./packs";

export const AVATAR_PACK_FORMAT = 1;

export type AvatarPackJsonItem = { name?: string; data?: string; file?: string; url?: string };
export type AvatarPackJsonSet = { name: string; items: Array<AvatarPackJsonItem | string> };
export type AvatarPackJson = {
  harborAvatarPack: number;
  name?: string;
  author?: string;
  description?: string;
  items?: Array<AvatarPackJsonItem | string>;
  sets?: AvatarPackJsonSet[];
};

export type ParsedPackSet = { name: string | null; items: AvatarPackJsonItem[] };
export type ParsedPack = { name: string; author?: string; description?: string; sets: ParsedPackSet[] };

export class AvatarPackError extends Error {}

function asItem(raw: AvatarPackJsonItem | string): AvatarPackJsonItem | null {
  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value) return null;
    return /^(https?:|data:)/i.test(value) ? { url: value } : { file: value };
  }
  if (!raw || typeof raw !== "object") return null;
  const { name, data, file, url } = raw;
  if (!data && !file && !url) return null;
  return { name: typeof name === "string" ? name : undefined, data, file, url };
}

function asItems(raw: unknown): AvatarPackJsonItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(asItem).filter((it): it is AvatarPackJsonItem => it != null);
}

export function parseAvatarPackJson(text: string): ParsedPack {
  let json: AvatarPackJson;
  try {
    json = JSON.parse(text) as AvatarPackJson;
  } catch {
    throw new AvatarPackError("That file is not valid JSON.");
  }
  if (!json || typeof json !== "object") throw new AvatarPackError("That file is not an avatar pack.");
  if (typeof json.harborAvatarPack !== "number") {
    throw new AvatarPackError('Missing "harborAvatarPack": 1 at the top level.');
  }
  if (json.harborAvatarPack > AVATAR_PACK_FORMAT) {
    throw new AvatarPackError("This pack needs a newer version of Harbor.");
  }

  const sets: ParsedPackSet[] = [];
  const loose = asItems(json.items);
  if (loose.length) sets.push({ name: null, items: loose });
  if (Array.isArray(json.sets)) {
    for (const set of json.sets) {
      const items = asItems(set?.items);
      const name = typeof set?.name === "string" ? set.name.trim() : "";
      if (items.length) sets.push({ name: name || null, items });
    }
  }
  if (!sets.length) throw new AvatarPackError("This pack has no images in it.");

  return {
    name: (typeof json.name === "string" && json.name.trim()) || "Imported pack",
    author: typeof json.author === "string" ? json.author : undefined,
    description: typeof json.description === "string" ? json.description : undefined,
    sets,
  };
}

export function packItemCount(pack: ParsedPack): number {
  return pack.sets.reduce((n, s) => n + s.items.length, 0);
}

export function avatarPackToJson(pack: AvatarPack): string {
  const json: AvatarPackJson = {
    harborAvatarPack: AVATAR_PACK_FORMAT,
    name: pack.name,
    items: pack.items.map((it) => ({ name: it.name, data: it.data })),
  };
  return JSON.stringify(json, null, 2);
}

export function packFileName(pack: AvatarPack): string {
  const slug =
    pack.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "avatar-pack";
  return `${slug}.harbor-avatars.json`;
}

export function itemLabel(item: AvatarPackJsonItem, index: number): string {
  if (item.name && item.name.trim()) return item.name.trim().slice(0, 40);
  const source = item.file || item.url || "";
  let base = source.replace(/[?#].*$/, "").replace(/^.*[\\/]/, "");
  try {
    base = decodeURIComponent(base);
  } catch {
    /* keep the raw name */
  }
  const stem = base.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem.slice(0, 40) || `Avatar ${index + 1}`;
}

export function toPackItems(items: AvatarPackJsonItem[]): AvatarPackItem[] {
  return items.map((it, i) => ({ id: `it_${i}`, name: itemLabel(it, i), data: it.data ?? "" }));
}
