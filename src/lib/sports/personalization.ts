import type { LeagueDef, SportsGame } from "./espn-types";

/** An intentionally empty selection must not silently restore the starter sports. */
export function selectedSportsLeagues(
  catalog: readonly LeagueDef[],
  saved: readonly string[],
  personalized: boolean,
  defaults: readonly string[],
) {
  const known = new Set(catalog.map((league) => league.key));
  return [...new Set(saved.length || personalized ? saved : defaults)].filter((key) =>
    known.has(key),
  );
}

/** Browsing a sport from Explore is temporary; saved preferences remain unchanged. */
export function sportsSelectionScope(
  catalog: readonly LeagueDef[],
  selected: readonly string[],
  requestedGroup: string,
  browsing: boolean,
  requestedLeague: string,
) {
  const followed = new Set(selected);
  const groups = new Set(
    catalog.filter((league) => followed.has(league.key)).map((league) => league.group),
  );
  const group =
    requestedGroup === "all" || groups.has(requestedGroup) || browsing ? requestedGroup : "all";
  const options = catalog.filter(
    (league) =>
      (browsing && group !== "all" ? league.group === group : followed.has(league.key)) &&
      (group === "all" || league.group === group),
  );
  const leagueFilter = options.some((league) => league.key === requestedLeague)
    ? requestedLeague
    : "";
  const leagues = leagueFilter ? [leagueFilter] : options.map((league) => league.key);
  return { group, groups, options, leagueFilter, leagues };
}

/** The aggregate football feed is efficient to fetch, but must not widen a personal selection. */
export function gamesInSportsSelection(
  games: SportsGame[],
  catalog: readonly LeagueDef[],
  keys: readonly string[],
) {
  const selected = new Set(keys);
  const tags = new Set(
    catalog.filter((league) => selected.has(league.key)).map((league) => league.tag),
  );
  return games.filter((game) => tags.has(game.league));
}
