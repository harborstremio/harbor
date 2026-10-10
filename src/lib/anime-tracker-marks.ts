import { kitsuToAnidb, kitsuToAnilist, kitsuToMal } from "@/lib/providers/anime-mapping";
import { rewindAnimeProgress, syncAnimeProgress } from "@/lib/anilist/sync";
import { rewindMalProgress, syncMalProgress } from "@/lib/mal/sync";
import { getSession as getSimklSession } from "@/lib/simkl/session";
import {
  markAnimeEpisodesWatched,
  markTvdbAnimeEpisodesWatched,
  unmarkAnimeEpisodesWatched,
} from "@/lib/simkl/history";
import type { SimklIds } from "@/lib/simkl/types";
import { animeEntryTarget, type AnimeEntryTarget } from "./anime-entry-target";

type Row = Parameters<typeof animeEntryTarget>[1];

export type AnimeMarkOptions = {
  title: string;
  trackId?: string;
  anilist: boolean;
  mal: boolean;
  simkl: boolean;
  /** Every row of the series and whether Harbor still shows it watched, for picking the rewind point. */
  watchedRows?: Array<{ row: Row; watched: boolean }>;
};

/** Highest entry number Harbor still shows watched below `below`, or 0 when none is. */
async function lastWatchedBelow(
  metaId: string,
  kitsuId: number,
  below: number,
  opts: AnimeMarkOptions,
): Promise<number> {
  const watched = (opts.watchedRows ?? []).filter((r) => r.watched);
  const targets = await Promise.all(
    watched.map(({ row }) => animeEntryTarget(metaId, row, opts.trackId)),
  );
  let best = 0;
  for (const t of targets) {
    if (t?.kitsuId === kitsuId && t.number < below && t.number > best) best = t.number;
  }
  return best;
}

async function simklAnimeIds(kitsuId: number): Promise<SimklIds | null> {
  const [mal, anilist, anidb] = await Promise.all([
    kitsuToMal(kitsuId).catch(() => null),
    kitsuToAnilist(kitsuId).catch(() => null),
    kitsuToAnidb(kitsuId).catch(() => null),
  ]);
  const ids: SimklIds = { kitsu: kitsuId };
  if (mal != null) ids.mal = mal;
  if (anilist != null) ids.anilist = anilist;
  if (anidb != null) ids.anidb = anidb;
  return mal != null || anilist != null || anidb != null ? ids : null;
}

function groupByEntry(targets: Array<AnimeEntryTarget | null>): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const t of targets) {
    if (!t || !Number.isInteger(t.number) || t.number < 1) continue;
    const list = out.get(t.kitsuId) ?? [];
    if (!list.includes(t.number)) list.push(t.number);
    out.set(t.kitsuId, list);
  }
  return out;
}

function tvdbFallback(metaId: string, rows: Row[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  if (!/^tt\d+$/.test(metaId)) return out;
  for (const r of rows) {
    if (r.imdbSeason == null || r.imdbSeason < 1 || r.imdbEpisode == null) continue;
    const list = out.get(r.imdbSeason) ?? [];
    list.push(r.imdbEpisode);
    out.set(r.imdbSeason, list);
  }
  return out;
}

/** Pushes manual anime marks to every connected tracker in each entry's own numbering. */
export async function pushAnimeMarks(
  metaId: string,
  rows: Row[],
  watched: boolean,
  opts: AnimeMarkOptions,
): Promise<void> {
  if (rows.length === 0) return;
  const simkl = opts.simkl && getSimklSession() != null;
  if (!simkl && !opts.anilist && !opts.mal) return;
  const targets = await Promise.all(rows.map((r) => animeEntryTarget(metaId, r, opts.trackId)));
  const byEntry = groupByEntry(targets);
  const unresolved = rows.filter((_, i) => targets[i] == null);
  for (const [kitsuId, numbers] of byEntry) {
    const harborId = `kitsu:${kitsuId}`;
    if (watched) {
      const highest = Math.max(...numbers);
      if (opts.anilist) void syncAnimeProgress(harborId, highest, opts.title);
      if (opts.mal) void syncMalProgress(harborId, highest, opts.title);
    } else if (opts.anilist || opts.mal) {
      // A count only says "watched through N", so it rewinds to the last episode still watched.
      const target = await lastWatchedBelow(metaId, kitsuId, Math.min(...numbers), opts);
      if (opts.anilist) void rewindAnimeProgress(harborId, target);
      if (opts.mal) void rewindMalProgress(harborId, target);
    }
    if (!simkl) continue;
    const ids = await simklAnimeIds(kitsuId);
    if (!ids) continue;
    if (watched) void markAnimeEpisodesWatched(ids, numbers);
    else void unmarkAnimeEpisodesWatched(ids, numbers);
  }
  if (!simkl || !watched) return;
  for (const [season, eps] of tvdbFallback(metaId, unresolved)) {
    void markTvdbAnimeEpisodesWatched({ imdb: metaId }, season, eps);
  }
}
