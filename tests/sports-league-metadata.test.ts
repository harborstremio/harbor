import test from "node:test";
import assert from "node:assert/strict";
import {
  createLeagueMetadataClient,
  leagueMetadataSeed,
  parseEspnLeagueMetadata,
  parseSportsDbLeagueMetadata,
} from "../src/lib/sports/league-metadata.ts";
import type { LeagueDef } from "../src/lib/sports/espn-types.ts";
import { espnPublishedAthleteId } from "../src/lib/sports/athlete-identity.ts";
import { toSide } from "../src/lib/sports/espn-parse.ts";

test("PGA scoreboard participants retain published athlete IDs without fetching a roster", () => {
  const def: LeagueDef = {
    key: "PGA",
    tag: "PGA",
    label: "PGA",
    labelEn: "PGA",
    path: "golf/pga",
    group: "golf",
  };
  const player = {
    id: "3980",
    uid: "s:1100~l:1106~a:3980",
    type: "athlete",
    athlete: {
      displayName: "Patton Kizzire",
      flag: { href: "https://a.espncdn.com/i/teamlogos/countries/500/usa.png" },
    },
  };
  const feed = {
    leagues: [{ id: "1106", slug: "pga" }],
    events: [
      {
        competitions: [
          {
            competitors: [
              player,
              player,
              {
                ...player,
                id: "5692",
                uid: "s:1100~l:1106~a:5692",
                athlete: { fullName: "Peter Malnati" },
              },
              { ...player, id: "123", uid: "s:1100~l:999~a:123" },
            ],
          },
        ],
      },
    ],
  };
  const result = parseEspnLeagueMetadata(def, feed, {}, {});
  assert.deepEqual(result.teams, []);
  assert.deepEqual(
    result.athletes?.map((person) => [person.name, person.id]),
    [
      ["Patton Kizzire", "3980"],
      ["Peter Malnati", "5692"],
    ],
  );
  assert.equal(
    result.athletes?.[0].image,
    undefined,
    "A country flag never becomes a headshot",
  );
  assert.equal(toSide(player, "golf").athleteId, "3980");
  assert.deepEqual(
    parseEspnLeagueMetadata(def, { ...feed, leagues: [{ slug: "lpga" }] }, {}, {}).athletes,
    [],
  );
});

test("standings distinguish athletes from team IDs and preserve their actual portrait", () => {
  const def: LeagueDef = {
    key: "PGA",
    tag: "PGA",
    label: "PGA",
    labelEn: "PGA",
    path: "golf/pga",
    group: "golf",
  };
  const image = "https://a.espncdn.com/i/headshots/golf/players/full/3980.png";
  const result = parseEspnLeagueMetadata(
    def,
    {},
    {},
    {
      standings: {
        entries: [
          {
            athlete: { id: "3980", displayName: "Patton Kizzire", headshot: { href: image } },
            stats: [{ name: "rank", value: 1 }],
          },
        ],
      },
    },
  );
  const athlete = result.standings?.groups[0].rows[0].athlete;
  assert.deepEqual(athlete, { id: "3980", name: "Patton Kizzire", source: "espn", image });
  assert.deepEqual(result.athletes, [athlete]);
  assert.deepEqual(result.teams, []);
});

test("classification IDs alone are never guessed to be ESPN athlete IDs", () => {
  assert.equal(
    espnPublishedAthleteId({ id: "23", type: "athlete", athlete: { displayName: "Name" } }),
    "",
  );
  assert.equal(
    espnPublishedAthleteId({
      id: "23",
      uid: "s:1100~l:1106~a:3980",
      type: "athlete",
      athlete: {},
    }),
    "",
  );
  assert.equal(
    espnPublishedAthleteId({ id: "3980", uid: "s:1100~l:1106~a:3980", type: "team" }),
    "",
  );
  assert.equal(espnPublishedAthleteId({ athlete: { id: "3980" } }), "3980");
});

const nba: LeagueDef = {
  key: "NBA",
  tag: "NBA",
  label: "NBA",
  labelEn: "NBA",
  path: "basketball/nba",
  group: "basketball",
  logo: "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
};
const premier: LeagueDef = {
  ...nba,
  key: "EPL_DB",
  tag: "EPL_DB",
  label: "Premier League",
  labelEn: "Premier League",
  path: "4328",
  group: "soccer",
};
const hawks = {
  id: "1",
  displayName: "Atlanta Hawks",
  shortDisplayName: "Hawks",
  abbreviation: "ATL",
  location: "Atlanta",
  logos: [{ href: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png" }],
  links: [
    {
      rel: ["clubhouse"],
      href: "https://www.espn.com/nba/team/_/name/atl/atlanta-hawks",
    },
  ],
};
const info = {
  leagues: [
    {
      id: "46",
      uid: "s:40~l:46",
      slug: "nba",
      name: "National Basketball Association",
      season: { displayName: "2026-27", year: 2027 },
      logos: [{ href: nba.logo }],
    },
  ],
};
const teams = {
  sports: [
    {
      id: "40",
      leagues: [
        {
          id: "46",
          slug: "nba",
          name: "National Basketball Association",
          season: { displayName: "2025-26", year: 2026 },
          teams: [{ team: hawks }],
        },
      ],
    },
  ],
};
const table = {
  uid: "s:40~l:46~g:7",
  name: "National Basketball Association",
  season: { displayName: "2026-27", year: 2027 },
  children: [
    {
      id: "5",
      name: "Eastern Conference",
      standings: {
        entries: [
          {
            team: hawks,
            stats: [
              {
                name: "wins",
                value: 0,
                displayValue: "0",
                displayName: "Wins",
                abbreviation: "W",
              },
              {
                name: "gamesPlayed",
                value: 0,
                displayValue: "0",
                displayName: "Games Played",
                abbreviation: "GP",
              },
            ],
          },
        ],
      },
    },
  ],
};
const league = {
  leagues: [
    {
      idLeague: "4328",
      strLeague: "English Premier League",
      strSport: "Soccer",
      strCurrentSeason: "2026-2027",
      strCountry: "England",
      strWebsite: "www.premierleague.com",
      strDescriptionEN: "The top level of English football.",
      strFanart1: "https://r2.thesportsdb.com/images/media/league/fanart/odberp1725731801.jpg",
      intFormedYear: "1992",
    },
  ],
};
const arsenal = {
  idTeam: "133604",
  idLeague: "4328",
  strTeam: "Arsenal",
  strTeamShort: "ARS",
  strCountry: "England",
  strLocation: "London, England",
  strWebsite: "arsenal.com",
  strDescriptionEN: "Arsenal Football Club.",
  strStadium: "Emirates Stadium",
  intStadiumCapacity: "60704",
  strBadge: "https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png",
};
const tableRow = {
  idLeague: "4328",
  strSeason: "2026-2027",
  idTeam: "133604",
  strTeam: "Arsenal",
  strGroup: "Premier League",
  intRank: "1",
  intPlayed: "4",
  intWin: "4",
  intDraw: "0",
  intLoss: "0",
  intGoalsFor: "8",
  intGoalsAgainst: "1",
  intGoalDifference: "7",
  intPoints: "12",
  strDescription: "Promotion - Champions League",
  strBadge: arsenal.strBadge,
};
const response = (target: string) =>
  target.includes("/scoreboard") ? info : target.includes("/teams?") ? teams : table;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("ESPN uses provider season, rich team logos/profile links, and published zero statistics", () => {
  const result = parseEspnLeagueMetadata(nba, info, teams, table);
  assert.equal(result.season, "2026-27");
  assert.equal(result.name, "National Basketball Association");
  assert.equal(result.teams[0].location, "Atlanta");
  assert.match(result.teams[0].sourceUrl!, /espn.com\/nba\/team/);
  assert.equal(result.teams[0].website, undefined);
  assert.equal(result.standings?.groups[0].rows[0].wins, 0);
  assert.equal(result.standings?.groups[0].rows[0].played, 0);
  assert.equal(result.partial, false);
});

test("mismatched ESPN league envelopes and standings identities cannot cross sports", () => {
  const wrongTeams = {
    sports: [{ leagues: [{ ...teams.sports[0].leagues[0], slug: "nhl", id: "90" }] }],
  };
  const result = parseEspnLeagueMetadata(nba, info, wrongTeams, {
    ...table,
    uid: "s:70~l:90~g:7",
  });
  assert.equal(result.standings, null);
  assert.deepEqual(result.teams, []);
  assert.equal(result.partial, true);
  const wrongId = {
    sports: [{ leagues: [{ ...teams.sports[0].leagues[0], id: "90" }] }],
  };
  assert.deepEqual(parseEspnLeagueMetadata(nba, info, wrongId, {}).teams, []);
});

test("college conference groups and catalog rosters remain separate and deduplicate team IDs", () => {
  const ncaa = {
    ...nba,
    path: "football/college-football",
    key: "NCAAF",
    tag: "NCAAF",
    group: "football",
  };
  const team = {
    ...hawks,
    id: "58",
    displayName: "South Florida Bulls",
    location: "South Florida",
  };
  const catalog = {
    sports: [
      {
        leagues: [{ id: "23", slug: "college-football", teams: [{ team }, { team }] }],
      },
    ],
  };
  const standing = {
    ...table,
    uid: "s:20~l:23~g:90",
    name: "NCAA Football",
    season: { displayName: "2026" },
    children: [
      {
        id: "151",
        name: "American Conference",
        standings: { entries: [{ team, stats: [] }] },
      },
    ],
  };
  const result = parseEspnLeagueMetadata(ncaa, {}, catalog, standing);
  assert.equal(result.teams.length, 1);
  assert.equal(result.teams[0].leagueKey, "NCAAF");
  assert.equal(result.standings?.groups[0].name, "American Conference");
  assert.equal(result.season, "2026");
});

test("SportsDB preserves actual art, official links, venue details, current table and zero draws", () => {
  const result = parseSportsDbLeagueMetadata(
    premier,
    league,
    { teams: [arsenal] },
    { table: [tableRow] },
  );
  assert.equal(result.website, "https://www.premierleague.com/");
  assert.equal(result.teams[0].website, "https://arsenal.com/");
  assert.equal(result.teams[0].venue?.capacity, 60704);
  assert.equal(result.country, "England");
  assert.equal(result.founded, 1992);
  assert.equal(result.limited, true);
  assert.ok(result.banner);
  assert.equal(result.standings?.groups[0].rows[0].points, 12);
  assert.equal(result.standings?.groups[0].rows[0].draws, 0);
  assert.equal(result.standings?.groups[0].rows[0].note, "Promotion - Champions League");
  assert.equal(result.partial, false);
});

test("wrong SportsDB clubs and seasons are rejected; valid standings can supply a roster", () => {
  const result = parseSportsDbLeagueMetadata(
    premier,
    league,
    {
      teams: [
        {
          ...arsenal,
          idTeam: "133607",
          idLeague: "4396",
          strTeam: "Wigan Athletic",
        },
      ],
    },
    {
      table: [
        tableRow,
        { ...tableRow, idTeam: "2", strSeason: "2025-2026" },
        { ...tableRow, idTeam: "3", idLeague: "4396" },
      ],
    },
  );
  assert.deepEqual(
    result.teams.map((team) => team.name),
    ["Arsenal"],
  );
  assert.equal(result.teams[0].description, undefined);
  assert.equal(result.standings?.groups[0].rows.length, 1);
  assert.equal(result.partial, true);
  const noIdentity = parseSportsDbLeagueMetadata(
    premier,
    { leagues: [{ ...league.leagues[0], idLeague: "4396" }] },
    {},
    { table: [tableRow] },
  );
  assert.equal(noIdentity.season, undefined);
  assert.equal(noIdentity.standings, null);
});

test("unsafe URLs are discarded without removing valid metadata", () => {
  const result = parseSportsDbLeagueMetadata(
    premier,
    {
      leagues: [
        {
          ...league.leagues[0],
          strWebsite: "javascript:alert(1)",
          strFanart1: "https://127.0.0.1/a.png",
        },
      ],
    },
    {
      teams: [
        {
          ...arsenal,
          strWebsite: "https://user:password@example.com",
          strBadge: "http://localhost/logo.png",
        },
      ],
    },
    {},
  );
  assert.equal(result.website, undefined);
  assert.equal(result.banner, undefined);
  assert.equal(result.teams[0].website, undefined);
  assert.equal(result.teams[0].logo, "");
});

test("cold ESPN overview makes three requests, caches normalized results and preserves them after failed refresh", async () => {
  let calls = 0,
    failed = false,
    clock = 1000;
  const client = createLeagueMetadataClient({
    now: () => clock,
    json: async (target) => {
      calls++;
      if (failed) throw new Error("offline");
      return response(target);
    },
  });
  const first = await client.loadLeagueMetadata(nba);
  assert.equal(calls, 3);
  assert.equal(first.teams.length, 1);
  assert.equal(first.fetchedAt, 1000);
  assert.equal(await client.loadLeagueMetadata(nba), first);
  assert.equal(calls, 3);
  failed = true;
  clock = 2000;
  const stale = await client.loadLeagueMetadata(nba, undefined, true);
  assert.equal(calls, 6);
  assert.equal(stale.teams[0].name, "Atlanta Hawks");
  assert.equal(stale.fetchedAt, first.fetchedAt);
  assert.equal(stale.partial, true);
  assert.equal(client.readLeagueMetadata({ ...nba, path: "hockey/nhl" }), null);
});

test("SportsDB only requests its explicitly published season and never guesses one", async () => {
  const calls: string[] = [];
  let published = false;
  const client = createLeagueMetadataClient({
    json: async (target) => {
      calls.push(target);
      if (target.includes("lookupleague"))
        return published
          ? league
          : { leagues: [{ ...league.leagues[0], strCurrentSeason: null }] };
      if (target.includes("search_all_teams")) return { teams: [arsenal] };
      return { table: [tableRow] };
    },
  });
  await client.loadLeagueMetadata(premier);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /search_all_teams\.php\?l=English%20Premier%20League$/);
  published = true;
  await client.loadLeagueMetadata(premier, undefined, true);
  assert.equal(calls.length, 5);
  assert.match(calls[4], /lookuptable\.php\?l=4328&s=2026-2027$/);
});

test("unsupported provider keys do not trigger guessed ESPN or SportsDB requests", async () => {
  const client = createLeagueMetadataClient({
    json: async () => {
      throw new Error("Should not request");
    },
  });
  const result = await client.loadLeagueMetadata({
    ...nba,
    key: "ONE",
    path: "official-one",
  });
  assert.equal(result.provider, "catalog");
  assert.equal(result.partial, false);
  assert.deepEqual(result.teams, []);
  assert.equal(leagueMetadataSeed({ ...nba, path: "../../private" }).provider, "catalog");
});

test("verified catalog official links survive empty and restricted provider metadata", async () => {
  const def = { ...nba, officialWebsite: "https://www.nba.com/" };
  assert.equal(leagueMetadataSeed(def).website, "https://www.nba.com/");
  assert.equal(
    parseEspnLeagueMetadata(def, info, teams, table).website,
    "https://www.nba.com/",
  );
  const regional = {
    ...premier,
    officialWebsite: "https://www.premierleague.com/",
  };
  assert.equal(
    parseSportsDbLeagueMetadata(regional, {}, {}, {}).website,
    "https://www.premierleague.com/",
  );
  const client = createLeagueMetadataClient({
    json: async () => {
      throw new Error("restricted");
    },
  });
  assert.equal((await client.loadLeagueMetadata(def)).website, "https://www.nba.com/");
});

test("shared consumers do not cancel one another and the last cancellation aborts transport", async () => {
  const signals: AbortSignal[] = [];
  const client = createLeagueMetadataClient({
    json: async (target, signal) => {
      signals.push(signal);
      await delay(15);
      return response(target);
    },
  });
  const one = new AbortController(),
    two = new AbortController();
  const first = client.loadLeagueMetadata(nba, one.signal);
  const second = client.loadLeagueMetadata(nba, two.signal);
  one.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(
    signals.some((signal) => signal.aborted),
    false,
  );
  assert.equal((await second).teams.length, 1);
  assert.equal(signals.length, 3);
  const abortAll = new AbortController();
  const pending = client.loadLeagueMetadata(nba, abortAll.signal, true);
  await delay(1);
  abortAll.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(
    signals.slice(3).every((signal) => signal.aborted),
    true,
  );
});

test("transport concurrency stays at three and metadata cache evicts after 32 leagues", async () => {
  let active = 0,
    maximum = 0;
  const client = createLeagueMetadataClient({
    json: async (target) => {
      active++;
      maximum = Math.max(active, maximum);
      await delay(1);
      active--;
      return response(target);
    },
  });
  await Promise.all([
    client.loadLeagueMetadata(nba),
    client.loadLeagueMetadata({ ...nba, key: "NBA_COPY" }),
  ]);
  assert.equal(maximum, 3);
  for (let i = 0; i < 32; i++)
    await client.loadLeagueMetadata({
      ...nba,
      key: `league${i}`,
      path: "official-one",
    });
  assert.equal(client.readLeagueMetadata(nba), null);
  assert.ok(
    client.readLeagueMetadata({
      ...nba,
      key: "league31",
      path: "official-one",
    }),
  );
});

test("a non-cooperative slow request hits the deadline without discarding other completed data", async () => {
  const client = createLeagueMetadataClient({
    timeoutMs: 20,
    json: async (target) =>
      target.includes("/standings") ? new Promise(() => {}) : response(target),
  });
  const result = await client.loadLeagueMetadata(nba);
  assert.equal(result.partial, true);
  assert.equal(result.teams[0].name, "Atlanta Hawks");
  assert.equal(result.standings, null);
  assert.equal(result.season, "2026-27");
});
