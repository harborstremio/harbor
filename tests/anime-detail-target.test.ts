// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { resolveAnimeDetailTarget } from "../src/views/detail/anime-episodes/anime-season-key.ts";
import type { Meta } from "../src/lib/cinemeta.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

function meta(id: string, name = "Entry"): Meta {
  return { id, type: "series", name } as Meta;
}

function ep(over: Partial<KitsuEpisode>): KitsuEpisode {
  return {
    id: 1,
    number: 1,
    seasonNumber: 1,
    title: "Ep",
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: null,
    ...over,
  };
}

test("tt-capable multi-season episode resolves to canonical imdb coordinates", () => {
  const e = ep({ id: 10, number: 1, seasonNumber: 1, imdbSeason: 3, imdbEpisode: 13, imdbId: "tt2560140" });
  const parent = meta("kitsu:11450", "Parent");
  const entry = meta("kitsu:11451", "Season 3 Part 2");
  const t = resolveAnimeDetailTarget(e, parent, entry);
  assert.equal(t.seriesId, "tt2560140");
  assert.equal(t.season, 3);
  assert.equal(t.episode, 13);
  assert.equal(t.seriesMeta.id, parent.id);
  assert.equal(t.playback.meta.id, entry.id);
});

test("parent tt id is used when the episode carries no imdbId", () => {
  const e = ep({ id: 11, number: 5, seasonNumber: 1, imdbSeason: 2, imdbEpisode: 5 });
  const t = resolveAnimeDetailTarget(e, meta("tt1234567"), meta("kitsu:999", "S2 entry"));
  assert.equal(t.seriesId, "tt1234567");
  assert.equal(t.season, 2);
  assert.equal(t.episode, 5);
  assert.equal(t.seriesMeta.id, "tt1234567");
  assert.equal(t.playback.meta.id, "kitsu:999");
});

test("pure kitsu entries keep Kitsu numbering for the videos lookup", () => {
  const e = ep({ id: 12, number: 1, seasonNumber: 1, imdbSeason: 3, imdbEpisode: 13 });
  const t = resolveAnimeDetailTarget(e, meta("kitsu:11450"), meta("kitsu:11451", "S3P2"));
  assert.equal(t.seriesId, "kitsu:11451");
  assert.equal(t.season, 1);
  assert.equal(t.episode, 1);
});

test("specials stay on season 0 on both paths", () => {
  const e = ep({ id: 13, number: 2, seasonNumber: 0, imdbSeason: 0, imdbEpisode: 2, imdbId: "tt2560140" });
  const canon = resolveAnimeDetailTarget(e, meta("kitsu:1"), meta("kitsu:2"));
  assert.equal(canon.season, 0);
  assert.equal(canon.episode, 2);
  const pure = resolveAnimeDetailTarget(
    ep({ id: 14, number: 2, seasonNumber: 0, imdbSeason: 0, imdbEpisode: 2 }),
    meta("kitsu:1"),
    meta("kitsu:2"),
  );
  assert.equal(pure.season, 0);
  assert.equal(pure.episode, 2);
});

test("missing imdb mapping falls back to Kitsu coordinates", () => {
  const e = ep({ id: 15, number: 7, seasonNumber: 1 });
  const t = resolveAnimeDetailTarget(e, meta("kitsu:100"), meta("kitsu:101"));
  assert.equal(t.seriesId, "kitsu:101");
  assert.equal(t.season, 1);
  assert.equal(t.episode, 7);
});

test("long-running absolute numbers are preserved by callers (detail uses season-relative only)", () => {
  const e = ep({ id: 16, number: 1089, seasonNumber: 1, imdbSeason: 21, imdbEpisode: 45, imdbId: "tt0388629" });
  const t = resolveAnimeDetailTarget(e, meta("kitsu:11243", "One Piece"), meta("kitsu:11243", "One Piece"));
  assert.equal(t.season, 21);
  assert.equal(t.episode, 45);
  assert.equal(e.number, 1089);
  assert.equal(t.playback.episode.episode, 1089);
  assert.equal(t.playback.episode.absoluteNumber, 1089);
});

test("an unmapped cour never borrows its parent's canonical episode numbers", () => {
  for (const mapping of [{}, { imdbSeason: 3 }, { imdbEpisode: 13 }]) {
    const t = resolveAnimeDetailTarget(ep({ number: 1, ...mapping }), meta("tt2560140"), meta("kitsu:part2"));
    assert.equal(t.seriesId, "kitsu:part2");
    assert.equal(t.season, 1);
    assert.equal(t.episode, 1);
  }
});

test("a different franchise entry's own canonical ID wins over the parent", () => {
  const t = resolveAnimeDetailTarget(
    ep({ imdbSeason: 1, imdbEpisode: 1 }), meta("tt111"), meta("tt222"),
  );
  assert.equal(t.seriesId, "tt222");
  assert.equal(t.playback.meta.id, "tt222");
  assert.equal(t.seriesMeta.id, "tt111");
});
