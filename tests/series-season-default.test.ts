import assert from "node:assert/strict";
import test from "node:test";
import { resumeDefaultSeason } from "../src/lib/episode-progress";

const SEASONS = [
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 10 },
  { seasonNumber: 3, episodeCount: 10 },
];

/** Mirrors the scoping series-episodes.tsx applies before resumeDefaultSeason sees Trakt keys. */
function scopedTraktKeys(account: Iterable<string>, imdbId: string | null, metaId: string): string[] {
  const mine = new Set<string>();
  if (imdbId) mine.add(`imdb:${imdbId}`);
  const tmdb = /^tmdb:(\d+)/.exec(metaId)?.[1];
  if (tmdb) mine.add(`tmdb:${tmdb}`);
  const out: string[] = [];
  for (const key of account) {
    const end = key.lastIndexOf(":");
    const start = end > 0 ? key.lastIndexOf(":", end - 1) : -1;
    if (start < 0) continue;
    if (!mine.has(key.slice(0, start))) continue;
    out.push(key.slice(start + 1));
  }
  return out;
}

test("a show nobody has watched opens on its first season", () => {
  assert.equal(resumeDefaultSeason("tt0000001", SEASONS, new Set()), 1);
});

test("another show's history cannot decide this show's season", () => {
  const account = ["imdb:tt9999999:2:1", "imdb:tt9999999:3:4", "tmdb:55555:2:2"];
  const scoped = scopedTraktKeys(account, "tt0000001", "tt0000001");
  assert.deepEqual(scoped, [], "no key belongs to this series");
  assert.equal(resumeDefaultSeason("tt0000001", SEASONS, new Set(scoped)), 1);
});

test("this show's own history still selects the season being watched", () => {
  const account = ["imdb:tt9999999:3:4", "imdb:tt0000001:2:1"];
  const scoped = scopedTraktKeys(account, "tt0000001", "tt0000001");
  assert.deepEqual(scoped, ["2:1"]);
  assert.equal(resumeDefaultSeason("tt0000001", SEASONS, new Set(scoped)), 2);
});

test("a tmdb-identified series matches its own tmdb keys only", () => {
  const account = ["tmdb:12345:2:1", "tmdb:67890:3:1"];
  assert.deepEqual(scopedTraktKeys(account, null, "tmdb:12345"), ["2:1"]);
  assert.deepEqual(scopedTraktKeys(account, null, "tmdb:67890"), ["3:1"]);
});

test("a finished season advances to the next one, for this show only", () => {
  const own = new Set(Array.from({ length: 10 }, (_, i) => `1:${i + 1}`));
  assert.equal(resumeDefaultSeason("tt0000001", SEASONS, own), 2);
});

test("a movie key carries no season and is discarded rather than misread", () => {
  assert.deepEqual(scopedTraktKeys(["imdb:tt0000001"], "tt0000001", "tt0000001"), []);
});
