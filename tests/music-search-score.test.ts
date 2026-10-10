// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  collapseWhitespace,
  foldArabic,
  hasArabic,
  hasCyrillic,
  normalizeName,
  normalizeTitle,
  stripDiacritics,
  stripFeatureCredit,
  stripInvisible,
  stripNoiseSuffix,
  tokenize,
  transliterateCyrillic,
} from "../src/lib/music/search-normalize.ts";
import {
  editDistance,
  nameScore,
  popularityFromCount,
  popularityFromPercent,
  RELEVANT_NAME_SCORE,
  scoreCandidate,
  scoreCandidateParts,
  similarity,
  tokenOverlap,
} from "../src/lib/music/search-score.ts";

const artist = (name: string, popularity: number, query: string) =>
  scoreCandidate({ query, name, popularity, kind: "artist" });

test("case, width and latin accents fold away", () => {
  assert.equal(normalizeName("Beyonce"), normalizeName("Beyoncé"));
  assert.equal(normalizeName("Björk"), "bjork");
  assert.equal(normalizeName("Motörhead"), "motorhead");
  assert.equal(normalizeName("ＤＥＰＥＣＨＥ Ｍｏｄｅ"), "depeche mode");
  assert.equal(
    normalizeName("Sigur Rós".normalize("NFD")),
    normalizeName("Sigur Rós".normalize("NFC")),
  );
});

test("latin letters that do not decompose still fold", () => {
  assert.equal(stripDiacritics("Straße".toLowerCase()), "strasse");
  assert.equal(stripDiacritics("bjørk"), "bjork");
  assert.equal(stripDiacritics("łódź".normalize("NFD")), "lodz");
});

test("cyrillic survives normalisation instead of being stripped", () => {
  assert.equal(normalizeName("КИНО"), "кино");
  assert.ok(hasCyrillic(normalizeName("Земфира")));
  assert.equal(normalizeName("Земфира"), "земфира");
});

test("cyrillic yo and short i fold so russian typists match either spelling", () => {
  assert.equal(normalizeName("Ёлка"), normalizeName("Елка"));
  assert.equal(normalizeName("Виктор Цой"), normalizeName("Виктор Цои"));
});

test("arabic tatweel, harakat, alef forms and ta marbuta all collapse", () => {
  assert.equal(normalizeName("أُمّ كُلْثُوم"), normalizeName("ام كلثوم"));
  assert.equal(normalizeName("امـــ كلثــوم"), normalizeName("ام كلثوم"));
  assert.equal(normalizeName("فيروزة"), normalizeName("فيروزه"));
  assert.equal(normalizeName("إسلام"), normalizeName("اسلام"));
  assert.equal(foldArabic("كلثـوم"), "كلثوم");
  assert.ok(hasArabic(normalizeName("ام كلثوم")));
});

test("arabic indic digits fold to ascii", () => {
  assert.equal(normalizeName("فيلم ٢٠٢٤"), "فيلم 2024");
  assert.equal(normalizeName("۱۹۹۵"), "1995");
});

test("invisible marks and stray whitespace never change the key", () => {
  assert.equal(normalizeName("Tee​Grizzley"), "teegrizzley");
  assert.equal(normalizeName("  Tee   Grizzley "), "tee grizzley");
  assert.equal(collapseWhitespace("  a \t b \n c "), "a b c");
  assert.equal(stripInvisible("Tee​Grizzley"), "TeeGrizzley");
  assert.equal(normalizeName("Beyoncé"), normalizeName("Beyoncé").normalize("NFC"));
});

test("punctuation, apostrophes and ampersands normalise", () => {
  assert.equal(normalizeName("Simon & Garfunkel"), normalizeName("Simon and Garfunkel"));
  assert.equal(normalizeName("Don't Stop"), "dont stop");
  assert.equal(normalizeName("Don’t Stop"), "dont stop");
  assert.equal(normalizeName("AC/DC"), "ac dc");
  assert.equal(normalizeName("Jay-Z"), "jay z");
});

test("release chrome is stripped from titles", () => {
  assert.equal(normalizeTitle("Blinding Lights (Official Video)"), "blinding lights");
  assert.equal(normalizeTitle("Blinding Lights (Official Music Video)"), "blinding lights");
  assert.equal(normalizeTitle("Song [Official Audio]"), "song");
  assert.equal(normalizeTitle("Levels - Original Mix"), "levels");
  assert.equal(normalizeTitle("Bohemian Rhapsody (Remastered 2011)"), "bohemian rhapsody");
  assert.equal(normalizeTitle("Bohemian Rhapsody - 2011 Remaster"), "bohemian rhapsody");
  assert.equal(normalizeTitle("Best of Dance 5 (Compilation Tracks)"), "best of dance 5");
});

test("featured credits are stripped, including stacked with release chrome", () => {
  assert.equal(normalizeTitle("Song (feat. Drake)"), "song");
  assert.equal(normalizeTitle("Song (ft. Drake)"), "song");
  assert.equal(normalizeTitle("Song featuring Drake"), "song");
  assert.equal(normalizeTitle("Song (feat. Drake) (Official Video)"), "song");
  assert.equal(stripFeatureCredit("Aircraft"), "Aircraft");
});

test("a title that is only chrome is left alone rather than emptied", () => {
  assert.equal(stripNoiseSuffix("(Official Video)"), "(Official Video)");
  assert.equal(stripFeatureCredit("feat. Drake"), "feat. Drake");
  assert.equal(normalizeTitle("Audio"), "audio");
});

test("words that name a different recording are kept", () => {
  assert.equal(normalizeTitle("Hotline Bling (Live)"), "hotline bling live");
  assert.equal(normalizeTitle("Hotline Bling (Remix)"), "hotline bling remix");
  assert.equal(normalizeTitle("Song (Instrumental)"), "song instrumental");
  assert.equal(normalizeTitle("(I Can't Get No) Satisfaction"), "i cant get no satisfaction");
});

test("tokenize splits normalised words and normalising twice changes nothing", () => {
  assert.deepEqual(tokenize("Simon & Garfunkel - Greatest Hits"), [
    "simon",
    "and",
    "garfunkel",
    "greatest",
    "hits",
  ]);
  assert.deepEqual(tokenize("   "), []);
  assert.deepEqual(tokenize("أُمّ كُلْثُوم"), ["ام", "كلثوم"]);
  const messy = "Ｂｅｙｏｎｃé & Jay-Z (Official Video)";
  assert.equal(normalizeName(normalizeName(messy)), normalizeName(messy));
});

test("cyrillic transliterates to latin", () => {
  assert.equal(transliterateCyrillic("кино"), "kino");
  assert.equal(transliterateCyrillic("виктор цои"), "viktor tsoi");
  assert.equal(transliterateCyrillic("kino"), "kino");
});

test("edit distance is a real levenshtein over code points", () => {
  assert.equal(editDistance("kitten", "sitting"), 3);
  assert.equal(editDistance("abc", "abc"), 0);
  assert.equal(editDistance("", "abc"), 3);
  assert.equal(editDistance("abc", ""), 3);
  assert.equal(editDistance("", ""), 0);
  assert.equal(editDistance("кино", "кину"), 1);
  assert.equal(editDistance("كلثوم", "كلثم"), 1);
});

test("edit distance is bounded and reports the bound plus one when exceeded", () => {
  assert.equal(editDistance("kitten", "sitting", 2), 3);
  assert.equal(editDistance("kitten", "sitting", 3), 3);
  assert.equal(editDistance("abc", "xyzzy", 1), 2);
  assert.equal(editDistance("abc", "abc", 0), 0);
});

test("the banded edit distance agrees with a naive levenshtein across scripts", () => {
  const naive = (a: string, b: string) => {
    const left = Array.from(a);
    const right = Array.from(b);
    const grid = Array.from({ length: left.length + 1 }, () =>
      Array.from({ length: right.length + 1 }, () => 0),
    );
    for (let row = 0; row <= left.length; row += 1) grid[row][0] = row;
    for (let column = 0; column <= right.length; column += 1) grid[0][column] = column;
    for (let row = 1; row <= left.length; row += 1) {
      for (let column = 1; column <= right.length; column += 1) {
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;
        grid[row][column] = Math.min(
          grid[row - 1][column] + 1,
          grid[row][column - 1] + 1,
          grid[row - 1][column - 1] + cost,
        );
      }
    }
    return grid[left.length][right.length];
  };
  let seed = 20260915;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pools = ["ab", "abcde", "кино вуз", "امكلثو", "abcاكи"];
  for (let trial = 0; trial < 3000; trial += 1) {
    const pool = pools[Math.floor(next() * pools.length)];
    const build = () => {
      let value = "";
      const length = Math.floor(next() * 9);
      for (let index = 0; index < length; index += 1)
        value += pool[Math.floor(next() * pool.length)];
      return value;
    };
    const left = build();
    const right = build();
    const truth = naive(left, right);
    assert.equal(editDistance(left, right), truth, `${left} vs ${right}`);
    const limit = Math.floor(next() * 7);
    const longest = Math.max(Array.from(left).length, Array.from(right).length);
    const expected = truth <= limit ? truth : Math.min(limit, longest) + 1;
    assert.equal(
      editDistance(left, right, limit),
      expected,
      `${left} vs ${right} at limit ${limit}`,
    );
  }
});

test("similarity is normalised, symmetric and bounded to 0..1", () => {
  assert.equal(similarity("Queen", "queen"), 1);
  assert.equal(similarity("Beyoncé", "beyonce"), 1);
  assert.ok(similarity("tee grizzly", "Tee Grizzley") > 0.95);
  assert.equal(
    similarity("tee grizzly", "Tee Grizzley"),
    similarity("Tee Grizzley", "tee grizzly"),
  );
  assert.ok(similarity("tee grizzly", "Drake") < 0.5);
  assert.equal(similarity("", "queen"), 0);
});

test("token overlap survives word order and rewards covering the query", () => {
  assert.equal(tokenOverlap("a b", "b a"), 1);
  assert.equal(tokenOverlap("grizzley tee", "Tee Grizzley"), 1);
  assert.ok(tokenOverlap("цой", "Виктор Цой") > 0.8);
  assert.equal(tokenOverlap("abba", "queen"), 0);
  assert.equal(tokenOverlap("", "queen"), 0);
  assert.equal(tokenOverlap("queen", ""), 0);
});

test("name score is 1 only for a normalised exact match", () => {
  assert.equal(nameScore("tee grizzly", "Tee Grizzly"), 1);
  assert.equal(nameScore("beyonce", "Beyoncé"), 1);
  assert.equal(nameScore("simon and garfunkel", "Simon & Garfunkel"), 1);
  assert.equal(nameScore("blinding lights", "Blinding Lights (Official Video)"), 1);
  assert.ok(nameScore("tee grizzly", "Tee Grizzley") < 1);
});

test("name score forgives typos", () => {
  assert.ok(nameScore("the beatls", "The Beatles") > 0.95);
  assert.ok(nameScore("bealtes", "Beatles") > 0.9);
  assert.ok(nameScore("daft punc", "Daft Punk") > 0.9);
  assert.ok(nameScore("rihana", "Rihanna") > 0.95);
  assert.ok(nameScore("the weekend", "The Weeknd") > 0.95);
});

test("name score rejects a name the user did not type", () => {
  assert.ok(nameScore("tee grizzly", "Drake") < RELEVANT_NAME_SCORE);
  assert.ok(nameScore("ام كلثوم", "فيروز") < RELEVANT_NAME_SCORE);
  assert.ok(nameScore("ماجد المهندس", "عمرو دياب") < RELEVANT_NAME_SCORE);
  assert.ok(nameScore("moscow", "Кино") < RELEVANT_NAME_SCORE);
  assert.equal(nameScore("", "Beatles"), 0);
  assert.equal(nameScore("Beatles", ""), 0);
});

test("typing the opening words of a longer name still matches", () => {
  assert.ok(nameScore("depeche mode", "Depeche Mode - Greatest Hits") > 0.85);
  assert.ok(nameScore("simon garfunkel", "Simon & Garfunkel") > 0.85);
});

test("arabic names match fuzzily as well as latin", () => {
  assert.equal(nameScore("ام كلثوم", "أُمّ كُلْثُوم"), 1);
  assert.ok(nameScore("ام كلثم", "أم كلثوم") > 0.95);
  assert.ok(nameScore("ماجد المهندس", "ماجد المهندز") > 0.95);
});

test("cyrillic names match fuzzily, and a latin spelling still finds them", () => {
  assert.equal(nameScore("кино", "Кино"), 1);
  assert.equal(nameScore("елка", "Ёлка"), 1);
  assert.ok(nameScore("земфіра", "Земфира") > 0.9);
  assert.ok(nameScore("kino", "Кино") > 0.9);
  assert.ok(nameScore("viktor tsoi", "Виктор Цой") > 0.9);
});

test("tee grizzly finds the real Tee Grizzley, not the one letter squatter", () => {
  const real = artist("Tee Grizzley", 0.95, "tee grizzly");
  const squatter = artist("Tee Grizzly", 0.05, "tee grizzly");
  assert.ok(real > squatter, `real ${real} should outrank squatter ${squatter}`);
  assert.ok(
    real - squatter > 0.1,
    "popularity must separate them decisively, not by a rounding error",
  );
});

test("popularity decides between two names equally close to the query", () => {
  const popular = artist("Tee Grizzley", 0.95, "tee grizzly");
  const unknown = artist("Tee Grizzley", 0.05, "tee grizzly");
  assert.ok(popular - unknown > 0.1);
});

test("an exact match still beats a fuzzy one at equal popularity", () => {
  assert.ok(artist("Tee Grizzly", 0.5, "tee grizzly") > artist("Tee Grizzley", 0.5, "tee grizzly"));
  assert.ok(artist("Кино", 0.5, "кино") > artist("Кинo", 0.5, "кино"));
  assert.ok(artist("أم كلثوم", 0.5, "ام كلثوم") > artist("ام كلثم", 0.5, "ام كلثوم"));
  assert.ok(artist("Tee Grizzly", 0, "tee grizzly") > artist("Tee Grizzley", 0, "tee grizzly"));
});

test("popularity cannot promote a name the user did not type", () => {
  assert.ok(artist("Tee Grizzley", 0.1, "tee grizzly") > artist("Drake", 1, "tee grizzly"));
  assert.ok(
    artist("Tee Grizzley", 0.1, "tee grizzly") > artist("Various Artists", 1, "tee grizzly"),
  );
});

test("a popular near miss outranks an exact squatter in arabic and cyrillic too", () => {
  assert.ok(
    artist("ماجد المهندز", 0.96, "ماجد المهندس") > artist("ماجد المهندس", 0.02, "ماجد المهندس"),
  );
  assert.ok(artist("Земфира", 0.93, "земфіра") > artist("Земфіра", 0.02, "земфіра"));
});

test("kind and source rank break ties only", () => {
  const track = scoreCandidate({ query: "halo", name: "Halo", popularity: 0.5, kind: "track" });
  const named = scoreCandidate({ query: "halo", name: "Halo", popularity: 0.5, kind: "artist" });
  const unknown = scoreCandidate({
    query: "halo",
    name: "Halo",
    popularity: 0.5,
    kind: "whatever",
  });
  assert.ok(track > named);
  assert.ok(named > unknown);
  const first = scoreCandidate({
    query: "halo",
    name: "Halo",
    popularity: 0.5,
    kind: "track",
    sourceRank: 0,
  });
  const later = scoreCandidate({
    query: "halo",
    name: "Halo",
    popularity: 0.5,
    kind: "track",
    sourceRank: 3,
  });
  assert.ok(first > later);
  assert.ok(first - later < 0.05, "source order must never outweigh a real signal");
  const weak = scoreCandidate({
    query: "halo",
    name: "Hello There Friend",
    popularity: 0.5,
    kind: "track",
    sourceRank: 0,
  });
  assert.ok(track > weak);
});

test("scores stay inside 0..1 for hostile input", () => {
  const cases = [
    { query: "halo", name: "Halo", popularity: 99, kind: "track" },
    { query: "halo", name: "Halo", popularity: -5, kind: "track", sourceRank: -3 },
    { query: "", name: "", kind: "track" },
    { query: "a".repeat(300), name: "b".repeat(300), kind: "album" },
  ];
  for (const input of cases) {
    const value = scoreCandidate(input);
    assert.ok(value >= 0 && value <= 1, `score ${value} out of range`);
  }
});

test("unknown popularity is treated as neutral, not as unpopular", () => {
  const unset = scoreCandidate({ query: "halo", name: "Halo", kind: "track" });
  assert.ok(unset > scoreCandidate({ query: "halo", name: "Halo", popularity: 0, kind: "track" }));
  assert.ok(unset < scoreCandidate({ query: "halo", name: "Halo", popularity: 1, kind: "track" }));
});

test("popularity helpers normalise raw source values", () => {
  assert.equal(popularityFromCount(0), 0);
  assert.equal(popularityFromCount(-5), 0);
  assert.equal(popularityFromPercent(0), 0);
  assert.equal(popularityFromPercent(100), 1);
  assert.equal(popularityFromPercent(500), 1);
  assert.ok(popularityFromCount(1000) < popularityFromCount(1000000));
  assert.ok(popularityFromCount(1e9) <= 1);
});

test("the score breakdown explains the total", () => {
  const parts = scoreCandidateParts({
    query: "tee grizzly",
    name: "Tee Grizzley",
    popularity: 0.95,
    kind: "artist",
  });
  assert.ok(parts.name > 0.95 && parts.name < 1);
  assert.equal(parts.popularity, 0.95);
  assert.equal(parts.source, 1);
  assert.ok(parts.total > 0.9);
  const reference = scoreCandidate({
    query: "tee grizzly",
    name: "Tee Grizzley",
    popularity: 0.95,
    kind: "artist",
  });
  assert.equal(parts.total, reference);
});

test("the scoring core stays pure so the node test runner can load it", () => {
  for (const file of ["search-score.ts", "search-normalize.ts"]) {
    const source = readFileSync(new URL(`../src/lib/music/${file}`, import.meta.url), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(
        specifier === "./search-normalize",
        `${file} may only import the normaliser, found ${specifier}`,
      );
    }
  }
});
