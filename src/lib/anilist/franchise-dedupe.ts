import type { AnilistMedia } from "./types";

const FORMAT_RANK: Record<string, number> = {
  TV: 0,
  TV_SHORT: 1,
  ONA: 2,
  OVA: 3,
  MOVIE: 4,
};
const SKIP_FORMATS = new Set(["MUSIC", "SPECIAL"]);

function baseTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/:\s+.*$/, " ")
    .replace(/\b(season|cour|part)\b.*$/i, " ")
    .replace(/\b\d+(st|nd|rd|th)\b.*$/i, " ")
    .replace(/\bfinal(\s+season)?\b.*$/i, " ")
    .replace(/\b(the\s+)?movie\b.*$/i, " ")
    .replace(/\s+(ii|iii|iv|v|vi|vii)\s*$/i, " ")
    .replace(/[°'.]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function franchiseKey(m: AnilistMedia): string {
  const raw = (m.title.romaji || m.title.english || m.title.userPreferred || "").trim();
  return baseTitle(raw) || raw.toLowerCase();
}

export function cleanShowName(name: string): string {
  const cut = name
    .replace(/\s+(the\s+)?final\s+season\b.*$/i, "")
    .replace(/\s+(season|cour)\s+\d+.*$/i, "")
    .replace(/\s+\d+(st|nd|rd|th)\s+season\b.*$/i, "")
    .replace(/\s+part\s+\d+\b.*$/i, "")
    .trim();
  return cut || name;
}

function representative(items: AnilistMedia[]): AnilistMedia {
  return items
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        (FORMAT_RANK[a.m.format ?? ""] ?? 5) - (FORMAT_RANK[b.m.format ?? ""] ?? 5) ||
        (a.m.seasonYear ?? 9999) - (b.m.seasonYear ?? 9999) ||
        a.i - b.i,
    )[0].m;
}

export function dedupeAnimeFranchises(list: AnilistMedia[]): AnilistMedia[] {
  const groups = new Map<string, { items: AnilistMedia[]; order: number }>();
  list.forEach((m, i) => {
    if (m.format && SKIP_FORMATS.has(m.format)) return;
    const key = franchiseKey(m);
    if (!key) return;
    const g = groups.get(key);
    if (g) g.items.push(m);
    else groups.set(key, { items: [m], order: i });
  });
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => representative(g.items));
}
