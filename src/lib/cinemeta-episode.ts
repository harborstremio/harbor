/**
 * Cinemeta fallback handler for episode data
 * Extracts episode information from Cinemeta series metadata when TMDB is unavailable
 */

import type { Meta } from "@/lib/cinemeta";
import type { EpisodeDetail } from "@/lib/providers/tmdb/tmdb-episode-types";

/**
 * Extract episode details from Cinemeta series metadata
 *
 * @param meta - Series metadata from Cinemeta
 * @param season - Season number
 * @param episode - Episode number
 * @returns Partial episode detail or null if not found
 */
export async function cinemetaEpisodeDetail(
  meta: Meta,
  season: number,
  episode: number,
): Promise<Partial<EpisodeDetail> | null> {
  try {
    // Find the matching video/episode in the series metadata
    const video = meta.videos?.find((v) => v.season === season && v.episode === episode);

    if (!video) {
      return null;
    }

    // Extract available episode information
    // Cinemeta doesn't provide rich episode details like TMDB
    return {
      episodeNumber: episode,
      seasonNumber: season,
      name: video.name || video.title || `Episode ${episode}`,
      overview: "", // Cinemeta doesn't provide episode descriptions
      stillPath: video.thumbnail || null,
      airDate: video.released || video.firstAired || null,
      runtime: null, // Not available in Cinemeta
      voteAverage: null, // Not available in Cinemeta
      voteCount: 0,
      guestStars: [],
      crew: [],
      stills: video.thumbnail
        ? [
            {
              aspectRatio: 16 / 9,
              filePath: video.thumbnail,
              height: 720,
              width: 1280,
              voteAverage: 0,
            },
          ]
        : [],
    };
  } catch (error) {
    console.error("Failed to get Cinemeta episode data:", error);
    return null;
  }
}
