import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { pickLocalizedText } from "@/lib/localized-text";
import { seasonDateRange, type TvdbOrder } from "@/lib/providers/tvdb-order";
import type { PickerItem } from "../series-episodes/season-arc-picker";

export type AnimeOrderBuild = { items: PickerItem[]; subsetByKey: Map<string, KitsuEpisode[]> };

export function buildAnimeOrder(
  ordering: TvdbOrder | null,
  episodes: KitsuEpisode[],
  specialsLabel: string,
  lang?: string,
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
      let match = byTvdbId.get(e.id) ?? byPair.get(`${e.seasonNumber}:${e.episodeNumber}`);
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
        title:
          pickLocalizedText([{ text: e.name }, { text: e.nameEn ?? "" }], {
            forName: true,
            lang,
          }) ?? `Episode ${e.episodeNumber}`,
        synopsis:
          pickLocalizedText([{ text: e.overview }, { text: e.overviewEn ?? "" }], { lang }) ??
          e.overview ??
          "",
        thumbnail: img ?? null,
        airdate: e.airDate ?? null,
        length: e.runtime ?? null,
        imdbSeason: e.seasonNumber,
        imdbEpisode: e.episodeNumber,
        absoluteNumber: abs ?? undefined,
        tvdbEpisodeId: e.id > 0 ? e.id : undefined,
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

// Season order for a standalone split-franchise entry (e.g. Bleach TYBW opened
// as its own page): bucket the entry's own episodes by their AniZip provider
// season (imdbSeason), so the cours appear as seasons without pulling in the
// franchise root's (Bleach 2004) provider order.
export function buildSoloAnimeOrder(
  episodes: KitsuEpisode[],
  specialsLabel: string,
  seasonLabel: (season: number) => string,
): AnimeOrderBuild | null {
  const bySeason = new Map<number, KitsuEpisode[]>();
  const specials: KitsuEpisode[] = [];
  for (const ep of episodes) {
    const s = ep.imdbSeason;
    if (s == null || s < 1) {
      specials.push(ep);
      continue;
    }
    const bucket = bySeason.get(s);
    if (bucket) bucket.push(ep);
    else bySeason.set(s, [ep]);
  }
  const items: PickerItem[] = [];
  const subsetByKey = new Map<string, KitsuEpisode[]>();
  for (const s of [...bySeason.keys()].sort((a, b) => a - b)) {
    const eps = bySeason
      .get(s)!
      .slice()
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    items.push({
      key: String(s),
      name: seasonLabel(s),
      count: eps.length,
      year: eps[0]?.airdate?.slice(0, 4),
    });
    subsetByKey.set(String(s), eps);
  }
  if (specials.length > 0) {
    items.push({ key: "specials", name: specialsLabel, count: specials.length, extra: true });
    subsetByKey.set("specials", specials);
  }
  if (items.length < 2) return null;
  return { items, subsetByKey };
}
