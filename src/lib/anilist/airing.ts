import type { CalendarItem } from "@/lib/calendar";
import { toLocalDateISO, toLocalTimeLabel } from "@/lib/calendar-time";
import { anilistRequest } from "./client";

const AIRING_QUERY = `query ($start: Int, $end: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
      airingAt
      episode
      media {
        id
        idMal
        type
        isAdult
        format
        title { romaji english }
        coverImage { extraLarge large }
        bannerImage
        averageScore
        description
      }
    }
    pageInfo {
      hasNextPage
    }
  }
}`;

type AiringMedia = {
  id: number;
  idMal: number | null;
  type: string | null;
  isAdult: boolean | null;
  format: string | null;
  title: { romaji: string | null; english: string | null } | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  averageScore: number | null;
  description: string | null;
};

type AiringNode = {
  airingAt: number;
  episode: number | null;
  media: AiringMedia | null;
};

type AiringResponse = {
  Page: {
    airingSchedules: AiringNode[] | null;
    pageInfo: { hasNextPage: boolean } | null;
  } | null;
};

const MAX_PAGES = 10;
// Fetches up to this many pages in parallel, then waits for the batch.
// AniList throttles hard on bursts, so this must stay small.
const CONCURRENCY = 3;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchAniListAiringCalendar(
  year: number,
  month: number,
): Promise<CalendarItem[]> {
  const start = Math.floor(new Date(year, month, 1).getTime() / 1000);
  const end = Math.floor(new Date(year, month + 1, 1).getTime() / 1000);

  const pages = new Map<number, readonly AiringNode[]>();
  let next = 1;
  let pastLast = false;
  let inflight = 0;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((r) => {
    resolveDone = r;
  });

  const pump = () => {
    while (!pastLast && next <= MAX_PAGES && inflight < CONCURRENCY) {
      const page = next++;
      inflight++;
      anilistRequest<AiringResponse>(AIRING_QUERY, { start, end, page }, undefined, true)
        .then((data) => {
          const nodes = data?.Page?.airingSchedules ?? [];
          pages.set(page, nodes);
          const hasNext = data?.Page?.pageInfo?.hasNextPage ?? nodes.length >= 50;
          if (!hasNext) pastLast = true;
        })
        .catch(() => {
          pastLast = true;
        })
        .finally(() => {
          inflight--;
          pump();
          if (inflight === 0) resolveDone();
        });
    }
  };
  pump();
  await done;

  const out: CalendarItem[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const nodes = pages.get(page);
    if (!nodes) break;
    for (const node of nodes) {
      const media = node.media;
      if (!media) continue;
      if (media.type !== "ANIME" || media.isAdult) continue;
      if (media.format === "MOVIE" || node.episode == null) continue;
      const title = media.title?.english?.trim() || media.title?.romaji?.trim() || "Untitled";
      const baseId = media.idMal != null ? `mal:${media.idMal}` : `anilist:${media.id}`;
      const id = `${baseId}:1:${node.episode}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const airMs = node.airingAt * 1000;
      out.push({
        id,
        imdbId: null,
        type: "tv",
        name: `${title} S1E${pad(node.episode)}`,
        poster: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
        background: media.bannerImage ?? null,
        releaseDate: toLocalDateISO(new Date(airMs)),
        releaseTime: toLocalTimeLabel(new Date(airMs)),
        releaseAtMs: airMs,
        isAnime: true,
        overview: media.description ? stripHtml(media.description) : "",
        voteAverage: media.averageScore != null ? media.averageScore / 10 : 0,
      });
    }
  }
  out.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return out;
}
