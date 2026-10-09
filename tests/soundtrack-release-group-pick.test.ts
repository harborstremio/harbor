import assert from "node:assert/strict";
import test from "node:test";
import {
  rankSoundtrackCandidates,
  readReleaseGroup,
  soundtrackCandidates,
} from "../src/lib/providers/musicbrainz-soundtrack-pick.ts";

const REMIX_ID = "13a48695-785a-4b04-bfbe-433c604c7f4f";
const OVERTURE_ID = "0c2833dc-2fe4-4215-b91f-e37c5d65136f";
const SCORE_ID = "e0b56cbe-df98-4ab7-a5d6-d2f62b35eb34";

const whiplashLookup = {
  resource: "https://www.imdb.com/title/tt2582802/",
  id: "eda4cbf2-f9b9-4173-8be2-1bc04d6d7123",
  relations: [
    {
      type: "IMDb",
      "target-type": "release_group",
      direction: "backward",
      release_group: {
        id: REMIX_ID,
        title: "Casey's Song (Milk Flud remix)",
        "first-release-date": "2020-05-08",
        "secondary-types": [],
        "primary-type": null,
      },
    },
    {
      type: "IMDb",
      "target-type": "release_group",
      direction: "backward",
      release_group: {
        id: OVERTURE_ID,
        title: "Overture (Opiuo remix producer cut)",
        "first-release-date": "2020-03-27",
        "secondary-types": [],
        "primary-type": null,
      },
    },
    {
      type: "IMDb",
      "target-type": "release_group",
      direction: "backward",
      release_group: {
        id: SCORE_ID,
        title: "Whiplash: Original Motion Picture Soundtrack",
        "first-release-date": "2014-09-26",
        "secondary-types": [],
        "primary-type": null,
      },
    },
  ],
};

const remixGroup = {
  id: REMIX_ID,
  title: "Casey's Song (Milk Flud remix)",
  "primary-type": "Single",
  "secondary-types": ["Remix"],
  "first-release-date": "2020-05-08",
  "artist-credit": [{ name: "Justin Hurwitz", joinphrase: "" }],
};

const scoreGroup = {
  id: SCORE_ID,
  title: "Whiplash: Original Motion Picture Soundtrack",
  "primary-type": "Album",
  "secondary-types": ["Soundtrack"],
  "first-release-date": "2014-09-26",
  "artist-credit": [{ name: "Justin Hurwitz", joinphrase: "" }],
};

const socialNetworkGroup = {
  id: "68d34935-78f4-4dfc-8891-7155de2d2f6b",
  title: "The Social Network",
  "primary-type": "Album",
  "secondary-types": ["Soundtrack"],
  "first-release-date": "2010-09-17",
  "artist-credit": [
    { name: "Trent Reznor", joinphrase: " and " },
    { name: "Atticus Ross", joinphrase: "" },
  ],
};

const spiritedAwayGroup = {
  id: "dc1f9d7d-9a98-3f2c-83aa-c16dbb4a9ae1",
  title: "千と千尋の神隠し サウンドトラック",
  "primary-type": "Album",
  "secondary-types": ["Soundtrack"],
  "first-release-date": "2001-07-18",
  aliases: [
    {
      locale: "en",
      primary: true,
      type: "Release group name",
      name: "Spirited Away Soundtrack",
    },
  ],
  "artist-credit": [
    {
      name: "久石譲",
      joinphrase: "",
      artist: {
        name: "久石譲",
        "sort-name": "Hisaishi, Joe",
        aliases: [
          { locale: null, primary: null, type: "Search hint", name: "Joe Hisaichi" },
          { locale: "en", primary: true, type: "Artist name", name: "Joe Hisaishi" },
          { locale: "ja", primary: true, type: "Artist name", name: "久石譲" },
        ],
      },
    },
  ],
};

test("every release group linked by the IMDb relation becomes a candidate", () => {
  assert.deepEqual(
    soundtrackCandidates(whiplashLookup).map((c) => c.id),
    [REMIX_ID, OVERTURE_ID, SCORE_ID],
  );
});

test("the score outranks the remixes even though MusicBrainz listed it last", () => {
  const ordered = rankSoundtrackCandidates(soundtrackCandidates(whiplashLookup));
  assert.equal(ordered[0].id, SCORE_ID);
});

test("a relation to a remix single is not a soundtrack", () => {
  assert.equal(readReleaseGroup(remixGroup, "Casey's Song"), null);
});

test("the confirming call is what identifies the score", () => {
  const found = readReleaseGroup(scoreGroup, "Whiplash");
  assert.ok(found);
  assert.equal(found.single, false);
  assert.equal(found.album.title, "Whiplash: Original Motion Picture Soundtrack");
  assert.equal(found.album.artist, "Justin Hurwitz");
  assert.equal(found.album.year, 2014);
});

test("the lookup response alone cannot identify the score", () => {
  for (const relation of whiplashLookup.relations) {
    assert.equal(readReleaseGroup(relation.release_group, ""), null);
  }
});

test("a joined artist credit reads as one name", () => {
  const found = readReleaseGroup(socialNetworkGroup, "");
  assert.ok(found);
  assert.equal(found.album.artist, "Trent Reznor and Atticus Ross");
});

test("a Japanese release reads through its English alias", () => {
  const found = readReleaseGroup(spiritedAwayGroup, "");
  assert.ok(found);
  assert.equal(found.album.title, "Spirited Away Soundtrack");
  assert.equal(found.album.artist, "Joe Hisaishi");
});

test("a credited name with no English alias is left exactly as credited", () => {
  const found = readReleaseGroup(socialNetworkGroup, "");
  assert.ok(found);
  assert.equal(found.album.title, "The Social Network");
  assert.equal(found.album.artist, "Trent Reznor and Atticus Ross");
});

test("a soundtrack whose title carries no signal still ranks and resolves", () => {
  const ordered = rankSoundtrackCandidates([
    { id: socialNetworkGroup.id, title: "The Social Network", released: "2010-09-17" },
  ]);
  assert.equal(ordered.length, 1);
  assert.ok(readReleaseGroup(socialNetworkGroup, ordered[0].title));
});
