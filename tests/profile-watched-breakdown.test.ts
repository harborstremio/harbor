// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import { computeWatchedBreakdown } from "../src/lib/social/watched-breakdown.ts";
import { watchMinutes } from "../src/lib/profile-card-layout.ts";

const now = Date.now();

localStorage.setItem(
  "harbor.playback-history.v1",
  JSON.stringify({
    tt_opened: { savedAt: now },
    tt_movie: { savedAt: now },
    "tt_series|s1e2": { savedAt: now },
  }),
);
localStorage.setItem("harbor.moviewatched.v1", JSON.stringify(["tt_movie"]));
localStorage.setItem("harbor.manualwatched.v1", JSON.stringify(["tt_series|1|2"]));
localStorage.setItem(
  "harbor.resume",
  JSON.stringify({
    "tt_series|s1e2": { ms: 600000, t: now },
    "tt_other_profile|s1e1": { ms: 7200000, t: now },
  }),
);

const breakdown = await computeWatchedBreakdown(null);
if (!breakdown) throw new Error("the breakdown must be computable from local storage alone");

test("a stream that was only opened is not a watched movie", () => {
  assert.equal(breakdown.moviesWatched, 1);
  assert.equal(breakdown.watched, 3);
});

test("an episode logged by both the manual list and playback history counts once", () => {
  assert.equal(breakdown.episodesWatched, 1);
});

test("resume rows outside this profile's playback history add no watch time", () => {
  assert.equal(breakdown.minutesWatched, 10);
});

test("watch time is no longer floored by a per-title estimate", () => {
  assert.equal(watchMinutes({ minutesWatched: 30, moviesWatched: 2, episodesWatched: 10 }), 30);
  assert.equal(watchMinutes({ hoursWatched: 2, moviesWatched: 40, episodesWatched: 100 }), 120);
  assert.equal(watchMinutes({ moviesWatched: 1, episodesWatched: 2 }), 210);
});
