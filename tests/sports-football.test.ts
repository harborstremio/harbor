import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFootballEvents,
  parseFootballSituation,
} from "../src/lib/sports/football-situation.ts";
import { parseTeamSummary } from "../src/lib/sports/espn-summary.ts";
import { leagueByTag } from "../src/lib/sports/espn-leagues.ts";

const liveHeader = {
  competitions: [{ status: { type: { state: "in" }, displayClock: "8:16", period: 4 } }],
};
const play = (
  id: number,
  end: Record<string, unknown> = {
    down: 3,
    distance: 5,
    team: { id: "19" },
    yardLine: 91,
    possessionText: "DAL 9",
  },
) => ({
  id: String(id),
  sequenceNumber: String(id * 100),
  text: `Play ${id}`,
  clock: { displayValue: "8:16" },
  period: { number: 4 },
  start: { team: { id: "6" } },
  end,
});

test("NFL snapshot uses the latest reported end state, including a change of possession", () => {
  const data = { header: liveHeader, drives: { current: { plays: [play(2), play(1)] } } };
  assert.deepEqual(parseFootballSituation(data), {
    source: "last-play",
    down: 3,
    distance: 5,
    possessionTeamId: "19",
    yardLine: 91,
    yardLineText: "DAL 9",
    clock: "8:16",
    period: 4,
    lastPlayId: "2",
  });
  assert.equal(parseFootballEvents(data)[0].teamId, "6");
});

test("touchdowns and between-play down sentinels never resurrect the preceding down", () => {
  for (const down of [-1, 0, 5, "3", undefined]) {
    assert.equal(
      parseFootballSituation({
        header: liveHeader,
        drives: { current: { plays: [play(1), play(2, { down, distance: 0 })] } },
      }),
      undefined,
    );
  }
  assert.equal(
    parseFootballSituation({ header: liveHeader, drives: { previous: [{ plays: [play(1)] }] } }),
    undefined,
  );
  assert.equal(
    parseFootballSituation({
      header: { competitions: [{ status: { type: { state: "post" } } }] },
      drives: { current: { plays: [play(1)] } },
    }),
    undefined,
  );
});

test("direct situation takes precedence and preserves zero yards without coercing malformed values", () => {
  const data = {
    header: liveHeader,
    situation: { down: 1, distance: 0, possession: 19, yardLine: 0 },
    drives: { current: { plays: [play(2)] } },
  };
  const situation = parseFootballSituation(data)!;
  assert.equal(situation.source, "situation");
  assert.equal(situation.distance, 0);
  assert.equal(situation.yardLine, 0);
  assert.equal(situation.possessionTeamId, "19");
  const malformed = parseFootballSituation({
    ...data,
    situation: { down: 2, distance: "10", yardLine: 101, possession: {} },
  })!;
  assert.equal(malformed.distance, undefined);
  assert.equal(malformed.yardLine, undefined);
  assert.equal(malformed.possessionTeamId, undefined);
});

test("drive events deduplicate corrected plays, retain full text and bound the newest 80", () => {
  const previous = Array.from({ length: 90 }, (_, index) => play(index + 1));
  const events = parseFootballEvents({
    drives: {
      previous: [{ plays: previous }],
      current: {
        plays: [
          {
            ...play(90),
            text: "Corrected full play text",
            shortText: "Short",
            teamParticipants: [{ id: "19", type: "offense" }],
          },
          play(91),
        ],
      },
    },
  });
  assert.equal(events.length, 80);
  assert.equal(events[0].id, "12");
  assert.equal(events.at(-1)?.id, "91");
  assert.equal(events.at(-2)?.text, "Corrected full play text");
  assert.equal(events.at(-2)?.teamId, "19");
  assert.equal(events.at(-1)?.time, "Q4 · 8:16");
  assert.equal(
    events.every((event) => event.type === "other"),
    true,
  );
});

test("scoring-only feeds remain useful, empty or malformed drive entries do not crash", () => {
  const scoring = {
    ...play(1),
    sequenceNumber: undefined,
    period: { number: 5 },
    text: "Field goal is GOOD.",
  };
  const events = parseFootballEvents({
    drives: { previous: [null, { plays: [null, {}] }] },
    scoringPlays: [scoring],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].text, "Field goal is GOOD.");
  assert.equal(parseFootballEvents({ scoringPlays: [scoring] })[0].time, "OT1 · 8:16");
  assert.deepEqual(parseFootballEvents({}), []);
});

test("team summary wires football drives into its event log and situation", () => {
  const header = {
    competitions: [
      {
        ...liveHeader.competitions[0],
        competitors: [
          { homeAway: "home", team: { id: "6" } },
          { homeAway: "away", team: { id: "19" } },
        ],
      },
    ],
  };
  const result = parseTeamSummary(leagueByTag("NFL")!, "game", {
    header,
    drives: { current: { plays: [play(1)] } },
  })!;
  assert.equal(result.football?.down, 3);
  assert.equal(result.events[0].text, "Play 1");
});

test("basketball box scores identify announced starters, preserving bench status and portraits", () => {
  const athlete = (id: string | number) => ({
    id,
    displayName: String(id),
    position: { abbreviation: "G" },
  });
  const header = {
    competitions: [
      {
        status: { type: { state: "post" } },
        competitors: [
          { homeAway: "home", team: { id: "24" } },
          { homeAway: "away", team: { id: "18" } },
        ],
      },
    ],
  };
  const result = parseTeamSummary(leagueByTag("NBA")!, "game", {
    header,
    rosters: [
      {
        team: { id: "24" },
        roster: [
          { athlete: { ...athlete(1), headshot: { href: "portrait.png" } }, starter: false },
        ],
      },
    ],
    boxscore: {
      players: [
        {
          team: { id: 24 },
          statistics: [
            {
              athletes: [
                { athlete: athlete("1"), starter: true, active: false, stats: ["37", "17"] },
                { athlete: athlete("2"), starter: false, active: true, stats: ["14", "7"] },
                null,
              ],
            },
          ],
        },
      ],
    },
  })!;
  assert.equal(result.homeRoster.length, 2);
  assert.equal(result.homeRoster[0].id, "1");
  assert.equal(result.homeRoster[0].starter, true);
  assert.equal(result.homeRoster[0].active, false);
  assert.equal(result.homeRoster[0].image, "portrait.png");
  assert.equal(result.homeRoster[1].starter, false);
  assert.equal(result.homeRoster[1].active, true);
});
