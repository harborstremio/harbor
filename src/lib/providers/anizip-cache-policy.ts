import { pickEpisodeTitle, type AniZipEpisodeTitleFields } from "./anizip-episode-title.ts";

export const ANI_ZIP_TRANSIENT_CACHE_TTL_MS = 120000;

export type AniZipTitleMapping = {
  episodes?: Record<string, AniZipEpisodeTitleFields>;
};

export function aniZipCacheExpiresAt(
  mapping: AniZipTitleMapping | null,
  now: number,
): number | null {
  if (mapping == null || !hasCompleteEpisodeTitles(mapping)) {
    return now + ANI_ZIP_TRANSIENT_CACHE_TTL_MS;
  }
  return null;
}

function hasCompleteEpisodeTitles(mapping: AniZipTitleMapping): boolean {
  const episodes = Object.values(mapping.episodes ?? {});
  return episodes.length > 0 && episodes.every((episode) => pickEpisodeTitle(episode) != null);
}
