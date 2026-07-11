import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";

import { get } from "./tmdb-client";

const CRITIC_CACHE_MAX = 400;

export type CriticReview = {
  author: string;
  rating?: number;
  content: string;
  url?: string;
  createdAt?: string;
};

export type CriticData = {
  tagline?: string;
  overview?: string;
  reviews: CriticReview[];
  cast: { id: number; name: string; character: string; profilePath: string | null }[];
  crew: { id: number; name: string; job: string }[];
  director?: { id: number; name: string };
  runtime?: number;
  genres: string[];
};

const CRITIC_KEY_JOBS = new Set([
  "Director",
  "Producer",
  "Executive Producer",
  "Screenplay",
  "Writer",
  "Story",
  "Original Music Composer",
  "Director of Photography",
]);

const criticCache = new Map<string, CriticData | null>();
const criticInflight = new Map<string, Promise<CriticData | null>>();

registerCache("tmdb:critic", () => criticCache.size);

export async function tmdbCriticData(
  key: string,
  metaId: string,
  type: "movie" | "series",
): Promise<CriticData | null> {
  if (!key) return null;
  if (criticCache.has(metaId)) return criticCache.get(metaId)!;
  const existing = criticInflight.get(metaId);
  if (existing) return existing;

  const p = (async (): Promise<CriticData | null> => {
    let kind: "movie" | "tv";
    let id: string;
    if (metaId.startsWith("tmdb:movie:")) {
      kind = "movie";
      id = metaId.slice("tmdb:movie:".length);
    } else if (metaId.startsWith("tmdb:tv:")) {
      kind = "tv";
      id = metaId.slice("tmdb:tv:".length);
    } else if (metaId.startsWith("tt")) {
      const find = await get<any>(key, `find/${metaId}`, { external_source: "imdb_id" });
      if (type === "movie" && find?.movie_results?.[0]) {
        kind = "movie";
        id = String(find.movie_results[0].id);
      } else if (type === "series" && find?.tv_results?.[0]) {
        kind = "tv";
        id = String(find.tv_results[0].id);
      } else {
        return null;
      }
    } else {
      return null;
    }

    const raw = await get<any>(key, `${kind}/${id}`, {
      append_to_response: "credits,reviews",
    });
    if (!raw) return null;

    const rawReviews = (raw.reviews?.results ?? []) as any[];
    const reviews: CriticReview[] = [];
    const seenAuthors = new Set<string>();
    for (const r of rawReviews) {
      const content = typeof r.content === "string" ? r.content.trim() : "";
      if (content.length < 120) continue;
      const author = (r.author_details?.username || r.author || "Anonymous").toString();
      const key = author.toLowerCase();
      if (seenAuthors.has(key)) continue;
      seenAuthors.add(key);
      reviews.push({
        author,
        rating: typeof r.author_details?.rating === "number" ? r.author_details.rating : undefined,
        content,
        url: typeof r.url === "string" ? r.url : undefined,
        createdAt: typeof r.created_at === "string" ? r.created_at : undefined,
      });
      if (reviews.length >= 6) break;
    }
    reviews.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    const cast = (raw.credits?.cast ?? []).slice(0, 20).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character ?? "",
      profilePath: c.profile_path ?? null,
    }));

    const crewRaw = (raw.credits?.crew ?? []) as any[];
    const directorRaw = crewRaw.find((c: any) => c.job === "Director");
    const director = directorRaw ? { id: directorRaw.id, name: directorRaw.name } : undefined;
    const seenCrew = new Set<number>();
    const crew: CriticData["crew"] = [];
    for (const c of crewRaw) {
      if (!CRITIC_KEY_JOBS.has(c.job)) continue;
      if (seenCrew.has(c.id)) continue;
      seenCrew.add(c.id);
      crew.push({ id: c.id, name: c.name, job: c.job });
    }
    const runtime = raw.runtime ?? raw.episode_run_time?.[0];
    const genres = (raw.genres ?? []).map((g: any) => g.name).filter(Boolean);

    return {
      tagline: typeof raw.tagline === "string" && raw.tagline.trim() ? raw.tagline.trim() : undefined,
      overview: typeof raw.overview === "string" && raw.overview.trim() ? raw.overview.trim() : undefined,
      reviews,
      cast,
      crew,
      director,
      runtime,
      genres,
    };
  })();

  criticInflight.set(metaId, p);
  try {
    const result = await p;
    lruSet(criticCache, metaId, result, CRITIC_CACHE_MAX);
    return result;
  } finally {
    criticInflight.delete(metaId);
  }
}
