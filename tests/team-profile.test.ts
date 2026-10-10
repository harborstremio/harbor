import assert from "node:assert/strict";
import test from "node:test";
import {
  createTeamProfileLoader,
  matchSportsDbTeam,
  parseEspnTeamProfile,
  parseEspnTeamRoster,
  parseEspnTeamStats,
  parseEspnTeamEvents,
  parseSportsDbRoster,
  parseSportsDbTeamEvents,
  enrichSportsDbTeam,
  teamProfileSeed,
} from "../src/lib/sports/team-profile.ts";
const identity = { id: "19", name: "New York Giants", league: "NFL" };
const league = { key: "NFL", tag: "NFL", path: "football/nfl", group: "football", labelEn: "NFL" };
const team = {
  idTeam: "134935",
  strTeam: "New York Giants",
  strSport: "American Football",
  strLeague: "NFL",
  idLeague: "4391",
  intFormedYear: "1925",
  strStadium: "MetLife Stadium",
  strWebsite: "www.giants.com",
  strDescriptionEN:
    "The New York Giants are an American football team.\n\nThe team has won eight NFL titles: four before the Super Bowl era and four Super Bowls.",
  strBadge: "https://www.thesportsdb.com/giants.png",
};
const espn = {
  team: {
    id: "19",
    displayName: "New York Giants",
    links: [
      { text: "Clubhouse", href: "https://www.espn.com/nfl/team/_/name/nyg/new-york-giants" },
    ],
    record: { items: [{ description: "Overall", summary: "1-0" }] },
    franchise: { venue: { fullName: "MetLife Stadium" } },
  },
};
test("TSDB requires exact name, sport, competition and unambiguous provider identity", () => {
  assert.equal(matchSportsDbTeam({ teams: [team] }, identity, league)?.idTeam, "134935");
  for (const wrong of [
    { ...team, strSport: "Baseball" },
    { ...team, strTeam: "New York Giants Women" },
    { ...team, strLeague: "Other League" },
  ])
    assert.equal(matchSportsDbTeam({ teams: [wrong] }, identity, league), undefined);
  assert.equal(
    matchSportsDbTeam({ teams: [team, { ...team, idTeam: "2" }] }, identity, league),
    undefined,
  );
  assert.equal(
    matchSportsDbTeam({ teams: [team] }, { ...identity, source: "thesportsdb-hub" }, league),
    undefined,
  );
  assert.equal(
    matchSportsDbTeam(
      { teams: [team] },
      { ...identity, id: "134935", source: "thesportsdb-hub" },
      { ...league, path: "999" },
    ),
    undefined,
  );
});
test("ESPN grouped and flat rosters retain provider identity and deduplicate athletes", () => {
  const athlete = {
    id: "2577240",
    displayName: "Andrew Thomas",
    jersey: "78",
    position: { abbreviation: "LT" },
  };
  assert.equal(parseEspnTeamProfile({ team: { ...espn.team, id: "20" } }, identity), null);
  assert.deepEqual(
    parseEspnTeamRoster({ athletes: [{ items: [athlete, athlete] }] }),
    parseEspnTeamRoster({ athletes: [athlete] }),
  );
  assert.equal(parseEspnTeamRoster({ athletes: [athlete] })[0].source, "espn");
  assert.equal(
    parseEspnTeamProfile(espn, identity)?.facts.find((f) => f.label === "Overall")?.value,
    "1-0",
  );
});
test("stats retain zeros and schedule requires requested team membership", () => {
  assert.equal(
    parseEspnTeamStats({
      results: {
        stats: {
          categories: [
            {
              displayName: "Passing",
              stats: [{ displayName: "Interceptions", displayValue: "0" }],
            },
          ],
        },
      },
    })[0].value,
    "0",
  );
  const event = {
    id: "1",
    name: "Giants vs Cowboys",
    competitions: [
      {
        competitors: [
          { team: { id: "19" }, score: { displayValue: "28" } },
          { team: { id: "6" }, score: { displayValue: "14" } },
        ],
        status: { type: { description: "Final", state: "post" } },
      },
    ],
  };
  assert.equal(parseEspnTeamEvents({ events: [event] }, "19")[0].score, "28 – 14");
  assert.deepEqual(parseEspnTeamEvents({ events: [event] }, "20"), []);
});
test("honors are attributed biography excerpts; unsafe URLs and conflicting founding years are omitted", () => {
  const p = teamProfileSeed(identity);
  enrichSportsDbTeam(p, {
    ...team,
    strTwitter: "javascript:alert(1)",
    strFacebook: "http://127.0.0.1/x",
  });
  assert.equal(p.honors[0].sourceUrl, "https://www.thesportsdb.com/team/134935");
  assert.equal(p.honors[0].detail, team.strDescriptionEN.split("\n\n")[1]);
  assert.deepEqual(p.links, [{ label: "Official website", url: "https://www.giants.com/" }]);
  assert.deepEqual(teamProfileSeed(identity).honors, []);
  const arsenal = teamProfileSeed(identity);
  enrichSportsDbTeam(arsenal, {
    ...team,
    intFormedYear: "1892",
    strDescriptionEN: "In 1886, Woolwich munitions workers founded the club as Dial Square.",
  });
  assert.equal(
    arsenal.facts.some((f) => f.label === "Founded"),
    false,
  );
});
test("TSDB demo payloads for other teams cannot populate roster or schedule", () => {
  const players = parseSportsDbRoster(
    {
      player: [
        { idPlayer: "1", idTeam: "134935", strPlayer: "Player One" },
        { idPlayer: "2", idTeam: "other", strPlayer: "Wrong Player" },
      ],
    },
    "134935",
  );
  assert.equal(players.length, 1);
  assert.equal(players[0].source, "thesportsdb");
  assert.equal(players[0].profileUrl, "https://www.thesportsdb.com/player/1");
  assert.deepEqual(
    parseSportsDbTeamEvents(
      { events: [{ idEvent: "1", idHomeTeam: "2", idAwayTeam: "3", strEvent: "Wrong game" }] },
      "134935",
    ),
    [],
  );
});
test("loader shares requests, honors TTL, retains partial successes and bounds calls", async () => {
  let calls = 0,
    clock = 1000;
  const load = createTeamProfileLoader({
    resolveLeague: () => league,
    now: () => clock,
    request: async (url) => {
      calls++;
      if (url.includes("searchteams")) return { teams: [team] };
      if (url.endsWith("/19")) return espn;
      if (url.endsWith("/roster")) return { athletes: [{ id: "1", displayName: "Player One" }] };
      if (url.endsWith("/statistics")) throw new Error("503");
      return {};
    },
  });
  const [a, b] = await Promise.all([load(identity), load(identity)]);
  assert.equal(a, b);
  assert.equal(a.partial, true);
  assert.equal(a.roster.length, 1);
  assert.equal(calls, 7);
  await load(identity);
  assert.equal(calls, 7);
  clock += 30001;
  await load(identity);
  assert.equal(calls, 14);
});
test("abort only cancels shared transport after the final subscriber leaves", async () => {
  let start!: () => void;
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const signals: AbortSignal[] = [];
  const load = createTeamProfileLoader({
    resolveLeague: () => league,
    request: async (_url, signal) => {
      signals.push(signal);
      start();
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      );
    },
  });
  const a = new AbortController(),
    b = new AbortController();
  const pa = load(identity, a.signal),
    pb = load(identity, b.signal);
  await started;
  a.abort();
  await assert.rejects(pa);
  assert.equal(signals[0].aborted, false);
  b.abort();
  await assert.rejects(pb);
  assert.equal(signals[0].aborted, true);
});
test("non-ESPN numeric team IDs are never sent to ESPN", async () => {
  const calls: string[] = [];
  const load = createTeamProfileLoader({
    resolveLeague: () => league,
    request: async (url) => {
      calls.push(url);
      return { teams: [] };
    },
  });
  const p = await load({ ...identity, source: "api-sports" });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("searchteams.php"));
  assert.equal(p.partial, true);
});
test("esports enrichment requires game competition membership, not organization name alone", () => {
  const i = { id: "provider-team", name: "Team Liquid", league: "LCS", source: "esports" };
  const l = { key: "LCS", tag: "LCS", path: "5555", group: "esports", labelEn: "LCS" };
  const squad = {
    idTeam: "2000",
    strTeam: "Team Liquid",
    strSport: "Esports",
    idLeague: "5555",
    strLeague: "LCS",
  };
  assert.equal(matchSportsDbTeam({ teams: [squad] }, i, l)?.idTeam, "2000");
  assert.equal(
    matchSportsDbTeam({ teams: [{ ...squad, idLeague: "6666", strLeague: "VALORANT" }] }, i, l),
    undefined,
  );
});
test("non-Latin names and same-name soccer clubs in another country do not match", () => {
  assert.equal(
    matchSportsDbTeam(
      { teams: [{ idTeam: "1", strSport: "Soccer", strTeam: "النصر" }] },
      { ...identity, name: "الهلال" },
      { ...league, group: "soccer" },
    ),
    undefined,
  );
  const arsenal = { id: "359", name: "Arsenal", league: "EPL" },
    epl = {
      ...league,
      path: "soccer/eng.1",
      group: "soccer",
      labelEn: "Premier League",
      tag: "EPL",
    };
  const club = {
    idTeam: "133604",
    strTeam: "Arsenal",
    strSport: "Soccer",
    strLeague: "English Premier League",
    strCountry: "England",
  };
  assert.equal(matchSportsDbTeam({ teams: [club] }, arsenal, epl)?.idTeam, "133604");
  assert.equal(
    matchSportsDbTeam({ teams: [{ ...club, strCountry: "Argentina" }] }, arsenal, epl),
    undefined,
  );
});
test("explicit retry bypasses partial cache while simultaneous retries share in-flight work", async () => {
  let calls = 0;
  const load = createTeamProfileLoader({
    resolveLeague: () => league,
    request: async () => {
      calls++;
      throw new Error("503");
    },
  });
  await load(identity);
  assert.equal(calls, 2);
  await load(identity);
  assert.equal(calls, 2);
  await Promise.all([load(identity, undefined, true), load(identity, undefined, true)]);
  assert.equal(calls, 4);
});

test("database roster fallback is explicitly partial without implying a failed request", async () => {
  const load = createTeamProfileLoader({
    resolveLeague: () => ({ ...league, path: "5337", group: "lacrosse", tag: "PLL" }),
    request: async (url) => {
      if (url.includes("lookupteam"))
        return {
          teams: [
            {
              idTeam: "146832",
              strTeam: "Philadelphia Waterdogs",
              strSport: "Lacrosse",
              idLeague: "5337",
            },
          ],
        };
      if (url.includes("lookup_all_players"))
        return { player: [{ idTeam: "146832", idPlayer: "34244582", strPlayer: "Ethan Walker" }] };
      return { events: [] };
    },
  });
  const result = await load({
    id: "146832",
    name: "Philadelphia Waterdogs",
    league: "PLL",
    source: "thesportsdb",
  });
  assert.equal(result.roster.length, 1);
  assert.equal(result.rosterLimited, true);
  assert.equal(result.partial, false);
});
