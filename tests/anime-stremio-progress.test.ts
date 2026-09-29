// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import { animeResumePoint } from "../src/lib/anime-resume.ts";
import {
  chooseWatchedLibraryItem,
  canonicalizeAnimeWatchedKeys,
  decodeWatchedEpisodes,
  encodeWatchedEpisodes,
  watchedAnchorOffset,
  watchedAnchorVideoId,
} from "../src/lib/stremio-watched.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";
import type { LibraryItem } from "../src/lib/stremio.ts";

Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  configurable: true,
});
const { getEpisodeProgress } = await import("../src/lib/episode-progress.ts");

const episodes = [
  {
    id: 10,
    number: 1,
    seasonNumber: 1,
    title: "Episode 1",
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: 23,
    streamId: "kitsu:series:1:1",
    imdbSeason: 1,
    imdbEpisode: 1,
  },
  {
    id: 11,
    number: 13,
    seasonNumber: 1,
    title: "Episode 13",
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: 23,
    streamId: "kitsu:series:1:13",
    imdbSeason: 2,
    imdbEpisode: 1,
  },
] satisfies KitsuEpisode[];

test("Stremio watched keys use the episode's canonical coordinates", () => {
  const watched = getEpisodeProgress(
    "kitsu:series",
    1,
    13,
    23,
    "tt1234567",
    new Set(),
    new Set(["2:1"]),
    undefined,
    undefined,
    undefined,
    2,
    1,
  );
  assert.equal(watched.watched, true);

  const displaySeasonCollision = getEpisodeProgress(
    "kitsu:sequel",
    1,
    1,
    23,
    "tt1234567",
    new Set(),
    new Set(["1:1"]),
    undefined,
    undefined,
    undefined,
    2,
    1,
  );
  assert.equal(displaySeasonCollision.watched, false);
});

test("anime resume resolves exact video IDs and IMDb coordinates to Kitsu episodes", () => {
  assert.deepEqual(animeResumePoint({ video_id: "kitsu:series:1:13" }, "kitsu:series", episodes), {
    season: 1,
    episode: 13,
  });
  assert.deepEqual(animeResumePoint({ season: 2, episode: 1 }, "tt1234567", episodes), {
    season: 1,
    episode: 13,
  });
  assert.deepEqual(animeResumePoint({ video_id: "kitsu:series:13" }, "kitsu:series", episodes), {
    season: 1,
    episode: 13,
  });
  assert.equal(animeResumePoint({ video_id: "kitsu:999:12" }, "kitsu:999", episodes), null);
  assert.deepEqual(animeResumePoint({ season: 3, episode: 4 }, "tt1234567", episodes), {
    season: 3,
    episode: 4,
  });
});

test("library lookup selection skips an empty IMDb alias for canonical anime progress", () => {
  const emptyImdb = {
    _id: "tt1234567",
    type: "series",
    name: "Example",
    removed: false,
    temp: false,
    _ctime: "2026-01-01",
    _mtime: "2026-01-01",
  } as LibraryItem;
  const watchedKitsu = {
    ...emptyImdb,
    _id: "kitsu:123",
    _mtime: "2026-01-02",
    state: { timeOffset: 0, duration: 1380000, watched: "kitsu:123:1:13:1:AA==" },
  } as LibraryItem;
  assert.equal(chooseWatchedLibraryItem([emptyImdb, watchedKitsu], "tt1234567")?._id, "kitsu:123");
});

test("newer watched progress wins over a stale preferred IMDb alias", () => {
  const stalePreferred = {
    _id: "tt1234567",
    type: "series",
    name: "Example",
    removed: false,
    temp: false,
    _ctime: "2026-01-01",
    _mtime: "2026-01-01",
    state: { timeOffset: 500, duration: 1000, watched: "old" },
  } as LibraryItem;
  const recentCanonical = {
    ...stalePreferred,
    _id: "kitsu:123",
    _mtime: "2026-01-02",
    state: { timeOffset: 100, duration: 1000, watched: "new" },
  } as LibraryItem;
  assert.equal(
    chooseWatchedLibraryItem([stalePreferred, recentCanonical], "tt1234567")?._id,
    "kitsu:123",
  );
});

test("watched bitfields reject a missing anchor instead of shifting episode bits", () => {
  const videos = [
    { id: "show:1:1", season: 1, episode: 1 },
    { id: "show:1:2", season: 1, episode: 2 },
  ];
  assert.equal(watchedAnchorOffset(videos, "show:1:2", 2), 0);
  assert.equal(watchedAnchorOffset(videos, "alias:1:2", 2), null);
  assert.equal(watchedAnchorVideoId("show:1:2:2:AA=="), "show:1:2");
});

test("Kitsu bitfields decode against their original video IDs and reject IMDb aliases", async () => {
  const videos = [
    { id: "kitsu:123:1:1", season: 1, episode: 1, imdbSeason: 1, imdbEpisode: 1 },
    { id: "kitsu:123:1:13", season: 1, episode: 13, imdbSeason: 2, imdbEpisode: 1 },
  ];
  const field = await encodeWatchedEpisodes(new Set(["1:13"]), videos);
  assert.ok(field);
  const decoded = await decodeWatchedEpisodes(field, videos);
  assert.deepEqual(decoded, new Set(["1:13"]));
  assert.deepEqual(canonicalizeAnimeWatchedKeys(decoded, videos), new Set(["2:1"]));
  assert.deepEqual(
    canonicalizeAnimeWatchedKeys(
      new Set(["1:13"]),
      [{ id: "kitsu:123:1:13", season: 1, episode: 13 }],
      [{ streamId: "kitsu:123:1:13", imdbSeason: 3, imdbEpisode: 1 }],
    ),
    new Set(["3:1"]),
  );
  assert.deepEqual(
    await decodeWatchedEpisodes(field, [
      { id: "tt1234567:1:1", season: 1, episode: 1 },
      { id: "tt1234567:2:1", season: 2, episode: 1 },
    ]),
    new Set(),
  );
});
