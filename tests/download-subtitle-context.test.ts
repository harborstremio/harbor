// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  downloadPlaybackFields,
  snapshotDownloadPlaybackContext,
} from "../src/lib/download/playback-context.ts";
import { localPlayerSrc } from "../src/lib/local-library/player-src.ts";
import {
  playerSubtitleMetadataId,
  subtitleHintsFromStreamRef,
  trustedPlayerImdbId,
} from "../src/lib/subtitles/player-hints.ts";

test("download playback keeps verified content and release metadata for subtitle providers", () => {
  const episode = { season: 1, episode: 3, imdbSeason: 2, imdbEpisode: 8 };
  const streamRef = {
    infoHash: "0123456789abcdef",
    title: "Show.S02E08.1080p.WEB-DL.mkv",
    parsedTitle: "Show S02E08",
    resolution: "1080p",
    releaseGroup: "GROUP",
    source: "WEB-DL",
    size: 1_234_567,
  };
  const subtitleHints = subtitleHintsFromStreamRef(streamRef);
  const context = snapshotDownloadPlaybackContext({
    imdbId: "tt1234567",
    imdbIdVerified: true,
    episode,
    subtitleHints,
  });

  episode.imdbEpisode = 99;
  streamRef.title = "changed";
  if (subtitleHints) subtitleHints.filename = "changed";

  assert.equal(context.imdbId, "tt1234567");
  assert.equal(context.imdbIdVerified, true);
  assert.equal(context.episode?.imdbEpisode, 8);
  assert.equal(context.subtitleHints?.filename, "Show S02E08");
  assert.equal(context.subtitleHints?.release, "Show.S02E08.1080p.WEB-DL.mkv");
  assert.equal(context.subtitleHints?.source, "WEB-DL");
  assert.equal(context.subtitleHints?.size, 1_234_567);

  const restored = downloadPlaybackFields(
    JSON.parse(JSON.stringify(context)) as typeof context,
    null,
    null,
  );
  assert.equal(restored.imdbId, "tt1234567");
  assert.equal(restored.episode?.imdbEpisode, 8);
  assert.equal(restored.subtitleHints?.filename, "Show S02E08");
  assert.equal("streamRef" in restored, false);
});

test("download playback does not trust fallback IMDb guesses", () => {
  const context = snapshotDownloadPlaybackContext({
    imdbId: "tt7654321",
    imdbIdVerified: false,
  });

  assert.equal(context.imdbId, undefined);
  assert.equal(context.imdbIdVerified, undefined);
  assert.equal(
    trustedPlayerImdbId({
      meta: { id: "tmdb:movie:42", type: "movie", name: "Movie" },
      imdbId: "tt7654321",
      imdbIdVerified: false,
    }),
    undefined,
  );
  assert.equal(
    trustedPlayerImdbId({
      meta: { id: "tt1111111", type: "movie", name: "Movie" },
      imdbId: undefined,
      imdbIdVerified: undefined,
    }),
    "tt1111111",
  );
});

test("older download records still rebuild their episode context", () => {
  const playback = downloadPlaybackFields(undefined, 4, 11, "C:\\Downloads\\Show.S04E11.1080p.mkv");
  assert.deepEqual(playback.episode, { season: 4, episode: 11 });
  assert.equal(playback.imdbId, undefined);
  assert.equal(playback.imdbIdVerified, false);
  assert.equal(playback.subtitleHints?.filename, "Show.S04E11.1080p.mkv");
});

test("scanned local files expose verified IMDb and filename hints", () => {
  const src = localPlayerSrc({
    id: "local-1",
    path: "C:/Media/Movie.2025.2160p.mkv",
    filename: "Movie.2025.2160p.mkv",
    title: "Movie",
    year: 2025,
    type: "movie",
    resolution: "2160p",
    imdbId: "tt7654321",
    addedAt: 1,
  });

  assert.equal(src.imdbId, "tt7654321");
  assert.equal(src.imdbIdVerified, true);
  assert.equal(src.subtitleHints?.filename, "Movie.2025.2160p.mkv");
  assert.equal(src.subtitleHints?.resolution, "2160p");
  assert.equal(src.streamRef, undefined);
});

test("TMDB-only local files keep stable resume and subtitle lookup IDs", () => {
  const src = localPlayerSrc({
    id: "local-2",
    path: "C:/Media/Movie.mkv",
    filename: "Movie.mkv",
    title: "Movie",
    year: null,
    type: "movie",
    tmdbId: 42,
    addedAt: 1,
  });

  assert.equal(src.meta.id, "local:local-2");
  assert.equal(src.tmdbId, 42);
  assert.equal(playerSubtitleMetadataId(src), "tmdb:movie:42");
  assert.equal(src.imdbId, undefined);
  assert.equal(src.imdbIdVerified, false);
});
