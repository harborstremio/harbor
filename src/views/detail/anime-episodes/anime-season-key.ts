import type { KitsuEpisode } from "@/lib/providers/kitsu";

export function animeSeasonKey(ep: KitsuEpisode): number {
  if (ep.imdbSeason === 0) return 0;
  return ep.id < 0 ? (ep.imdbSeason ?? ep.seasonNumber ?? 1) : (ep.seasonNumber ?? 1);
}
