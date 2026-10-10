import assert from "node:assert/strict";
import test from "node:test";

type Route = { match: RegExp; status?: number; body: string };
let routes: Route[] = [];
let seen: { url: string; headers: Record<string, string> }[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = Object.fromEntries(new Headers(init?.headers as HeadersInit | undefined));
  seen.push({ url, headers });
  const route = routes.find((entry) => entry.match.test(url));
  if (!route) return new Response("unrouted", { status: 404 });
  return new Response(route.body, { status: route.status ?? 200 });
}) as typeof fetch;

const feeds = await import("../src/lib/sports/esports-feeds.ts");
const dota = await import("../src/lib/sports/esports-dota-broadcasts.ts");

function serve(next: Route[]) {
  routes = next;
  seen = [];
}
const hit = (pattern: RegExp) => seen.filter((entry) => pattern.test(entry.url)).length;

// Riot's own envelope: data.schedule.events, one event per series, league slug carrying the title.
const riotEvent = (overrides: Record<string, unknown> = {}) => ({
  startTime: new Date(Date.now() + 2 * 60_000).toISOString(),
  state: "unstarted",
  type: "match",
  blockName: "Playoffs",
  league: {
    id: "98767991310872058",
    slug: "lck",
    name: "LCK",
    image: "http://static.lolesports.com/leagues/lck.png",
  },
  tournament: { id: "110371551277508787" },
  match: {
    id: "110853020122747188",
    teams: [
      { name: "T1", code: "T1", image: "https://static.lolesports.com/t1.png", result: {} },
      { name: "Gen.G", code: "GEN", result: {} },
    ],
    strategy: { type: "bestOf", count: 5 },
  },
  streams: [],
  ...overrides,
});
const riotPayload = (...events: unknown[]) => JSON.stringify({ data: { schedule: { events } } });

// The SSR page the JSON gateway falls back to. Same shape the shipped parser already reads.
const ssrPage = (slug: string) =>
  `<script>window.transport.push(${JSON.stringify([
    {
      __typename: "EventMatch",
      id: "117110122781503024",
      state: "unstarted",
      startTime: new Date(Date.now() + 90 * 60_000).toISOString(),
      blockName: "Week 3",
      league: { id: "1", name: slug.toUpperCase() },
      tournament: { id: "2" },
      matchTeams: [
        { id: "1:11", name: "Fallback One", result: { gameWins: 0 } },
        { id: "1:12", name: "Fallback Two", result: { gameWins: 0 } },
      ],
      match: { strategy: { type: "bestOf", count: 3 } },
      streams: [],
    },
  ])})</script>`;

// Bo3 v1: rows under results, count under total, and the echoed filter the guard checks.
const bo3Row = (overrides: Record<string, unknown> = {}) => ({
  id: 1512345,
  slug: "navi-vs-vitality-30-09-2026",
  status: "current",
  discipline_id: 1,
  start_date: new Date(Date.now() - 20 * 60_000).toISOString(),
  bo_type: 3,
  team1_score: 1,
  team2_score: 0,
  team1: { id: 100, name: "Natus Vincere", image_url: "https://files.bo3.gg/navi.webp" },
  team2: { id: 200, name: "Team Vitality" },
  tournament: { id: 7001, slug: "blast-bounty-2026", name: "BLAST Bounty 2026", tier: "s" },
  stage: { title: "BLAST Bounty 2026 Group Stage" },
  round: { name: "Round 2" },
  streams: [
    {
      platform: 1,
      raw_url: "https://www.twitch.tv/blastpremier",
      embed_url: "https://player.twitch.tv/?channel=blastpremier",
      name: "BLAST Premier",
      language: "en",
      official: true,
      viewers_number: 48000,
    },
    { platform: 1, raw_url: "https://www.twitch.tv/blocked", blocked: true },
  ],
  bet_updates: { url: "https://refpa04636.pro/L?tag=d_x" },
  ...overrides,
});
const bo3Payload = (discipline: number, rows: unknown[]) =>
  JSON.stringify({
    total: { count: rows.length },
    results: rows,
    links: {
      self: `https://api.bo3.gg/api/v1/matches?filter[matches.discipline_id][eq]=${discipline}`,
    },
  });

const bo3V2Payload = () =>
  JSON.stringify({
    data: {
      tiers: {
        high_tier: {
          matches: [
            {
              id: 2222,
              slug: "spirit-vs-mouz-30-09-2026",
              status: "upcoming",
              discipline_id: 1,
              start_date: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
              team1_id: 11,
              team2_id: 22,
              tournament: "6058",
              bo_type: 3,
            },
          ],
        },
      },
    },
    included: {
      teams: { 11: { name: "Team Spirit" }, 22: { name: "MOUZ" } },
      tournaments: { 6058: { id: 6058, name: "Fiesta Series" } },
    },
  });

const openDotaLive = (leagueId: number) =>
  JSON.stringify([
    {
      match_id: 8123456789,
      league_id: leagueId,
      league_name: "BLAST Slam VIII",
      team_id_radiant: 7119388,
      team_id_dire: 2163,
      team_name_radiant: "Team Spirit",
      team_name_dire: "Team Liquid",
      activate_time: Math.floor((Date.now() - 25 * 60_000) / 1000),
      last_update_time: Math.floor((Date.now() - 30_000) / 1000),
      radiant_score: 22,
      dire_score: 17,
    },
  ]);

// Valve's league payload, with the three return shapes the survey measured, scheme included or not.
const leagueData = (leagueId: number) =>
  JSON.stringify({
    info: {
      league_id: leagueId,
      name: "BLAST Slam VIII",
      streams: [
        { stream_name: "BLAST Dota", language: "en", stream_url: "https://www.twitch.tv/blastdota" },
        { stream_name: "BLAST Dota", stream_url: "https://www.youtube.com/@BLASTDota" },
        { stream_name: "BLAST", stream_url: "blast.tv/dota/live" },
      ],
    },
  });

test("LoL reads the JSON gateway with its key, and a live row supersedes its scheduled twin", async () => {
  const scheduled = riotEvent();
  serve([
    {
      match: /esports-api\.lolesports\.com\/persisted\/gw\/getSchedule/,
      body: riotPayload(scheduled),
    },
    {
      match: /esports-api\.lolesports\.com\/persisted\/gw\/getLive/,
      body: riotPayload({
        ...scheduled,
        state: "inProgress",
        streams: [
          {
            provider: "twitch",
            parameter: "lck",
            locale: "ko-KR",
            mediaLocale: { translatedName: "LCK Korean" },
            countries: ["KR"],
          },
          { provider: "huya", parameter: "123456" },
        ],
      }),
    },
  ]);
  const feed = await feeds.fetchEsportsFeed("lol", { force: true });
  assert.equal(feed.status, "ready");
  assert.equal(feed.matches.length, 1);
  assert.equal(feed.matches[0].state, "live");
  assert.equal(feed.matches[0].teams[0].code, "T1");
  assert.equal(feed.matches[0].event.logo, "https://static.lolesports.com/leagues/lck.png");
  assert.deepEqual(
    feed.matches[0].streams.map((stream) => stream.url),
    ["https://www.twitch.tv/lck"],
  );
  const keyed = seen.filter((entry) => /esports-api\.lolesports\.com/.test(entry.url));
  assert.equal(keyed.length, 2);
  assert.ok(keyed.every((entry) => (entry.headers["x-api-key"] ?? "").length > 20));
  assert.equal(hit(/lolesports\.com\/en-US\/schedule/), 0);
});

test("a rotated key falls back to the proven SSR parser instead of an empty board", async () => {
  serve([
    { match: /esports-api\.lolesports\.com/, status: 403, body: "Forbidden" },
    { match: /lolesports\.com\/en-US/, body: ssrPage("lck") },
  ]);
  const feed = await feeds.fetchEsportsFeed("lol", { force: true });
  assert.equal(feed.status, "ready");
  assert.equal(feed.matches.length, 1);
  assert.equal(feed.matches[0].teams[0].name, "Fallback One");
  assert.equal(hit(/lolesports\.com\/en-US\/schedule/), 1);
});

test("VALORANT uses its own gateway path and is never asked for the live board it refuses", async () => {
  serve([
    {
      match: /persisted\/val\/getSchedule/,
      body: riotPayload(
        riotEvent({
          league: { id: "1", slug: "vct_emea", name: "VCT EMEA" },
          streams: [
            { provider: "twitch", parameter: "valorant_emea", locale: "en-GB" },
            { provider: "youtube", parameter: "abcdefghijk", locale: "de-DE" },
          ],
        }),
      ),
    },
  ]);
  const feed = await feeds.fetchEsportsFeed("valorant", { force: true });
  assert.equal(feed.status, "ready");
  assert.equal(feed.matches.length, 1);
  assert.equal(feed.matches[0].streams.length, 2);
  assert.equal(hit(/getLive/), 0);
  assert.equal(hit(/sport=val/), 1);
});

test("CS2 reads one v1 request per state set and keeps the broadcast links, never the odds", async () => {
  serve([
    {
      match: /api\/v1\/matches\?.*status.*current/,
      body: bo3Payload(1, [bo3Row()]),
    },
    {
      match: /api\/v1\/matches\?.*finished/,
      body: bo3Payload(1, [
        bo3Row({
          id: 1512300,
          slug: "faze-vs-g2-29-09-2026",
          status: "finished",
          start_date: new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
          winner_team_id: 100,
          streams: [],
        }),
      ]),
    },
  ]);
  const feed = await feeds.fetchEsportsFeed("cs2", { force: true });
  assert.equal(feed.status, "ready");
  assert.deepEqual(
    feed.matches.map((match) => match.state),
    ["live", "recent"],
  );
  assert.equal(feed.matches[0].event.stage, "Group Stage · Round 2");
  assert.deepEqual(
    feed.matches[0].streams.map((stream) => stream.url),
    ["https://www.twitch.tv/blastpremier"],
  );
  assert.equal(JSON.stringify(feed).includes("refpa"), false);
  assert.equal(JSON.stringify(feed).includes("player.twitch.tv"), false);
  assert.equal(hit(/api\/v1\/matches/), 2);
  assert.equal(hit(/api\/v2\/matches/), 0);
});

test("a v1 outage drops CS2 back to the v2 tier lists rather than to nothing", async () => {
  serve([
    { match: /api\/v1\/matches/, status: 500, body: "" },
    { match: /api\/v2\/matches\/(live|upcoming|finished)/, body: bo3V2Payload() },
  ]);
  const feed = await feeds.fetchEsportsFeed("cs2", { force: true });
  assert.equal(feed.status, "ready");
  assert.equal(feed.matches[0].teams[0].name, "Team Spirit");
  assert.ok(hit(/api\/v2\/matches/) >= 5);
});

test("Dota keeps OpenDota live and adds the bo3 schedule it has never had", async () => {
  serve([
    { match: /api\.opendota\.com\/api\/live/, body: openDotaLive(19102) },
    { match: /api\.opendota\.com\/api\/proMatches/, body: "[]" },
    {
      match: /api\/v1\/matches/,
      body: bo3Payload(4, [
        bo3Row({
          id: 1599001,
          slug: "falcons-vs-tundra-01-10-2026",
          status: "upcoming",
          discipline_id: 4,
          start_date: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
          team1_score: null,
          team2_score: null,
          team1: { id: 9, name: "Team Falcons" },
          team2: { id: 8, name: "Tundra Esports" },
          tournament: { id: 8002, slug: "esl-one-2026", name: "ESL One 2026" },
          stage: null,
          round: null,
          streams: [
            { platform: 2, raw_url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", name: "ESL" },
          ],
        }),
      ]),
    },
    { match: /GetLeagueData/, body: leagueData(19102) },
  ]);
  const feed = await feeds.fetchEsportsFeed("dota2", { force: true });
  assert.equal(feed.status, "ready");
  assert.deepEqual(
    feed.matches.map((match) => [match.state, match.teams[0].name]),
    [
      ["live", "Team Spirit"],
      ["upcoming", "Team Falcons"],
    ],
  );
  // The live row had no streams of its own, so Valve's official league broadcast supplies them.
  assert.deepEqual(
    feed.matches[0].streams.map((stream) => stream.url),
    ["https://www.twitch.tv/blastdota"],
  );
  assert.deepEqual(
    feed.matches[1].streams.map((stream) => stream.url),
    ["https://www.youtube.com/watch?v=aaaaaaaaaaa"],
  );
  assert.equal(hit(/hawk\.live/), 0);
  assert.equal(hit(/GetLeagueData/), 1);
});

test("Rocket League still reads the official BLAST page and reports an outage honestly", async () => {
  serve([{ match: /blast\.tv\/rl/, body: "<html>no transport</html>" }]);
  const feed = await feeds.fetchEsportsFeed("rocketleague", { force: true });
  assert.equal(feed.status, "unavailable");
  assert.equal(hit(/blast\.tv\/rl/), 1);
});

test("Valve league broadcasts come back by shape, and only on an allowlisted host", async () => {
  assert.deepEqual(
    dota.parseDotaLeagueBroadcasts(JSON.parse(leagueData(1))).map((stream) => [
      stream.platform,
      stream.url,
      stream.title,
    ]),
    [["twitch", "https://www.twitch.tv/blastdota", "BLAST Dota"]],
  );
  // A renamed container is survivable; an unlisted host, a vod path and a bare image are not.
  assert.deepEqual(
    dota.parseDotaLeagueBroadcasts({
      result: {
        broadcasts: [
          { title: "Main", url: "www.twitch.tv/dota2ti" },
          { title: "Mirror", link: "https://vk.com/dota" },
          { title: "Replay", vod_url: "https://www.twitch.tv/videos/2199991" },
        ],
        logo_url: "https://cdn.cloudflare.steamstatic.com/apps/dota2/x.png",
      },
    }).map((stream) => stream.url),
    ["https://www.twitch.tv/dota2ti"],
  );
  assert.equal(dota.parseDotaLeagueBroadcasts({}).length, 0);
  assert.equal(
    dota.dotaLeagueDataUrl("19102"),
    "https://www.dota2.com/webapi/IDOTA2DPC/GetLeagueData/v001/?league_id=19102",
  );
  assert.equal(dota.dotaLeagueDataUrl("19102;drop"), null);
});

test("only an OpenDota row offers its event id as a Valve league id", () => {
  const base = {
    id: "1",
    game: "dota2" as const,
    state: "live" as const,
    startMs: Date.now(),
    event: { id: "19102", name: "BLAST Slam VIII" },
    teams: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ] as [{ id: string; name: string }, { id: string; name: string }],
    streams: [],
    sourceUrl: "https://www.opendota.com/matches/8123456789",
  };
  assert.equal(dota.dotaLeagueId(base), "19102");
  // A bo3 row's event id is a bo3 tournament id, so it must never address a Valve league.
  assert.equal(
    dota.dotaLeagueId({ ...base, sourceUrl: "https://bo3.gg/matches/a-vs-b-01-10-2026" }),
    null,
  );
});

test("a request signature is per header set, and the allowlist is the last gate on a link", async () => {
  serve([{ match: /example\.test/, body: "one" }]);
  const url = "https://example.test/schedule";
  assert.equal(await feeds.requestEsportsText(url, 60_000, { headers: { "x-api-key": "a" } }), "one");
  await feeds.requestEsportsText(url, 60_000, { headers: { "x-api-key": "a" } });
  assert.equal(hit(/example\.test/), 1);
  await feeds.requestEsportsText(url, 60_000, { headers: { "x-api-key": "b" } });
  assert.equal(hit(/example\.test/), 2);
  await feeds.requestEsportsText(url, 60_000);
  assert.equal(hit(/example\.test/), 3);
  assert.equal(seen[0].headers["x-api-key"], "a");
  const match = {
    id: "1",
    game: "cs2" as const,
    state: "live" as const,
    startMs: Date.now(),
    event: { id: "1", name: "Event" },
    teams: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ] as [{ id: string; name: string }, { id: string; name: string }],
    streams: [
      { title: "Twitch", url: "https://www.twitch.tv/blastpremier", platform: "twitch" as const },
      { title: "Channel", url: "https://www.youtube.com/@BLASTDota", platform: "youtube" as const },
      { title: "Site", url: "https://blast.tv/dota/live", platform: "external" as const },
    ],
    sourceUrl: "https://bo3.gg/matches/a-vs-b",
  };
  assert.deepEqual(
    feeds.allowedEsportsStreams([match])[0].streams.map((stream) => stream.url),
    ["https://www.twitch.tv/blastpremier"],
  );
});

test("the match dialog asks Valve first and keeps the community listing behind it", async () => {
  const match = {
    id: "8123456790",
    game: "dota2" as const,
    state: "live" as const,
    startMs: Date.parse("2026-09-30T19:52:00Z"),
    event: { id: "19777", name: "BLAST Slam VIII" },
    teams: [
      { id: "a", name: "Stray Club" },
      { id: "b", name: "Rostikfacekid Club" },
    ] as [{ id: string; name: string }, { id: string; name: string }],
    streams: [],
    sourceUrl: "https://www.opendota.com/matches/8123456790",
  };
  serve([{ match: /GetLeagueData/, body: leagueData(19777) }]);
  assert.deepEqual(
    (await dota.fetchDotaBroadcasts(match)).map((stream) => stream.url),
    ["https://www.twitch.tv/blastdota"],
  );
  assert.equal(hit(/hawk\.live/), 0);
  // An empty Valve answer is where the series level listing still earns its place.
  const series = {
    slug: "rostikfacekid-club-vs-stray-club",
    championship: { slug: "winline-star-series-season-4" },
    team1: { name: "Rostikfacekid Club" },
    team2: { name: "Stray Club" },
    startAt: "2026-09-30T18:45:00Z",
    streams: [{ name: "stray228", url: "https://player.twitch.tv/?channel=stray228" }],
  };
  const page = (props: unknown) =>
    `<div data-page="${JSON.stringify({ props }).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></div>`;
  serve([
    { match: /GetLeagueData/, body: JSON.stringify({ info: { streams: [] } }) },
    { match: /hawk\.live\/dota-2/, body: page({ seriesPageData: series }) },
    { match: /hawk\.live/, body: page({ seriesList: [series] }) },
  ]);
  const fallback = { ...match, id: "8123456791", event: { id: "19778", name: "Star Series" } };
  assert.deepEqual(
    (await dota.fetchDotaBroadcasts(fallback)).map((stream) => stream.url),
    ["https://www.twitch.tv/stray228"],
  );
  assert.equal(hit(/hawk\.live/), 2);
});
