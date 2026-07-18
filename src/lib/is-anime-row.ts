import type { AddonRow } from "@/lib/addons";

export function isAnimeRow(row: AddonRow): boolean {
  if (row.type === "anime") return true;
  const nameLower = (row.name ?? "").toLowerCase();
  if (/\b(anime|mal|anilist|kitsu|aniworld|crunchyroll|funimation)\b/.test(nameLower)) return true;
  const sample = row.metas.slice(0, 6);
  if (sample.length === 0) return false;
  const animeIds = sample.filter(
    (m) => m.id.startsWith("kitsu:") || m.id.startsWith("mal:") || m.id.startsWith("anilist:"),
  ).length;
  return animeIds / sample.length >= 0.5;
}
