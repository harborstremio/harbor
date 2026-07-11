/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Type verification test for episode types
 * This file ensures all types are properly defined and can be used
 */

import type {
  EpisodeDetail,
  GuestStar,
  CrewMember,
  StillImage,
  EpisodeCacheEntry,
  TmdbEpisodeResponse,
} from "./tmdb-episode-types";

// Verify GuestStar type
const testGuestStar: GuestStar = {
  id: 123,
  name: "Test Actor",
  character: "Test Character",
  order: 1,
  profilePath: "/test.jpg",
};

// Verify CrewMember type
const testCrewMember: CrewMember = {
  id: 456,
  name: "Test Director",
  job: "Director",
  department: "Directing",
  profilePath: "/director.jpg",
};

// Verify StillImage type
const testStillImage: StillImage = {
  aspectRatio: 1.78,
  filePath: "/still.jpg",
  height: 1080,
  width: 1920,
  voteAverage: 7.5,
};

// Verify EpisodeDetail type
const testEpisodeDetail: EpisodeDetail = {
  id: 789,
  episodeNumber: 5,
  seasonNumber: 2,
  name: "Test Episode",
  overview: "Test overview",
  stillPath: "/episode.jpg",
  airDate: "2024-01-01",
  runtime: 45,
  voteAverage: 8.5,
  voteCount: 100,
  imdbId: "tt1234567",
  guestStars: [testGuestStar],
  crew: [testCrewMember],
  stills: [testStillImage],
};

// Verify EpisodeCacheEntry type
const testCacheEntry: EpisodeCacheEntry = {
  data: testEpisodeDetail,
  timestamp: Date.now(),
  seriesId: "tmdb:tv:12345",
};

// Verify TmdbEpisodeResponse type
const testApiResponse: TmdbEpisodeResponse = {
  id: 789,
  episode_number: 5,
  season_number: 2,
  name: "Test Episode",
  overview: "Test overview",
  still_path: "/episode.jpg",
  air_date: "2024-01-01",
  runtime: 45,
  vote_average: 8.5,
  vote_count: 100,
  credits: {
    cast: [],
    crew: [],
    guest_stars: [
      {
        id: 123,
        name: "Test Actor",
        character: "Test Character",
        order: 1,
        profile_path: "/test.jpg",
      },
    ],
  },
  images: {
    stills: [
      {
        aspect_ratio: 1.78,
        file_path: "/still.jpg",
        height: 1080,
        width: 1920,
        vote_average: 7.5,
      },
    ],
  },
  external_ids: {
    imdb_id: "tt1234567",
  },
};

// Type guards to ensure compatibility
function isValidEpisodeDetail(data: unknown): data is EpisodeDetail {
  const episode = data as EpisodeDetail;
  return (
    typeof episode.id === "number" &&
    typeof episode.episodeNumber === "number" &&
    typeof episode.seasonNumber === "number" &&
    typeof episode.name === "string" &&
    Array.isArray(episode.guestStars) &&
    Array.isArray(episode.crew) &&
    Array.isArray(episode.stills)
  );
}

// Export verification - ensures types can be imported elsewhere
export type { EpisodeDetail, GuestStar, CrewMember, StillImage, EpisodeCacheEntry, TmdbEpisodeResponse };

// Test successful if this compiles without errors
console.log("Episode types verification: All types are properly defined");

export { testCacheEntry, testApiResponse, isValidEpisodeDetail };
