import { fetchMediaListCollection } from "@/lib/anilist/lists";
import { getSession } from "@/lib/anilist/session";
import type { AnilistMediaEntry } from "@/lib/anilist/types";
import type { NormalizedAnimeProgress } from "../types";

const ACTIVE_STATUSES = new Set(["CURRENT", "REPEATING"]);

/** Pure raw → normalized mapping, exported for unit tests. */
export function normalizeAnilistProgress(
  entry: AnilistMediaEntry,
): NormalizedAnimeProgress | null {
  if (entry.media.format === "MOVIE") return null;
  if (!ACTIVE_STATUSES.has(entry.status)) return null;
  const count = entry.progress;
  // Zero counts stay: a show set to watching before episode 1 must reach
  // Continue Watching as a first-episode entry instead of vanishing here.
  if (!Number.isFinite(count) || count < 0) return null;
  const total = entry.media.episodes;
  if (total != null && total > 0 && count >= total) return null;
  const titles = [
    entry.media.title.english,
    entry.media.title.userPreferred,
    entry.media.title.romaji,
    entry.media.title.native,
  ].filter((t): t is string => !!t && t.trim() !== "");
  return {
    // Prefer the MAL key when AniList knows it, so AniList and MAL agree on the
    // canonical anime and their inferred counts can be cross-checked.
    key: entry.media.idMal != null ? `mal:${entry.media.idMal}` : `anilist:${entry.media.id}`,
    source: "anilist",
    kind: "inferred", // AniList reports only a watched count, not exact episodes
    status: entry.status,
    watching: true,
    watchedEpisodes: null,
    watchedCount: count,
    totalEpisodes: total,
    ids: { mal: entry.media.idMal, anilist: entry.media.id },
    titles,
    year: entry.media.seasonYear,
    updatedAt: null,
  };
}

/** Anime the authenticated user is currently watching on AniList. */
export async function fetchAnilistAnimeProgress(): Promise<NormalizedAnimeProgress[]> {
  const session = getSession();
  if (!session) return [];
  const groups = await fetchMediaListCollection(session.userId).catch(() => []);
  const out: NormalizedAnimeProgress[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const e of g.entries) {
      const n = normalizeAnilistProgress(e);
      if (n && !seen.has(n.key)) {
        seen.add(n.key);
        out.push(n);
      }
    }
  }
  return out;
}