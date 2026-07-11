import type { AnimeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { pickEpisodeTitle, type AniZipMapping } from "@/lib/providers/anizip";
import type { KitsuEpisode } from "@/lib/providers/kitsu";

export function buildKitsuEpisodes(addonMeta: AnimeKitsuMeta | null, kitsuRawEpisodes: KitsuEpisode[]): KitsuEpisode[] {
  if (!addonMeta?.videos || addonMeta.videos.length === 0) return kitsuRawEpisodes;
  const kitsuById = new Map<number, KitsuEpisode>();
  for (const ep of kitsuRawEpisodes) kitsuById.set(ep.number, ep);
  return addonMeta.videos.map((v): KitsuEpisode => {
    const k = kitsuById.get(v.episode);
    return {
      id: k?.id ?? v.episode,
      number: v.episode,
      seasonNumber: v.season ?? 1,
      title: v.title || k?.title || `Episode ${v.episode}`,
      synopsis: v.overview ?? k?.synopsis ?? "",
      thumbnail: v.thumbnail ?? k?.thumbnail ?? null,
      airdate: v.released ?? k?.airdate ?? null,
      length: k?.length ?? null,
      streamId: v.id,
      imdbId: v.imdb_id,
      imdbSeason: v.imdbSeason,
      imdbEpisode: v.imdbEpisode,
    };
  });
}

export function mergeAniZipEpisodes(episodes: KitsuEpisode[], aniZip: AniZipMapping | null): void {
  if (!aniZip?.episodes) return;
  const azImdb = aniZip.mappings?.imdb_id;
  for (const ep of episodes) {
    const az = aniZip.episodes[String(ep.number)];
    if (!az) continue;
    const enrichedTitle = pickEpisodeTitle(az);
    if (enrichedTitle && (!ep.title || ep.title === `Episode ${ep.number}`)) {
      ep.title = enrichedTitle;
    }
    if (az.overview && !ep.synopsis) ep.synopsis = az.overview;
    if (az.image && !ep.thumbnail) ep.thumbnail = az.image;
    if (az.airDate) ep.airdate = az.airDate;
    if (az.runtime && !ep.length) ep.length = az.runtime;
    if (az.filler) ep.filler = true;
    if (az.absoluteEpisodeNumber) ep.absoluteNumber = az.absoluteEpisodeNumber;
    if (ep.rating == null && az.rating != null) {
      const r = Number(az.rating);
      if (Number.isFinite(r) && r > 0) ep.rating = r;
    }
    if (az.seasonNumber != null && az.seasonNumber > 0 && az.episodeNumber != null) {
      if (azImdb) ep.imdbId = azImdb;
      if (ep.imdbSeason == null) ep.imdbSeason = az.seasonNumber;
      if (ep.imdbEpisode == null) ep.imdbEpisode = az.episodeNumber;
    }
  }
}
