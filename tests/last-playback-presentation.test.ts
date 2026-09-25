import assert from "node:assert/strict";
import test from "node:test";
import { lastPlaybackPresentation } from "../src/lib/last-playback-presentation.ts";
import type { ActualPlayback } from "../src/lib/playback-history.ts";

const settings = {
  hideSpoilers: true,
  spoilerHideThumbnails: true,
  spoilerHideTitles: true,
  spoilerHideDescriptions: true,
  spoilerSkipNext: true,
};
const target: ActualPlayback = {
  id: "played-a",
  actor: { profileId: "test", storageProfileId: "test", accountId: null },
  playedAt: 1,
  positionMs: 5000,
  durationMs: 50000,
  completed: false,
  src: {
    meta: {
      id: "tt123",
      type: "series",
      name: "Series A",
      poster: "https://example.invalid/a.png",
    },
    url: "https://example.invalid/private-video",
    episode: {
      season: 2,
      episode: 3,
      name: "The reveal",
      still: "https://example.invalid/episode-a.png",
    },
  },
};

test("last playback keeps concealed episode artwork/title out of its row and tooltip", () => {
  const hidden = lastPlaybackPresentation(target, settings, false);
  assert.equal(hidden.artwork, undefined);
  assert.equal(hidden.episode, "S2 · E3");
  assert.equal(hidden.title, "Series A");
  const watched = lastPlaybackPresentation(target, settings, true);
  assert.equal(watched.artwork, target.src.episode?.still);
  assert.equal(watched.episode, "S2 · E3 · The reveal");
});

test("last playback does not invent a next-up exception or substitute the title poster for a still", () => {
  assert.equal(lastPlaybackPresentation(target, settings, false).artwork, undefined);
  const noStill = {
    ...target,
    src: { ...target.src, episode: { ...target.src.episode!, still: undefined } },
  };
  assert.equal(lastPlaybackPresentation(noStill, settings, true).artwork, undefined);
});

test("unknown local media uses only its display basename, never the path or a source URL", () => {
  const local = {
    ...target,
    src: {
      ...target.src,
      episode: undefined,
      meta: {
        id: "local:fixture",
        type: "movie",
        name: "C:\\test\\private.mp4",
        poster: "C:\\test\\private.jpg",
      },
    },
  };
  assert.deepEqual(lastPlaybackPresentation(local, settings, false), {
    artwork: undefined,
    title: "private.mp4",
    episode: undefined,
  });
  const movie = { ...target, src: { ...target.src, episode: undefined } };
  assert.equal(lastPlaybackPresentation(movie, settings, false).artwork, target.src.meta.poster);
});

test("small TMDB artwork uses a thumbnail while signed and other source URLs are unchanged", () => {
  const movie = {
    ...target,
    src: {
      ...target.src,
      episode: undefined,
      meta: { ...target.src.meta, poster: "https://image.tmdb.org/t/p/original/known.jpg" },
    },
  };
  assert.equal(
    lastPlaybackPresentation(movie, settings, false).artwork,
    "https://image.tmdb.org/t/p/w92/known.jpg",
  );
  assert.equal(movie.src.meta.poster, "https://image.tmdb.org/t/p/original/known.jpg");
  movie.src.meta.poster += "?signature=fixture";
  assert.equal(lastPlaybackPresentation(movie, settings, false).artwork, movie.src.meta.poster);
  movie.src.meta.name = "https://user:password@private.invalid/file";
  assert.equal(lastPlaybackPresentation(movie, settings, false).title, undefined);
});
