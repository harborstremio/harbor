import assert from "node:assert/strict";
import test from "node:test";
import { explicitnessOf, rankByExplicitness } from "../src/lib/music/explicit-preference";
import type { MusicTrack } from "../src/lib/music/types";

function track(patch: Partial<MusicTrack>): MusicTrack {
  return {
    id: "id",
    title: "Sunshine",
    artist: "Young Dolph",
    artwork: "",
    durationSeconds: 180,
    durationLabel: "3:00",
    ...patch,
  } as MusicTrack;
}

test("a published flag settles the cut without reading the title", () => {
  assert.equal(explicitnessOf(track({ explicit: true, title: "Sunshine (Clean)" })), true);
  assert.equal(explicitnessOf(track({ explicit: false, title: "Sunshine (Explicit)" })), false);
});

test("an unflagged upload is read from its own label", () => {
  assert.equal(explicitnessOf(track({ title: "Sunshine (Clean)" })), false);
  assert.equal(explicitnessOf(track({ title: "Sunshine [Explicit]" })), true);
  assert.equal(explicitnessOf(track({ title: "Sunshine" })), undefined);
});

test("a radio edit is a length, not a rating, so it is never read as clean", () => {
  assert.equal(explicitnessOf(track({ title: "Like a Prayer (Cascada Radio Edit)" })), undefined);
});

test("asking for the explicit cut does not hand back the clean one", () => {
  const candidates = [
    { connectorId: "ytm", track: track({ id: "clean", explicit: false }) },
    { connectorId: "ytm", track: track({ id: "dirty", explicit: true }) },
  ];
  assert.equal(rankByExplicitness(candidates, true)[0].track.id, "dirty");
  assert.equal(rankByExplicitness(candidates, false)[0].track.id, "clean");
});

test("an unrated upload is preferred over the wrong cut, never over the right one", () => {
  const candidates = [
    { connectorId: "ytm", track: track({ id: "clean", explicit: false }) },
    { connectorId: "ytm", track: track({ id: "unknown" }) },
    { connectorId: "ytm", track: track({ id: "dirty", explicit: true }) },
  ];
  const order = rankByExplicitness(candidates, true).map((entry) => entry.track.id);
  assert.deepEqual(order, ["dirty", "unknown", "clean"]);
});

test("with nothing requested the provider's own order is left alone", () => {
  const candidates = [
    { connectorId: "ytm", track: track({ id: "first", explicit: false }) },
    { connectorId: "ytm", track: track({ id: "second", explicit: true }) },
  ];
  const order = rankByExplicitness(candidates, undefined).map((entry) => entry.track.id);
  assert.deepEqual(order, ["first", "second"]);
});

test("equal candidates keep the order the provider ranked them in", () => {
  const candidates = [
    { connectorId: "a", track: track({ id: "best", explicit: true }) },
    { connectorId: "b", track: track({ id: "second", explicit: true }) },
  ];
  const order = rankByExplicitness(candidates, true).map((entry) => entry.track.id);
  assert.deepEqual(order, ["best", "second"]);
});
