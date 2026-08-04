import { anilistArtByMalId } from "@/lib/anilist/browse";
import {
  fetchAnilistMediaDetails,
  type AnilistMediaDetails,
  type AnilistRelatedNode,
} from "@/lib/anilist/media-details";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";

export async function resolveAnilistId(id: string, malId?: number | null): Promise<number | null> {
  if (id.startsWith("anilist:")) return Number(id.slice(8)) || null;
  const mal = id.startsWith("mal:") ? Number(id.slice(4)) : (malId ?? null);
  if (mal) {
    const art = await anilistArtByMalId(mal).catch(() => null);
    if (art?.id) return art.id;
  }
  const kitsu = parseKitsuId(id);
  if (kitsu != null) return await kitsuToAnilist(kitsu).catch(() => null);
  return null;
}

const TITLE_STOP = new Set([
  "the",
  "and",
  "season",
  "part",
  "movie",
  "ova",
  "manga",
  "gekijouban",
  "final",
]);

function titleTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TITLE_STOP.has(w));
}

function franchiseOverlap(anime: string, manga: string): number {
  const a = new Set(titleTokens(anime));
  let hits = 0;
  for (const w of titleTokens(manga)) if (a.has(w)) hits += 1;
  return hits;
}

const RELATION_SCORE: Record<string, number> = {
  Source: 100,
  Adaptation: 90,
  "Parent Story": 55,
  Compilation: 20,
  Alternative: 10,
  Other: -30,
  "Side Story": -20,
  "Spin-off": -40,
  Character: -60,
  Summary: -60,
};

export function pickSourceManga(
  details: AnilistMediaDetails,
  animeName: string,
): AnilistRelatedNode | null {
  const mangas = details.adaptations.filter((n) => n.mediaType === "manga");
  if (mangas.length === 0) return null;
  const animeTitle = details.englishTitle ?? details.romajiTitle ?? animeName;
  const best = mangas
    .map((n) => ({
      n,
      score:
        (RELATION_SCORE[n.relation] ?? 0) +
        franchiseOverlap(animeTitle, n.title) * 25 +
        (n.poster ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
  return best.score > 0 ? best.n : null;
}

export async function resolveAnimeSourceManga(
  id: string,
  malId: number | null | undefined,
  animeName: string,
): Promise<AnilistRelatedNode | null> {
  const anilistId = await resolveAnilistId(id, malId);
  if (anilistId == null) return null;
  const details = await fetchAnilistMediaDetails(anilistId).catch(() => null);
  return details ? pickSourceManga(details, animeName) : null;
}
