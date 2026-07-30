import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMinRating,
  MIN_VOTES_MOVIE,
  MIN_VOTES_TV,
  rankByRating,
  ratingPrior,
  sortFilmography,
  weightedRating,
} from "../src/views/person/filmography-rank.ts";
import type { PersonCredit } from "../src/lib/providers/tmdb/tmdb-people.ts";

function credit(over: Partial<PersonCredit> & { title: string }): PersonCredit {
  return {
    id: Math.abs(hash(over.title)),
    mediaType: "movie",
    popularity: 1,
    voteCount: 0,
    voteAverage: 0,
    ...over,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const classic = credit({ title: "Classic", voteAverage: 8.4, voteCount: 50000 });
const fluke = credit({ title: "Fluke", voteAverage: 9.8, voteCount: 6 });

test("the vote floor excludes thinly voted titles entirely", () => {
  const ranked = rankByRating([classic, fluke], 10);
  assert.deepEqual(
    ranked.map((c) => c.title),
    ["Classic"],
  );
});

test("a 9.8 from 6 votes never outranks an 8.4 from 50k", () => {
  assert.deepEqual(
    rankByRating([fluke, classic], 10).map((c) => c.title),
    ["Classic"],
  );
  assert.deepEqual(
    sortFilmography([fluke, classic], "rating").map((c) => c.title),
    ["Classic", "Fluke"],
  );
  assert.deepEqual(
    applyMinRating([fluke, classic], 8).map((c) => c.title),
    ["Classic"],
  );
});

test("above the floor, a barely qualifying high rating loses to a massively voted one", () => {
  const boutique = credit({ title: "Boutique", voteAverage: 8.6, voteCount: MIN_VOTES_MOVIE });
  const blockbuster = credit({ title: "Blockbuster", voteAverage: 8.4, voteCount: 400000 });
  const ordinary = [
    credit({ title: "Ordinary A", voteAverage: 6.1, voteCount: 8000 }),
    credit({ title: "Ordinary B", voteAverage: 5.8, voteCount: 12000 }),
    credit({ title: "Ordinary C", voteAverage: 6.4, voteCount: 30000 }),
    credit({ title: "Ordinary D", voteAverage: 6.9, voteCount: 22000 }),
    credit({ title: "Ordinary E", voteAverage: 5.5, voteCount: 9000 }),
  ];
  const ranked = rankByRating([boutique, blockbuster, ...ordinary], 10);
  assert.deepEqual(ranked.slice(0, 2).map((c) => c.title), ["Blockbuster", "Boutique"]);
});

test("the prior is not inflated by a swarm of thinly voted outliers", () => {
  const heavy = credit({ title: "Heavy", voteAverage: 7, voteCount: 100000 });
  const swarm = Array.from({ length: 40 }, (_, i) =>
    credit({ title: `Thin ${i}`, voteAverage: 9.9, voteCount: 3 }),
  );
  const prior = ratingPrior([heavy, ...swarm]);
  assert.ok(prior < 7.05, `vote-weighted prior stayed near the evidence, got ${prior}`);
});

test("a title sitting exactly on the floor is admitted, one vote short is not", () => {
  const onFloor = credit({ title: "On Floor", voteAverage: 7, voteCount: MIN_VOTES_MOVIE });
  const under = credit({ title: "Under", voteAverage: 7, voteCount: MIN_VOTES_MOVIE - 1 });
  assert.deepEqual(
    rankByRating([onFloor, under], 10).map((c) => c.title),
    ["On Floor"],
  );
});

test("TV clears at the lower floor that would fail as a movie", () => {
  const show = credit({ title: "Show", mediaType: "tv", voteAverage: 8, voteCount: MIN_VOTES_TV });
  const film = credit({ title: "Film", voteAverage: 8, voteCount: MIN_VOTES_TV });
  assert.deepEqual(
    rankByRating([show, film], 10).map((c) => c.title),
    ["Show"],
  );
});

test("equal ratings break toward the better established title", () => {
  const many = credit({ title: "Many Votes", voteAverage: 8, voteCount: 40000 });
  const few = credit({ title: "Few Votes", voteAverage: 8, voteCount: 250 });
  assert.deepEqual(
    rankByRating([few, many], 10).map((c) => c.title),
    ["Many Votes", "Few Votes"],
  );
});

test("identical rating and vote count fall back to a stable title order", () => {
  const b = credit({ title: "Beta", voteAverage: 8, voteCount: 5000 });
  const a = credit({ title: "Alpha", voteAverage: 8, voteCount: 5000 });
  assert.deepEqual(
    rankByRating([b, a], 10).map((c) => c.title),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(
    rankByRating([a, b], 10).map((c) => c.title),
    ["Alpha", "Beta"],
  );
});

test("empty input returns empty", () => {
  assert.deepEqual(rankByRating([], 10), []);
  assert.deepEqual(applyMinRating([], 7), []);
  assert.deepEqual(sortFilmography([], "rating"), []);
  assert.equal(ratingPrior([]), 0);
});

test("an entire filmography under the floor yields no ranking at all", () => {
  const thin = [
    credit({ title: "One", voteAverage: 10, voteCount: 1 }),
    credit({ title: "Two", voteAverage: 9.5, voteCount: 3 }),
    credit({ title: "Three", voteAverage: 0, voteCount: 0 }),
  ];
  assert.deepEqual(rankByRating(thin, 12), []);
});

test("the limit caps the result", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    credit({ title: `T${i}`, voteAverage: 7 + (i % 3), voteCount: 1000 + i }),
  );
  assert.equal(rankByRating(many, 12).length, 12);
});

test("rating sort keeps every credit but sinks the unproven ones", () => {
  const all = [fluke, classic, credit({ title: "Mid", voteAverage: 7.2, voteCount: 900 })];
  const sorted = sortFilmography(all, "rating");
  assert.equal(sorted.length, 3, "sorting must not drop credits");
  assert.deepEqual(
    sorted.map((c) => c.title),
    ["Classic", "Mid", "Fluke"],
  );
});

test("popularity sort is untouched by the rating work", () => {
  const a = credit({ title: "A", popularity: 5, voteAverage: 9, voteCount: 90000 });
  const b = credit({ title: "B", popularity: 90, voteAverage: 4, voteCount: 10 });
  assert.deepEqual(
    sortFilmography([a, b], "popularity").map((c) => c.title),
    ["B", "A"],
  );
});

test("popularity sort leaves an already popularity-ordered list untouched", () => {
  const list = [
    credit({ title: "A", popularity: 90 }),
    credit({ title: "B", popularity: 40, voteAverage: 9.1, voteCount: 90000 }),
    credit({ title: "C", popularity: 40, voteAverage: 4.0, voteCount: 90000 }),
    credit({ title: "D", popularity: 40 }),
    credit({ title: "E", popularity: 1 }),
  ];
  assert.deepEqual(
    sortFilmography(list, "popularity").map((c) => c.title),
    ["A", "B", "C", "D", "E"],
    "ties must keep their incoming order",
  );
});

test("newest sort orders by year and tolerates missing dates", () => {
  const old = credit({ title: "Old", releaseDate: "1994-09-23" });
  const recent = credit({ title: "Recent", releaseDate: "2021-01-05" });
  const undated = credit({ title: "Undated" });
  assert.deepEqual(
    sortFilmography([old, undated, recent], "newest").map((c) => c.title),
    ["Recent", "Old", "Undated"],
  );
});

test("min rating filter demands the vote floor too", () => {
  const kept = credit({ title: "Kept", voteAverage: 7.5, voteCount: 4000 });
  const pretender = credit({ title: "Pretender", voteAverage: 9.9, voteCount: 4 });
  assert.deepEqual(
    applyMinRating([kept, pretender], 7).map((c) => c.title),
    ["Kept"],
  );
});

test("min rating of zero is a passthrough", () => {
  const all = [classic, fluke];
  assert.equal(applyMinRating(all, 0).length, 2);
});

test("ranking does not mutate its input", () => {
  const input = [fluke, classic];
  const snapshot = input.map((c) => c.title);
  rankByRating(input, 10);
  sortFilmography(input, "rating");
  assert.deepEqual(
    input.map((c) => c.title),
    snapshot,
  );
});
