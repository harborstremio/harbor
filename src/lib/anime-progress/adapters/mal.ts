import { fetchMalList } from "@/lib/mal/lists";
import type { MalListEntry } from "@/lib/mal/types";
import type { NormalizedAnimeProgress } from "../types";

/** Pure raw → normalized mapping, exported for unit tests. */
export function normalizeMalProgress(entry: MalListEntry): NormalizedAnimeProgress | null {
  if (entry.status !== "watching") return null;
  const count = entry.numEpisodesWatched;
  // Zero counts stay: a show set to watching before episode 1 must reach
  // Continue Watching as a first-episode entry instead of vanishing here.
  if (!Number.isFinite(count) || count < 0) return null;
  const total = entry.anime.numEpisodes;
  // A "watching" entry that is already at the show's end is effectively complete.
  if (total != null && total > 0 && count >= total) return null;
  const title = (entry.anime.title ?? "").trim();
  return {
    key: `mal:${entry.anime.id}`,
    source: "mal",
    kind: "inferred", // MAL reports only a watched count, not exact episodes
    status: entry.status,
    watching: true,
    watchedEpisodes: null,
    watchedCount: count,
    totalEpisodes: total,
    ids: { mal: entry.anime.id },
    titles: title ? [title] : [],
    year: null,
    updatedAt: entry.updatedAt,
  };
}

/** Anime the authenticated user is currently watching on MyAnimeList. */
export async function fetchMalAnimeProgress(): Promise<NormalizedAnimeProgress[]> {
  const groups = await fetchMalList().catch(() => []);
  const watching = groups.find((g) => g.status === "watching")?.entries ?? [];
  const out: NormalizedAnimeProgress[] = [];
  const seen = new Set<string>();
  for (const e of watching) {
    const n = normalizeMalProgress(e);
    if (n && !seen.has(n.key)) {
      seen.add(n.key);
      out.push(n);
    }
  }
  return out;
}