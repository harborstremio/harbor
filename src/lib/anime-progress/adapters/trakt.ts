import { traktRequest } from "@/lib/trakt/client";
import { getSession } from "@/lib/trakt/session";
import type { AnimeProgressIds, NormalizedAnimeProgress } from "../types";

export type TraktWatchedShowRaw = {
  last_watched_at?: string;
  plays?: number;
  show?: {
    title?: string;
    year?: number | null;
    ids?: { trakt?: number; slug?: string; imdb?: string; tmdb?: number; tvdb?: number };
  };
  seasons?: Array<{ season?: number; episodes?: Array<{ number?: number }> }>;
};

/** Pure raw → normalized mapping, exported for unit tests. */
export function normalizeTraktWatchedShow(
  raw: TraktWatchedShowRaw,
): NormalizedAnimeProgress | null {
  const show = raw.show;
  if (!show) return null;
  const idsRaw = show.ids ?? {};
  const watchedEpisodes = new Set<string>();
  let count = 0;
  for (const s of raw.seasons ?? []) {
    if (typeof s.season !== "number" || s.season < 1) continue;
    for (const e of s.episodes ?? []) {
      if (typeof e.number !== "number" || e.number < 1) continue;
      watchedEpisodes.add(`${s.season}:${e.number}`);
      count += 1;
    }
  }
  if (count === 0) return null;
  const imdb =
    typeof idsRaw.imdb === "string" && /^tt\d+$/.test(idsRaw.imdb) ? idsRaw.imdb : null;
  const ids: AnimeProgressIds = {
    trakt: idsRaw.trakt ?? null,
    imdb,
    tmdb: idsRaw.tmdb ?? null,
    tvdb: idsRaw.tvdb ?? null,
  };
  const title = (show.title ?? "").trim();
  return {
    // Trakt has no explicit "watching" list status. A show the user watched
    // episodes of is treated as in-progress; completed shows fall out later
    // because no next episode can be found. (Known limitation, see docs.)
    status: "watching",
    watching: true,
    key: idsRaw.trakt != null ? `trakt:${idsRaw.trakt}` : (imdb ?? `trakt:${idsRaw.slug ?? ""}`),
    source: "trakt",
    kind: "exact",
    watchedEpisodes,
    watchedCount: count,
    totalEpisodes: null, // the aggregate endpoint does not report the total
    ids,
    titles: title ? [title] : [],
    year: show.year ?? null,
    updatedAt: raw.last_watched_at ?? null,
  };
}

/** Watching progress for shows whose episodes the user has watched on Trakt. */
export async function fetchTraktAnimeProgress(): Promise<NormalizedAnimeProgress[]> {
  if (!getSession()) return [];
  const rows = await traktRequest<TraktWatchedShowRaw[]>("/sync/watched/shows").catch(
    () => [] as TraktWatchedShowRaw[],
  );
  if (!Array.isArray(rows)) return [];
  const out: NormalizedAnimeProgress[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const n = normalizeTraktWatchedShow(r);
    if (n && !seen.has(n.key)) {
      seen.add(n.key);
      out.push(n);
    }
  }
  return out;
}