// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import { alsoTodayGroups, teamSlideInfo } from "../src/lib/jl/sports/hub-sections.ts";
import { espnDarkLogo, monogram, nameColor, teamLook } from "../src/lib/jl/sports/team-look.ts";

function side(name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr: "", logo: "", score: "", winner: false, ...extra };
}

function game(
  id: string,
  league: string,
  away: SportsSide,
  home: SportsSide,
  extra: Partial<SportsGame> = {},
): SportsGame {
  return { id, league, state: "pre", detail: "", away, home, startMs: 0, ...extra };
}

test("monograms read like the team", () => {
  assert.equal(monogram("Iowa State Cyclones"), "IS");
  assert.equal(monogram("#8 BYU Cougars"), "BC");
  assert.equal(monogram("Florida State"), "FS");
  assert.equal(monogram("University of Louisville"), "LO");
  assert.equal(monogram("Army"), "AR");
  assert.equal(monogram(""), "?");
});

test("ESPN logos get their dark variant first; other hosts are left alone", () => {
  assert.equal(
    espnDarkLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/87.png"),
    "https://a.espncdn.com/i/teamlogos/ncaa/500-dark/87.png",
  );
  assert.equal(espnDarkLogo("https://img.example/i/teamlogos/ncaa/500/87.png"), null);
  assert.equal(espnDarkLogo("https://a.espncdn.com/i/teamlogos/ncaa/500-dark/87.png"), null);
});

test("team look: ESPN colours, TheSportsDB fills gaps, a stable colour otherwise", () => {
  const nd = teamLook(
    side("Notre Dame Fighting Irish", {
      color: "0c2340",
      altColor: "c99700",
      logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/87.png",
    }),
  );
  assert.equal(nd.primary, "0c2340");
  assert.equal(nd.secondary, "c99700");
  assert.deepEqual(nd.logos, [
    "https://a.espncdn.com/i/teamlogos/ncaa/500-dark/87.png",
    "https://a.espncdn.com/i/teamlogos/ncaa/500/87.png",
  ]);
  // Black/white is a last resort when a team has a real colour.
  assert.equal(teamLook(side("X", { color: "000000", altColor: "cc0000" })).primary, "cc0000");
  const tsdb = teamLook(side("Bison"), {
    fanart: [],
    banner: null,
    stadium: null,
    badge: "https://img.example/b.png",
    colors: ["003366"],
  });
  assert.equal(tsdb.primary, "003366");
  assert.deepEqual(tsdb.logos, ["https://img.example/b.png"]);
  const none = teamLook(side("Gallaudet Bison"));
  assert.match(none.primary, /^[0-9a-f]{6}$/);
  assert.equal(none.primary, teamLook(side("Gallaudet Bison")).primary);
  assert.equal(none.primary, nameColor("Gallaudet Bison"));
  assert.equal(none.monogram, "GB");
});

test("also today: the day's other games by league, live first, Top 10 left out", () => {
  const now = new Date(2026, 9, 10, 12, 0).getTime();
  const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m).getTime();
  const games = [
    game("a", "NCAAF", side("A"), side("B"), { startMs: at(15) }),
    game("b", "NCAAF", side("C"), side("D"), { startMs: at(9), state: "in" }),
    game("c", "NCAAF", side("E"), side("F"), { startMs: at(8), state: "post" }),
    game("d", "NFL", side("G"), side("H"), { startMs: at(13) }),
    game("top", "NCAAF", side("I"), side("J"), { startMs: at(12, 30) }),
    game("tomorrow", "NCAAF", side("K"), side("L"), { startMs: at(12) + 24 * 3600000 }),
    game("mls", "MLS", side("M"), side("N"), { startMs: at(19) }),
    game("x", "XFL", side("O"), side("P"), { startMs: at(19) }),
  ];
  const groups = alsoTodayGroups(games, { now, exclude: new Set(["NCAAF:top"]) });
  assert.deepEqual(
    groups.map((g) => [g.label, g.games.map((x) => x.id), g.live]),
    [
      ["College", ["b", "a", "c"], 1],
      ["NFL", ["d"], 0],
      ["MLS", ["mls"], 0],
      ["XFL", ["x"], 0],
    ],
  );
  // A league with a game on now moves ahead of the fixed order.
  const nflLive = alsoTodayGroups([games[0], { ...games[3], state: "in" }], {
    now,
    exclude: new Set(),
  });
  assert.deepEqual(
    nflLive.map((g) => g.league),
    ["NFL", "NCAAF"],
  );
});

test("team slides: ESPN's listing of the team and its game on now or next", () => {
  const now = new Date("2026-10-10T16:00:00Z");
  const ravens = side("Baltimore Ravens", {
    id: "33",
    color: "241773",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png",
  });
  const games = [
    game("g1", "NFL", side("Kansas City Chiefs", { id: "12" }), ravens, {
      startMs: Date.parse("2026-10-12T17:00:00Z"),
    }),
    game("g0", "NFL", ravens, side("Buffalo Bills", { id: "2" }), {
      startMs: Date.parse("2026-10-05T17:00:00Z"),
      state: "post",
    }),
  ];
  const [slide, empty] = teamSlideInfo(
    games,
    [
      { league: "NFL", id: "33", name: "Baltimore Ravens" },
      { league: "NFL", id: "99", name: "Nowhere Team" },
    ],
    now,
  );
  assert.equal(slide.side?.color, "241773");
  assert.equal(slide.next?.id, "g1");
  assert.equal(empty.side, null);
  assert.equal(empty.next, null);
  const live = teamSlideInfo(
    [{ ...games[1], state: "in" }, games[0]],
    [{ league: "NFL", id: "33", name: "" }],
    now,
  )[0];
  assert.equal(live.next?.id, "g0");
});
