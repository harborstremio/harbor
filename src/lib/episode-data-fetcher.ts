/**
 * Unified episode data fetcher
 * Orchestrates fetching episode details from cache → TMDB → Cinemeta fallback
 */

import type { Meta } from "@/lib/cinemeta";
import type { Settings } from "@/lib/settings";
import { tmdbEpisodeDetail } from "@/lib/providers/tmdb/tmdb-episode-details";
import { getCachedEpisode, cacheEpisode } from "@/lib/providers/tmdb/tmdb-episode-cache";
import { cinemetaEpisodeDetail } from "@/lib/cinemeta-episode";
import type { EpisodeDetail } from "@/lib/providers/tmdb/tmdb-episode-types";

/**
 * Extract TMDB ID from various meta ID formats
 *
 * @param seriesId - Meta ID (can be tmdb:tv:123, tt1234567, etc.)
 * @param seriesMeta - Series metadata
 * @param tmdbKey - TMDB API key for IMDB->TMDB resolution
 * @returns TMDB TV series ID or null if not extractable
 */
async function extractTmdbId(
  seriesId: string,
  _seriesMeta: Meta,
  tmdbKey: string,
): Promise<number | null> {
  // Direct TMDB ID format: tmdb:tv:12345
  if (seriesId.startsWith("tmdb:tv:")) {
    const id = Number(seriesId.slice(8));
    return isNaN(id) ? null : id;
  }

  // IMDB ID format - resolve to TMDB ID using find API
  if (seriesId.startsWith("tt")) {
    try {
      const { get } = await import("@/lib/providers/tmdb/tmdb-client");
      const response = await get<{ tv_results?: Array<{ id: number }> }>(
        tmdbKey,
        `find/${seriesId}`,
        { external_source: "imdb_id" },
      );

      if (response?.tv_results && response.tv_results.length > 0) {
        const tmdbId = response.tv_results[0].id;
        return tmdbId;
      }
    } catch (error) {
      console.error(`[TMDB-RESOLVE] Failed to resolve IMDB ID ${seriesId}:`, error);
    }
  }

  return null;
}

/**
 * Fetch episode data with multi-tier fallback strategy
 *
 * Priority order:
 * 1. Cache (24-hour TTL)
 * 2. TMDB API (if API key available and TMDB ID extractable)
 * 3. Cinemeta (fallback for basic data)
 *
 * @param seriesId - Meta ID of the series
 * @param seriesMeta - Series metadata from Cinemeta
 * @param season - Season number
 * @param episode - Episode number
 * @param settings - User settings (contains TMDB API key)
 * @returns Complete episode detail or null on failure
 */
export async function fetchEpisodeData(
  seriesId: string,
  seriesMeta: Meta,
  season: number,
  episode: number,
  settings: Settings,
): Promise<EpisodeDetail | null> {
  // 1. Check cache first (fastest path)
  const cached = getCachedEpisode(seriesId, season, episode);
  if (cached) {
    return cached;
  }

  // 2. Try TMDB if API key is available
  if (settings.tmdbKey) {
    try {
      const tmdbId = await extractTmdbId(seriesId, seriesMeta, settings.tmdbKey);

      if (tmdbId) {
        const tmdbData = await tmdbEpisodeDetail(settings.tmdbKey, tmdbId, season, episode);

        if (tmdbData) {
          // Cache successful TMDB fetch
          cacheEpisode(seriesId, season, episode, tmdbData);
          return tmdbData;
        }
      }
    } catch (tmdbError) {
      console.warn(`[episode-fetcher] TMDB fetch failed, falling back to Cinemeta:`, tmdbError);
      // Continue to fallback
    }
  }

  // 3. Fallback to Cinemeta
  try {
    const cinemetaData = await cinemetaEpisodeDetail(seriesMeta, season, episode);

    if (cinemetaData) {
      // Construct complete EpisodeDetail from partial Cinemeta data
      const completeData: EpisodeDetail = {
        id: 0, // Cinemeta doesn't provide episode ID
        episodeNumber: cinemetaData.episodeNumber!,
        seasonNumber: cinemetaData.seasonNumber!,
        name: cinemetaData.name!,
        overview: cinemetaData.overview!,
        stillPath: cinemetaData.stillPath!,
        airDate: cinemetaData.airDate!,
        runtime: cinemetaData.runtime!,
        voteAverage: cinemetaData.voteAverage!,
        voteCount: cinemetaData.voteCount!,
        imdbId: null,
        guestStars: cinemetaData.guestStars || [],
        crew: cinemetaData.crew || [],
        stills: cinemetaData.stills || [],
      };

      // Cache Cinemeta data with shorter TTL (1 hour) since it has limited info
      // This allows it to be replaced if TMDB data becomes available later
      cacheEpisode(seriesId, season, episode, completeData);
      return completeData;
    }
  } catch (cinemetaError) {
    console.error(`[episode-fetcher] Cinemeta fetch failed:`, cinemetaError);
  }

  console.error(
    `[episode-fetcher] All fetch attempts failed for ${seriesId} S${season}E${episode}`,
  );
  return null;
}
