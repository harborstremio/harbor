import assert from "node:assert/strict";
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import {
  followedGamesThisWeek,
  scheduleEventsToScoreboard,
  selectTopGames,
  teamsMissingFromScoreboard,
} from "../src/lib/jl/sports/gameday.ts";
import { rankGames, type JlFavoriteTeam } from "../src/lib/jl/sports/rank.ts";

function side(name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr: "", logo: "", score: "", winner: false, ...extra };
}

function game(id: string, league: string, away: SportsSide, home: SportsSide, extra: Partial<SportsGame> = {}): SportsGame {
  return { id, league, state: "pre", detail: "", away, home, startMs: 0, ...extra };
}

// Saturday 9:00 PT.
const NOW = new Date("2026-10-10T16:00:00Z");
const at = (iso: string) => Date.parse(iso);
const GALLAUDET: JlFavoriteTeam = { league: "NCAAF", id: "417", name: "Gallaudet Bison" };

// Twelve ranked FBS games: more than enough to fill a Top 10 on their own.
const FBS = Array.from({ length: 12 }, (_, i) =>
  game(`fbs${i}`, "NCAAF", side(`Team ${i}A`, { rank: i + 1 }), side(`Team ${i}B`, { rank: i + 13 }), {
    startMs: at("2026-10-10T19:30:00Z"),
    network: "ABC",
  }),
);

const GALLAUDET_GAME = game("dIII", "NCAAF", side("Gallaudet Bison", { id: "417" }), side("Keystone Giants", { id: "999" }), {
  startMs: at("2026-10-10T17:00:00Z"),
});

test("a followed Division III team's game takes a Top 10 place over ranked FBS games", () => {
  const games = [...FBS, GALLAUDET_GAME];
  const ranked = rankGames(games, [GALLAUDET], { now: NOW });
  const followed = followedGamesThisWeek(games, [GALLAUDET], NOW);
  const top = selectTopGames(ranked, followed);
  assert.equal(top.length, 10);
  assert.ok(top.some((r) => r.game.id === "dIII"));
  // The week's biggest game still leads.
  assert.equal(top[0].game.id, "fbs0");
});

test("without followers the small-school game is not forced in", () => {
  const games = [...FBS, GALLAUDET_GAME];
  const top = selectTopGames(rankGames(games, [], { now: NOW }), followedGamesThisWeek(games, [], NOW));
  assert.ok(!top.some((r) => r.game.id === "dIII"));
});

test("only a followed team's next game this week is guaranteed; later games don't crowd out top games", () => {
  const favs: JlFavoriteTeam[] = [{ league: "NBA", id: "20", name: "Philadelphia 76ers" }];
  const sixers = [1, 3, 5].map((d) =>
    game(`phi${d}`, "NBA", side("Philadelphia 76ers", { id: "20" }), side(`Opp ${d}`), {
      startMs: NOW.getTime() + d * 24 * 3600000,
    }),
  );
  const games = [...FBS, ...sixers];
  const followed = followedGamesThisWeek(games, favs, NOW);
  assert.deepEqual(
    followed.map((g) => g.id),
    ["phi1"],
  );
  const top = selectTopGames(rankGames(games, favs, { now: NOW }), followed);
  assert.deepEqual(
    top.filter((r) => r.game.league === "NBA").map((r) => r.game.id),
    ["phi1"],
  );
});

test("games more than a week out, and finished games, are not this week's", () => {
  const later = game("next-week", "NCAAF", side("Gallaudet Bison", { id: "417" }), side("X"), {
    startMs: NOW.getTime() + 8 * 24 * 3600000,
  });
  const done = game("done", "NCAAF", side("Gallaudet Bison", { id: "417" }), side("Y"), {
    state: "post",
    startMs: NOW.getTime() - 3 * 24 * 3600000,
  });
  assert.deepEqual(followedGamesThisWeek([later, done], [GALLAUDET], NOW), []);
});

test("followed teams missing from the scoreboard are found by league and id", () => {
  const favs: JlFavoriteTeam[] = [GALLAUDET, { league: "NCAAF", id: "0", name: "Team 0A" }];
  const games = FBS.map((g, i) => (i === 0 ? { ...g, away: { ...g.away, id: "0" } } : g));
  assert.deepEqual(
    teamsMissingFromScoreboard(games, favs).map((f) => f.id),
    ["417"],
  );
});

test("team-schedule events are reshaped into scoreboard events", () => {
  const [ev] = scheduleEventsToScoreboard([
    {
      id: "401",
      date: "2026-10-10T17:00Z",
      competitions: [
        {
          competitors: [
            {
              homeAway: "away",
              score: { value: 21, displayValue: "21" },
              team: { id: "417", displayName: "Gallaudet Bison", logos: [{ href: "https://a.espncdn.com/417.png" }] },
            },
            { homeAway: "home", team: { id: "999", displayName: "Keystone Giants", logo: "https://x/999.png" } },
          ],
        },
      ],
    },
  ]) as Array<{ competitions: Array<{ competitors: Array<{ score: string; team: { logo: string } }> }> }>;
  const [away, home] = ev.competitions[0].competitors;
  assert.equal(away.score, "21");
  assert.equal(away.team.logo, "https://a.espncdn.com/417.png");
  assert.equal(home.score, "");
  assert.equal(home.team.logo, "https://x/999.png");
});
