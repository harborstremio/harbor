import { pickEpisodeTitle, type AniZipMapping } from "@/lib/providers/anizip";
import type { AnimeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { TvdbEpisode } from "@/lib/providers/tvdb";

export function buildKitsuEpisodes(
  addonMeta: AnimeKitsuMeta | null,
  kitsuRawEpisodes: KitsuEpisode[],
): KitsuEpisode[] {
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
    if (az.image) {
      if (ep.thumbnail && ep.thumbnail !== az.image && !ep.thumbnailFallback) {
        ep.thumbnailFallback = ep.thumbnail;
      }
      ep.thumbnail = az.image;
    }
    if (az.airDate) ep.airdate = az.airDate;
    if (az.runtime && !ep.length) ep.length = az.runtime;
    if (az.filler) ep.filler = true;
    if (az.absoluteEpisodeNumber) ep.absoluteNumber = az.absoluteEpisodeNumber;
    if (az.tvdbId) ep.tvdbEpisodeId = az.tvdbId;
    if (ep.rating == null && az.rating != null) {
      const r = Number(az.rating);
      if (Number.isFinite(r) && r > 0) {
        if (!ep.airdate || new Date(ep.airdate).getTime() <= Date.now()) {
          ep.rating = r;
        }
      }
    }
    if (az.seasonNumber != null && az.seasonNumber > 0 && az.episodeNumber != null) {
      if (azImdb) ep.imdbId = azImdb;
      if (ep.imdbSeason == null) ep.imdbSeason = az.seasonNumber;
      if (ep.imdbEpisode == null) ep.imdbEpisode = az.episodeNumber;
    }
  }
}

export function mergeTvdbEpisodes(episodes: KitsuEpisode[], tvdbEps: TvdbEpisode[] | null): void {
  if (!tvdbEps || tvdbEps.length === 0) return;
  const tvdbById = new Map<number, TvdbEpisode>();
  const tvdbByAbsolute = new Map<number, TvdbEpisode>();
  const tvdbBySeasonAndEpisode = new Map<string, TvdbEpisode>();

  for (const e of tvdbEps) {
    tvdbById.set(e.id, e);
    if (e.absoluteNumber != null) tvdbByAbsolute.set(e.absoluteNumber, e);
    tvdbBySeasonAndEpisode.set(`${e.seasonNumber}:${e.number}`, e);
  }

  for (const ep of episodes) {
    let tvdbEp: TvdbEpisode | undefined;

    if (ep.tvdbEpisodeId) tvdbEp = tvdbById.get(ep.tvdbEpisodeId);
    if (!tvdbEp && ep.absoluteNumber) tvdbEp = tvdbByAbsolute.get(ep.absoluteNumber);
    if (!tvdbEp && ep.imdbSeason != null && ep.imdbEpisode != null) {
      tvdbEp = tvdbBySeasonAndEpisode.get(`${ep.imdbSeason}:${ep.imdbEpisode}`);
    }
    if (!tvdbEp) tvdbEp = tvdbBySeasonAndEpisode.get(`${ep.seasonNumber}:${ep.number}`);
    if (!tvdbEp) tvdbEp = tvdbByAbsolute.get(ep.number);

    if (tvdbEp) {
      if (tvdbEp.name && (!ep.title || ep.title === `Episode ${ep.number}`)) {
        ep.title = tvdbEp.name;
      }
      if (tvdbEp.aired) ep.airdate = tvdbEp.aired;
      if (tvdbEp.overview && !ep.synopsis) ep.synopsis = tvdbEp.overview;
      if (tvdbEp.image) {
        if (ep.thumbnail && ep.thumbnail !== tvdbEp.image && !ep.thumbnailFallback) {
          ep.thumbnailFallback = ep.thumbnail;
        }
        ep.thumbnail = tvdbEp.image;
      }
      if (tvdbEp.runtime && !ep.length) ep.length = tvdbEp.runtime;
    }
  }
}
