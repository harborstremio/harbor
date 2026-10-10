import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  artistPresenceIn,
  artistPlaylistTracks,
  buildMusicPlaylistIndex,
  trackPlaylistsIn,
} from "../src/lib/music/playlist-membership";
import type { MusicPlaylist, MusicTrack } from "../src/lib/music/types";

function track(partial: Partial<MusicTrack>): MusicTrack {
  return {
    id: partial.id ?? "id",
    connectorId: partial.connectorId,
    title: partial.title ?? "Title",
    artist: partial.artist ?? "Artist",
    artwork: "",
    durationSeconds: 180,
    durationLabel: "3:00",
    ...partial,
  };
}

function playlist(id: string, name: string, tracks: MusicTrack[]): MusicPlaylist {
  return { id, name, createdAt: "", updatedAt: "", tracks };
}

describe("music playlist membership", () => {
  it("opens exactly the counted artist songs, retaining explicit metadata and collaborations", () => {
    const explicit = track({ id: "1", connectorId: "catalog", artist: "Kevin Gates", explicit: true });
    const duet = track({ id: "2", connectorId: "catalog", artist: "Other feat. Kevin Gates" });
    const playlists = [playlist("a", "Liked songs", [explicit, explicit, duet, track({ artist: "Unrelated" })]), playlist("b", "Driving", [explicit])];
    const presence = artistPresenceIn(buildMusicPlaylistIndex(playlists), "Kevin Gates");
    const songs = artistPlaylistTracks(presence.playlists, "Kevin Gates");
    assert.equal(songs.length, presence.trackCount);
    assert.deepEqual(songs, [explicit, duet, explicit]);
    assert.equal(songs[0].explicit, true);
  });
  it("matches the same recording across connectors", () => {
    const saved = track({
      id: "111",
      connectorId: "deezer",
      title: "First Day Out",
      artist: "Tee Grizzley",
    });
    const index = buildMusicPlaylistIndex([playlist("p1", "Late Night", [saved])]);
    const viewed = track({
      id: "abc",
      connectorId: "ytmusic",
      title: "First Day Out",
      artist: "Tee Grizzley",
    });
    assert.deepEqual(
      trackPlaylistsIn(index, viewed).map((entry) => entry.name),
      ["Late Night"],
    );
  });

  it("lists every playlist holding a track without repeating one", () => {
    const saved = track({ id: "1", connectorId: "deezer", title: "Rain", artist: "Tee Grizzley" });
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [saved, saved]),
      playlist("p2", "Drive", [saved]),
    ]);
    assert.deepEqual(
      trackPlaylistsIn(index, saved).map((entry) => entry.name),
      ["Late Night", "Drive"],
    );
  });

  it("does not claim membership for a different song by the same artist", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({ id: "1", connectorId: "deezer", title: "Rain", artist: "Tee Grizzley" }),
      ]),
    ]);
    const other = track({
      id: "2",
      connectorId: "deezer",
      title: "Second Day Out",
      artist: "Tee Grizzley",
    });
    assert.deepEqual(trackPlaylistsIn(index, other), []);
  });

  it("counts an artist's distinct songs and the playlists holding them", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({ id: "1", connectorId: "deezer", title: "Rain", artist: "Tee Grizzley" }),
        track({ id: "2", connectorId: "deezer", title: "First Day Out", artist: "Tee Grizzley" }),
      ]),
      playlist("p2", "Drive", [
        track({ id: "3", connectorId: "deezer", title: "No Effort", artist: "Tee Grizzley" }),
        track({ id: "9", connectorId: "deezer", title: "Unrelated", artist: "Madonna" }),
      ]),
    ]);
    const presence = artistPresenceIn(index, "Tee Grizzley");
    assert.equal(presence.trackCount, 3);
    assert.deepEqual(
      presence.playlists.map((entry) => entry.name),
      ["Late Night", "Drive"],
    );
  });

  it("finds a featured artist through the primary-artist key", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({
          id: "1",
          connectorId: "deezer",
          title: "Young Grizzley World",
          artist: "Tee Grizzley, A Boogie",
        }),
      ]),
    ]);
    assert.equal(artistPresenceIn(index, "Tee Grizzley").trackCount, 1);
    assert.equal(artistPresenceIn(index, "Tee Grizzley, A Boogie").trackCount, 1);
  });

  it("credits every artist on a collaboration, not just the first", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({
          id: "1",
          connectorId: "spotify",
          title: "Went Legit",
          artist: "G Herbo, Southside",
        }),
      ]),
    ]);
    assert.equal(artistPresenceIn(index, "G Herbo").trackCount, 1);
    assert.equal(artistPresenceIn(index, "Southside").trackCount, 1);
    assert.equal(artistPresenceIn(index, "G Herbo, Southside").trackCount, 1);
  });

  it("splits ampersand and feat credits, not only commas", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({ id: "1", connectorId: "spotify", title: "One", artist: "G Herbo & Southside" }),
        track({
          id: "2",
          connectorId: "spotify",
          title: "Two",
          artist: "Lil Durk feat. Southside",
        }),
      ]),
    ]);
    assert.equal(artistPresenceIn(index, "Southside").trackCount, 2);
    assert.equal(artistPresenceIn(index, "Lil Durk").trackCount, 1);
  });

  it("does not let a collaboration inflate a solo artist's count", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({ id: "1", connectorId: "spotify", title: "Solo", artist: "G Herbo" }),
        track({ id: "2", connectorId: "spotify", title: "Duo", artist: "G Herbo, Southside" }),
      ]),
    ]);
    assert.equal(artistPresenceIn(index, "G Herbo").trackCount, 2);
    assert.equal(artistPresenceIn(index, "Southside").trackCount, 1);
    assert.equal(artistPresenceIn(index, "G Herbo, Southside").trackCount, 1);
  });

  it("reports nothing until the index has loaded", () => {
    const pending = { ready: false, playlists: [], byTrack: new Map(), byArtist: new Map() };
    assert.deepEqual(trackPlaylistsIn(pending, track({ id: "1" })), []);
    assert.equal(artistPresenceIn(pending, "Tee Grizzley").trackCount, 0);
  });

  it("ignores an empty or missing artist rather than grouping them together", () => {
    const index = buildMusicPlaylistIndex([
      playlist("p1", "Late Night", [
        track({ id: "1", connectorId: "deezer", title: "Untitled", artist: "" }),
      ]),
    ]);
    assert.equal(artistPresenceIn(index, "").trackCount, 0);
  });
});
