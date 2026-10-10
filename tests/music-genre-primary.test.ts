// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { MUSIC_GENRES } from "../src/lib/music/genre-catalog";
import { genreTagScore, primaryGenre, genreMatchesTags } from "../src/lib/music/genre-membership";

const SCENES = new Set([
  "hip-hop", "electronic", "dance", "pop", "rock", "rnb", "metal",
  "jazz", "country", "reggae", "reggaeton", "classical", "afrobeats", "k-pop", "j-pop",
]);
const scene = MUSIC_GENRES.filter((g) => SCENES.has(g.slug));
const bySlug = (slug: string) => scene.find((g) => g.slug === slug)!;
const home = (tags: string[]) => primaryGenre(scene, tags)?.slug ?? null;

test("a rapper tagged pop and electronic still lands in hip-hop", () => {
  // The reported bug: Kanye West showed up in both Pop Mix and Electronic Mix.
  const kanye = ["hip hop", "rap", "pop", "electronic"];
  assert.equal(home(kanye), "hip-hop");
  // The loose predicate is exactly why he leaked into every scene.
  assert.equal(genreMatchesTags(bySlug("pop"), kanye), true);
  assert.equal(genreMatchesTags(bySlug("electronic"), kanye), true);
});

test("tag order decides the home genre", () => {
  assert.equal(home(["pop", "hip hop"]), "pop");
  assert.equal(home(["hip hop", "pop"]), "hip-hop");
});

test("an untagged or unknown artist has no home and joins no mix", () => {
  assert.equal(home([]), null);
  assert.equal(home(["field recording", "spoken word"]), null);
});

test("a eurodance act lands in dance, not electronic, and only once", () => {
  // S3RL / Basshunter shaped tags. dance and electronic share happy hardcore, but
  // eurodance is dance-only, so dance wins outright instead of claiming both.
  const tags = ["happy hardcore", "eurodance", "electronic"];
  assert.equal(home(tags), "dance");
  assert.ok(genreTagScore(bySlug("dance"), tags) > genreTagScore(bySlug("electronic"), tags));
});

test("a techno act lands in electronic", () => {
  assert.equal(home(["techno", "drum and bass", "electronica"]), "electronic");
});

test("repeated weak tags cannot outrank a single leading tag", () => {
  // One leading hip hop tag (1.0) beats pop appearing later three times (<1.0).
  const tags = ["hip hop", "pop", "dance pop", "pop rap"];
  assert.equal(home(tags), "hip-hop");
});

test("score weights earlier tags more heavily", () => {
  const first = genreTagScore(bySlug("hip-hop"), ["hip hop", "pop"]);
  const later = genreTagScore(bySlug("hip-hop"), ["pop", "hip hop"]);
  assert.ok(first > later, `expected ${first} > ${later}`);
});

test("every scene genre an artist is not primary in rejects them", () => {
  const tags = ["hip hop", "rap", "pop", "electronic"];
  const claimed = scene.filter((g) => primaryGenre(scene, tags)?.id === g.id);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].slug, "hip-hop");
});
