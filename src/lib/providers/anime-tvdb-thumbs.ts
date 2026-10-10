import { tvdbEpisodes, tvdbEpisodesAbsolute } from "@/lib/providers/tvdb";

export type TvdbThumbIndex = {
  bySeasonEpisode: Map<string, string>;
  byAbsolute: Map<number, string>;
};

export async function fetchTvdbThumbs(
  apiKey: string,
  seriesId: number,
  seasons: number[],
): Promise<TvdbThumbIndex> {
  const bySeasonEpisode = new Map<string, string>();
  const byAbsolute = new Map<number, string>();

  const absEps = await tvdbEpisodesAbsolute(apiKey, seriesId).catch(() => []);
  if (absEps.length > 0) {
    for (const e of absEps) {
      if (!e.image) continue;
      bySeasonEpisode.set(`${e.seasonNumber}:${e.number}`, e.image);
      // This endpoint uses absolute ordering; its number remains meaningful
      // even when the response omits earlier episodes or artwork.
      const absolute = e.absoluteNumber ?? e.number;
      if (!byAbsolute.has(absolute)) byAbsolute.set(absolute, e.image);
    }
    return { bySeasonEpisode, byAbsolute };
  }

  const wanted = seasons.length > 0 ? seasons : [1];
  const lists = await Promise.all(
    Array.from(new Set(wanted)).map((s) => tvdbEpisodes(apiKey, seriesId, s).catch(() => [])),
  );
  for (const list of lists) {
    for (const e of list) {
      if (!e.image) continue;
      bySeasonEpisode.set(`${e.seasonNumber}:${e.number}`, e.image);
      if (e.absoluteNumber != null && !byAbsolute.has(e.absoluteNumber)) {
        byAbsolute.set(e.absoluteNumber, e.image);
      }
    }
  }
  return { bySeasonEpisode, byAbsolute };
}
