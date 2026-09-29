// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  animeDownloadEpisodes,
  animeDownloadResumeTarget,
} from "../src/lib/download/anime-series.ts";
import { availableDownloadEpisodes, endsInFinalSeason } from "../src/lib/download/episode-range.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

function episode(id: number, season: number, number: number): KitsuEpisode {
  return {
    id,
    number,
    seasonNumber: 1,
    title: `Episode ${number}`,
    synopsis: "",
    thumbnail: null,
    airdate: "2021-01-01",
    length: 23,
    streamId: `kitsu:${id}:${number}`,
    sourceMetaId: `kitsu:${id}`,
    imdbSeason: season,
    imdbEpisode: number,
  };
}

test("full anime series retains all season groups and each entry's stream identity", () => {
  const seasons = [73, 12, 14].flatMap((count, index) =>
    Array.from({ length: count }, (_, offset) => ({
      episode: episode(index + 1, index + 1, offset + 1),
      season: index + 1,
      number: offset + 1,
    })),
  );
  const downloads = availableDownloadEpisodes(
    animeDownloadEpisodes(seasons, (ep) => ep.imdbSeason === 1 && ep.number <= 12, "tt123"),
  );
  assert.equal(downloads.length, 99);
  assert.deepEqual([...new Set(downloads.map((ep) => ep.season))], [1, 2, 3]);
  assert.equal(downloads[73]!.kitsuStreamId, "kitsu:2:1");
  assert.equal(downloads[73]!.imdbId, "tt123");
  assert.equal(downloads[11]!.watched, true);
  assert.equal(downloads[12]!.watched, false);
  assert.equal(endsInFinalSeason(downloads[72], downloads), false);
  assert.equal(endsInFinalSeason(downloads.at(-1), downloads), true);
});

test("display ordering does not replace canonical stream episode coordinates", () => {
  const ep = episode(2, 2, 1);
  const [download] = animeDownloadEpisodes([{ episode: ep, season: 1, number: 74 }], () => false);
  assert.equal(download!.episode, 74);
  assert.equal(download!.imdbSeason, 2);
  assert.equal(download!.imdbEpisode, 1);
  assert.equal(download!.kitsuStreamId, "kitsu:2:1");
});

test("a native resume episode follows its identity into the displayed season order", () => {
  const native = { ...episode(2, 2, 1), number: 13 };
  const entries = [
    { episode: episode(1, 1, 13), season: 1, number: 13 },
    { episode: native, season: 2, number: 1 },
  ];
  assert.deepEqual(animeDownloadResumeTarget(entries, [native], { season: 1, episode: 13 }), {
    season: 2,
    episode: 1,
  });
  assert.equal(
    animeDownloadResumeTarget(entries.slice(0, 1), [native], { season: 1, episode: 13 }),
    undefined,
  );
});
