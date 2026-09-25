import type { KitsuEpisode } from "@/lib/providers/kitsu";

export function animeSeasonKey(ep: KitsuEpisode): number {
  // in some animes (like AOT, one piece...) kitsu api returns seasonNumber 1 in all seasons which caused Episode Not Found so use imdbSeason
  return ep.imdbSeason ?? ep.seasonNumber ?? 1;
}
