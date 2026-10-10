// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { localGroupKey, localTitleKey } from "../src/lib/local-library/group-key.ts";
import type { LocalEntry } from "../src/lib/local-library.ts";

function entry(over: Partial<LocalEntry> = {}): LocalEntry {
  return {
    id: "local-x",
    path: "/movies/x.mkv",
    filename: "x.mkv",
    title: "The Thing",
    year: 1982,
    type: "movie",
    addedAt: 0,
    ...over,
  };
}

test("two files of the same movie share a group key via tmdb id", () => {
  const bluray = entry({
    path: "/a/The.Thing.1982.1080p.BluRay.x264.mkv",
    filename: "The.Thing.1982.1080p.BluRay.x264.mkv",
    tmdbId: 1091,
  });
  const remux = entry({
    path: "/b/The.Thing.1982.2160p.UHD.BluRay.REMUX.HDR.mkv",
    filename: "The.Thing.1982.2160p.UHD.BluRay.REMUX.HDR.mkv",
    tmdbId: 1091,
  });
  assert.equal(localGroupKey(bluray), localGroupKey(remux));
  assert.equal(localGroupKey(bluray), "tmdb:movie:1091");
});

test("imdb id groups files when no tmdb id is present", () => {
  const a = entry({ path: "/a/a.mkv", imdbId: "tt0084787" });
  const b = entry({ path: "/b/b.mkv", imdbId: "tt0084787", title: "The Thing (1982)" });
  assert.equal(localGroupKey(a), localGroupKey(b));
  assert.equal(localGroupKey(a), "tt0084787");
});

test("unidentified files fall back to normalized title and year", () => {
  const a = entry({ path: "/a/a.mkv", title: "The Thing" });
  const b = entry({ path: "/b/b.mkv", title: "the  thing." });
  assert.equal(localGroupKey(a), localGroupKey(b));
  assert.equal(localGroupKey(a), "title:movie:thething:1982");
});

test("a remake with a different year is not merged", () => {
  const original = entry({ title: "The Thing", year: 1982 });
  const remake = entry({ path: "/b/b.mkv", title: "The Thing", year: 2011 });
  assert.notEqual(localGroupKey(original), localGroupKey(remake));
});

test("a movie and a show with the same title do not merge", () => {
  const movie = entry({ title: "Fargo", year: 1996 });
  const show = entry({ path: "/b/b.mkv", title: "Fargo", year: 1996, type: "show" });
  assert.notEqual(localTitleKey(movie), localTitleKey(show));
});

test("episodes group per episode, not per series", () => {
  const s1e1a = entry({ type: "show", tmdbId: 60622, season: 1, episode: 1 });
  const s1e1b = entry({ path: "/b/b.mkv", type: "show", tmdbId: 60622, season: 1, episode: 1 });
  const s1e2 = entry({ path: "/c/c.mkv", type: "show", tmdbId: 60622, season: 1, episode: 2 });
  assert.equal(localGroupKey(s1e1a), localGroupKey(s1e1b));
  assert.notEqual(localGroupKey(s1e1a), localGroupKey(s1e2));
  assert.equal(localGroupKey(s1e1a), "tmdb:tv:60622:s1e1");
});

test("a missing year still groups identical titles together", () => {
  const a = entry({ title: "Some Rip", year: null });
  const b = entry({ path: "/b/b.mkv", title: "Some Rip", year: null });
  assert.equal(localGroupKey(a), localGroupKey(b));
  assert.equal(localGroupKey(a), "title:movie:somerip:?");
});
