import assert from "node:assert/strict";
import test from "node:test";
import {
  matchCardContext,
  publishedSideContext,
  relativeCardStart,
} from "../src/lib/sports/card-context.ts";
import { parseEvents } from "../src/lib/sports/espn-parse.ts";
import { reconcileSportsGames } from "../src/lib/sports/hub-cache.ts";
import type { LeagueDef, SportsGame } from "../src/lib/sports/espn-types.ts";

const league: LeagueDef = {
  key: "NCAAWVOLLEY",
  tag: "NCAAWVOLLEY",
  label: "NCAA",
  labelEn: "NCAA Women's Volleyball",
  path: "volleyball/womens-college-volleyball",
  group: "volleyball",
  logo: "",
};
const competitor = (id: string, homeAway: string) => ({
  id,
  type: "team",
  homeAway,
  team: {
    id,
    displayName: id === "221" ? "Pittsburgh Panthers" : "Wright State Raiders",
    logo: `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`,
  },
  records: [
    { name: "Home", type: "home", summary: "0-0" },
    { name: "overall", type: "total", summary: id === "221" ? "10-0" : "4-5" },
  ],
  curatedRank: { current: id === "221" ? 2 : 99 },
});
const fixture = {
  id: "401884323",
  name: "Wright State Raiders at Pittsburgh Panthers",
  date: "2026-09-13T17:00:00Z",
  competitions: [
    {
      id: "401884323",
      venue: {
        fullName: "Victory Heights Arena and Sports Performance Center",
      },
      status: { type: { state: "pre", shortDetail: "Scheduled" } },
      broadcasts: [{ names: ["ACCNX"] }],
      competitors: [competitor("221", "home"), competitor("2750", "away")],
    },
  ],
};
const game = (): SportsGame => parseEvents([fixture], league)[0];

test("scoreboard context keeps the published overall record and drops the unranked99 sentinel", () => {
  const parsed = game();
  assert.equal(parsed.home.record, "10-0");
  assert.equal(parsed.away.record, "4-5");
  assert.equal(parsed.home.rank, 2);
  assert.equal(parsed.away.rank, undefined);
  assert.equal(parsed.context?.venue, "Victory Heights Arena and Sports Performance Center");
  assert.equal(
    parsed.context?.name,
    "",
    "Ordinary team-match hero names retain the existing team composition",
  );
});

test("missing or malformed published records never create a synthetic team record", () => {
  assert.deepEqual(publishedSideContext(undefined), {
    record: undefined,
    rank: undefined,
  });
  assert.deepEqual(
    publishedSideContext({
      records: [null, { name: "Home", summary: "2-0" }],
      curatedRank: { current: 99 },
    }),
    { record: undefined, rank: undefined },
  );
  assert.equal(
    publishedSideContext({ records: [{ type: "total", summary: "0-0" }] }).record,
    "0-0",
  );
});

test("card context uses existing stage, venue and distinct broadcasters without repeating generic labels", () => {
  const parsed = game();
  parsed.context = {
    ...parsed.context!,
    round: "Semifinal",
    draw: "Semifinal",
  };
  parsed.broadcasts = ["ESPN", "ESPN", "ABC"];
  assert.deepEqual(matchCardContext(parsed), [
    { kind: "stage", value: "Semifinal" },
    {
      kind: "venue",
      value: "Victory Heights Arena and Sports Performance Center",
    },
    { kind: "broadcast", value: "ESPN · ABC" },
  ]);
  parsed.context.draw = "Standard";
  assert.equal(matchCardContext(parsed)[0].value, "Semifinal");
});

test("sparse upcoming cards use a localized relative start and never imply a past match is live", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  const parsed = {
    ...game(),
    context: undefined,
    broadcasts: [],
    startMs: now + 120 * 60000,
  };
  assert.deepEqual(matchCardContext(parsed, now), [{ kind: "start", value: parsed.startMs }]);
  assert.equal(relativeCardStart(parsed.startMs, "en", now), "in 2 hours");
  assert.notEqual(relativeCardStart(parsed.startMs, "fr", now), "in 2 hours");
  assert.deepEqual(matchCardContext({ ...parsed, startMs: now - 1 }, now), []);
});

test("schedule refresh preserves stable cards while updating records, rankings and venue context", () => {
  const before = [game()];
  assert.equal(reconcileSportsGames(before, structuredClone(before)), before);
  for (const change of [
    (next: SportsGame) => {
      next.home.record = "11-0";
    },
    (next: SportsGame) => {
      next.home.rank = 1;
    },
    (next: SportsGame) => {
      next.context!.venue = "Updated venue";
    },
    (next: SportsGame) => {
      next.broadcasts = ["ESPN"];
    },
  ]) {
    const next = structuredClone(before);
    change(next[0]);
    assert.notEqual(reconcileSportsGames(before, next)[0], before[0]);
  }
});
