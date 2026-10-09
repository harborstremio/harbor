import assert from "node:assert/strict";
import test from "node:test";
import {
  artistTally,
  dayPart,
  forgottenFavourites,
  normalizeArtist,
  seasonalMoment,
} from "../src/lib/music/listening-habits";

const track = (id: string, artist: string) =>
  ({ id, artist, title: id, connectorId: "x" }) as never;

test("october lands on the spooky season, november does not", () => {
  assert.equal(seasonalMoment(new Date(2026, 9, 1))?.id, "spooky");
  assert.equal(seasonalMoment(new Date(2026, 9, 31))?.id, "spooky");
  assert.equal(seasonalMoment(new Date(2026, 10, 1))?.id, "spooky");
  assert.equal(seasonalMoment(new Date(2026, 10, 10))?.id, "autumn");
});

test("every day of the year resolves to exactly one season", () => {
  for (let month = 0; month < 12; month += 1) {
    const days = new Date(2026, month + 1, 0).getDate();
    for (let day = 1; day <= days; day += 1) {
      const found = seasonalMoment(new Date(2026, month, day));
      assert.ok(found, `${month + 1}/${day} has no season`);
    }
  }
});

test("the dated holidays win over the broad season they sit inside", () => {
  assert.equal(seasonalMoment(new Date(2026, 11, 26))?.id, "festive");
  assert.equal(seasonalMoment(new Date(2026, 0, 3))?.id, "newYear");
  assert.equal(seasonalMoment(new Date(2026, 1, 14))?.id, "valentines");
  assert.equal(seasonalMoment(new Date(2026, 1, 20))?.id, "winter");
});

test("the clock picks the part of day, and midnight is late night", () => {
  assert.equal(dayPart(new Date(2026, 0, 1, 0, 30)).id, "lateNight");
  assert.equal(dayPart(new Date(2026, 0, 1, 8, 0)).id, "morning");
  assert.equal(dayPart(new Date(2026, 0, 1, 14, 0)).id, "afternoon");
  assert.equal(dayPart(new Date(2026, 0, 1, 19, 0)).id, "evening");
  assert.equal(dayPart(new Date(2026, 0, 1, 23, 59)).id, "lateNight");
});

test("a featured credit does not split one artist into two", () => {
  assert.equal(normalizeArtist("Young Dolph feat. Key Glock"), "young dolph");
  assert.equal(normalizeArtist("Young Dolph"), "young dolph");
  assert.equal(normalizeArtist("Tyler, The Creator"), "tyler");
});

test("a single play is not a habit, repeats are ranked", () => {
  const tally = artistTally([
    track("1", "Basshunter"),
    track("2", "Basshunter"),
    track("3", "Basshunter"),
    track("4", "Aphex Twin"),
    track("5", "Aphex Twin"),
    track("6", "Someone Once"),
  ]);
  assert.deepEqual(
    tally.map((entry) => entry.name),
    ["Basshunter", "Aphex Twin"],
  );
  assert.equal(tally[0].plays, 3);
});

test("forgotten favourites exclude anything recently heard, by track or artist", () => {
  const liked = [track("a", "Portishead"), track("b", "Boards of Canada"), track("c", "Burial")];
  const recents = [track("a", "Portishead"), track("z", "Burial")];
  const out = forgottenFavourites(liked, recents);
  assert.deepEqual(
    out.map((entry) => entry.id),
    ["b"],
    "a was played, and Burial was heard under a different track",
  );
});

test("nothing liked means nothing forgotten", () => {
  assert.deepEqual(forgottenFavourites([], [track("a", "X")]), []);
});
