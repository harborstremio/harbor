import assert from "node:assert/strict";
import test from "node:test";
import { MusicQueueOrder, queueTrackKey } from "../src/lib/music/queue-order";
import type { MusicTrack } from "../src/lib/music/types";

const track = (id: string): MusicTrack =>
  ({ id, connectorId: "c", title: id, artist: "a" }) as unknown as MusicTrack;
const QUEUE = ["a", "b", "c", "d", "e", "f"].map(track);
const OFF = { shuffle: false, repeat: "off" as const };
const ON = { shuffle: true, repeat: "off" as const };
const ON_ALL = { shuffle: true, repeat: "all" as const };

/** Deterministic so a shuffled order can be asserted rather than merely observed. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test("with shuffle off the preview is simply what comes next", () => {
  const order = new MusicQueueOrder();
  assert.deepEqual(
    order.upcoming(QUEUE, 0, OFF, 3).map((t) => t.id),
    ["b", "c", "d"],
  );
  assert.deepEqual(
    order.upcoming(QUEUE, 4, OFF, 3).map((t) => t.id),
    ["f"],
  );
});

test("repeat all wraps the preview round to the start", () => {
  const order = new MusicQueueOrder();
  const seen = order.upcoming(QUEUE, 4, { shuffle: false, repeat: "all" }, 3).map((t) => t.id);
  assert.deepEqual(seen, ["f", "a", "b"]);
});

test("with shuffle on the preview is NOT the stored order", () => {
  const order = new MusicQueueOrder();
  const seen = order.upcoming(QUEUE, 0, ON, 5, seeded(7)).map((t) => t.id);
  assert.notDeepEqual(seen, ["b", "c", "d", "e", "f"]);
  assert.equal(seen.length, 5);
  assert.equal(new Set(seen).size, 5);
  assert.equal(seen.includes("a"), false);
});

test("the shuffled preview is what actually plays next", () => {
  const order = new MusicQueueOrder();
  const preview = order.upcoming(QUEUE, 0, ON, 3, seeded(11)).map((t) => t.id);
  const played: string[] = [];
  let index = 0;
  for (let i = 0; i < 3; i += 1) {
    const next = order.next(QUEUE, index, ON, true, null, seeded(11));
    if (!next) break;
    played.push(next.id);
    index = QUEUE.findIndex((t) => queueTrackKey(t) === queueTrackKey(next));
  }
  assert.deepEqual(played, preview);
});

test("the preview is stable across repeated reads, it does not reshuffle on every render", () => {
  const order = new MusicQueueOrder();
  const first = order.upcoming(QUEUE, 0, ON, 4, seeded(3)).map((t) => t.id);
  const second = order.upcoming(QUEUE, 0, ON, 4, seeded(99)).map((t) => t.id);
  assert.deepEqual(second, first);
});

test("toggling shuffle deals a fresh order", () => {
  const order = new MusicQueueOrder();
  const before = order.upcoming(QUEUE, 0, ON, 5, seeded(3)).map((t) => t.id);
  order.reset();
  const after = order.upcoming(QUEUE, 0, ON, 5, seeded(4242)).map((t) => t.id);
  assert.equal(after.length, 5);
  assert.notDeepEqual(after, before);
});

test("a play-next pick leads the preview", () => {
  const order = new MusicQueueOrder();
  order.upcoming(QUEUE, 0, ON, 3, seeded(5));
  const moved = order.previous(QUEUE, 2, true);
  assert.equal(moved, null);
});

test("repeat one has no up next, the same song follows itself", () => {
  const order = new MusicQueueOrder();
  assert.deepEqual(order.upcoming(QUEUE, 0, { shuffle: true, repeat: "one" }, 3), []);
});

test("shuffle still visits every track once before repeating", () => {
  const order = new MusicQueueOrder();
  const played = new Set<string>();
  let index = 0;
  for (let i = 0; i < QUEUE.length - 1; i += 1) {
    const next = order.next(QUEUE, index, ON, true, null, seeded(21));
    if (!next) break;
    assert.equal(played.has(next.id), false, `repeated ${next.id}`);
    played.add(next.id);
    index = QUEUE.findIndex((t) => queueTrackKey(t) === queueTrackKey(next));
  }
  assert.equal(played.size, QUEUE.length - 1);
});

test("an exhausted shuffle stops unless repeat all is on", () => {
  const order = new MusicQueueOrder();
  let index = 0;
  for (let i = 0; i < QUEUE.length * 2; i += 1) {
    const next = order.next(QUEUE, index, ON, true, null, seeded(31));
    if (!next) return;
    index = QUEUE.findIndex((t) => queueTrackKey(t) === queueTrackKey(next));
  }
  assert.fail("shuffle without repeat should have ended");
});

test("repeat all keeps going past the end of the order", () => {
  const order = new MusicQueueOrder();
  let index = 0;
  let plays = 0;
  for (let i = 0; i < QUEUE.length * 2; i += 1) {
    const next = order.next(QUEUE, index, ON_ALL, true, null, seeded(41));
    if (!next) break;
    plays += 1;
    index = QUEUE.findIndex((t) => queueTrackKey(t) === queueTrackKey(next));
  }
  assert.ok(plays > QUEUE.length, `only played ${plays}`);
});

test("peeking at the previous track does not consume the history", () => {
  const order = new MusicQueueOrder();
  const first = order.next(QUEUE, 0, ON, true, null, seeded(7));
  assert.ok(first);
  const at = QUEUE.findIndex((t) => queueTrackKey(t) === queueTrackKey(first!));

  const peeked = order.peekPrevious(QUEUE, at, true);
  assert.equal(peeked?.id, "a");
  assert.equal(order.peekPrevious(QUEUE, at, true)?.id, "a");
  assert.equal(order.previous(QUEUE, at, true)?.id, "a");
});

test("the warm preview matches the track shuffle actually advances to", () => {
  const warm = new MusicQueueOrder();
  const play = new MusicQueueOrder();
  let index = 0;
  for (let i = 0; i < QUEUE.length - 1; i += 1) {
    const predicted = warm.upcoming(QUEUE, index, ON, 3, seeded(19))[0];
    const actual = play.next(QUEUE, index, ON, true, null, seeded(19));
    assert.ok(actual, `advance stopped at step ${i}`);
    assert.equal(predicted?.id, actual!.id, `step ${i} warmed the wrong track`);
    index = QUEUE.findIndex((t) => queueTrackKey(t) === queueTrackKey(actual!));
  }
});
