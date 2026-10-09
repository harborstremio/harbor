import assert from "node:assert/strict";
import test from "node:test";
import {
  cachedSportsSnapshot,
  loadSportsSlices,
  reconcileSportsGames,
  type SportsSnapshot,
} from "../src/lib/sports/hub-cache.ts";
import {
  filterCachedTournament,
  isGameOnLocalDay,
  sportsDbTimestamp,
} from "../src/lib/sports/slice-calendar.ts";
import { parseEvents, toSide } from "../src/lib/sports/espn-parse.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

const game = (id: string): SportsGame => ({
  id,
  league: "ATP",
  state: "pre",
  startMs: new Date(2026, 8, 13, 12).getTime(),
  detail: "",
  home: { id: "1", name: "A", abbr: "A", logo: "", score: "", winner: false },
  away: { id: "2", name: "B", abbr: "B", logo: "", score: "", winner: false },
});

test("cached schedules are ready synchronously and recent cache does not flash stale", () => {
  const now = Date.now();
  const snapshot = cachedSportsSnapshot(
    ["TENNIS@20260913@day"],
    () => ({ at: now, games: [game("one")] }),
    now,
  );
  assert.equal(snapshot.games.length, 1);
  assert.equal(snapshot.stale, false);
  assert.equal(snapshot.games[0].savedAt, undefined);
});

test("refresh keeps unchanged fixture references but updates actual scores", () => {
  const before = [game("one"), game("two")];
  assert.equal(reconcileSportsGames(before, structuredClone(before)), before);
  const next = structuredClone(before);
  next[1].home.score = "2";
  const after = reconcileSportsGames(before, next);
  assert.equal(after[0], before[0]);
  assert.notEqual(after[1], before[1]);
  assert.equal(after[1].home.score, "2");
});

test("a feed burst renders progressively without publishing each league separately", async () => {
  const snapshots: SportsSnapshot[] = [];
  const keys = Array.from({ length: 50 }, (_, i) => `league-${i}`);
  await loadSportsSlices(
    keys,
    () => undefined,
    async (key) => [game(key)],
    () => {},
    (value) => snapshots.push(value),
    new AbortController().signal,
  );
  assert(snapshots.length <= 4, `Expected batched renders, got ${snapshots.length}`);
  assert.equal(snapshots.at(-1)?.games.length, 50);
  assert.equal(snapshots.at(-1)?.pending, 0);
});

test("reusing a recent result never extends its freshness or writes it again", async () => {
  const at = Date.now() - 1000;
  let fetched = 0,
    saved = 0;
  const snapshots: SportsSnapshot[] = [];
  await loadSportsSlices(
    ["TENNIS@20260913@day"],
    () => ({ at, games: [game("one")] }),
    async () => {
      fetched++;
      return [];
    },
    () => saved++,
    (value) => snapshots.push(value),
    new AbortController().signal,
    5,
    15_000,
  );
  assert.equal(fetched, 0);
  assert.equal(saved, 0);
  assert.equal(snapshots.at(-1)?.at, at);
});

test("previous tennis rounds cannot leak into today's board including legacy cache", () => {
  const today = game("today"),
    qualifier = {
      ...game("qualifier"),
      startMs: new Date(2026, 7, 24, 10).getTime(),
    };
  assert(isGameOnLocalDay(today, "20260913"));
  assert(!isGameOnLocalDay(qualifier, "20260913"));
  assert.deepEqual(filterCachedTournament("TENNIS@20260913@day", [today, qualifier]), [today]);
  assert.equal(filterCachedTournament("TENNIS@20260913@upcoming", [today, qualifier]).length, 2);
});

test("tennis detail uses numeric competitor ID and set wins when headline score is absent", () => {
  const side = toSide(
    {
      id: "11685",
      type: "athlete",
      athlete: { guid: "non-numeric-guid", displayName: "Jacob Fearnley" },
      linescores: [
        { value: 7, winner: true },
        { value: 6, winner: true },
      ],
    },
    "tennis",
  );
  assert.equal(side.id, "11685");
  assert.equal(side.score, "2");
});

test("zone-less SportsDB times stay UTC, while explicit offsets remain intact", () => {
  assert.equal(
    sportsDbTimestamp("2026-09-13T04:15:00", null, null),
    Date.parse("2026-09-13T04:15:00Z"),
  );
  assert.equal(
    sportsDbTimestamp("2026-09-13T13:45:00+09:30", null, null),
    Date.parse("2026-09-13T04:15:00Z"),
  );
});

test("major tournament payloads keep ATP and WTA singles in their own tours", () => {
  const competition = (id: string) => ({
    id,
    date: "2026-09-13T18:00:00Z",
    competitors: [1, 2].map((n) => ({
      id: String(n),
      type: "athlete",
      athlete: { displayName: `Player ${n}` },
    })),
  });
  const event = {
    id: "open",
    name: "US Open",
    groupings: [
      { grouping: { displayName: "Men's Singles" }, competitions: [competition("men")] },
      { grouping: { displayName: "Women's Singles" }, competitions: [competition("women")] },
    ],
  };
  const base = {
    key: "TENNIS",
    tag: "ATP",
    label: "ATP",
    labelEn: "ATP",
    logo: "",
    group: "tennis",
  };
  assert.deepEqual(
    parseEvents([event], { ...base, path: "tennis/atp" }).map((game) => game.id),
    ["open|men"],
  );
  assert.deepEqual(
    parseEvents([event], { ...base, tag: "WTA", path: "tennis/wta" }).map((game) => game.id),
    ["open|women"],
  );
});
