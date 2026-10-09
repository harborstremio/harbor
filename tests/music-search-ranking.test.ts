import assert from "node:assert/strict";
import test from "node:test";
import {
  audienceOf,
  musicSearchTop,
  rankMusicItems,
  rankMusicSearch,
} from "../src/lib/music/search-ranking.ts";
import type {
  MusicAlbumRef,
  MusicArtistRef,
  MusicSearchResults,
  MusicTrack,
} from "../src/lib/music/types.ts";

/** What mergeMusicSearchLanes stamps on every merged item. */
type Ranked = { sourceCount?: number; sourceRank?: number };

function artist(
  over: Partial<MusicArtistRef & Ranked> & { id: string; name: string },
): MusicArtistRef {
  return { connectorId: "catalog", sourceCount: 1, sourceRank: 0, ...over } as MusicArtistRef;
}

function track(
  over: Partial<MusicTrack & Ranked> & { id: string; title: string; artist: string },
): MusicTrack {
  return {
    connectorId: "catalog",
    artwork: "https://cdn.example/cover.jpg",
    durationSeconds: 191,
    durationLabel: "3:11",
    sourceCount: 1,
    sourceRank: 0,
    ...over,
  } as MusicTrack;
}

function album(
  over: Partial<MusicAlbumRef & Ranked> & { id: string; title: string; artist: string },
): MusicAlbumRef {
  return {
    connectorId: "catalog",
    artwork: "https://cdn.example/album.jpg",
    sourceCount: 1,
    sourceRank: 0,
    ...over,
  } as MusicAlbumRef;
}

function results(over: Partial<MusicSearchResults> = {}): MusicSearchResults {
  return { tracks: [], albums: [], artists: [], playlists: [], ...over };
}

/**
 * The shape that actually reaches the panel: lanes already merged, so one entry per artist name
 * carrying how many connectors agreed on it. The squatter is one letter off and single sourced.
 */
const GRIZZLEY = results({
  artists: [
    artist({
      id: "deezer:artist:9635182",
      name: "Tee Grizzley",
      artwork: "https://cdn.example/tg.jpg",
      sourceCount: 3,
      sourceRank: 0,
    }),
    artist({ id: "483920184", connectorId: "soundcloud", name: "Tee Grizzly", sourceRank: 2 }),
    artist({
      id: "deezer:artist:1140",
      name: "Grizzly Bear",
      artwork: "https://cdn.example/gb.jpg",
      sourceRank: 1,
    }),
  ],
  tracks: [
    track({ id: "deezer:track:1", title: "First Day Out", artist: "Tee Grizzley", sourceCount: 2 }),
    track({ id: "deezer:track:2", title: "No Effort", artist: "Tee Grizzley", sourceRank: 1 }),
    track({ id: "deezer:track:4", title: "Colors", artist: "Tee Grizzly", sourceRank: 3 }),
  ],
  albums: [album({ id: "deezer:album:1", title: "Activated", artist: "Tee Grizzley", year: 2018 })],
});

const artistNames = (query: string, source = GRIZZLEY) =>
  rankMusicItems(source, query)
    .filter((entry) => entry.item.kind === "artist")
    .map((entry) => (entry.item.kind === "artist" ? entry.item.name : ""));

test("a one letter typo does not hand the top spot to the namesake squatter", () => {
  const top = musicSearchTop(GRIZZLEY, "tee grizzly");
  assert.equal(top?.kind, "artist");
  assert.equal(top?.kind === "artist" ? top.name : "", "Tee Grizzley");
});

test("the correctly spelled query lands on the same artist", () => {
  const top = musicSearchTop(GRIZZLEY, "tee grizzley");
  assert.equal(top?.kind === "artist" ? top.name : "", "Tee Grizzley");
});

test("an exact name match alone cannot outweigh the authority signals", () => {
  const names = artistNames("tee grizzly");
  assert.equal(names[0], "Tee Grizzley");
  assert.ok(names.indexOf("Tee Grizzly") > 0, "the exact but unsupported name must not be first");
  assert.equal(names[names.length - 1], "Grizzly Bear", "an unrelated band still sorts below both");
});

test("the win over the squatter is a real margin, not an ordering accident", () => {
  const ranked = rankMusicItems(GRIZZLEY, "tee grizzly");
  const squatter = ranked.find(
    (entry) => entry.item.kind === "artist" && entry.item.name === "Tee Grizzly",
  );
  assert.ok(squatter);
  const margin = ranked[0].score - squatter.score;
  assert.ok(margin > 0.05, `margin was only ${margin.toFixed(3)}`);
});

test("standing alone separates two accounts spelled identically", () => {
  const twins = results({
    artists: [
      artist({ id: "551", connectorId: "soundcloud", name: "Tee Grizzley", sourceRank: 3 }),
      artist({
        id: "deezer:artist:9635182",
        name: "Tee Grizzley",
        artwork: "https://cdn.example/tg.jpg",
        sourceCount: 3,
      }),
    ],
  });
  assert.equal(musicSearchTop(twins, "tee grizzley")?.id, "deezer:artist:9635182");
});

const ELASTIC = results({
  artists: [
    artist({ id: "88117", connectorId: "soundcloud", name: "Elastic Heart" }),
    artist({
      id: "deezer:artist:1187",
      name: "Sia",
      artwork: "https://cdn.example/sia.jpg",
      sourceCount: 3,
      sourceRank: 1,
    }),
  ],
  tracks: [
    track({
      id: "deezer:track:70",
      title: "Elastic Heart",
      artist: "Sia",
      album: "1000 Forms of Fear",
      sourceCount: 2,
    }),
    track({
      id: "deezer:track:71",
      title: "Chandelier",
      artist: "Sia",
      sourceCount: 2,
      sourceRank: 1,
    }),
  ],
});

test("an exact song title still beats an account that merely shares its name", () => {
  const top = musicSearchTop(ELASTIC, "elastic heart");
  assert.equal(top?.kind, "track");
  assert.equal(top?.kind === "track" ? top.title : "", "Elastic Heart");
});

test("a release tag on the title does not cost the song its exact match", () => {
  const tagged = results({
    ...ELASTIC,
    tracks: [
      track({
        id: "youtube:track:70",
        connectorId: "youtube",
        title: "Elastic Heart (Official Video)",
        artist: "Sia",
      }),
      ...ELASTIC.tracks.slice(1),
    ],
  });
  const top = musicSearchTop(tagged, "elastic heart");
  assert.equal(top?.kind === "track" ? top.id : "", "youtube:track:70");
});

test("typing the artist returns the artist, not one of their songs", () => {
  assert.equal(musicSearchTop(ELASTIC, "sia")?.kind, "artist");
});

test("a cyrillic typo does not hand the top spot to the squatter either", () => {
  const kino = results({
    artists: [
      artist({ id: "7781", connectorId: "soundcloud", name: "Киино", sourceRank: 1 }),
      artist({
        id: "deezer:artist:1229",
        name: "Кино",
        artwork: "https://cdn.example/kino.jpg",
        sourceCount: 2,
      }),
    ],
    tracks: [
      track({ id: "deezer:track:900", title: "Группа крови", artist: "Кино" }),
      track({
        id: "deezer:track:901",
        title: "Звезда по имени Солнце",
        artist: "Кино",
        sourceRank: 1,
      }),
    ],
  });
  const top = musicSearchTop(kino, "киино");
  assert.equal(top?.kind === "artist" ? top.name : "", "Кино");
});

test("an arabic typo does not hand the top spot to the squatter either", () => {
  const umm = results({
    artists: [
      artist({ id: "4412", connectorId: "soundcloud", name: "ام كلثم", sourceRank: 1 }),
      artist({
        id: "deezer:artist:5525",
        name: "ام كلثوم",
        artwork: "https://cdn.example/umm.jpg",
        sourceCount: 2,
      }),
    ],
    tracks: [
      track({ id: "deezer:track:5525", title: "انت عمري", artist: "ام كلثوم" }),
      track({ id: "deezer:track:5526", title: "الاطلال", artist: "ام كلثوم", sourceRank: 1 }),
    ],
  });
  const top = musicSearchTop(umm, "ام كلثم");
  assert.equal(top?.kind === "artist" ? top.name : "", "ام كلثوم");
});

test("an empty query keeps whatever the sources nominated", () => {
  const nominated = results({
    top: { kind: "artist", id: "deezer:artist:1", connectorId: "catalog", name: "Anyone" },
    artists: [artist({ id: "deezer:artist:2", name: "Someone Else" })],
  });
  assert.equal(musicSearchTop(nominated, "   ")?.id, "deezer:artist:1");
  assert.equal(rankMusicSearch(nominated, "")?.top?.id, "deezer:artist:1");
});

test("no results means no pick", () => {
  assert.equal(musicSearchTop(null, "anything"), undefined);
  assert.equal(rankMusicSearch(null, "anything"), null);
});

test("a source nominated top that is in no grid still competes", () => {
  const nominated = results({
    ...GRIZZLEY,
    top: {
      kind: "album",
      id: "deezer:album:9",
      connectorId: "catalog",
      title: "Chapters",
      artist: "Tee Grizzley",
      artwork: "https://cdn.example/chapters.jpg",
    },
  });
  assert.equal(rankMusicItems(nominated, "chapters")[0]?.item.id, "deezer:album:9");
  assert.equal(musicSearchTop(nominated, "chapters")?.id, "deezer:album:9");
});

test("a query nothing answers falls back to the source's own nomination", () => {
  const nominated = results({
    ...GRIZZLEY,
    top: {
      kind: "artist",
      id: "deezer:artist:9635182",
      connectorId: "catalog",
      name: "Tee Grizzley",
    },
  });
  assert.equal(musicSearchTop(nominated, "zzzqxv unrelated")?.id, "deezer:artist:9635182");
});

test("a heavyweight artist cannot ride an unrelated query", () => {
  const top = musicSearchTop(GRIZZLEY, "colors");
  assert.equal(top?.kind, "track");
  assert.equal(top?.kind === "track" ? top.title : "", "Colors");
});

test("ranking reorders the grids without dropping anything", () => {
  const ranked = rankMusicSearch(GRIZZLEY, "tee grizzly");
  assert.ok(ranked);
  assert.equal(ranked.artists.length, GRIZZLEY.artists.length);
  assert.equal(ranked.tracks.length, GRIZZLEY.tracks.length);
  assert.equal(ranked.albums.length, GRIZZLEY.albums.length);
  assert.deepEqual(
    ranked.artists.map((entry) => entry.id).sort(),
    GRIZZLEY.artists.map((entry) => entry.id).sort(),
  );
  assert.equal(ranked.artists[0].name, "Tee Grizzley");
  assert.equal(ranked.top?.id, ranked.artists[0].id);
});

// Carried over from tests/music/search-ranking.test.mjs, which can no longer load this module.
const MINION = results({
  top: { kind: "artist", id: "account", connectorId: "catalog", name: "Rich Minion" },
  artists: [artist({ id: "account", name: "Rich Minion" })],
  tracks: [track({ id: "song", title: "Rich Minion", artist: "Yeat", artwork: "" })],
});

test("a remix is a different recording, so it does not answer for the original", () => {
  const remixOnly = results({
    ...MINION,
    tracks: [track({ id: "song", title: "Rich Minion (Remix)", artist: "Yeat", artwork: "" })],
  });
  assert.equal(musicSearchTop(remixOnly, "Rich Minion")?.kind, "artist");
});

test("a release tag and stray punctuation do not hide the song", () => {
  const tagged = results({
    ...MINION,
    tracks: [
      track({ id: "song", title: "Rich Minion (Official Audio)", artist: "Yeat", artwork: "" }),
    ],
  });
  assert.equal(musicSearchTop(tagged, "  RICH—MINION  ")?.kind, "track");
});

test("the source's own exact song wins a tie with the grid copy", () => {
  const nominated = results({
    ...MINION,
    top: { kind: "track", ...MINION.tracks[0], id: "official" },
  });
  assert.equal(musicSearchTop(nominated, "Rich Minion")?.id, "official");
});

test("equal songs keep the order the sources gave them", () => {
  const duplicated = results({
    ...MINION,
    tracks: [MINION.tracks[0], { ...MINION.tracks[0], id: "reupload" }],
  });
  assert.equal(musicSearchTop(duplicated, "rich minion")?.id, "song");
});

test("the only real audience number in the pipeline is read out of the subtitle", () => {
  assert.equal(audienceOf("8.1M subscribers"), 8_100_000);
  assert.equal(audienceOf("1,236,341 listens"), 1_236_341);
  assert.equal(audienceOf("2.1M monthly listeners"), 2_100_000);
  assert.equal(audienceOf("12K followers"), 12_000);
});

test("the wording YouTube Music actually sends is the wording that must parse", () => {
  assert.equal(audienceOf("Artist • 21.6M monthly audience"), 21_600_000);
  assert.equal(audienceOf("Artist • 1.94K subscribers"), 1_940);
  assert.equal(audienceOf("Artist • 65 subscribers"), 65);
  assert.equal(audienceOf("#3"), 0);
});

test("genre and chart subtitles are not mistaken for an audience", () => {
  assert.equal(audienceOf("Hip-Hop/Rap"), 0);
  assert.equal(audienceOf("Alternative"), 0);
  assert.equal(audienceOf("#3"), 0);
  assert.equal(audienceOf(undefined), 0);
});

test("an audience subtitle lifts the account that actually holds it", () => {
  const twins = results({
    artists: [
      artist({ id: "551", connectorId: "soundcloud", name: "Tee Grizzley", sourceRank: 0 }),
      artist({
        id: "UCf5HVn0Yzt4Q0SXoyzWAUOA",
        connectorId: "youtube",
        name: "Tee Grizzley",
        subtitle: "8.1M subscribers",
        sourceRank: 1,
      }),
    ],
  });
  assert.equal(musicSearchTop(twins, "tee grizzley")?.id, "UCf5HVn0Yzt4Q0SXoyzWAUOA");
});

test("an item nothing stamped sorts behind a stamped one, never ahead of it", () => {
  const mixed = results({
    artists: [
      { id: "unstamped", connectorId: "soundcloud", name: "Halo Nine" } as MusicArtistRef,
      artist({ id: "stamped", connectorId: "soundcloud", name: "Halo Nine", sourceRank: 5 }),
    ],
  });
  const order = rankMusicItems(mixed, "halo nine")
    .filter((entry) => entry.item.kind === "artist")
    .map((entry) => entry.item.id);
  assert.deepEqual(order, ["stamped", "unstamped"]);
});

const VON_TRACKS = Array.from({ length: 20 }, (_, index) =>
  track({ id: `deezer:track:${index}`, title: `Von Cut ${index}`, artist: "King Von" }),
);

const JUNK_VON = "deezer:artist:222422125";
const REAL_VON = "UC_von_official";

const vonResults = (subtitle?: string) =>
  results({
    artists: [
      artist({
        id: JUNK_VON,
        name: "King Von",
        artwork: "https://cdn.example/junk.jpg",
        sourceRank: 0,
      }),
      artist({ id: REAL_VON, connectorId: "youtube", name: "King Von", subtitle, sourceRank: 3 }),
    ],
    tracks: VON_TRACKS,
  });

const vonOrder = (source: MusicSearchResults) =>
  rankMusicItems(source, "king von")
    .filter((entry) => entry.item.kind === "artist")
    .map((entry) => entry.item.id);

function artistScore(source: MusicSearchResults, id: string): number {
  const found = rankMusicItems(source, "king von").find(
    (entry) => entry.item.kind === "artist" && entry.item.id === id,
  );
  if (!found) throw new Error(`${id} never reached the ranking`);
  return found.score;
}

test("a namesake does not inherit the audience the other account reported", () => {
  const huge = artistScore(vonResults("Artist • 21.6M monthly audience"), JUNK_VON);
  const small = artistScore(vonResults("Artist • 2.16K monthly audience"), JUNK_VON);
  assert.equal(huge, small);
});

test("the account holding the audience outranks the namesake that reports none", () => {
  const measured = vonResults("Artist • 21.6M monthly audience");
  assert.deepEqual(vonOrder(measured), [REAL_VON, JUNK_VON]);
  const margin = artistScore(measured, REAL_VON) - artistScore(measured, JUNK_VON);
  assert.ok(margin > 0.02, `margin was only ${margin.toFixed(4)}`);
});
