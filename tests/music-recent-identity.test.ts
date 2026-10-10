import assert from "node:assert/strict";
import test from "node:test";
import { legacySingleArtist, musicDestinationIdentity, musicRecentContextIdentity, uniqueMusicRecents } from "../src/lib/music/recent-identity";
import type { MusicDestination } from "../src/lib/music/recent-destinations";

const artist = (id: string, name: string, at: number): MusicDestination => ({ kind: "artist", id, name, at, artwork: `${id}.jpg`, connectorId: id.includes("spotify") ? "spotify" : "catalog" });

test("same artist across providers and spelling variants appears once, retaining the newest destination", () => {
  const entries = [artist("catalog:chris", "Chris Brown", 1), artist("spotify:chris", "Chris_Brown", 4), artist("yt:chris", "Chris Brown - Topic", 2), artist("other", "S3RL", 3)];
  assert.deepEqual(uniqueMusicRecents(entries, musicDestinationIdentity), [entries[1], entries[3]]);
  assert.equal(musicDestinationIdentity(entries[0]), musicDestinationIdentity(entries[1]), "now-playing identity follows the artist across sources");
});

test("dedupe happens before the display limit so distinct older destinations fill the row", () => {
  const recent = [artist("a", "Chris Brown", 50), artist("b", "Chris Brown", 49), ...Array.from({ length: 9 }, (_, n) => artist(`unique${n}`, `Artist ${n}`, 48 - n))];
  const tiles = uniqueMusicRecents(recent, musicDestinationIdentity).slice(0, 8);
  assert.equal(tiles.length, 8);
  assert.equal(tiles.at(-1)?.name, "Artist 6");
});

test("album/track dedupe includes artist and edition; unknown credits never merge by title alone", () => {
  const album = { ...artist("1", "Home", 1), kind: "album" as const, artist: "A" };
  assert.equal(musicDestinationIdentity(album), musicDestinationIdentity({ ...album, id: "spotify:2", connectorId: "spotify" }));
  assert.notEqual(musicDestinationIdentity(album), musicDestinationIdentity({ ...album, artist: "B" }));
  assert.notEqual(musicDestinationIdentity(album), musicDestinationIdentity({ ...album, name: "Home (Deluxe)" }));
  assert.notEqual(musicDestinationIdentity({ ...album, artist: "" }), musicDestinationIdentity({ ...album, artist: "", id: "2" }));
});

test("daily genre editions occupy one tile; different genres and independent same-name playlists stay distinct", () => {
  const recent = { kind: "similar" as const, id: "mix:discovery:v1:2026-09-29:116:abc" };
  assert.equal(musicRecentContextIdentity(recent), musicRecentContextIdentity({ ...recent, id: "mix:discovery:v1:2026-09-30:116:def" }));
  assert.equal(musicRecentContextIdentity(recent), musicRecentContextIdentity({ ...recent, id: "mix:genre:116" }));
  assert.notEqual(musicRecentContextIdentity(recent), musicRecentContextIdentity({ ...recent, id: "mix:genre:132" }));
  assert.notEqual(musicRecentContextIdentity({ kind: "playlist", id: "a" }), musicRecentContextIdentity({ kind: "playlist", id: "b" }));
});

test("one-artist legacy daily IDs identify artist mixes without renaming multiartist queues", () => {
  const seed = { id: "1", title: "Song", artist: "YNW Melly", artwork: "", durationSeconds: 1, durationLabel: "0:01" };
  assert.equal(legacySingleArtist({ id: "mix:daily:v2:ynw%20melly", seed }), "YNW Melly");
  assert.equal(legacySingleArtist({ id: "mix:daily:v2:ynw%20melly|other", seed }), null);
  assert.equal(legacySingleArtist({ id: "mix:daily:v2:%broken", seed }), null);
});

test("personal daily editions dedupe by scene while artist editions dedupe across providers and old IDs", () => {
  const seed = { id: "1", title: "Song", artist: "YNW Melly", artwork: "album.jpg", durationSeconds: 180, durationLabel: "3:00" };
  const context = { kind: "similar" as const, id: "mix:personal:v2:profile:2026-09-29:scene", seed };
  assert.equal(musicRecentContextIdentity(context), musicRecentContextIdentity({ ...context, id: "mix:personal:v2:profile:2026-09-30:scene" }));
  assert.notEqual(musicRecentContextIdentity(context), musicRecentContextIdentity({ ...context, id: "mix:personal:v2:profile:2026-09-29:other" }));
  assert.equal(musicRecentContextIdentity({ ...context, id: context.id + ":artist" }), musicRecentContextIdentity({ ...context, id: "mix:artist:ynw melly" }));
});
