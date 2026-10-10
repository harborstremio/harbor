import { meta as fetchMeta } from "@/lib/cinemeta";
import { tmdbLiteMeta } from "@/lib/providers/tmdb/tmdb-lite";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import type { TopTitle } from "./types";

const isAnimeId = (id: string) => /^(kitsu|mal|anilist|anidb|simkl):/.test(id);

export async function enrichTopTitles(
  titles: TopTitle[],
  tmdbKey: string,
): Promise<{
  genres: Array<{ genre: string; count: number }>;
  posters: Record<string, string>;
  actors: Array<{ name: string; count: number }>;
}> {
  const targets = titles.slice(0, 20);
  if (targets.length === 0) return { genres: [], posters: {}, actors: [] };
  const counts = new Map<string, number>();
  const castCounts = new Map<string, number>();
  const posters: Record<string, string> = {};
  await Promise.all(
    targets.map(async (t) => {
      try {
        if (isAnimeId(t.id)) {
          const m = await animeKitsuMeta(t.id);
          if (m?.poster) posters[t.id] = m.poster;
          return;
        }
        if (t.id.startsWith("tmdb:")) {
          const m = await tmdbLiteMeta(tmdbKey, t.id);
          if (m?.poster) posters[t.id] = m.poster;
          return;
        }
        if (t.id.startsWith("tt")) {
          const m = await fetchMeta(t.type === "movie" ? "movie" : "series", t.id);
          if (m?.poster) posters[t.id] = m.poster;
          for (const g of m?.genres ?? []) counts.set(g, (counts.get(g) ?? 0) + t.count);
          const cast = (m as { cast?: string[] } | null)?.cast ?? [];
          for (const raw of cast.slice(0, 8)) {
            const name = raw.trim();
            if (name) castCounts.set(name, (castCounts.get(name) ?? 0) + 1);
          }
        }
      } catch {
        /* skip */
      }
    }),
  );
  const genres = [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const actors = [...castCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((a) => a.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 9);
  return { genres, posters, actors };
}
