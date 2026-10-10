import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as selection from "../src/lib/music/daily-discovery-selection";
import * as ranking from "../src/lib/music/made-for-you-selection";
import * as quality from "../src/lib/music/mix-quality";
import { artistIdentityKey } from "../src/lib/music/artist-popularity";
import { genreSearchKey } from "../src/lib/music/genre-catalog";
import { musicTrackIdentity } from "../src/lib/music/track-identity";
import type { MusicTrack } from "../src/lib/music/types";

const day = "2026-09-29";
const track = (artist: string, n: number): MusicTrack => ({ id: `deezer:track:${artist}-${n}`, title: `Song ${n}`, artist, artwork: `${artist}-${n}.jpg`, durationSeconds: 180, durationLabel: "3:00" });
const taste = (): ranking.MixTaste => ({ recents: [], liked: Array.from({ length: 6 }, (_, n) => Array.from({ length: 5 }, (_, i) => track(`Favourite ${n}`, i))).flat(), followed: [], library: [], affinity: {} });

function api(options: { outage?: boolean; sparse?: boolean; metadataOnly?: boolean } = {}) {
  const saved: Record<string, any> = {};
  let queries = 0, active = 0, maxActive = 0, blocked = "";
  const remote = async <T,>(value: T) => { queries++; active++; maxActive = Math.max(maxActive, active); await new Promise(resolve => setTimeout(resolve, 1)); active--; return value; };
  const source = readFileSync(new URL("../src/lib/music/made-for-you.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mocks: Record<string, unknown> = {
    "./artist-authority": { resolveArtist: async (name: string) => remote({ canonical: options.outage ? null : { id: `${options.metadataOnly ? "musicbrainz" : "deezer"}:artist:${name}`, name, artwork: name + "-portrait.jpg" } }) },
    "./artist-popularity": { artistIdentityKey },
    "./artist-blocks": { filterBlockedTracks: (tracks: MusicTrack[]) => tracks.filter(track => track.artist !== blocked) },
    "./artist-genre-cache": { readArtistGenres: async () => new Map() },
    "./catalog": {
      artistTop: async ({ name }: { name: string }) => remote([...Array.from({ length: 18 }, (_, n) => track(name, n)), { ...track(name, 20), durationSeconds: 0 }, { ...track(name, 21), artwork: "" }, { ...track(name, 22), id: "musicbrainz:recording:metadata" }, { ...track(name, 23), title: "Song (Instrumental)" }, track("Wrong Artist", 99)]),
      artistRows: async ({ name }: { name: string }) => remote([{ id: "artist:related", items: options.sparse ? [] : Array.from({ length: 8 }, (_, n) => ({ kind: "artist", id: `deezer:artist:${name} Neighbour ${n}`, name: `${name} Neighbour ${n}` })) }]),
    },
    "./daily-discovery-selection": selection,
    "./genre-catalog": { genreSearchKey },
    "./local-store": { readLocalJson: async (name: string) => saved[name] ?? null, writeLocalJson: (name: string, value: unknown) => { saved[name] = value; } },
    "./made-for-you-selection": ranking,
    "./mix-quality": quality,
    "./track-identity": { musicTrackIdentity },
    "./made-for-you-genres": { loadMadeForYouGenres: async () => [] },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, module, module.exports);
  return { music: module.exports as typeof import("../src/lib/music/made-for-you"), saved, queries: () => queries, maxActive: () => maxActive, block: (name: string) => { blocked = name; } };
}

test("a binge is capped per artist; likes, followed artists and library tracks remain represented", () => {
  const input = taste();
  input.recents = Array.from({ length: 1388 }, (_, n) => track(n % 2 ? "Chris Brown" : "Chris_Brown", n));
  input.followed = [{ id: "follow", connectorId: "spotify", name: "Followed Artist" }];
  input.library = [track("Library Artist", 1)];
  const ranked = ranking.rankMixArtists(input);
  assert.equal(ranked.filter(value => value.key === "chris brown").length, 1);
  assert.equal(ranked.find(value => value.key === "chris brown")?.score, 3);
  assert.ok(ranked.slice(0, 6).every(value => value.name.startsWith("Favourite")));
  assert.ok(ranked.some(value => value.name === "Followed Artist"));
  assert.ok(ranked.some(value => value.name === "Library Artist"));
});

test("six numbered daily queues and four artist queues use real related catalogs, not generic genres", async () => {
  const { music, maxActive } = api();
  const updates: string[][] = [];
  const mixes = await music.loadMadeForYou(taste(), day, "me", value => updates.push(value.map(mix => mix.id)));
  const daily = mixes.filter(mix => mix.kind === "daily"), artists = mixes.filter(mix => mix.kind === "artist");
  assert.equal(daily.length, 6); assert.equal(artists.length, 4);
  assert.deepEqual(daily.map(mix => mix.index), [1, 2, 3, 4, 5, 6]);
  assert.ok(maxActive() <= 3);
  const recordings = daily.flatMap(mix => mix.tracks.map(musicTrackIdentity));
  assert.equal(new Set(recordings).size, recordings.length, "no repeated recording across Daily Mixes");
  for (const mix of daily) {
    assert.ok(selection.dailyMixHasVariety(mix.tracks));
    assert.ok(mix.tracks.some(track => track.artist === mix.name));
    assert.ok(mix.tracks.every(track => track.artist === mix.name || track.artist.startsWith(mix.name + " Neighbour")));
    assert.ok(mix.tracks.every(quality.isMixRecording));
    assert.equal(mix.artwork.length, 4);
  }
  assert.ok(artists.every(mix => mix.tracks.every(track => track.artist === mix.name)));
  assert.ok(artists.every(mix => mix.artwork[0].endsWith("-portrait.jpg")));
  updates.forEach((ids, i) => assert.deepEqual(ids.slice(0, updates[i - 1]?.length ?? 0), updates[i - 1] ?? []));
});

test("same-day cache, duplicate requests and reopening preserve queues without provider requests", async () => {
  const { music, queries } = api();
  const [a, b] = await Promise.all([music.loadMadeForYou(taste(), day, "me"), music.loadMadeForYou(taste(), day, "me")]);
  assert.deepEqual(a, b);
  const before = queries();
  const changed = taste(); changed.recents = Array.from({ length: 100 }, (_, n) => track("Binge", n));
  assert.deepEqual(await music.loadMadeForYou(changed, day, "me"), a);
  assert.deepEqual(await music.readMadeForYouShelf(day, "me"), a);
  assert.deepEqual(await music.readMadeForYouMix(a[0].id, "me"), a[0]);
  assert.equal(queries(), before);
  assert.equal(await music.readMadeForYouMix(a[0].id, "other-profile"), null);
});

test("adding genre shelves to an older daily snapshot preserves its existing queues and IDs", async () => {
  const { music, saved, queries } = api();
  const previous = await music.loadMadeForYou(taste(), day, "me");
  const snapshot = Object.values(saved)[0][0];
  delete snapshot.genres;
  assert.deepEqual(await music.readMadeForYouShelf(day, "me", true), []);
  const before = queries();
  assert.deepEqual(await music.loadMadeForYou(taste(), day, "me"), previous);
  assert.equal(queries(), before);
  assert.deepEqual(await music.readMadeForYouShelf(day, "me", true), previous);
});

test("daily refresh rotates actual recordings and profile caches are separate", async () => {
  const { music } = api();
  const a = await music.loadMadeForYou(taste(), day, "me"), b = await music.loadMadeForYou(taste(), "2026-09-30", "me");
  assert.notEqual(a[0].id, b[0].id);
  assert.notDeepEqual(a[0].tracks.map(musicTrackIdentity).sort(), b[0].tracks.map(musicTrackIdentity).sort());
  assert.deepEqual(await music.readMadeForYouShelf(day, "you"), []);
});

test("source failures and metadata catalogs cannot fabricate Daily Mixes", async () => {
  for (const options of [{ outage: true }, { sparse: true }, { metadataOnly: true }]) {
    const { music } = api(options);
    const mixes = await music.loadMadeForYou(taste(), day, "me");
    assert.equal(mixes.filter(mix => mix.kind === "daily").length, 0);
    assert.equal(mixes.filter(mix => mix.kind === "artist").length, 4, "real saved songs can still form honest artist mixes");
    assert.ok(mixes.every(mix => mix.tracks.every(quality.isMixRecording)));
  }
  assert.deepEqual(await api().music.loadMadeForYou({ recents: [], liked: [], library: [], followed: [], affinity: {} }, day, "new"), []);
});

test("artist blocks invalidate cached mixes on reopening", async () => {
  const { music, block } = api();
  const mixes = await music.loadMadeForYou(taste(), day, "me");
  const daily = mixes.find(mix => mix.kind === "daily")!;
  block(daily.tracks[0].artist);
  const reopened = await music.readMadeForYouMix(daily.id, "me");
  assert.ok(reopened?.tracks.every(track => track.artist !== daily.tracks[0].artist));
  const artist = mixes.find(mix => mix.kind === "artist")!;
  block(artist.name);
  assert.equal(await music.readMadeForYouMix(artist.id, "me"), null);
});

test("late listening hydration replaces a library-only snapshot, then remains stable", async () => {
  const { music, queries } = api();
  const libraryOnly = { recents: [], liked: [], followed: [], library: taste().liked, affinity: {} };
  await music.loadMadeForYou(libraryOnly, day, "me");
  assert.deepEqual(await music.readMadeForYouShelf(day, "me", true), []);
  const personal = taste(); personal.liked = personal.liked.map(track => ({ ...track, artist: "Liked " + track.artist }));
  const mixes = await music.loadMadeForYou(personal, day, "me");
  assert.ok(mixes.every(mix => mix.name.startsWith("Liked")));
  const before = queries();
  assert.deepEqual(await music.readMadeForYouShelf(day, "me", true), mixes);
  assert.equal(queries(), before);
});
