import assert from "node:assert/strict";
import test from "node:test";
import { mentionsArtist } from "../src/lib/music/artist-rarities";
import type { MusicTrack } from "../src/lib/music/types";

const upload = (title: string, artist: string): MusicTrack => ({
  id: `${artist}:${title}`,
  connectorId: "soundcloud",
  title,
  artist,
  artwork: "",
  durationSeconds: 100,
  durationLabel: "1:40",
});

test("a fan account whose name contains the artist does not credit them", () => {
  assert.equal(
    mentionsArtist(upload("Lil Baby - Lawyer (Unreleased)", "TRAP JEEZY4"), "jeezy"),
    false,
    "a Lil Baby leak uploaded by TRAP JEEZY4 is not a Jeezy rarity",
  );
});

test("a short uploader name never swallows a longer artist", () => {
  assert.equal(mentionsArtist(upload("Some Demo (unreleased)", "Ye"), "kanyewest"), false);
});

test("the artist named in the title counts, whoever uploaded it", () => {
  assert.equal(mentionsArtist(upload("Kanye West - 530 (Unreleased)", "leighton"), "kanyewest"), true);
  assert.equal(
    mentionsArtist(upload("Famous- Kanye West (Unreleased Version)", "erotica"), "kanyewest"),
    true,
  );
  assert.equal(mentionsArtist(upload("Raqbaby - Jeezy Flow (unreleased)", "Larry"), "jeezy"), true);
});

test("an exact artist credit counts even when the title omits the name", () => {
  assert.equal(mentionsArtist(upload("Lawyer (Unreleased)", "Lil Baby"), "lilbaby"), true);
});
