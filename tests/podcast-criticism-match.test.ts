// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { rankEpisodes, riskyTitle, type RawEpisode } from "../src/lib/providers/podcast-criticism/match.ts";

type Seed = {
  show: string;
  track: string;
  genre?: string;
  minutes?: number;
  description?: string;
  guid?: string;
};

let counter = 0;

function episode(seed: Seed): RawEpisode {
  counter += 1;
  return {
    trackId: counter,
    trackName: seed.track,
    collectionName: seed.show,
    trackViewUrl: `https://podcasts.apple.com/episode/${counter}`,
    episodeUrl: `https://audio.example.test/${seed.guid ?? counter}.mp3`,
    episodeGuid: seed.guid ?? String(counter),
    episodeContentType: "audio",
    trackTimeMillis: (seed.minutes ?? 60) * 60_000,
    releaseDate: "2020-01-01T00:00:00Z",
    description: seed.description ?? "",
    artworkUrl600: "https://art.example.test/600.jpg",
    genres: [{ name: seed.genre ?? "Film Reviews" }],
  };
}

function titlesKept(
  seeds: Seed[],
  title: string,
  year: number | null,
  directors: string[],
): string[] {
  return rankEpisodes(seeds.map(episode), [title], year, directors).map((kept) => kept.title);
}

test("a short common-word title is treated as risky and a distinctive one is not", () => {
  assert.equal(riskyTitle("Her"), true);
  assert.equal(riskyTitle("Up"), true);
  assert.equal(riskyTitle("Dune"), true);
  assert.equal(riskyTitle("Blade Runner"), false);
  assert.equal(riskyTitle("Do the Right Thing"), false);
  assert.equal(riskyTitle("Sátántangó"), false);
});

test("a podcast part number is not read as a film sequel", () => {
  const kept = titlesKept(
    [
      { show: "Weird Studies", track: "On Tarkovsky's 'Stalker' - Part Two", genre: "Arts" },
      { show: "Weird Studies", track: "On Tarkovsky's 'Stalker' - Part One", genre: "Arts" },
    ],
    "Stalker",
    1979,
    ["Andrei Tarkovsky"],
  );
  assert.deepEqual(kept.length, 2);
});

test("a colon continuation is rejected for a risky title even when the director matches", () => {
  const kept = titlesKept(
    [
      { show: "What's Your Favorite Scary Movie", track: "Alien: Covenant (dir. Ridley Scott)" },
      { show: "Verbal Diorama", track: "Alien" },
    ],
    "Alien",
    1979,
    ["Ridley Scott"],
  );
  assert.deepEqual(kept, ["Alien"]);
});

test("a sequel marker directly after the title is rejected", () => {
  const kept = titlesKept(
    [
      { show: "The Stephen King Boo! Club", track: "It Chapter 2, Dir. Andres Muschietti" },
      { show: "The Big Picture", track: "'It' Director Andy Muschietti on Adapting Stephen King" },
    ],
    "It",
    2017,
    ["Andy Muschietti"],
  );
  assert.deepEqual(kept, ["'It' Director Andy Muschietti on Adapting Stephen King"]);
});

test("a following year that is not this film's year is rejected", () => {
  const kept = titlesKept(
    [
      { show: "The Cine-Files", track: "Blade Runner 2049" },
      { show: "The Cine-Files", track: "Blade Runner (Rebroadcast)", guid: "rebroadcast" },
    ],
    "Blade Runner",
    1982,
    ["Ridley Scott"],
  );
  assert.deepEqual(kept, ["Blade Runner (Rebroadcast)"]);
});

test("a show outside the allowlist, the film genres and the film-named shows is rejected", () => {
  const kept = titlesKept(
    [
      { show: "Fake Doctors, Real Friends", track: "314: My Screw Up with Joshua Radin", genre: "Comedy" },
      { show: "Stand Up for Doctors!", track: "A Life Doctors Want to Keep Showing Up For", genre: "Mental Health" },
    ],
    "Up",
    2009,
    ["Pete Docter"],
  );
  assert.deepEqual(kept, []);
});

test("a film podcast filed under another genre is kept when its name says film", () => {
  const kept = titlesKept(
    [
      {
        show: "First Impressions: Thinking Aloud About Film",
        track: "The Youssef Chahine Podcast No. 3: Cairo Station",
        genre: "Arts",
      },
    ],
    "Cairo Station",
    1958,
    ["Youssef Chahine"],
  );
  assert.deepEqual(kept.length, 1);
});

test("episodes under ten minutes are dropped", () => {
  const kept = titlesKept(
    [{ show: "Filmspotting", track: "Parasite (1989) review", minutes: 9 }],
    "Parasite",
    2019,
    ["Bong Joon-ho"],
  );
  assert.deepEqual(kept, []);
});

test("one show contributes at most two episodes", () => {
  const seeds: Seed[] = [1, 2, 3, 4].map((index) => ({
    show: "Filmspotting",
    track: `Parasite review, take ${index}`,
    guid: `take-${index}`,
  }));
  assert.equal(titlesKept(seeds, "Parasite", 2019, ["Bong Joon-ho"]).length, 2);
});

test("no results is an empty list rather than a failure", () => {
  assert.deepEqual(rankEpisodes([], ["Parasite"], 2019, ["Bong Joon-ho"]), []);
  assert.deepEqual(rankEpisodes([episode({ show: "Filmspotting", track: "Weekend Review" })], ["Parasite"], 2019, []), []);
});
