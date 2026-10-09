import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { followedGamesThisWeek } from "./gameday.ts";
import { isFavoriteSide, type JlFavoriteTeam } from "./rank.ts";

/**
 * The Sports Hub's sections beyond the Top 10: "Also today" games grouped by league, and one hero
 * slide per followed team. Plain module, no I/O.
 */

/** Section titles per league, in the order sections appear. */
export const ALSO_TODAY_LEAGUES: Array<{ league: string; label: string }> = [
  { league: "NCAAF", label: "College" },
  { league: "NFL", label: "NFL" },
  { league: "NBA", label: "NBA" },
  { league: "NCAAB", label: "College basketball" },
  { league: "NHL", label: "NHL" },
  { league: "MLB", label: "MLB" },
  { league: "EPL", label: "Premier League" },
  { league: "UCL", label: "Champions League" },
  { league: "MLS", label: "MLS" },
];

export type AlsoTodayGroup = { league: string; label: string; games: SportsGame[]; live: number };

/** Midnight to midnight in the viewer's own time zone. */
function sameLocalDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * Today's games that aren't in the Top 10, one group per league: live first, then by kick-off,
 * finals last. Leagues with a game on now come first; otherwise a fixed league order keeps the
 * page predictable.
 */
export function alsoTodayGroups(
  games: SportsGame[],
  opts: { now: number; exclude: ReadonlySet<string> },
): AlsoTodayGroup[] {
  const byLeague = new Map<string, SportsGame[]>();
  for (const g of games) {
    if (opts.exclude.has(`${g.league}:${g.id}`)) continue;
    if (g.state !== "in" && !(g.startMs > 0 && sameLocalDay(g.startMs, opts.now))) continue;
    const list = byLeague.get(g.league);
    if (list) list.push(g);
    else byLeague.set(g.league, [g]);
  }
  const order = (g: SportsGame) => (g.state === "in" ? 0 : g.state === "pre" ? 1 : 2);
  const known = new Set(ALSO_TODAY_LEAGUES.map((l) => l.league));
  const leagues = [
    ...ALSO_TODAY_LEAGUES,
    ...[...byLeague.keys()]
      .filter((l) => !known.has(l))
      .sort()
      .map((l) => ({ league: l, label: l })),
  ];
  const groups: AlsoTodayGroup[] = [];
  for (const { league, label } of leagues) {
    const list = byLeague.get(league);
    if (!list?.length) continue;
    list.sort((a, b) => order(a) - order(b) || a.startMs - b.startMs || a.id.localeCompare(b.id));
    groups.push({ league, label, games: list, live: list.filter((g) => g.state === "in").length });
  }
  // Stable sort: the fixed order holds within each half.
  return groups.sort((a, b) => Number(b.live > 0) - Number(a.live > 0));
}

export type TeamSlideInfo = {
  team: JlFavoriteTeam;
  /** The team as ESPN last listed it (logo, colours, school/city), when any game has it. */
  side: SportsSide | null;
  /** The game on now or the next one this week. */
  next: SportsGame | null;
};

/** One slide per followed team: who they are and their next game. */
export function teamSlideInfo(
  games: SportsGame[],
  teams: JlFavoriteTeam[],
  now: Date,
): TeamSlideInfo[] {
  return teams.map((team) => {
    let side: SportsSide | null = null;
    for (const g of games) {
      if (g.league !== team.league) continue;
      for (const s of [g.home, g.away]) {
        if (!side && isFavoriteSide(s, g.league, [team])) side = s;
      }
      if (side) break;
    }
    const live = games.find(
      (g) =>
        g.state === "in" &&
        g.league === team.league &&
        (isFavoriteSide(g.home, g.league, [team]) || isFavoriteSide(g.away, g.league, [team])),
    );
    const next = live ?? followedGamesThisWeek(games, [team], now)[0] ?? null;
    return { team, side, next };
  });
}
