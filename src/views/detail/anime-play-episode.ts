import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { PlayEpisode } from "@/lib/view";

/** Keep the hero's saved episode even while its season's metadata is loading. */
export function animePlayEpisode(
  episodes: KitsuEpisode[],
  resume: { season: number; episode: number } | null,
  nativeId: boolean,
  canonicalId: string | null,
): PlayEpisode | undefined {
  const nativeMatch = resume
    ? episodes.find((ep) => (ep.seasonNumber ?? 1) === resume.season && ep.number === resume.episode)
    : undefined;
  const providerMatch = resume
    ? episodes.find((ep) => ep.imdbSeason === resume.season && ep.imdbEpisode === resume.episode)
    : undefined;
  const wanted = resume
    ? nativeId
      ? nativeMatch ?? providerMatch
      : providerMatch ?? (nativeMatch?.imdbSeason == null ? nativeMatch : undefined)
    : episodes[0];
  const sourceMetaId = !nativeId && canonicalId ? canonicalId : undefined;
  if (wanted) {
    return {
      season: wanted.seasonNumber ?? 1,
      episode: wanted.number,
      name: wanted.title,
      still: wanted.thumbnail ?? undefined,
      overview: wanted.synopsis || undefined,
      kitsuStreamId: wanted.streamId,
      imdbId: wanted.imdbId,
      imdbSeason: wanted.imdbSeason,
      imdbEpisode: wanted.imdbEpisode,
      absoluteNumber: wanted.absoluteNumber ?? wanted.number,
      tvdbEpisodeId: wanted.tvdbEpisodeId,
      sourceMetaId: wanted.sourceMetaId ?? sourceMetaId,
    };
  }
  if (!resume) return undefined;
  return {
    season: resume.season,
    episode: resume.episode,
    // A missing later season needs provider coordinates for sibling-entry resolution.
    // Native season 1 remains entry-relative; it may represent a later cour.
    ...(!nativeId || resume.season > 1
      ? { imdbSeason: resume.season, imdbEpisode: resume.episode }
      : {}),
    sourceMetaId,
  };
}
