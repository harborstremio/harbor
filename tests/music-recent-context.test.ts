import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getMusicRecentContexts,
  getMusicTrackContext,
  musicContextArtwork,
  recordMusicRecentContext,
} from "../src/lib/music/recent-context";
import type { MusicTrack } from "../src/lib/music/types";

function track(partial: Partial<MusicTrack>): MusicTrack {
  return {
    id: partial.id ?? "id",
    connectorId: partial.connectorId,
    title: partial.title ?? "Title",
    artist: partial.artist ?? "Artist",
    artwork: partial.artwork ?? "",
    durationSeconds: 180,
    durationLabel: "3:00",
    ...partial,
  };
}

const deezer = track({
  id: "111",
  connectorId: "deezer",
  title: "First Day Out",
  artist: "Tee Grizzley",
  artwork: "a.jpg",
});
const ytm = track({
  id: "abc",
  connectorId: "ytmusic",
  title: "First Day Out",
  artist: "Tee Grizzley",
  artwork: "b.jpg",
});
const seed = track({ id: "seed", connectorId: "deezer", title: "Seed", artist: "Someone" });

describe("music recent contexts", () => {
  it("links a mix track that playback resolved through a different source", () => {
    recordMusicRecentContext(
      { kind: "similar", id: seed.id, name: seed.title, artwork: ["a.jpg"], seed },
      [deezer],
    );
    assert.equal(getMusicTrackContext(deezer)?.id, seed.id);
    assert.equal(
      getMusicTrackContext(ytm)?.id,
      seed.id,
      "a source swap changes the track id, so an id-only link loses the mix",
    );
  });

  it("keeps the newest context first and dedupes on kind and id", () => {
    recordMusicRecentContext(
      { kind: "playlist", id: "p1", name: "Late Night", artwork: [] },
      [deezer],
    );
    recordMusicRecentContext(
      { kind: "playlist", id: "p1", name: "Late Night", artwork: [] },
      [deezer],
    );
    const contexts = getMusicRecentContexts();
    assert.equal(contexts[0]?.id, "p1");
    assert.equal(contexts.filter((entry) => entry.id === "p1").length, 1);
    assert.equal(getMusicTrackContext(deezer)?.id, "p1", "the newest context wins the link");
  });

  it("refuses a similar context with no seed, so reopening can never dead-end", () => {
    const before = getMusicRecentContexts().length;
    recordMusicRecentContext({ kind: "similar", id: "nope", name: "No Seed", artwork: [] }, []);
    assert.equal(getMusicRecentContexts().length, before);
  });

  it("caps the context list and drops links whose context fell off", () => {
    for (let n = 0; n < 20; n += 1) {
      recordMusicRecentContext({ kind: "playlist", id: `x${n}`, name: `Mix ${n}`, artwork: [] }, [
        track({ id: `t${n}`, connectorId: "deezer", title: `T${n}`, artist: "A" }),
      ]);
    }
    const contexts = getMusicRecentContexts();
    assert.ok(contexts.length <= 12, `expected at most 12 contexts, got ${contexts.length}`);
    assert.equal(contexts[0]?.id, "x19");
    assert.equal(
      getMusicTrackContext(track({ id: "t0", connectorId: "deezer", title: "T0", artist: "A" })),
      null,
    );
  });

  it("takes four distinct covers for the mosaic", () => {
    const covers = musicContextArtwork([
      track({ artwork: "1.jpg" }),
      track({ artwork: "1.jpg" }),
      track({ artwork: "" }),
      track({ artwork: "2.jpg" }),
      track({ artwork: "3.jpg" }),
      track({ artwork: "4.jpg" }),
      track({ artwork: "5.jpg" }),
    ]);
    assert.deepEqual(covers, ["1.jpg", "2.jpg", "3.jpg", "4.jpg"]);
  });
});
