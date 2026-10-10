import { aniZipByKitsu } from "@/lib/providers/anizip";
import { airedOnly } from "@/lib/aired";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { entryTvdbPairs } from "@/lib/anime-entry-target";

/** Episode keys a tracker count reaches, in both the entry's own and the TVDB display coordinates. */
export async function trackerWatchedKeys(
  harborId: string,
  episodes: KitsuEpisode[],
  watchedCount: number,
  completed: boolean,
  mediaTotal: number | null,
): Promise<Set<string>> {
  const sorted = airedOnly(
    [...episodes].sort(
      (a, b) => (a.seasonNumber ?? 1) - (b.seasonNumber ?? 1) || a.number - b.number,
    ),
    (e) => e.airdate,
  );
  const cap =
    mediaTotal != null && mediaTotal > 0 ? Math.min(sorted.length, mediaTotal) : sorted.length;
  const count = completed ? Math.max(cap, mediaTotal ?? 0) : Math.max(0, watchedCount);
  const keys = new Set<string>();
  for (let i = 0; i < Math.min(count, cap); i++) {
    const ep = sorted[i];
    keys.add(`${ep.seasonNumber ?? 1}:${ep.number}`);
    if (ep.imdbSeason != null && ep.imdbEpisode != null)
      keys.add(`${ep.imdbSeason}:${ep.imdbEpisode}`);
  }
  // TVDB-ordered rows look themselves up by their provider pair, so map entry numbers onto it.
  const kitsu = /^kitsu:(\d+)$/.exec(harborId);
  if (kitsu && count > 0) {
    const az = await aniZipByKitsu(Number(kitsu[1])).catch(() => null);
    for (const [n, pair] of entryTvdbPairs(az)) if (n <= count) keys.add(pair);
  }
  return keys;
}
