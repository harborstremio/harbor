import type {
  EpisodeDetail,
  TmdbEpisodeResponse,
  GuestStar,
  CrewMember,
  StillImage,
} from "./tmdb-episode-types";
import { effectiveTmdbLanguage, get } from "./tmdb-client";
import { imageLangParam } from "./tmdb-image-lang";

/**
 * Fetch comprehensive episode details from TMDB API
 *
 * @param apiKey - TMDB API key
 * @param tvId - TMDB TV series ID
 * @param seasonNumber - Season number
 * @param episodeNumber - Episode number
 * @returns EpisodeDetail object or null on failure
 */
export async function tmdbEpisodeDetail(
  apiKey: string,
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<EpisodeDetail | null> {
  try {
    const path = `tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`;
    const params = {
      append_to_response: "credits,images,external_ids",
      language: effectiveTmdbLanguage() || "en",
      include_image_language: imageLangParam(),
    };

    const data = await get<TmdbEpisodeResponse>(apiKey, path, params);

    if (!data) {
      return null;
    }

    // Merge regular cast + guest stars, dedup by id, sorted by order
    const seen = new Set<number>();
    const allCast: GuestStar[] = [];
    const push = (item: {
      id: number;
      name: string;
      character: string;
      order: number;
      profile_path: string | null;
    }) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      allCast.push({
        id: item.id,
        name: item.name,
        character: item.character,
        order: item.order,
        profilePath: item.profile_path,
      });
    };
    for (const star of data.credits?.cast || []) push(star);
    for (const star of data.credits?.guest_stars || []) push(star);
    const guestStars = allCast.sort((a, b) => a.order - b.order);

    // Transform crew members
    const crew: CrewMember[] = (data.credits?.crew || []).map((member) => ({
      id: member.id,
      name: member.name,
      job: member.job,
      department: member.department,
      profilePath: member.profile_path,
    }));

    // Transform stills (limit to 12 images)
    const stills: StillImage[] = (data.images?.stills || []).slice(0, 12).map((still) => ({
      aspectRatio: still.aspect_ratio,
      filePath: still.file_path,
      height: still.height,
      width: still.width,
      voteAverage: still.vote_average || 0,
    }));

    return {
      id: data.id,
      episodeNumber: data.episode_number,
      seasonNumber: data.season_number,
      name: data.name,
      overview: data.overview,
      stillPath: data.still_path,
      airDate: data.air_date,
      runtime: data.runtime,
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      imdbId: data.external_ids?.imdb_id ?? null,
      guestStars,
      crew,
      stills,
    };
  } catch (error) {
    console.error("Failed to fetch TMDB episode details:", error);
    return null;
  }
}
