import test from "node:test";
import assert from "node:assert/strict";
import { insertIntoQueue, manualBlockEnd } from "../src/lib/music/queue-insert";
import type { MusicTrack } from "../src/lib/music/types";

const track = (id: string) =>
  ({
    id,
    connectorId: "s",
    title: id,
    artist: "A",
    durationSeconds: 1,
    durationLabel: "0:01",
  }) as MusicTrack;
const queue = (...ids: string[]) => ids.map(track);

test("a queued song plays next, not after the whole playlist", () => {
  const q = queue("playing", "p1", "p2", "p3");
  const at = manualBlockEnd(q, 0, () => false);
  assert.equal(at, 1);
  assert.deepEqual(
    insertIntoQueue(q, track("added"), at).map((t) => t.id),
    ["playing", "added", "p1", "p2", "p3"],
  );
});

test("queueing several keeps them in the order they were added, ahead of the playlist", () => {
  const q = queue("playing", "first", "p1", "p2");
  const manual = new Set(["first"]);
  const at = manualBlockEnd(q, 0, (t) => manual.has(t.id));
  assert.equal(at, 2);
  assert.deepEqual(
    insertIntoQueue(q, track("second"), at).map((t) => t.id),
    ["playing", "first", "second", "p1", "p2"],
  );
});

test("the currently playing track is never displaced", () => {
  const q = queue("playing", "p1");
  const next = insertIntoQueue(
    q,
    track("added"),
    manualBlockEnd(q, 0, () => false),
  );
  assert.equal(next[0].id, "playing");
});

test("queueing with nothing playing puts it at the front", () => {
  const q = queue("p1", "p2");
  assert.equal(
    manualBlockEnd(q, -1, () => false),
    0,
  );
});

test("a duplicate is not queued twice", () => {
  const q = queue("playing", "dupe");
  assert.equal(insertIntoQueue(q, track("dupe"), 1), q);
});

test("an out of range insert point is clamped instead of losing the track", () => {
  const q = queue("a");
  assert.deepEqual(
    insertIntoQueue(q, track("b"), 99).map((t) => t.id),
    ["a", "b"],
  );
  assert.deepEqual(
    insertIntoQueue(q, track("c"), -5).map((t) => t.id),
    ["c", "a"],
  );
});
