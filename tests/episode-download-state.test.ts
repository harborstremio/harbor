// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { episodeDownloadStatus } from "../src/lib/download/episode-download-state.ts";

test("completed downloads stay unavailable even if an older attempt failed", () => {
  assert.equal(
    episodeDownloadStatus(
      [
        { metaId: "tt1", season: 1, episode: 5, status: "error" },
        { metaId: "tt1", season: 1, episode: 5, status: "done" },
      ],
      "tt1",
      { season: 1, episode: 5 },
    ),
    "done",
  );
});

test("paused and active downloads are unavailable while failed attempts can retry", () => {
  for (const status of ["paused", "downloading", "error", "canceled", "interrupted"] as const) {
    assert.equal(
      episodeDownloadStatus([{ metaId: "tt1", season: 1, episode: 5, status }], "tt1", {
        season: 1,
        episode: 5,
      }),
      status === "paused" || status === "downloading" ? status : null,
    );
  }
});

test("known anime and IMDb identities retain their own episode numbering", () => {
  const episode = {
    season: 2,
    episode: 3,
    kitsuStreamId: "kitsu:200:3",
    imdbId: "tt1",
    imdbSeason: 2,
    imdbEpisode: 3,
  };
  assert.equal(
    episodeDownloadStatus(
      [{ metaId: "kitsu:200", season: 1, episode: 3, status: "done" }],
      "kitsu:100",
      episode,
    ),
    "done",
  );
  assert.equal(
    episodeDownloadStatus(
      [{ metaId: "tt1", season: 2, episode: 3, status: "done" }],
      "kitsu:100",
      episode,
    ),
    "done",
  );
  assert.equal(
    episodeDownloadStatus(
      [
        { metaId: "tt1", season: 1, episode: 3, status: "done" },
        { metaId: "kitsu:999", season: 1, episode: 3, status: "done" },
      ],
      "kitsu:100",
      episode,
    ),
    null,
  );
});
