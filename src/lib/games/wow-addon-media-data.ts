import { communityText } from "./community";

export type WowAddonImage = { image: string; thumbnail: string; description: string };
export type WowAddonMedia = { id: number; title: string; images: WowAddonImage[]; author: string; version: string; updatedAt: number | null; description: string; changeLog: string; notesTruncated: boolean };

function authorText(value: unknown) {
  if (typeof value !== "string") return { text: "", truncated: false };
  // Reuse Harbor's text-only BBCode handling; WoWInterface also uses these
  // presentation tags and numeric entities. Never turn author text into markup.
  const plain = communityText(value.slice(0, 24_000).replace(/\r\n?/g, "\n")
    .replace(/\[\/?(?:indent|center|left|right)\b[^\]]*\]/gi, "\n")
    .replace(/\[\/?(?:size|color|font)\b[^\]]*\]/gi, "")
    .replace(/\[\*\]/g, "\n• "), 24_000)
    .replace(/&#(x[\da-f]+|\d+);/gi, (entity, code: string) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return point >= 32 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
    })
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim();
  return { text: plain.slice(0, 16_000), truncated: value.length > 24_000 || plain.length > 16_000 };
}

export function wowAddonMediaUrl(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 0xffff_ffff) throw Error("Invalid addon identity");
  // Bulk responses have repeated other addons' images. Fetch the exact record.
  return `https://api.mmoui.com/v4/game/WOW/filedetails/${id}.json`;
}
function mediaUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "cdn-wow.mmoui.com" || url.username || url.password || url.port || url.search || url.hash || !/^\/preview\/(?:tiny\/)?pvw\d+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
const text = (value: unknown, limit: number) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit) : "";
export function parseWowAddonMedia(raw: unknown, id: number): WowAddonMedia {
  wowAddonMediaUrl(id);
  if (!Array.isArray(raw) || raw.length !== 1 || !raw[0] || typeof raw[0] !== "object") throw Error("Invalid addon record");
  const value = raw[0] as Record<string, unknown>;
  if (value.id !== id || !text(value.title, 180)) throw Error("Wrong addon identity");
  if (value.images != null && !Array.isArray(value.images)) throw Error("Invalid addon images");
  const images: WowAddonImage[] = [], seen = new Set<string>();
  for (const entry of ((value.images ?? []) as unknown[]).slice(0, 50)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>, image = mediaUrl(item.imageUrl), thumbnail = mediaUrl(item.thumbUrl);
    if (!image || seen.has(image)) continue;
    seen.add(image); images.push({ image, thumbnail: thumbnail ?? image, description: text(item.description, 240) });
    if (images.length === 8) break;
  }
  const description = authorText(value.description), changeLog = authorText(value.changeLog);
  const updatedAt = typeof value.lastUpdate === "number" && Number.isSafeInteger(value.lastUpdate) && value.lastUpdate > 0 && value.lastUpdate <= 8.64e15 ? value.lastUpdate : null;
  return { id, title: text(value.title, 180), images, author: text(value.author, 180), version: text(value.version, 100), updatedAt, description: description.text, changeLog: changeLog.text, notesTruncated: description.truncated || changeLog.truncated };
}
