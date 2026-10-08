import assert from "node:assert/strict";
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import {
  agree,
  parseStorySummary,
  periodLabel,
  storyGames,
  storySlides,
  writeStory,
  type StorySummary,
} from "../src/lib/jl/sports/game-story.ts";

function side(name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr: "", logo: "", score: "", winner: false, ...extra };
}

function game(extra: Partial<SportsGame> = {}): SportsGame {
  return {
    id: "1",
    league: "NCAAF",
    state: "post",
    detail: "Final",
    away: side("Illinois Fighting Illini", {
      id: "356",
      location: "Illinois",
      nickname: "Fighting Illini",
      score: "10",
    }),
    home: side("Ohio State Buckeyes", {
      id: "194",
      location: "Ohio State",
      nickname: "Buckeyes",
      score: "38",
      rank: 3,
    }),
    startMs: Date.parse("2026-10-10T16:00:00Z"),
    ...extra,
  };
}

const NOW = new Date("2026-10-10T22:00:00Z");

const SUMMARY = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            team: { id: "194", abbreviation: "OSU", color: "ce1141" },
            record: [{ type: "total", summary: "6-0" }],
            linescores: [
              { displayValue: "7" },
              { displayValue: "14" },
              { displayValue: "10" },
              { displayValue: "7" },
            ],
          },
          {
            homeAway: "away",
            team: { id: "356", abbreviation: "ILL", color: "not-a-colour" },
            record: [{ type: "total", summary: "3-3" }],
            linescores: [
              { displayValue: "3" },
              { displayValue: "0" },
              { displayValue: "7" },
              { displayValue: "0" },
            ],
          },
        ],
      },
    ],
  },
  scoringPlays: [
    {
      id: "p1",
      type: { text: "Passing Touchdown" },
      scoringType: { displayName: "Touchdown" },
      text: "Q. Back 12 Yd pass to W. Out (K. Leg Kick)",
      awayScore: 0,
      homeScore: 7,
      period: { number: 1 },
      clock: { displayValue: "8:12" },
      team: { id: "194" },
    },
    {
      id: "p2",
      scoringType: { displayName: "Field Goal" },
      text: "F. Kicker 41 Yd Field Goal",
      awayScore: 3,
      homeScore: 7,
      period: { number: 1 },
      clock: { displayValue: "2:01" },
      team: { id: "356" },
    },
  ],
  leaders: [
    {
      team: { id: "194" },
      leaders: [
        {
          displayName: "Passing Yards",
          leaders: [
            { displayValue: "24/31, 312 YDS, 3 TD", athlete: { id: "9", displayName: "Q. Back" } },
          ],
        },
      ],
    },
    {
      team: { id: "356" },
      leaders: [
        {
          displayName: "Rushing Yards",
          leaders: [
            { displayValue: "18 CAR, 96 YDS", athlete: { id: "4", displayName: "R. Runner" } },
          ],
        },
      ],
    },
  ],
  boxscore: {
    teams: [
      {
        team: { id: "356" },
        statistics: [
          { name: "firstDowns", label: "1st Downs", displayValue: "14" },
          { name: "totalYards", label: "Total Yards", displayValue: "288" },
          { name: "turnovers", label: "Turnovers", displayValue: "2" },
          { name: "rushingYards", label: "Rushing", displayValue: "120" },
        ],
      },
      {
        team: { id: "194" },
        statistics: [
          { name: "firstDowns", label: "1st Downs", displayValue: "25" },
          { name: "totalYards", label: "Total Yards", displayValue: "512" },
          { name: "turnovers", label: "Turnovers", displayValue: "0" },
          { name: "rushingYards", label: "Rushing", displayValue: "200" },
        ],
      },
    ],
  },
  gameInfo: { venue: { fullName: "Ohio Stadium" } },
};

test("summary: scoring plays, leaders, preferred team stats, line score, colours", () => {
  const s = parseStorySummary(SUMMARY, "NCAAF");
  assert.deepEqual(
    s.plays.map((p) => [p.id, p.side, p.period, p.kind, p.away, p.home]),
    [
      ["p1", "home", "Q1", "Touchdown", 0, 7],
      ["p2", "away", "Q1", "Field Goal", 3, 7],
    ],
  );
  assert.equal(s.leaders.home[0].athlete, "Q. Back");
  assert.equal(s.leaders.away[0].athlete, "R. Runner");
  // Preferred order for football, not ESPN's order.
  assert.deepEqual(
    s.stats.map((r) => r.label),
    ["Total Yards", "Rushing", "1st Downs", "Turnovers"],
  );
  assert.deepEqual(s.stats[0], { label: "Total Yards", away: "288", home: "512" });
  assert.deepEqual(s.periods[1], { label: "Q2", away: "0", home: "14" });
  assert.deepEqual(s.records, { away: "3-3", home: "6-0" });
  assert.deepEqual(s.colors, { away: null, home: "#ce1141" });
  assert.equal(s.venue, "Ohio Stadium");
});

test("summary: soccer goals come from key events with a running score", () => {
  const s = parseStorySummary(
    {
      header: {
        competitions: [
          {
            competitors: [
              { homeAway: "home", team: { id: "1" } },
              { homeAway: "away", team: { id: "2" } },
            ],
          },
        ],
      },
      keyEvents: [
        {
          id: "a",
          type: { text: "Goal" },
          scoringPlay: true,
          team: { id: "2" },
          clock: { displayValue: "12'" },
          text: "Goal! A. Striker",
        },
        { id: "b", type: { text: "Yellow Card" }, team: { id: "1" } },
        {
          id: "c",
          type: { text: "Goal - Header" },
          scoringPlay: true,
          team: { id: "1" },
          participants: [{ athlete: { id: "77" } }],
          text: "Goal! H. Header",
        },
      ],
    },
    "EPL",
  );
  assert.deepEqual(
    s.plays.map((p) => [p.id, p.side, p.away, p.home]),
    [
      ["a", "away", 1, 0],
      ["c", "home", 1, 1],
    ],
  );
  assert.deepEqual(s.plays[1].athleteIds, ["77"]);
});

test("summary: basketball has no scoring-play story, garbage input is empty", () => {
  const s = parseStorySummary({ plays: [{ id: "1", scoringPlay: true, text: "Layup" }] }, "NBA");
  assert.deepEqual(s.plays, []);
  const empty = parseStorySummary(null, "NFL");
  assert.deepEqual(empty.plays, []);
  assert.deepEqual(empty.stats, []);
  assert.equal(empty.venue, null);
});

test("period labels follow the sport", () => {
  assert.equal(periodLabel("football", 3), "Q3");
  assert.equal(periodLabel("football", 5), "OT");
  assert.equal(periodLabel("hockey", 2), "P2");
  assert.equal(periodLabel("baseball", 7), "7th");
  assert.equal(periodLabel("soccer", 2), "2nd half");
});

test("recap: a rout by the ranked home team, told from the facts", () => {
  const story = writeStory({
    game: game({ home: { ...game().home, score: "45" } }),
    summary: parseStorySummary(SUMMARY, "NCAAF"),
  });
  assert.equal(story.headline, "No. 3 Ohio State routs Illinois, 45–10");
  assert.match(story.paragraphs[0], /^Ohio State beat Illinois 45–10 at Ohio Stadium\./);
  assert.match(story.paragraphs[0], /led 21–3 at halftime and never looked back/);
  assert.match(
    story.paragraphs[1],
    /Q\. Back led Ohio State in passing yards \(24\/31, 312 YDS, 3 TD\)\./,
  );
  assert.match(story.paragraphs[1], /R\. Runner paced Illinois in rushing yards/);
  assert.match(story.paragraphs[1], /Records: Ohio State 6-0, Illinois 3-3\./);
});

test("recap: upsets, close games, overtime and draws get their own headlines", () => {
  const upset = game({
    away: side("Illinois Fighting Illini", { location: "Illinois", score: "24" }),
    home: side("Ohio State Buckeyes", { location: "Ohio State", score: "21", rank: 3 }),
  });
  assert.equal(
    writeStory({ game: upset, summary: null }).headline,
    "Illinois stuns No. 3 Ohio State, 24–21",
  );

  const close = game({
    league: "NFL",
    away: side("Philadelphia Eagles", { nickname: "Eagles", score: "20" }),
    home: side("Chicago Bears", { nickname: "Bears", score: "17" }),
  });
  // Pro nicknames are plural.
  assert.equal(writeStory({ game: close, summary: null }).headline, "Eagles edge Bears, 20–17");
  assert.equal(
    writeStory({ game: { ...close, detail: "Final/OT" }, summary: null }).headline,
    "Eagles outlast Bears in overtime, 20–17",
  );

  const draw = game({
    league: "EPL",
    away: side("Chelsea", { score: "1" }),
    home: side("Arsenal", { score: "1" }),
  });
  assert.equal(writeStory({ game: draw, summary: null }).headline, "Chelsea and Arsenal draw 1–1");

  const shutout = game({
    league: "NHL",
    away: side("Boston Bruins", { nickname: "Bruins", score: "0" }),
    home: side("Utah Hockey Club", { nickname: "Hockey Club", score: "2" }),
  });
  assert.equal(
    writeStory({ game: shutout, summary: null }).headline,
    "Hockey Club blanks Bruins, 2–0",
  );
});

test("live story: who leads, the clock and the latest score", () => {
  const live = game({
    state: "in",
    detail: "3rd 4:12",
    away: { ...game().away, score: "10" },
    home: { ...game().home, score: "21" },
  });
  const story = writeStory({ game: live, summary: parseStorySummary(SUMMARY, "NCAAF") });
  assert.equal(story.headline, "No. 3 Ohio State leads Illinois 21–10");
  assert.equal(
    story.paragraphs[0],
    "Live, 3rd 4:12. Latest score: F. Kicker 41 Yd Field Goal (3–7).",
  );
  const tied = writeStory({
    game: { ...live, away: { ...live.away, score: "0" }, home: { ...live.home, score: "0" } },
    summary: null,
  });
  assert.equal(tied.headline, "Illinois and No. 3 Ohio State, scoreless so far");
});

test("slides: story first, then scoring, performers, periods, stats; a writer can be swapped in", () => {
  const summary: StorySummary = parseStorySummary(SUMMARY, "NCAAF");
  assert.deepEqual(
    storySlides(game(), summary).map((s) => s.kind),
    ["story", "plays", "leaders", "periods", "stats"],
  );
  // Without a summary there is still a story slide built from the scoreboard.
  assert.deepEqual(
    storySlides(game(), null).map((s) => s.kind),
    ["story"],
  );
  const custom = storySlides(game(), null, () => ({
    headline: "Written elsewhere",
    paragraphs: ["Body"],
  }));
  assert.equal(custom[0].kind === "story" && custom[0].headline, "Written elsewhere");
});

test("verb agreement only treats US pro nicknames as plural", () => {
  assert.equal(agree(side("Eagles", { nickname: "Eagles" }), "NFL", "wins", "win"), "win");
  assert.equal(agree(side("Red Sox", { nickname: "Red Sox" }), "MLB", "wins", "win"), "win");
  assert.equal(agree(side("Jazz", { nickname: "Jazz" }), "NBA", "wins", "win"), "wins");
  assert.equal(
    agree(side("Texas Longhorns", { location: "Texas" }), "NCAAF", "wins", "win"),
    "wins",
  );
});

test("story games: live and recent big games, yours first, no previews or old finals", () => {
  const mine = { league: "NFL", id: "21", name: "Philadelphia Eagles" };
  const games: SportsGame[] = [
    game({ id: "ranked-final", startMs: NOW.getTime() - 5 * 3600000 }),
    game({ id: "old-final", startMs: NOW.getTime() - 3 * 24 * 3600000 }),
    game({ id: "ranked-live", state: "in" }),
    game({ id: "preview", state: "pre" }),
    game({ id: "unranked-live", state: "in", home: side("A"), away: side("B") }),
    game({ id: "top10-live", league: "NBA", state: "in", home: side("C"), away: side("D") }),
    game({
      id: "eagles",
      league: "NFL",
      state: "post",
      startMs: NOW.getTime() - 3600000,
      home: side("Philadelphia Eagles", { id: "21" }),
      away: side("E"),
    }),
  ];
  const picked = storyGames(games, {
    favorites: [mine],
    bigKeys: new Set(["NBA:top10-live"]),
    now: NOW,
  });
  assert.deepEqual(
    picked.map((g) => g.id),
    ["eagles", "ranked-live", "top10-live", "ranked-final"],
  );
});
