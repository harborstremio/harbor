import type { Meta } from "@/lib/cinemeta";
import { anilistRequest } from "./client";
import { anilistMediaToMeta } from "./to-meta";
import type { AnilistMedia } from "./types";

const BROWSE_QUERY = `query ($page: Int, $perPage: Int, $sort: [MediaSort], $isAdult: Boolean) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, isAdult: $isAdult) {
      id
      idMal
      title { romaji english native userPreferred }
      coverImage { extraLarge large medium }
      bannerImage
      format
      episodes
      averageScore
      seasonYear
      countryOfOrigin
      description
    }
  }
}`;

type BrowseResponse = { Page: { media: AnilistMedia[] } | null };

const COUNTRY_BY_MAL_QUERY = `query ($ids: [Int]) {
  Page(perPage: 50) {
    media(idMal_in: $ids, type: ANIME) { idMal countryOfOrigin }
  }
}`;

const malCountryCache = new Map<number, string>();

export async function anilistCountriesByMalIds(malIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const need: number[] = [];
  for (const n of new Set(malIds)) {
    if (!Number.isFinite(n)) continue;
    const cached = malCountryCache.get(n);
    if (cached) out.set(n, cached);
    else need.push(n);
  }
  for (let i = 0; i < need.length; i += 50) {
    const batch = need.slice(i, i + 50);
    try {
      const data = await anilistRequest<{
        Page: { media: { idMal: number | null; countryOfOrigin: string | null }[] } | null;
      }>(COUNTRY_BY_MAL_QUERY, { ids: batch }, undefined, true);
      for (const m of data?.Page?.media ?? []) {
        if (m.idMal != null && m.countryOfOrigin) {
          malCountryCache.set(m.idMal, m.countryOfOrigin);
          out.set(m.idMal, m.countryOfOrigin);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

const SEARCH_QUERY = `query ($q: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $q, type: ANIME, sort: SEARCH_MATCH) {
      id
      idMal
      title { romaji english }
      coverImage { extraLarge large }
      bannerImage
      seasonYear
      averageScore
      description
      countryOfOrigin
    }
  }
}`;

export type AnilistSearchHit = {
  anilistId: number;
  malId: number | null;
  name: string;
  year: string | null;
  poster: string | null;
  background: string | null;
  overview: string;
  score: number;
};

type SearchMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null };
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  description: string | null;
};

export async function anilistAnimeSearch(query: string, perPage = 8): Promise<AnilistSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const data = await anilistRequest<{ Page: { media: SearchMedia[] } | null }>(
      SEARCH_QUERY,
      { q, perPage },
      undefined,
      true,
    );
    return (data?.Page?.media ?? []).map((m) => ({
      anilistId: m.id,
      malId: m.idMal ?? null,
      name: m.title.english?.trim() || m.title.romaji?.trim() || "Untitled",
      year: m.seasonYear ? String(m.seasonYear) : null,
      poster: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
      background: m.bannerImage ?? null,
      overview: (m.description ?? "").replace(/<[^>]+>/g, "").trim(),
      score: m.averageScore ? m.averageScore / 10 : 0,
    }));
  } catch {
    return [];
  }
}

async function fetchAnilistBrowse(sort: string, count: number): Promise<Meta[]> {
  const perPage = Math.min(50, count);
  const pages = Math.ceil(count / perPage);
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      anilistRequest<BrowseResponse>(
        BROWSE_QUERY,
        { page: i + 1, perPage, sort: [sort], isAdult: false },
        undefined,
        false,
      ).catch(() => null),
    ),
  );
  const out: Meta[] = [];
  const seen = new Set<string>();
  for (const data of responses) {
    for (const m of data?.Page?.media ?? []) {
      const meta = anilistMediaToMeta(m);
      if (!meta || seen.has(meta.id)) continue;
      seen.add(meta.id);
      out.push(meta);
    }
  }
  return out.slice(0, count);
}

const ART_BY_ID_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    bannerImage
    coverImage { extraLarge }
  }
}`;

const artByIdCache = new Map<number, { banner?: string; cover?: string }>();

export async function anilistArtById(id: number): Promise<{ banner?: string; cover?: string }> {
  const cached = artByIdCache.get(id);
  if (cached) return cached;
  try {
    const data = await anilistRequest<{
      Media: {
        bannerImage: string | null;
        coverImage: { extraLarge: string | null } | null;
      } | null;
    }>(ART_BY_ID_QUERY, { id }, undefined, true);
    const art = {
      banner: data?.Media?.bannerImage ?? undefined,
      cover: data?.Media?.coverImage?.extraLarge ?? undefined,
    };
    artByIdCache.set(id, art);
    return art;
  } catch {
    const empty = {};
    artByIdCache.set(id, empty);
    return empty;
  }
}

const ART_BY_MAL_QUERY = `query ($mal: Int) {
  Media(idMal: $mal, type: ANIME) {
    id
    bannerImage
    coverImage { extraLarge }
  }
}`;

const artByMalCache = new Map<number, { id?: number; banner?: string; cover?: string }>();

export async function anilistArtByMalId(
  malId: number,
): Promise<{ id?: number; banner?: string; cover?: string }> {
  const cached = artByMalCache.get(malId);
  if (cached) return cached;
  try {
    const data = await anilistRequest<{
      Media: {
        id: number;
        bannerImage: string | null;
        coverImage: { extraLarge: string | null } | null;
      } | null;
    }>(ART_BY_MAL_QUERY, { mal: malId }, undefined, true);
    const art = {
      id: data?.Media?.id ?? undefined,
      banner: data?.Media?.bannerImage ?? undefined,
      cover: data?.Media?.coverImage?.extraLarge ?? undefined,
    };
    artByMalCache.set(malId, art);
    return art;
  } catch {
    const empty = {};
    artByMalCache.set(malId, empty);
    return empty;
  }
}

const RECS_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {
    recommendations(sort: RATING_DESC, perPage: 24) {
      nodes {
        mediaRecommendation {
          id
          idMal
          title { romaji english native userPreferred }
          coverImage { extraLarge large medium }
          bannerImage
          format
          episodes
          averageScore
          seasonYear
          countryOfOrigin
          description
        }
      }
    }
  }
}`;

const recsCache = new Map<number, Meta[]>();

export async function anilistRecommendations(anilistId: number): Promise<Meta[]> {
  if (!anilistId) return [];
  const cached = recsCache.get(anilistId);
  if (cached) return cached;
  try {
    const data = await anilistRequest<{
      Media: {
        recommendations: { nodes: Array<{ mediaRecommendation: AnilistMedia | null }> } | null;
      } | null;
    }>(RECS_QUERY, { id: anilistId }, undefined, true);
    const out: Meta[] = [];
    const seen = new Set<string>();
    for (const n of data?.Media?.recommendations?.nodes ?? []) {
      if (!n.mediaRecommendation) continue;
      const meta = anilistMediaToMeta(n.mediaRecommendation);
      if (!meta || seen.has(meta.id)) continue;
      seen.add(meta.id);
      out.push(meta);
    }
    recsCache.set(anilistId, out);
    return out;
  } catch {
    return [];
  }
}

export function fetchAnilistTopAnime(count = 100): Promise<Meta[]> {
  return fetchAnilistBrowse("SCORE_DESC", count);
}

export function fetchAnilistTrendingAnime(count = 40): Promise<Meta[]> {
  return fetchAnilistBrowse("TRENDING_DESC", count);
}
