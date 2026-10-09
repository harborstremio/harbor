import { anilistRequest } from "./client";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { lruSet } from "@/lib/cache";
import { registerEvictable } from "@/lib/maintenance";

const MEDIA_DETAILS_QUERY = `query ($id: Int) {
  Media(id: $id) {
    id
    title { native romaji english }
    synonyms
    source(version: 3)
    favourites
    episodes
    nextAiringEpisode { airingAt episode }
    tags { name rank isMediaSpoiler isGeneralSpoiler }
    studios { nodes { name isAnimationStudio } }
    stats { statusDistribution { status amount } scoreDistribution { score amount } }
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          type
          format
          status
          seasonYear
          averageScore
          title { english romaji native userPreferred }
          coverImage { large }
          startDate { year }
        }
      }
    }
  }
}`;

const SOURCE_LABELS: Record<string, string> = {
  ORIGINAL: "Original",
  MANGA: "Manga",
  LIGHT_NOVEL: "Light Novel",
  WEB_NOVEL: "Web Novel",
  NOVEL: "Novel",
  VISUAL_NOVEL: "Visual Novel",
  VIDEO_GAME: "Video Game",
  DOUJINSHI: "Doujinshi",
  ANIME: "Anime",
  PICTURE_BOOK: "Picture Book",
  COMIC: "Comic",
  GAME: "Game",
  LIVE_ACTION: "Live Action",
  MULTIMEDIA_PROJECT: "Multimedia Project",
  OTHER: "Other",
};

const FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  MANGA: "Manga",
  NOVEL: "Light Novel",
  ONE_SHOT: "One Shot",
};

const RELATION_LABELS: Record<string, string> = {
  ADAPTATION: "Adaptation",
  PREQUEL: "Prequel",
  SEQUEL: "Sequel",
  PARENT: "Parent Story",
  SIDE_STORY: "Side Story",
  CHARACTER: "Character",
  SUMMARY: "Summary",
  ALTERNATIVE: "Alternative",
  SPIN_OFF: "Spin-off",
  SOURCE: "Source",
  COMPILATION: "Compilation",
  CONTAINS: "Contains",
  OTHER: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  CURRENT: "Watching",
  PLANNING: "Plan to Watch",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  PAUSED: "On Hold",
  REPEATING: "Rewatching",
};

type RawTitle = {
  native: string | null;
  romaji: string | null;
  english: string | null;
  userPreferred?: string | null;
};

type RawRelationNode = {
  id: number;
  type: string | null;
  format: string | null;
  status: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  title: RawTitle;
  coverImage: { large: string | null } | null;
  startDate: { year: number | null } | null;
};

type RawResponse = {
  Media: {
    id: number;
    title: RawTitle;
    synonyms: string[] | null;
    source: string | null;
    favourites: number | null;
    episodes: number | null;
    nextAiringEpisode: { airingAt: number; episode: number } | null;
    tags: Array<{
      name: string;
      rank: number | null;
      isMediaSpoiler: boolean;
      isGeneralSpoiler: boolean;
    }> | null;
    studios: { nodes: Array<{ name: string; isAnimationStudio: boolean }> } | null;
    stats: {
      statusDistribution: Array<{ status: string; amount: number }> | null;
      scoreDistribution: Array<{ score: number; amount: number }> | null;
    } | null;
    relations: {
      edges: Array<{ relationType: string | null; node: RawRelationNode | null }>;
    } | null;
  } | null;
};

export type AnilistRelatedNode = {
  anilistId: number;
  title: string;
  relation: string;
  mediaType: "anime" | "manga";
  format?: string;
  poster?: string;
  year?: number;
  rating?: string;
  upcoming: boolean;
};

export type StatusSlice = { label: string; amount: number };

export type AnilistTag = { name: string; rank: number; spoiler: boolean };

export type ScoreBucket = { score: number; amount: number };

export type AnilistMediaDetails = {
  anilistId: number;
  nativeTitle?: string;
  romajiTitle?: string;
  englishTitle?: string;
  synonyms: string[];
  source?: string;
  favourites?: number;
  episodes?: number;
  nextAiring?: { airingAt: number; episode: number };
  studios: string[];
  statusDistribution: StatusSlice[];
  scoreDistribution: ScoreBucket[];
  tags: AnilistTag[];
  relatedAnime: AnilistRelatedNode[];
  adaptations: AnilistRelatedNode[];
};

function relatedTitle(t: RawTitle): string {
  return (t.english ?? t.romaji ?? t.userPreferred ?? t.native ?? "").trim();
}

function toRelated(relationType: string | null, node: RawRelationNode): AnilistRelatedNode | null {
  const title = relatedTitle(node.title);
  if (!title) return null;
  return {
    anilistId: node.id,
    title,
    relation: relationType ? RELATION_LABELS[relationType] ?? "Related" : "Related",
    mediaType: node.type === "MANGA" ? "manga" : "anime",
    format: node.format ? FORMAT_LABELS[node.format] ?? node.format : undefined,
    poster: node.coverImage?.large ?? undefined,
    year: node.seasonYear ?? node.startDate?.year ?? undefined,
    rating:
      typeof node.averageScore === "number" && node.averageScore > 0
        ? (node.averageScore / 10).toFixed(1)
        : undefined,
    upcoming: node.status === "NOT_YET_RELEASED",
  };
}

function shape(raw: NonNullable<RawResponse["Media"]>): AnilistMediaDetails {
  const studios = (raw.studios?.nodes ?? [])
    .slice()
    .sort((a, b) => Number(b.isAnimationStudio) - Number(a.isAnimationStudio))
    .map((s) => s.name)
    .filter(Boolean);

  const statusDistribution = (raw.stats?.statusDistribution ?? [])
    .filter((s) => s.amount > 0)
    .map((s) => ({ label: STATUS_LABELS[s.status] ?? s.status, amount: s.amount }))
    .sort((a, b) => b.amount - a.amount);

  const scoreDistribution = (raw.stats?.scoreDistribution ?? [])
    .filter((s) => s.amount > 0)
    .map((s) => ({ score: s.score, amount: s.amount }))
    .sort((a, b) => a.score - b.score);

  const tags = (raw.tags ?? [])
    .map((t) => ({
      name: t.name,
      rank: t.rank ?? 0,
      spoiler: t.isMediaSpoiler || t.isGeneralSpoiler,
    }))
    .sort((a, b) => b.rank - a.rank);

  const relatedAnime: AnilistRelatedNode[] = [];
  const adaptations: AnilistRelatedNode[] = [];
  for (const edge of raw.relations?.edges ?? []) {
    if (!edge.node || edge.node.id == null) continue;
    const node = toRelated(edge.relationType, edge.node);
    if (!node) continue;
    if (node.mediaType === "manga") adaptations.push(node);
    else relatedAnime.push(node);
  }

  return {
    anilistId: raw.id,
    nativeTitle: raw.title.native ?? undefined,
    romajiTitle: raw.title.romaji ?? undefined,
    englishTitle: raw.title.english ?? undefined,
    synonyms: (raw.synonyms ?? []).map((s) => s.trim()).filter(Boolean),
    source: raw.source ? SOURCE_LABELS[raw.source] ?? undefined : undefined,
    favourites: typeof raw.favourites === "number" && raw.favourites > 0 ? raw.favourites : undefined,
    episodes: typeof raw.episodes === "number" && raw.episodes > 0 ? raw.episodes : undefined,
    nextAiring: raw.nextAiringEpisode
      ? { airingAt: raw.nextAiringEpisode.airingAt, episode: raw.nextAiringEpisode.episode }
      : undefined,
    studios,
    statusDistribution,
    scoreDistribution,
    tags,
    relatedAnime,
    adaptations,
  };
}

const cache = new Map<number, AnilistMediaDetails | null>();
const CACHE_MAX = 250;
registerEvictable("anilist-media-details", (aggressive) => {
  if (aggressive) cache.clear();
});

export async function fetchAnilistMediaDetails(
  anilistId: number,
): Promise<AnilistMediaDetails | null> {
  if (cache.has(anilistId)) return cache.get(anilistId) ?? null;
  try {
    const data = await anilistRequest<RawResponse>(
      MEDIA_DETAILS_QUERY,
      { id: anilistId },
      undefined,
      true,
    );
    const media = data?.Media;
    const result = media ? shape(media) : null;
    lruSet(cache, anilistId, result, CACHE_MAX);
    return result;
  } catch {
    lruSet(cache, anilistId, null, CACHE_MAX);
    return null;
  }
}

export async function fetchAnilistMediaDetailsByKitsu(
  kitsuId: number,
): Promise<AnilistMediaDetails | null> {
  const anilistId = await kitsuToAnilist(kitsuId).catch(() => null);
  if (!anilistId) return null;
  return fetchAnilistMediaDetails(anilistId);
}
