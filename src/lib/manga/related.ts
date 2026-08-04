import { anilistRequest } from "@/lib/anilist/client";
import { searchManga, type MangaSummary } from "@/lib/manga/api";

export type MangaAdaptation = {
  anilistId: number;
  title: string;
  cover?: string;
  banner?: string;
  format?: string;
};

type TitleFields = { english: string | null; romaji: string | null };

type RelationEdge = {
  relationType: string | null;
  node: {
    id: number;
    type: string | null;
    format: string | null;
    episodes: number | null;
    seasonYear: number | null;
    startDate: { year: number | null } | null;
    title: TitleFields | null;
    coverImage: { large: string | null } | null;
    bannerImage: string | null;
  };
};

type AdaptationResp = {
  Page: {
    media: Array<{ relations: { edges: RelationEdge[] } | null }>;
  } | null;
};

type RecommendationNode = {
  mediaRecommendation: { title: TitleFields | null } | null;
};

type SimilarResp = {
  Page: {
    media: Array<{ recommendations: { nodes: RecommendationNode[] } | null }>;
  } | null;
};

const ADAPTATION_QUERY = `query ($s: String) {
  Page(perPage: 1) {
    media(search: $s, type: MANGA) {
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            episodes
            seasonYear
            startDate { year }
            title { english romaji }
            coverImage { large }
            bannerImage
          }
        }
      }
    }
  }
}`;

const SIMILAR_QUERY = `query ($s: String) {
  Page(perPage: 1) {
    media(search: $s, type: MANGA) {
      recommendations(sort: RATING_DESC, perPage: 14) {
        nodes {
          mediaRecommendation {
            title { english romaji }
          }
        }
      }
    }
  }
}`;

const SIMILAR_CAP = 12;

const adaptationCache = new Map<string, MangaAdaptation | null>();
const similarCache = new Map<string, MangaSummary[]>();

function pickTitle(t: TitleFields | null): string | null {
  return t?.english ?? t?.romaji ?? null;
}

export async function mangaAdaptation(title: string): Promise<MangaAdaptation | null> {
  const key = title.trim().toLowerCase();
  if (!key) return null;
  if (adaptationCache.has(key)) return adaptationCache.get(key) ?? null;
  try {
    const data = await anilistRequest<AdaptationResp>(
      ADAPTATION_QUERY,
      { s: title },
      undefined,
      true,
    );
    const edges = data?.Page?.media?.[0]?.relations?.edges ?? [];
    const anime = edges.filter((e) => e.node?.type === "ANIME");
    const rank = (e: RelationEdge): number => {
      const f = e.node.format;
      const name = (pickTitle(e.node.title) ?? "").toLowerCase();
      const junk = /\b(cm|pv|commercial|promo|promotion|trailer|teaser|recap|special)\b/.test(name);
      const sequel =
        /season\s*[2-9]|[2-9](nd|rd|th)\s*season|part\s*[2-9]|final season|\bii+\b|arise from/.test(
          name,
        );
      let base: number;
      if (f === "TV") base = 0;
      else if (f === "TV_SHORT") base = 1;
      else if (f === "ONA") base = 2;
      else if (f === "MOVIE") base = 3;
      else if (f === "OVA" || f === "SPECIAL") base = 4;
      else base = 6;
      if (e.relationType !== "ADAPTATION") base += 5;
      if (sequel) base += 8;
      if (junk) base += 20;
      return base;
    };
    const yearOf = (e: RelationEdge): number => e.node.startDate?.year ?? e.node.seasonYear ?? 9999;
    const chosen = [...anime].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return yearOf(a) - yearOf(b);
    })[0];
    if (!chosen) {
      if (data?.Page?.media?.[0]) adaptationCache.set(key, null);
      return null;
    }
    const node = chosen.node;
    const name = pickTitle(node.title);
    const result: MangaAdaptation = {
      anilistId: node.id,
      title: name ?? "Adaptation",
      cover: node.coverImage?.large ?? undefined,
      banner: node.bannerImage ?? undefined,
      format: node.format ?? undefined,
    };
    adaptationCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export async function similarManga(title: string): Promise<MangaSummary[]> {
  const key = title.trim().toLowerCase();
  if (!key) return [];
  if (similarCache.has(key)) return similarCache.get(key)!;
  try {
    const data = await anilistRequest<SimilarResp>(SIMILAR_QUERY, { s: title }, undefined, true);
    const nodes = data?.Page?.media?.[0]?.recommendations?.nodes ?? [];

    const seenTitle = new Set<string>([key]);
    const recTitles: string[] = [];
    for (const n of nodes) {
      const t = pickTitle(n.mediaRecommendation?.title ?? null);
      if (!t) continue;
      const lower = t.trim().toLowerCase();
      if (seenTitle.has(lower)) continue;
      seenTitle.add(lower);
      recTitles.push(t);
    }

    const results: MangaSummary[] = [];
    const seenId = new Set<string>();
    for (const rec of recTitles.slice(0, SIMILAR_CAP)) {
      const found = (await searchManga(rec, 0))[0];
      if (!found) continue;
      if (seenId.has(found.id)) continue;
      if (found.title.trim().toLowerCase() === key) continue;
      seenId.add(found.id);
      results.push(found);
    }

    similarCache.set(key, results);
    return results;
  } catch {
    return [];
  }
}
