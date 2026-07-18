import {
  aniZipByAnilist,
  aniZipByKitsu,
  aniZipByMal,
  type AniZipMapping,
} from "@/lib/providers/anizip";

export type AnimeTitleLang = "english" | "romaji" | "native";

export function getTitleFromAniZip(
  titles: Record<string, string>,
  lang: AnimeTitleLang,
): string | null {
  if (lang === "english") return titles.en || titles.en_jp || titles.ja || null;
  if (lang === "romaji") return titles["x-jat"] || titles.en_jp || titles.en || null;
  if (lang === "native") return titles.ja || titles["x-jat"] || titles.en || null;
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

export async function resolvePreferredAnimeTitle(
  id: string,
  lang: AnimeTitleLang,
): Promise<string | null> {
  let mapping: AniZipMapping | null = null;
  if (id.startsWith("kitsu:")) {
    const n = parseInt(id.slice(6), 10);
    if (Number.isFinite(n)) mapping = await aniZipByKitsu(n).catch(() => null);
  } else if (id.startsWith("mal:")) {
    const n = parseInt(id.slice(4), 10);
    if (Number.isFinite(n)) mapping = await aniZipByMal(n).catch(() => null);
  } else if (id.startsWith("anilist:")) {
    const n = parseInt(id.slice(8), 10);
    if (Number.isFinite(n)) mapping = await aniZipByAnilist(n).catch(() => null);
  }
  if (mapping?.titles) {
    const t = getTitleFromAniZip(mapping.titles, lang);
    if (t) return t;
  }
  if (id.startsWith("kitsu:")) {
    const n = parseInt(id.slice(6), 10);
    if (Number.isFinite(n)) {
      try {
        const res = await fetch(`https://kitsu.io/api/edge/anime/${n}`, {
          headers: { Accept: "application/vnd.api+json" },
        });
        if (res.ok) {
          const j = await res.json();
          const attr = j?.data?.attributes;
          if (attr?.titles)
            return getTitleFromKitsu(attr.titles, lang) || attr.canonicalTitle || null;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}
