import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQueryLadder,
  hasSearchResults,
  queryLadder,
  runQueryLadder,
  type MusicQueryIntent,
} from "../src/lib/music/search-fallback";

const stub = {
  clean: (text: string) =>
    text
      .replace(/\s*[([][^)\]]*[)\]]\s*/gu, " ")
      .replace(/\s+/gu, " ")
      .trim(),
  key: (text: string) =>
    text
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
};

const PLAYING: MusicQueryIntent = {
  title: "Castle in the Sky",
  artist: "Dj Satomi",
  album: "Best of Dance 5 (Compilation Tracks)",
};

const ARABIC = /\p{Script=Arabic}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const INVISIBLE = /[\p{Cf}]/u;
const mark = (code: number) => String.fromCharCode(code);

const at = (ladder: string[], query: string) => ladder.indexOf(query);

test("the song that started this never runs out of rungs", () => {
  const ladder = buildQueryLadder(PLAYING, stub);
  assert.equal(
    ladder[0],
    "Best of Dance 5 (Compilation Tracks) Dj Satomi",
    "the original query still goes first",
  );
  assert.ok(
    at(ladder, "Castle in the Sky Dj Satomi") > 0,
    "title plus artist must be on the ladder",
  );
  assert.ok(at(ladder, "Dj Satomi") > 0, "artist alone must be on the ladder");
  assert.ok(
    at(ladder, "Castle in the Sky Dj Satomi") < at(ladder, "Dj Satomi"),
    "the recording is tried before the whole artist",
  );
  assert.equal(ladder.at(-1), "Dj Satomi", "artist alone is the floor, never the opener");
});

test("compilation noise is stripped into its own rung without losing the raw one", () => {
  const ladder = buildQueryLadder(PLAYING, stub);
  assert.ok(ladder.includes("Best of Dance 5 Dj Satomi"), "the de-noised album is tried too");
  assert.ok(ladder.includes("Best of Dance 5"), "the album alone is tried");
});

test("every rung is usable and distinct", () => {
  for (const intent of [
    PLAYING,
    { title: "Castle in the Sky", artist: "Dj Satomi", album: "Castle in the Sky" },
    { title: " Song ", artist: "Band", album: "Song (Deluxe Edition)" },
  ]) {
    const ladder = buildQueryLadder(intent, stub);
    assert.equal(
      new Set(ladder).size,
      ladder.length,
      "duplicate rung in " + JSON.stringify(ladder),
    );
    for (const rung of ladder) assert.equal(rung, rung.trim(), "rungs are trimmed");
    assert.ok(ladder.every(Boolean), "no blank rung");
  }
});

test("specific rungs are exhausted before broadened ones", () => {
  const rungs = queryLadder(PLAYING, stub);
  const lastExact = rungs.map((rung) => rung.exact).lastIndexOf(true);
  const firstBroad = rungs.findIndex((rung) => !rung.exact);
  assert.ok(
    lastExact >= 0 && firstBroad > lastExact,
    "an artist-pinned rung must never follow a broadened one",
  );
  assert.deepEqual(
    rungs.map((rung) => rung.kind),
    ["album", "album", "song", "song", "album", "artist"],
    "album intent leads, the recording rescues it, the artist is the floor",
  );
});

test("a single field still produces a ladder", () => {
  assert.deepEqual(buildQueryLadder({ title: "Castle in the Sky" }, stub), ["Castle in the Sky"]);
  assert.deepEqual(buildQueryLadder({ artist: "Dj Satomi" }, stub), ["Dj Satomi"]);
  assert.deepEqual(buildQueryLadder({ album: "Best of Dance 5 (Compilation Tracks)" }, stub), [
    "Best of Dance 5 (Compilation Tracks)",
    "Best of Dance 5",
  ]);
});

test("nothing in, nothing out", () => {
  assert.deepEqual(buildQueryLadder({}, stub), []);
  assert.deepEqual(buildQueryLadder({ title: "   ", artist: "", album: "  " }, stub), []);
});

test("a placeholder credit is dropped, unless it is the only thing we know", () => {
  const ladder = buildQueryLadder(
    { title: "Castle in the Sky", artist: "Various Artists", album: "Best of Dance 5" },
    stub,
  );
  assert.ok(
    !ladder.some((rung) => /various/i.test(rung)),
    "placeholder leaked into " + JSON.stringify(ladder),
  );
  assert.ok(ladder.includes("Castle in the Sky"), "the recording is still reachable");
  assert.deepEqual(buildQueryLadder({ artist: "Unknown Artist" }, stub), ["Unknown Artist"]);
});

test("a title that is nothing but noise keeps its raw form rather than vanishing", () => {
  const ladder = buildQueryLadder({ title: "(Live)", artist: "Kino" }, stub);
  assert.ok(ladder.includes("(Live) Kino"), "expected the raw pair in " + JSON.stringify(ladder));
  assert.ok(ladder.includes("Kino"));
});

test("the runner reports which rung actually found something", async () => {
  const seen: string[] = [];
  const outcome = await runQueryLadder(buildQueryLadder(PLAYING, stub), async (query) => {
    seen.push(query);
    return query === "Castle in the Sky Dj Satomi" ? ["a track"] : [];
  });
  assert.equal(outcome.query, "Castle in the Sky Dj Satomi");
  assert.equal(outcome.index, 2);
  assert.deepEqual(outcome.results, ["a track"]);
  assert.deepEqual(outcome.tried, seen, "tried is the rungs actually requested, in order");
  assert.equal(seen.length, 3, "the ladder stops at the first hit instead of querying every rung");
});

test("a rung that throws does not end the ladder", async () => {
  const outcome = await runQueryLadder(["one", "two", "three"], async (query) => {
    if (query !== "three") throw new Error(query + " exploded");
    return ["found"];
  });
  assert.equal(outcome.query, "three");
  assert.equal(outcome.index, 2);
  assert.deepEqual(
    outcome.errors.map((entry) => entry.query),
    ["one", "two"],
  );
});

test("an exhausted ladder says so instead of pretending", async () => {
  const outcome = await runQueryLadder(["one", "two"], async () => []);
  assert.equal(outcome.query, null);
  assert.equal(outcome.index, -1);
  assert.equal(outcome.results, null);
  assert.deepEqual(outcome.tried, ["one", "two"]);
});

test("a stale search stops climbing", async () => {
  let calls = 0;
  const outcome = await runQueryLadder(
    ["one", "two", "three"],
    async () => {
      calls += 1;
      return [];
    },
    { cancelled: () => calls >= 1 },
  );
  assert.equal(calls, 1);
  assert.equal(outcome.query, null);
});

test("emptiness is judged the way a music search result is shaped", () => {
  const blank = { top: undefined, tracks: [], albums: [], artists: [], playlists: [] };
  assert.equal(hasSearchResults(blank), false);
  assert.equal(hasSearchResults({ ...blank, artists: [{ id: "a" }] }), true);
  assert.equal(hasSearchResults({ ...blank, top: { id: "a" } }), true);
  assert.equal(hasSearchResults([]), false);
  assert.equal(hasSearchResults(null), false);
  assert.equal(hasSearchResults(undefined), false);
  assert.equal(hasSearchResults({}), false);
});

test("the default runner treats an all-empty result page as no results", async () => {
  const blank = { tracks: [], albums: [], artists: [], playlists: [] };
  const outcome = await runQueryLadder(["one", "two"], async (query) =>
    query === "two" ? { ...blank, tracks: [{ id: "t" }] } : blank,
  );
  assert.equal(outcome.query, "two");
});

test("arabic and cyrillic intents keep their own script in every rung", () => {
  const arabic = buildQueryLadder(
    { title: "قصر في السماء", artist: "دي جي ساتومي", album: "أفضل الرقص (تجميعة)" },
    stub,
  );
  assert.ok(arabic.length >= 5, "expected a full arabic ladder, got " + JSON.stringify(arabic));
  assert.ok(
    arabic.every((rung) => ARABIC.test(rung)),
    "arabic rungs must stay arabic",
  );
  assert.ok(arabic.includes("قصر في السماء دي جي ساتومي"), "title plus artist must survive");
  assert.ok(arabic.includes("دي جي ساتومي"), "artist alone must survive");

  const cyrillic = buildQueryLadder(
    { title: "Группа крови", artist: "Кино", album: "Лучшее (Сборник)" },
    stub,
  );
  assert.ok(
    cyrillic.every((rung) => CYRILLIC.test(rung)),
    "cyrillic rungs must stay cyrillic",
  );
  assert.ok(cyrillic.includes("Группа крови Кино"));
  assert.ok(cyrillic.includes("Кино"));
});

test("invisible bidi marks in provider metadata do not reach the query", () => {
  const ladder = buildQueryLadder(
    { title: mark(0x200f) + "قصر" + mark(0x200e) + " في السماء", artist: "كينو" + mark(0x200b) },
    stub,
  );
  assert.ok(
    ladder.every((rung) => !INVISIBLE.test(rung)),
    JSON.stringify(ladder),
  );
  assert.ok(ladder.includes("قصر في السماء كينو"));
});

test("the shared normalizer, not this module, decides what counts as noise", () => {
  const ladder = buildQueryLadder(PLAYING);
  assert.ok(ladder.length > 0, "the real normalizer must still yield a ladder");
  assert.equal(ladder[0], "Best of Dance 5 (Compilation Tracks) Dj Satomi");
  assert.ok(
    ladder.includes("Castle in the Sky Dj Satomi") && ladder.includes("Dj Satomi"),
    "title plus artist and artist alone are required, got " + JSON.stringify(ladder),
  );
  assert.ok(
    !ladder.slice(1).some((rung) => /compilation/i.test(rung)),
    "compilation noise survived search-normalize: " + JSON.stringify(ladder),
  );
});

test("the real normalizer collapses case and diacritic variants into one rung", () => {
  const plain = buildQueryLadder({ artist: "Кино", title: "Группа крови" });
  const shouty = buildQueryLadder({ artist: "КИНО", title: "ГРУППА КРОВИ" });
  assert.equal(plain.length, shouty.length, "case alone must not change the shape of the ladder");
  const arabic = buildQueryLadder({ title: "الدَّم المشروك", artist: "كينو" });
  assert.equal(
    new Set(arabic).size,
    arabic.length,
    "harakat produced a duplicate rung: " + JSON.stringify(arabic),
  );
});
