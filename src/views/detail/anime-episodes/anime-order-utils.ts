import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { seasonDateRange, type TvdbOrder } from "@/lib/providers/tvdb-order";
import type { PickerItem } from "../series-episodes/season-arc-picker";

export type AnimeOrderBuild = { items: PickerItem[]; subsetByKey: Map<string, KitsuEpisode[]> };

export function buildAnimeOrder(
  ordering: TvdbOrder | null,
  episodes: KitsuEpisode[],
  specialsLabel: string,
): AnimeOrderBuild | null {
  if (!ordering) return null;
  const byPair = new Map<string, KitsuEpisode>();
  const byAbs = new Map<number, KitsuEpisode>();
  const byTvdbId = new Map<number, KitsuEpisode>();
  for (const ep of episodes) {
    const abs = ep.absoluteNumber ?? ep.number;
    if (abs != null && !byAbs.has(abs)) byAbs.set(abs, ep);
    if (ep.tvdbEpisodeId != null && !byTvdbId.has(ep.tvdbEpisodeId))
      byTvdbId.set(ep.tvdbEpisodeId, ep);
    if (ep.imdbSeason == null || ep.imdbSeason < 1 || ep.imdbEpisode == null) continue;
    const key = `${ep.imdbSeason}:${ep.imdbEpisode}`;
    if (!byPair.has(key)) byPair.set(key, ep);
  }
  if (byPair.size === 0 && byAbs.size === 0) return null;

  const items: PickerItem[] = [];
  const subsetByKey = new Map<string, KitsuEpisode[]>();
  const matched = new Set<number>();
  for (const s of ordering.seasons) {
    if (s.seasonNumber < 1) continue;
    const bucket = ordering.bySeason.get(s.seasonNumber) ?? [];
    if (bucket.length === 0) continue;
    const ordered: KitsuEpisode[] = bucket.map((e) => {
      const abs = ordering.absByEpId.get(e.id);
      let match = byPair.get(`${e.seasonNumber}:${e.episodeNumber}`) ?? byTvdbId.get(e.id);
      if (!match && abs != null) match = byAbs.get(abs);
      if (match) {
        matched.add(match.id);
        return match;
      }
      const img = abs != null ? ordering.imageByAbs.get(abs) : undefined;
      return {
        id: -e.id,
        number: e.episodeNumber,
        seasonNumber: e.seasonNumber,
        title: e.name || `Episode ${e.episodeNumber}`,
        synopsis: e.overview ?? "",
        thumbnail: img ?? null,
        airdate: e.airDate ?? null,
        length: e.runtime ?? null,
        imdbSeason: e.seasonNumber,
        imdbEpisode: e.episodeNumber,
        absoluteNumber: abs ?? undefined,
      };
    });
    const key = String(s.seasonNumber);
    const { from, to } = seasonDateRange(bucket);
    items.push({
      key,
      name: s.name,
      count: ordered.length,
      year: s.airDate?.slice(0, 4),
      from,
      to,
    });
    subsetByKey.set(key, ordered);
  }
  if (items.length < 2) return null;

  const leftovers = episodes.filter((ep) => !matched.has(ep.id));
  if (leftovers.length > 0) {
    items.push({ key: "specials", name: specialsLabel, count: leftovers.length, extra: true });
    subsetByKey.set("specials", leftovers);
  }
  return { items, subsetByKey };
}
