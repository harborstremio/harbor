import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adoptRequestedIdentity,
  replaceQueueTrack,
  selectableSources,
} from "../src/lib/music/queue-source";
import type { MusicSourceCandidate, MusicTrack } from "../src/lib/music/types";

const track = (id: string, connectorId: string, extra: Partial<MusicTrack> = {}) =>
  ({
    id,
    connectorId,
    title: id,
    artist: "A",
    durationSeconds: 1,
    durationLabel: "0:01",
    ...extra,
  }) as MusicTrack;

const candidate = (connectorId: string, id: string, health: string = "online") =>
  ({
    connectorId,
    connectorName: connectorId,
    health,
    track: track(id, connectorId),
  }) as unknown as MusicSourceCandidate;

test("swapping a queued track keeps its place in the queue", () => {
  const queue = [track("a", "spotify"), track("b", "spotify"), track("c", "spotify")];
  const next = replaceQueueTrack(queue, 1, track("b2", "youtube_music"));
  assert.equal(next.length, 3);
  assert.equal(next[1].connectorId, "youtube_music");
  assert.equal(next[0].id, "a");
  assert.equal(next[2].id, "c");
});

test("the swap keeps the collection it came from, so going back still works", () => {
  const original = track("b", "spotify", {
    collectionOrigin: { id: "playlist1", connectorId: "spotify" },
  });
  const next = replaceQueueTrack([original], 0, track("b2", "youtube_music"));
  assert.equal(next[0].collectionOrigin?.id, "playlist1");
  assert.equal(next[0].collectionOrigin?.connectorId, "spotify");
});

test("a track with no collection adopts itself as the origin", () => {
  const next = adoptRequestedIdentity(track("b2", "youtube_music"), track("b", "spotify"));
  assert.equal(next.collectionOrigin?.id, "b");
  assert.equal(next.collectionOrigin?.connectorId, "spotify");
});

test("a swapped source keeps the requested song's credits, not the uploader's", () => {
  const requested = track("b", "spotify", { title: "Violent Kiss", artist: "Eyes Set To Kill" });
  const rip = track("b2", "soundcloud", { title: "violent kiss (full)", artist: "angelicold" });
  const next = adoptRequestedIdentity(rip, requested);
  assert.equal(next.connectorId, "soundcloud");
  assert.equal(next.id, "b2");
  assert.equal(next.title, "Violent Kiss");
  assert.equal(next.artist, "Eyes Set To Kill");
  assert.equal(next.collectionOrigin?.artist, "Eyes Set To Kill");
});

test("swapping to the identical source is a no-op, so the queue identity is stable", () => {
  const queue = [track("a", "spotify")];
  assert.equal(replaceQueueTrack(queue, 0, track("a", "spotify")), queue);
});

test("an out of range index never damages the queue", () => {
  const queue = [track("a", "spotify")];
  assert.equal(replaceQueueTrack(queue, 5, track("z", "youtube_music")), queue);
  assert.equal(replaceQueueTrack(queue, -1, track("z", "youtube_music")), queue);
});

test("offline sources and the track's current source are not offered", () => {
  const current = track("a", "spotify");
  const offered = selectableSources(
    [
      candidate("spotify", "a"),
      candidate("youtube_music", "a2"),
      candidate("plex", "a3", "offline"),
    ],
    current,
  );
  assert.deepEqual(
    offered.map((c) => c.connectorId),
    ["youtube_music"],
  );
});

test("duplicate candidates are offered once", () => {
  const offered = selectableSources(
    [candidate("youtube_music", "x"), candidate("youtube_music", "x")],
    track("a", "spotify"),
  );
  assert.equal(offered.length, 1);
});

test("the queue row swaps the source without starting playback", () => {
  const queue = readFileSync("src/components/music/music-queue.tsx", "utf8");
  assert.ok(
    queue.includes("replaceQueueTrack(queue, index, candidate.track)"),
    "the row must swap in place",
  );
  const handler = queue.slice(queue.indexOf("onSource={candidate =>"));
  assert.ok(
    !handler.slice(0, handler.indexOf("\n")).includes("playMusic"),
    "switching an upcoming source must not start playing it",
  );
});
