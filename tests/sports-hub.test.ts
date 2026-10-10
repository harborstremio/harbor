import assert from "node:assert/strict";
import test from "node:test";
import {
  eventCards,
  gameKey,
  loadSportsSlices,
  mergeSlices,
  type SportsSnapshot,
} from "../src/lib/sports/hub-cache.ts";
import { diverseEvents, featuredEvents } from "../src/lib/sports/hub-discovery.ts";
import { fetchHubSlice, HUB_LEAGUES } from "../src/lib/sports/hub-data.ts";
import {
  esportsOffseasonGames,
  esportsRailGames,
  esportsRailMatches,
  selectedEsportsFeeds,
} from "../src/lib/sports/esports-match-rail.ts";
import type {
  EsportsFeed,
  EsportsGameId,
  EsportsMatch,
} from "../src/lib/sports/esports-feeds.ts";
import { parseEvents } from "../src/lib/sports/espn-parse.ts";
import { parseDotaMatches } from "../src/lib/sports/opendota.ts";
import { twitchEmbedUrl } from "../src/lib/sports/broadcasts.ts";
import { watchProviders } from "../src/lib/sports/watch-providers.ts";
import type { SportsGame, LeagueDef } from "../src/lib/sports/espn-types.ts";

const game = (id: string, league = "EPL"): SportsGame => ({
  id,
  league,
  state: "pre",
  startMs: 1000,
  detail: "",
  home: { id: "1", name: "Home", abbr: "HOM", logo: "", score: "", winner: false },
  away: { id: "2", name: "Away", abbr: "AWY", logo: "", score: "", winner: false },
});
const ESPORTS_NOW = Date.UTC(2026, 8, 30, 12);
const ESPORTS_TITLES: EsportsGameId[] = ["cs2", "dota2", "lol", "rocketleague", "valorant"];
const esportsKeys = () =>
  HUB_LEAGUES.filter((league) => league.group === "esports").map((league) => league.key);
const esMatch = (id: string, game: EsportsGameId, event = "Tournament"): EsportsMatch => ({
  id,
  game,
  state: "upcoming",
  startMs: ESPORTS_NOW + 3_600_000,
  event: { id, name: event },
  teams: [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Bravo" },
  ],
  streams: [],
  sourceUrl: "https://example.com/match",
});
const esFeed = (game: EsportsGameId, matches: EsportsMatch[]): EsportsFeed => ({
  game,
  matches,
  status: "ready",
  fetchedAt: ESPORTS_NOW,
  source: { name: "Fixture", url: "https://example.com" },
});
const def = (key: string, group: string): LeagueDef => ({
  key,
  tag: key,
  label: key,
  labelEn: key,
  path: "",
  logo: "",
  group,
});

test("a fast league renders before a slow peer; cached scores survive an outage", async () => {
  const snapshots: SportsSnapshot[] = [];
  const saved: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cached = { at: 1, games: [{ ...game("old"), state: "in" as const }] };
  const task = loadSportsSlices(
    ["fast", "slow", "offline"],
    (key) => (key === "offline" ? cached : undefined),
    async (key) => {
      if (key === "slow") await held;
      if (key === "offline") throw Error("offline");
      return [game(key)];
    },
    (key) => saved.push(key),
    (snapshot) => snapshots.push(snapshot),
    new AbortController().signal,
    3,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert(
    snapshots.some(
      (snapshot) => snapshot.games.some((g) => g.id === "fast") && snapshot.pending > 0,
    ),
  );
  assert.equal(snapshots[0].games[0].id, "old");
  assert(snapshots[0].stale);
  release();
  await task;
  const final = snapshots.at(-1)!;
  assert.equal(final.failed, 1);
  assert.equal(final.pending, 0);
  assert(final.stale);
  assert.equal(final.games.length, 3);
  assert(!saved.includes("offline"));
});
test("leaving a date cancels publication and persistence of its late response", async () => {
  const controller = new AbortController();
  let release!: (games: SportsGame[]) => void;
  const held = new Promise<SportsGame[]>((resolve) => {
    release = resolve;
  });
  const snapshots: SportsSnapshot[] = [];
  let saves = 0;
  const task = loadSportsSlices(
    ["old-date"],
    () => undefined,
    () => held,
    () => saves++,
    (value) => snapshots.push(value),
    controller.signal,
  );
  controller.abort();
  release([game("late")]);
  await task;
  assert.equal(saves, 0);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].games.length, 0);
});
test("a successful empty schedule clears a stale event rather than pretending it still exists", async () => {
  let result: SportsSnapshot | undefined;
  await loadSportsSlices(
    ["league"],
    () => ({ at: 1, games: [game("old")] }),
    async () => [],
    () => {},
    (value) => {
      result = value;
    },
    new AbortController().signal,
  );
  assert.deepEqual(result?.games, []);
  assert.equal(result?.failed, 0);
  assert.equal(result?.stale, false);
});
test("provider and league ids cannot overwrite each other; newer scores win", () => {
  const first = game("42");
  const second = { ...first, source: "other" };
  const changed = { ...first, detail: "new" };
  const merged = mergeSlices([
    { at: 2, games: [changed] },
    { at: 1, games: [first, second, game("42", "NBA")] },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged.find((g) => gameKey(g) === gameKey(first))?.detail, "new");
});
test("future races survive before entrants are announced; main-card names retain the headliner", () => {
  const race = parseEvents(
    [
      {
        id: "race",
        name: "Azerbaijan Grand Prix",
        date: "2026-09-26T11:00Z",
        competitions: [
          {
            id: "session",
            date: "2026-09-26T11:00Z",
            type: { abbreviation: "RACE" },
            status: { type: { state: "pre" } },
          },
        ],
      },
    ],
    def("F1", "motorsport"),
  );
  assert.equal(race.length, 1);
  assert.equal(race[0].context?.name, "Azerbaijan Grand Prix");
  assert.equal(race[0].home.name, "");
  const bout = (id: string, names: string[]) => ({
    id,
    date: "2026-09-20T01:00Z",
    competitors: names.map((name, i) => ({
      id: String(i),
      type: "athlete",
      order: i + 1,
      athlete: { id: String(i), displayName: name },
    })),
  });
  const fights = parseEvents(
    [
      {
        id: "ufc",
        name: "UFC 331: Van vs. Pantoja 2",
        shortName: "UFC 331",
        competitions: [
          bout("prelim", ["Other Fighter", "Another Fighter"]),
          bout("main", ["Joshua Van", "Alexandre Pantoja"]),
        ],
      },
    ],
    def("UFC", "combat"),
  );
  assert.equal(eventCards(fights)[0].id, "ufc|main");
});
test("a daily league cannot push F1, NBA and fight nights out of discovery", () => {
  const schedule = [
    ...Array.from({ length: 50 }, (_, i) => game(String(i), "MLB")),
    game("nba", "NBA"),
    game("race", "F1"),
    game("fight", "BOXING"),
  ];
  const events = diverseEvents(schedule, 8);
  for (const league of ["NBA", "F1", "BOXING"]) assert(events.some((g) => g.league === league));
  const featured = featuredEvents([game("live")], schedule);
  assert(featured.some((g) => g.league === "NBA"));
  assert(featured.some((g) => g.league === "F1"));
});
test("OpenDota filters public lobbies and expired live matches", () => {
  const now = 1_000_000;
  const match = {
    match_id: 42,
    team_name_radiant: "Team A",
    team_name_dire: "Team B",
    league_id: 5,
    last_update_time: now / 1000,
    activate_time: 900,
    radiant_score: 10,
    dire_score: 7,
    game_time: 65,
  };
  const parsed = parseDotaMatches(
    [match, { ...match, league_id: 0 }, { ...match, last_update_time: 1 }],
    true,
    now,
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].detail, "1:05");
  assert.equal(parsed[0].state, "in");
});
test("Twitch embeds use the actual host, require a safe channel, and do not autoplay", () => {
  const url = new URL(twitchEmbedUrl("RocketLeague", "127.0.0.1")!);
  assert.equal(url.searchParams.get("parent"), "127.0.0.1");
  assert.equal(url.searchParams.get("autoplay"), "false");
  assert.equal(twitchEmbedUrl("bad&channel=other", "localhost"), null);
  assert.equal(twitchEmbedUrl("lec", ""), null);
});
test("official-service suggestions are not misrepresented as this event's listed broadcaster", () => {
  const boxing = watchProviders(game("fight", "BOXING"));
  assert.equal(boxing[0].name, "DAZN");
  assert.equal(boxing[0].listed, false);
  const listed = watchProviders({ ...game("nba", "NBA"), broadcasts: ["ESPN"] });
  assert(listed.find((provider) => provider.id === "espn")?.listed);
  assert.equal(listed.find((provider) => provider.id === "nba")?.listed, false);
});

test("every esports title the hub offers can reach the rail", () => {
  // A hub key with no game mapping is exactly how CS2 and VALORANT stayed invisible.
  for (const key of esportsKeys()) assert.equal(esportsRailGames([key])?.length, 1, key);
  assert.deepEqual([...new Set(esportsRailGames(esportsKeys()))].sort(), ESPORTS_TITLES);
});
test("a full esports selection keeps every title on the rail", () => {
  const feeds = [
    esFeed("dota2", [esMatch("d1", "dota2")]),
    esFeed("cs2", [esMatch("c1", "cs2")]),
    esFeed("valorant", [esMatch("v1", "valorant")]),
    esFeed("lol", [esMatch("l1", "lol", "EMEA MASTERS · Playoffs")]),
    esFeed("rocketleague", [esMatch("r1", "rocketleague")]),
  ];
  const rail = esportsRailMatches(selectedEsportsFeeds(feeds, esportsKeys()), ESPORTS_NOW);
  assert.deepEqual([...new Set(rail.map((match) => match.game))].sort(), ESPORTS_TITLES);
});
test("a chosen LoL split narrows the feed, and a week without it keeps the game", () => {
  const names = (feeds: EsportsFeed[]) => feeds[0].matches.map((match) => match.event.name);
  const lol = (leagues: string[]) =>
    esFeed(
      "lol",
      leagues.map((league, i) => esMatch(`l${i}`, "lol", `${league} · Playoffs`)),
    );
  assert.deepEqual(names(selectedEsportsFeeds([lol(["EMEA MASTERS", "CBLOL"])], ["LCK"])), [
    "EMEA MASTERS · Playoffs",
    "CBLOL · Playoffs",
  ]);
  assert.deepEqual(names(selectedEsportsFeeds([lol(["LCK", "LEC", "LCK Challengers"])], ["LCK"])), [
    "LCK · Playoffs",
  ]);
});
test("a healthy empty esports feed reads as a season break, not an outage", () => {
  const empty = esFeed("rocketleague", []);
  const live = esFeed("cs2", [esMatch("c1", "cs2")]);
  assert.deepEqual(esportsOffseasonGames([empty, live]), ["rocketleague"]);
  assert.deepEqual(esportsOffseasonGames([{ ...empty, status: "unavailable" }]), []);
  assert.deepEqual(esportsOffseasonGames([{ ...empty, partial: true }]), []);
});
test("a rail-only esports title requests no day schedule", async () => {
  for (const key of ["CS2", "VALORANT"]) {
    const slice = await fetchHubSlice(`${key}@20260930@day`, new AbortController().signal);
    assert.deepEqual(slice, [], key);
  }
});
