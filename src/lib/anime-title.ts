import {
  aniZipByAnidb,
  aniZipByAnilist,
  aniZipByImdb,
  aniZipByKitsu,
  aniZipByMal,
  type AniZipMapping,
} from "@/lib/providers/anizip";
import { getAnimeCwId } from "@/lib/anime-cw-ids";
import { externalToKitsu, imdbToKitsu } from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";

export type AnimeTitleLang = "english" | "romaji" | "native";

export function getTitleFromAniZip(
  titles: Record<string, string>,
  lang: AnimeTitleLang,
): string | null {
  if (lang === "english") return titles.en || titles.ja || null;
  // AniZip's `x-jat` is AniDB's *abbreviated short title* ("OP TV", "Bleach3",
  // "SnK"), never a romaji series title, so romaji resolves from Kitsu below.
  if (lang === "romaji") return titles.en || null;
  if (lang === "native") return titles.ja || titles.en || null;
  return null;
}

export function getTitleFromKitsu(
  titles: { en?: string; en_jp?: string; ja_jp?: string },
  lang: AnimeTitleLang,
): string | null {
  if (lang === "english") return titles.en || titles.en_jp || titles.ja_jp || null;
  if (lang === "romaji") return titles.en_jp || titles.en || titles.ja_jp || null;
  if (lang === "native") return titles.ja_jp || titles.en_jp || titles.en || null;
  return null;
}

const KITSU_TITLES_TTL = 30 * 60 * 1000;
const KITSU_TITLES_MISS_TTL = 5 * 60 * 1000;
const KITSU_TITLES_MAX = 300;
const kitsuTitlesCache = new Map<number, { v: Record<string, string> | null; t: number }>();

/** Kitsu's own title map, the only source carrying a real romaji (`en_jp`). */
async function kitsuTitles(kitsuId: number): Promise<Record<string, string> | null> {
  const hit = kitsuTitlesCache.get(kitsuId);
  if (hit && Date.now() - hit.t < (hit.v ? KITSU_TITLES_TTL : KITSU_TITLES_MISS_TTL)) return hit.v;
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
      headers: { Accept: "application/vnd.api+json" },
    });
    const titles = res.ok
      ? (((await res.json())?.data?.attributes?.titles as Record<string, string> | null) ?? null)
      : null;
    if (kitsuTitlesCache.size >= KITSU_TITLES_MAX) kitsuTitlesCache.clear();
    kitsuTitlesCache.set(kitsuId, { v: titles, t: Date.now() });
    return titles;
  } catch {
    return null;
  }
}

/** The Kitsu entry behind any id a card can carry, including Cinemeta rows. */
async function kitsuIdFor(id: string): Promise<number | null> {
  if (id.startsWith("kitsu:")) return parseKitsuId(id);
  const external: Array<[string, string]> = [
    ["mal:", "myanimelist"],
    ["anilist:", "anilist"],
    ["anidb:", "anidb"],
  ];
  for (const [prefix, source] of external) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    return Number.isFinite(n) ? externalToKitsu(source, n).catch(() => null) : null;
  }
  if (/^tt\d+$/.test(id)) {
    // The anime id recorded when the detail page resolved this title first;
    // the IMDb bridge is the fallback for rows never opened.
    const mapped = parseKitsuId(getAnimeCwId(id) ?? "");
    if (mapped != null) return mapped;
    return imdbToKitsu(id).catch(() => null);
  }
  return null;
}

async function aniZipFor(id: string): Promise<AniZipMapping | null> {
  if (id.startsWith("kitsu:")) {
    const n = parseKitsuId(id);
    return n != null ? aniZipByKitsu(n) : null;
  }
  if (id.startsWith("mal:")) {
    const n = Number(id.slice(4));
    return Number.isFinite(n) ? aniZipByMal(n) : null;
  }
  if (id.startsWith("anilist:")) {
    const n = Number(id.slice(8));
    return Number.isFinite(n) ? aniZipByAnilist(n) : null;
  }
  if (id.startsWith("anidb:")) {
    const n = Number(id.slice(6));
    return Number.isFinite(n) ? aniZipByAnidb(n) : null;
  }
  if (/^tt\d+$/.test(id)) return aniZipByImdb(id);
  return null;
}

export async function resolvePreferredAnimeTitle(
  id: string,
  lang: AnimeTitleLang,
): Promise<string | null> {
  const kitsuId = await kitsuIdFor(id).catch(() => null);
  if (lang === "romaji" && kitsuId != null) {
    const titles = await kitsuTitles(kitsuId);
    const title = titles ? getTitleFromKitsu(titles, "romaji") : null;
    if (title) return title;
  }
  const mapping = await aniZipFor(id).catch(() => null);
  if (mapping?.titles) {
    const title = getTitleFromAniZip(mapping.titles, lang);
    if (title) return title;
  }
  if (kitsuId != null) {
    const titles = await kitsuTitles(kitsuId);
    if (titles) return getTitleFromKitsu(titles, lang);
  }
  return null;
}
