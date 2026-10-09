import assert from "node:assert/strict";
import test from "node:test";
import {
  currentEsportsMatches,
  extractRiotEvents,
  parseBo3Esports,
  parseBlastRocketLeague,
  parseOpenDotaEsports,
  parseRiotEsports,
  type EsportsMatch,
} from "../src/lib/sports/esports-feeds.ts";

const now = Date.parse("2026-09-14T00:00:00Z");
const riot = (overrides: Record<string, unknown> = {}) => ({
  __typename: "EventMatch",
  id: "117110122781503024",
  state: "unstarted",
  startTime: "2026-09-14T07:00:00Z",
  blockName: "Knockouts",
  league: {
    id: "10",
    name: "Game Changers Pacific",
    image: "http://static.lolesports.com/leagues/gc.png",
  },
  tournament: { id: "117109760462916663", name: "2026" },
  matchTeams: [
    {
      id: "1:11",
      name: "Gen.G GC",
      code: "GEN",
      image: "http://static.lolesports.com/teams/gen.png",
      result: { gameWins: 0 },
    },
    { id: "1:12", name: "Rising Esports GC", result: { gameWins: 0 } },
  ],
  match: { strategy: { type: "bestOf", count: 3 } },
  streams: [],
  ...overrides,
});
const html = (...rows: Record<string, unknown>[]) =>
  `<script>window.transport.push({"unrelated":undefined,"events":${JSON.stringify(rows)}})</script>`;

test("official Riot SSR yields real teams, event art and series format without executing scripts", () => {
  const raw = html(riot());
  const matches = parseRiotEsports(raw, "valorant", now);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].teams[0].name, "Gen.G GC");
  assert.equal(matches[0].teams[0].id, "11");
  assert.equal(matches[0].teams[0].logo, "https://static.lolesports.com/teams/gen.png");
  assert.equal(matches[0].teams[0].score, undefined);
  assert.equal(matches[0].bestOf, 3);
  assert.equal(matches[0].state, "upcoming");
  assert.equal(
    matches[0].sourceUrl,
    "https://valorantesports.com/en-US/tournament/117109760462916663",
  );
});

test("Riot parser tolerates quoted braces but rejects executable literals and changed markup", () => {
  assert.equal(
    extractRiotEvents(html(riot({ blockName: 'A } bracket " quote' })))[0].blockName,
    'A } bracket " quote',
  );
  assert.throws(() =>
    extractRiotEvents('<script>{"__typename":"EventMatch","id":alert(1)}</script>'),
  );
  assert.throws(() => extractRiotEvents("<html>Maintenance</html>"));
  assert.throws(() => extractRiotEvents(" ".repeat(8_000_001)));
});

test("old scheduled events disappear, recent results expire after 48 hours, only provider live is live", () => {
  const rows = [
    riot({ id: "1", startTime: "2026-09-13T23:00:00Z" }),
    riot({ id: "2", state: "completed", startTime: "2026-09-13T22:00:00Z" }),
    riot({ id: "3", state: "completed", startTime: "2026-09-10T22:00:00Z" }),
    riot({ id: "4", state: "inProgress", startTime: "2026-09-13T23:30:00Z" }),
    riot({ id: "5", state: "inProgress", startTime: "2026-09-10T22:00:00Z" }),
    riot({ id: "6", state: "cancelled" }),
  ];
  const matches = parseRiotEsports(html(...rows), "lol", now);
  assert.deepEqual(
    matches.map((match) => [match.id, match.state]),
    [
      ["4", "live"],
      ["2", "recent"],
    ],
  );
});

test("duplicate SSR transports collapse to one match and completed result supersedes old schedule", () => {
  const raw = html(
    riot({ id: "1", state: "inProgress", startTime: "2026-09-13T23:30:00Z" }),
    riot({ id: "1", state: "completed", startTime: "2026-09-13T23:30:00Z" }),
  );
  const matches = parseRiotEsports(raw + raw, "lol", now);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].state, "recent");
});

test("only official event-associated Twitch and YouTube identifiers become streams", () => {
  const matches = parseRiotEsports(
    html(
      riot({
        streams: [
          { provider: "twitch", parameter: "valorant", locale: "en-US" },
          { provider: "youtube", parameter: "abcdefghijk", name: "Official" },
          { provider: "twitch", parameter: "bad/name" },
          { provider: "external", parameter: "javascript:alert(1)" },
        ],
      }),
    ),
    "valorant",
    now,
  );
  assert.deepEqual(
    matches[0].streams.map((stream) => stream.url),
    ["https://www.twitch.tv/valorant", "https://www.youtube.com/watch?v=abcdefghijk"],
  );
});

test("OpenDota rejects pub lobbies and stale live snapshots, preserving recent pro results", () => {
  const row = {
    match_id: "123",
    league_id: 99,
    team_id_radiant: 1,
    team_id_dire: 2,
    team_name_radiant: "Radiant",
    team_name_dire: "Dire",
    activate_time: (now - 30 * 60_000) / 1000,
    last_update_time: (now - 60_000) / 1000,
    radiant_score: 15,
    dire_score: 12,
  };
  assert.equal(parseOpenDotaEsports([row], true, now)[0].teams[0].score, 15);
  assert.equal(parseOpenDotaEsports([{ ...row, league_id: 0 }], true, now).length, 0);
  assert.equal(
    parseOpenDotaEsports([{ ...row, last_update_time: (now - 6 * 60_000) / 1000 }], true, now)
      .length,
    0,
  );
  assert.equal(parseOpenDotaEsports([{ ...row, last_update_time: 0 }], true, now).length, 0);
  const recent = {
    match_id: 456,
    leagueid: 99,
    start_time: (now - 60_000) / 1000,
    radiant_name: "A",
    dire_name: "B",
    radiant_team_id: 1,
    dire_team_id: 2,
    radiant_win: true,
  };
  assert.equal(parseOpenDotaEsports([recent], false, now)[0].teams[0].winner, true);
});

test("Bo3 public CS2 feed resolves included logos, omits odds and rejects other games", () => {
  const row = {
    id: 129430,
    slug: "ence-vs-falcons-force-14-09-2026",
    status: "upcoming",
    discipline_id: 1,
    start_date: "2026-09-14T08:00:00Z",
    team1_id: 754,
    team2_id: 21012,
    tournament: "6058",
    bo_type: 3,
    bet_updates: { path: "https://affiliate.example" },
  };
  const included = {
    teams: {
      754: { name: "ENCE", image_url: "https://files.bo3.gg/ence.webp" },
      21012: { name: "Falcons Force" },
    },
    tournaments: {
      6058: {
        id: 6058,
        name: "Fiesta Series",
        image_url: "https://files.bo3.gg/event.webp",
      },
    },
  };
  const games = parseBo3Esports(
    {
      data: {
        tiers: {
          high_tier: { matches: [row, { ...row, id: 3, discipline_id: 2 }] },
        },
      },
      included,
    },
    now,
  );
  assert.equal(games.length, 1);
  assert.equal(games[0].teams[0].name, "ENCE");
  assert.equal(games[0].event.name, "Fiesta Series");
  assert.equal(games[0].bestOf, 3);
  assert.equal(JSON.stringify(games).includes("affiliate"), false);
  assert.throws(() => parseBo3Esports({ code: "query_params_error" }, now));
});

test("cached matches are time-filtered again without extending live freshness", () => {
  const match = parseRiotEsports(html(riot()), "lol", now)[0];
  assert.equal(currentEsportsMatches([match], now + 8 * 60 * 60_000).length, 0);
  const live: EsportsMatch = {
    ...match,
    state: "live",
    startMs: now,
    updatedMs: now,
  };
  assert.equal(currentEsportsMatches([live], now + 6 * 60_000).length, 0);
});

function blastPage(value: unknown) {
  const table: unknown[] = [];
  function flatten(item: unknown): number {
    if (item === undefined || item === null) return -5;
    const index = table.length;
    table.push(null);
    if (Array.isArray(item)) table[index] = item.map(flatten);
    else if (typeof item === "object")
      table[index] = Object.fromEntries(
        Object.entries(item).map(([key, child]) => [`_${flatten(key)}`, flatten(child)]),
      );
    else table[index] = item;
    return index;
  }
  flatten(value);
  return `window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(table))})`;
}

test("official BLAST RLCS transport yields actual upcoming teams, artwork and series format", () => {
  const match = {
    id: "543cd38c-8832-4e8f-8b7a-8efda4428b99",
    name: "UB Quarter Final 1",
    stageName: "Play-ins",
    type: "BO5",
    scheduledAt: "2026-09-15T16:00:00.000Z",
    startedAt: null,
    hasFinished: false,
    teamA: {
      id: "57464286-ad6e-4685-bdb0-8217d1c9e677",
      name: "Virtus.pro",
      shortName: "vp",
    },
    teamB: {
      id: "152ed6b2-a8aa-4c23-9404-0fc6b54e3ee4",
      name: "Bigodes",
      shortName: "bigodes",
    },
    teamAScore: 0,
    teamBScore: 0,
  };
  const page = blastPage({
    loader: {
      id: "rlcs-world-championship-2026",
      name: "RLCS World Championship 2026",
      matches: [match, { ...match, id: "abcd0000-8832-4e8f-8b7a-8efda4428b99", teamA: null }],
    },
  });
  const matches = parseBlastRocketLeague(page, now);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].teams[0].name, "Virtus.pro");
  assert.equal(matches[0].state, "upcoming");
  assert.equal(matches[0].bestOf, 5);
  assert.equal(matches[0].teams[0].score, undefined);
  assert.equal(
    matches[0].sourceUrl,
    "https://blast.tv/rl/tournaments/rlcs-world-championship-2026/series/543cd38c/vp-bigodes",
  );
  assert.equal(parseBlastRocketLeague(page, now + 3 * 86400_000).length, 0);
});

test("BLAST malformed or executable transport is not evaluated", () => {
  assert.throws(() => parseBlastRocketLeague('streamController.enqueue(alert("x"))', now));
  assert.throws(() => parseBlastRocketLeague('streamController.enqueue("not-json")', now));
});
