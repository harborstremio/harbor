import assert from "node:assert/strict";
import test from "node:test";
import { createDeckAdoption, type DeckAdoptRequest } from "../src/lib/music/deck-primary";
import type { MusicDeckSnapshot, MusicDeckState } from "../src/lib/music/decks";
import { queueTrackKey } from "../src/lib/music/queue-order";
import type { MusicPlayerState, MusicTrack } from "../src/lib/music/types";

const track = (id: string, extra: Partial<MusicTrack> = {}): MusicTrack =>
  ({
    id,
    connectorId: "catalog",
    title: id,
    artist: "Artist",
    artwork: "",
    durationSeconds: 200,
    durationLabel: "3:20",
    ...extra,
  }) as unknown as MusicTrack;

const A = track("a");
const B = track("b");
const C = track("c");

const PLAYED = track("tidal-b", {
  connectorId: "tidal",
  title: "b",
  collectionOrigin: { id: "b", connectorId: "catalog" },
});

const deck = (extra: Partial<MusicDeckState> = {}): MusicDeckState => ({
  deck: 1,
  live: true,
  paused: false,
  trackId: null,
  connectorId: null,
  positionSeconds: 0,
  durationSeconds: 200,
  volume: 1,
  gain: 1,
  ...extra,
});

function ask(extra: Partial<DeckAdoptRequest> = {}): DeckAdoptRequest {
  return {
    deck: 1,
    track: null,
    trackId: null,
    connectorId: null,
    live: true,
    paused: false,
    position: 0,
    duration: 200,
    ...extra,
  };
}

type Snapshots = MusicDeckSnapshot | (() => MusicDeckSnapshot);

function harness(
  start: Partial<MusicPlayerState> = {},
  snapshot?: Snapshots,
  releaseMs?: number,
) {
  let state: MusicPlayerState = {
    phase: "playing",
    current: A,
    queue: [A, B, C],
    queueIndex: 0,
    currentTime: 30,
    duration: 200,
    volume: 1,
    error: null,
    likedIds: [],
    likedTracks: [],
    recents: [],
    ...start,
  };
  const patches: Partial<MusicPlayerState>[] = [];
  const announced: MusicTrack[] = [];
  let ended = 0;
  const adoption = createDeckAdoption({
    read: () => state,
    publish: (patch) => {
      patches.push(patch);
      state = { ...state, ...patch };
    },
    announce: (item) => {
      announced.push(item);
    },
    ended: () => {
      ended += 1;
    },
    snapshot: async () => {
      if (typeof snapshot === "function") return snapshot();
      return snapshot ?? { decks: [deck({ deck: 0 }), deck()], primary: 1 };
    },
    releaseMs,
  });
  return {
    adoption,
    patches,
    announced,
    ended: () => ended,
    now: () => state,
    rest: () => adoption.adopt(ask({ deck: 0, live: false })),
  };
}

test("deck B is adopted as the track it is really carrying, not the queue entry", () => {
  const box = harness();
  const landed = box.adoption.adopt(
    ask({ track: PLAYED, trackId: "tidal-b", connectorId: "tidal", position: 13 }),
  );
  box.rest();
  assert.equal(landed, true);
  assert.equal(box.now().current?.id, "tidal-b");
  assert.equal(box.now().currentTime, 13);
  assert.equal(box.announced.at(0)?.id, "tidal-b");
});

test("a candidate track keeps its place in the queue instead of piling on the end", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", connectorId: "tidal" }));
  box.rest();
  assert.equal(box.now().queue.length, 3);
  assert.equal(box.now().queueIndex, 1);
  assert.equal(box.now().queue[1]?.id, "tidal-b");
  assert.equal(box.now().queue[2]?.id, "c");
});

test("next advances past the adopted deck B track", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", connectorId: "tidal" }));
  box.rest();
  const after = box.now().queue[box.now().queueIndex + 1];
  assert.equal(after?.id, "c");
});

test("a track the main window cannot identify is refused so the deck keeps asking", () => {
  const box = harness();
  const landed = box.adoption.adopt(ask({ trackId: "ghost", connectorId: "tidal" }));
  assert.equal(landed, false);
  assert.equal(box.adoption.deck(), 0);
  assert.equal(box.patches.length, 0);
});

test("the retry lands once the payload carries the track", () => {
  const box = harness();
  assert.equal(box.adoption.adopt(ask({ trackId: "tidal-b" })), false);
  const landed = box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b" }));
  box.rest();
  assert.equal(landed, true);
  assert.equal(box.now().current?.id, "tidal-b");
});

test("an unnamed deck is matched by identity rather than by a bare id compare", () => {
  const twin = track("ytm-b", { connectorId: "ytmusic", title: "b", artist: "Artist" });
  const box = harness();
  const landed = box.adoption.adopt(ask({ track: twin, trackId: null }));
  box.rest();
  assert.equal(landed, true);
  assert.equal(box.now().queueIndex, 1);
  assert.equal(box.now().queue.length, 3);
});

test("an identity match keeps the queue entry's own identity so listening order holds", () => {
  const twin = track("ytm-b", { connectorId: "ytmusic", title: "b", artist: "Artist" });
  const box = harness();
  box.adoption.adopt(ask({ track: twin, trackId: null }));
  box.rest();
  assert.equal(queueTrackKey(box.now().queue[1]), queueTrackKey(B));
  assert.equal(queueTrackKey(box.now().current as MusicTrack), "catalog:b");
});

test("a deck that is not live is never adopted", () => {
  const box = harness();
  assert.equal(box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", live: false })), false);
  assert.equal(box.adoption.deck(), 0);
});

test("a repeated adopt is acknowledged without moving anything again", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", position: 13 }));
  const again = box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", position: 20 }));
  box.rest();
  assert.equal(again, true);
  assert.equal(box.announced.length, 1);
});

test("a paused deck adopts as paused and a running deck as playing", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", paused: true }));
  assert.equal(box.now().phase, "paused");
  box.rest();
  const other = harness();
  other.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", paused: false }));
  assert.equal(other.now().phase, "playing");
  other.rest();
});

test("crossfading back restores deck A with the position it really reached", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", position: 13 }));
  const landed = box.adoption.adopt(
    ask({ deck: 0, trackId: "a", connectorId: "catalog", position: 92.5, paused: false }),
  );
  assert.equal(landed, true);
  assert.equal(box.adoption.deck(), 0);
  assert.equal(box.now().current?.id, "a");
  assert.equal(box.now().currentTime, 92.5);
  assert.equal(box.now().phase, "playing");
});

test("promotion is a role change, so both decks keep their tracks in the queue", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b" }));
  box.adoption.adopt(ask({ deck: 0, trackId: "a", position: 92.5 }));
  const queue = box.now().queue;
  assert.equal(queue.length, 3);
  assert.deepEqual(
    queue.map((item) => item.id),
    ["a", "tidal-b", "c"],
  );
  assert.equal(box.now().queueIndex, 0);
});

test("a dead deck A is not restored over whatever is on air", () => {
  const box = harness();
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b" }));
  const landed = box.adoption.adopt(ask({ deck: 0, live: false, trackId: null }));
  assert.equal(landed, true);
  assert.equal(box.adoption.deck(), 0);
  assert.equal(box.now().current?.id, "tidal-b");
});

test("an idle main window is never hijacked by the deck", () => {
  const box = harness({ phase: "idle", current: null, queue: [], queueIndex: -1 });
  const landed = box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b" }));
  box.rest();
  assert.equal(landed, true);
  assert.equal(box.now().current, null);
});

test("the watch lets go once deck B is gone and the engine is back on deck A", async () => {
  let alive = true;
  const box = harness(
    {},
    () => ({
      decks: [deck({ deck: 0, live: false }), deck({ live: alive })],
      primary: alive ? 1 : 0,
    }),
    0,
  );
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", position: 13 }));
  assert.equal(box.adoption.deck(), 1);
  alive = false;
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(box.adoption.deck(), 0);
});

test("an ejected deck B still hands back to deck A within the grace period", async () => {
  let alive = true;
  const box = harness(
    {},
    () => ({
      decks: [deck({ deck: 0, live: !alive }), deck({ live: alive })],
      primary: alive ? 1 : 0,
    }),
    5000,
  );
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", position: 13 }));
  alive = false;
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(box.adoption.deck(), 1);
  const landed = box.adoption.adopt(
    ask({ deck: 0, trackId: "a", connectorId: "catalog", position: 92.5 }),
  );
  assert.equal(landed, true);
  assert.equal(box.adoption.deck(), 0);
  assert.equal(box.now().current?.id, "a");
  assert.equal(box.now().currentTime, 92.5);
});

test("the watch follows deck B and reports the end of its track once", async () => {
  const box = harness(
    {},
    {
      decks: [deck({ deck: 0 }), deck({ positionSeconds: 199.8, durationSeconds: 200 })],
      primary: 1,
    },
  );
  box.adoption.adopt(ask({ track: PLAYED, trackId: "tidal-b", position: 13 }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  box.rest();
  assert.equal(box.ended(), 1);
  assert.equal(box.now().currentTime, 199.8);
});
