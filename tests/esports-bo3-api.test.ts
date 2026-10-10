import assert from "node:assert/strict";
import test from "node:test";
import {
  BO3_DISCIPLINES,
  bo3FeedMatches,
  bo3MatchesUrl,
  parseBo3Matches,
  type Bo3Query,
} from "../src/lib/sports/esports-bo3-api.ts";

const now = Date.parse("2026-09-30T12:00:00Z");
const iso = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

// Shapes copied from live api.bo3.gg/api/v1/matches responses, trimmed to the fields read.
const tournament = (overrides: Record<string, unknown> = {}) => ({
  id: 6110,
  slug: "cct-europe-2026-series-10",
  name: "CCT Europe 2026 Series 10",
  status: "current",
  prize: 25000,
  tier: "b",
  tier_rank: 3,
  image_url: "https://files.bo3.gg/uploads/tournament/6110/image/webp-5188825.webp",
  banner_image_url: null,
  short_name: null,
  start_date: "2026-09-28T08:00:00.000+00:00",
  end_date: "2026-10-10T21:00:00.000+00:00",
  event_scope: "regional",
  event_level: "regular",
  discipline_id: 1,
  ...overrides,
});
const kickStream = {
  id: 4820,
  embed_url: "https://player.kick.com/cct_cs2",
  raw_url: "https://kick.com/cct_cs2",
  viewers_number: 1112,
  official: false,
  language: "en",
  name: "CCT_CS2",
  channel_image_url: "https://kick.com/img/default-profile-pictures/default2.jpeg",
  blocked: false,
  platform: 3,
};
const twitchStream = {
  id: 6429,
  embed_url: "https://player.twitch.tv/?channel=metanoiagg",
  raw_url: "https://www.twitch.tv/metanoiagg",
  viewers_number: 352,
  official: true,
  language: "pt",
  name: "MetanoiaGG",
  blocked: false,
  platform: 1,
};
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 130215,
  slug: "masonic-vs-lavked-01-10-2026",
  team1_id: 1059,
  team2_id: 25011,
  winner_team_id: null,
  tournament_id: 6110,
  team1_score: 0,
  team2_score: 0,
  status: "current",
  bo_type: 3,
  start_date: iso(-30),
  tier: "b",
  maps_score: [false, true, true],
  discipline_id: 1,
  // Never read by the adapter: live odds, affiliate redirects and model output.
  bet_updates: [{ url: "https://refpa04636.pro/L?tag=d_123", team1_coef: 1.4, team2_coef: 2.9 }],
  ai_predictions: { team1: 0.61 },
  points: 12,
  rating: 7,
  stars: 2,
  team1: {
    id: 1059,
    slug: "masonic",
    name: "MASONIC",
    rank: 116,
    image_url: "https://files.bo3.gg/uploads/team/1059/image/webp-3acae7de.webp",
    country_id: 26,
  },
  team2: {
    id: 25011,
    slug: "lavked",
    name: "Lavked",
    image_url: "https://files.bo3.gg/uploads/team/25011/image/webp-9f21aa01.webp",
  },
  tournament: tournament(),
  stage: { id: 10832, title: "CCT Europe 2026 Series 10 Group Stage", tournament_id: 6110 },
  round: { id: 40242, name: "Round 2", round_index: 2 },
  streams: [kickStream],
  ...overrides,
});
const self = (discipline: number) =>
  `/api/v1/matches?filter%5Bmatches.discipline_id%5D%5Beq%5D=${discipline}` +
  "&filter%5Bmatches.status%5D%5Bin%5D=current%2Cupcoming&sort=start_date";
type PageOptions = { count?: number; self?: string; discipline?: number };
const page = (rows: Record<string, unknown>[], options: PageOptions = {}) => ({
  total: { count: options.count ?? rows.length, pages: 1, offset: 0, limit: 50 },
  results: rows,
  links: { self: options.self ?? self(options.discipline ?? 1) },
});
const cs2: Bo3Query = { game: "cs2" };

test("one list request carries the mandatory filter prefix, the title and the stream expansion", () => {
  const url = new URL(bo3MatchesUrl({ game: "dota2", limit: 400 }));
  assert.equal(url.origin + url.pathname, "https://api.bo3.gg/api/v1/matches");
  assert.equal(url.searchParams.get("filter[matches.discipline_id][eq]"), "4");
  assert.equal(url.searchParams.get("filter[matches.status][in]"), "current,upcoming");
  assert.equal(url.searchParams.get("with"), "teams,tournament,streams,stage,round");
  assert.equal(url.searchParams.get("sort"), "start_date");
  // The provider caps page[limit] at 100 and silently keeps its own default past that.
  assert.equal(url.searchParams.get("page[limit]"), "100");
  assert.match(url.search, /filter%5Bmatches\.discipline_id%5D%5Beq%5D=4/);
  const recent = new URL(bo3MatchesUrl({ game: "cs2", statuses: ["finished"], limit: 20 }));
  assert.equal(recent.searchParams.get("sort"), "-start_date");
  assert.equal(recent.searchParams.get("filter[matches.status][in]"), "finished");
  assert.deepEqual(
    Object.values(BO3_DISCIPLINES).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 7, 8],
  );
});

test("a live row becomes a match with teams, series format, stage and the public match page", () => {
  const result = parseBo3Matches(page([row()]), cs2, now);
  assert.equal(result.total, 1);
  assert.equal(result.matches.length, 1);
  const match = result.matches[0];
  assert.equal(match.game, "cs2");
  assert.equal(match.state, "live");
  assert.equal(match.startMs, now - 30 * 60_000);
  assert.equal(match.bestOf, 3);
  assert.equal(match.teams[0].name, "MASONIC");
  assert.equal(match.teams[0].id, "1059");
  assert.equal(match.teams[0].logo, "https://files.bo3.gg/uploads/team/1059/image/webp-3acae7de.webp");
  assert.equal(match.teams[0].score, 0);
  assert.equal(match.teams[0].winner, undefined);
  assert.equal(match.teams[0].code, undefined);
  assert.equal(match.event.name, "CCT Europe 2026 Series 10");
  assert.equal(match.event.stage, "Group Stage · Round 2");
  assert.equal(match.tier, "b");
  assert.equal(match.sourceUrl, "https://bo3.gg/matches/masonic-vs-lavked-01-10-2026");
});

test("tournament metadata rides along on the same request and is deduped", () => {
  const second = row({
    id: 130216,
    slug: "falcons-vs-pure-01-10-2026",
    status: "upcoming",
    start_date: iso(120),
    team1_score: 0,
    team2_score: 0,
  });
  const result = parseBo3Matches(page([row(), second]), cs2, now);
  assert.equal(result.tournaments.length, 1);
  const event = result.tournaments[0];
  assert.equal(event.id, "6110");
  assert.equal(event.name, "CCT Europe 2026 Series 10");
  assert.equal(event.tier, "b");
  assert.equal(event.tierRank, 3);
  assert.equal(event.scope, "regional");
  assert.equal(event.level, "regular");
  assert.equal(event.prize, 25000);
  assert.equal(event.startMs, Date.parse("2026-09-28T08:00:00.000+00:00"));
  assert.equal(event.endMs, Date.parse("2026-10-10T21:00:00.000+00:00"));
  assert.equal(event.sourceUrl, "https://bo3.gg/tournaments/cct-europe-2026-series-10");
  assert.equal(event.banner, undefined);
  // Scheduled rows must not invent a score before the series starts.
  const upcoming = result.matches.find((match) => match.state === "upcoming")!;
  assert.equal(upcoming.teams[0].score, undefined);
});

test("platform integers select the player, and unusable channels are dropped not guessed", () => {
  const youtube = {
    ...twitchStream,
    id: 7,
    platform: 2,
    raw_url: "https://www.youtube.com/watch?v=qwhxaatodx0",
    name: "Watch",
    official: false,
    viewers_number: 10,
  };
  const blocked = { ...kickStream, id: 8, blocked: true, name: "Blocked" };
  const lying = { ...kickStream, id: 9, platform: 1, raw_url: "https://kick.com/not-twitch", name: "Lying" };
  const videoPage = { ...twitchStream, id: 10, raw_url: "https://www.twitch.tv/videos/12345", name: "Vod" };
  const insecure = { ...kickStream, id: 11, raw_url: "http://kick.com/insecure", name: "Insecure" };
  const result = parseBo3Matches(
    page([row({ streams: [kickStream, youtube, blocked, lying, videoPage, insecure, twitchStream] })]),
    cs2,
    now,
  );
  const streams = result.matches[0].streams;
  assert.deepEqual(
    streams.map((stream) => [stream.platform, stream.title]),
    [
      ["twitch", "MetanoiaGG"],
      ["kick", "CCT_CS2"],
      ["youtube", "Watch"],
    ],
  );
  // Official first, then viewer count. The provider's embed_url is never passed through.
  assert.equal(streams[0].official, true);
  assert.equal(streams[0].language, "pt");
  assert.equal(streams[0].url, "https://www.twitch.tv/metanoiagg");
  assert.equal(streams[1].viewers, 1112);
  assert.equal(streams[2].url, "https://www.youtube.com/watch?v=qwhxaatodx0");
  assert.ok(!JSON.stringify(streams).includes("player.twitch.tv"));
});

test("a filter the provider silently replaced is an outage, never a board of the wrong game", () => {
  // Reproduced live: filter[discipline_id] without the matches. prefix answers 200 with CS2 rows.
  assert.throws(() => parseBo3Matches(page([row()]), { game: "dota2" }, now), /title filter/);
  assert.throws(
    () =>
      parseBo3Matches(
        page([row({ discipline_id: 1 })], {
          self: "/api/v1/matches?filter%5Bmatches.discipline_id%5D%5Beq%5D=4",
        }),
        cs2,
        now,
      ),
    /title filter/,
  );
  assert.throws(
    () => parseBo3Matches(page([row({ status: "finished" })]), cs2, now),
    /outside the requested filter/,
  );
  // A dropped filter returns the whole database; the live facing states are only ever hundreds.
  assert.throws(() => parseBo3Matches(page([row()], { count: 81257 }), cs2, now), /schedule filter/);
  assert.throws(() => parseBo3Matches({ data: [] }, cs2, now), /unavailable/);
});

test("the finished archive is legitimately huge, so the ceiling must not reject it", () => {
  const finished = row({
    status: "finished",
    start_date: iso(-180),
    team1_score: 2,
    team2_score: 1,
    winner_team_id: 1059,
    streams: [twitchStream],
  });
  const result = parseBo3Matches(
    page([finished], {
      count: 75313,
      self:
        "/api/v1/matches?filter%5Bmatches.discipline_id%5D%5Beq%5D=1" +
        "&filter%5Bmatches.status%5D%5Beq%5D=finished",
    }),
    { game: "cs2", statuses: ["finished"] },
    now,
  );
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].state, "recent");
  assert.equal(result.matches[0].teams[0].winner, true);
  assert.equal(result.matches[0].teams[1].winner, false);
  assert.equal(result.matches[0].teams[0].score, 2);
});

test("odds, affiliate redirects and model predictions never reach the parsed output", () => {
  const result = parseBo3Matches(page([row()]), cs2, now);
  const serialized = JSON.stringify(result);
  for (const banned of ["refpa", "bet_updates", "ai_predictions", "coef", "rating", "stars"])
    assert.ok(!serialized.includes(banned), `${banned} leaked into the adapter output`);
});

test("titles beyond the feed contract come free, and only modelled titles cross into it", () => {
  const mlbbRow = row({
    discipline_id: 8,
    status: "upcoming",
    start_date: iso(90),
    streams: [],
    tournament: tournament({ id: 7001, slug: "mpl-ph-s16", name: "MPL PH Season 16", discipline_id: 8 }),
    stage: { id: 1, title: "MPL PH Season 16 Regular Season", tournament_id: 7001 },
    round: { id: 2, name: "Week 5" },
    team1: { id: 22144, slug: "myanmar-", name: "Myanmar", image_url: null },
    team2: { id: 24672, slug: "cag-by-varrel", name: "CAG by VARREL", image_url: null },
  });
  const mlbb = parseBo3Matches(page([mlbbRow], { discipline: 8 }), { game: "mlbb" }, now);
  assert.equal(mlbb.matches.length, 1);
  assert.equal(mlbb.matches[0].game, "mlbb");
  assert.equal(mlbb.matches[0].event.stage, "Regular Season · Week 5");
  assert.equal(mlbb.matches[0].teams[1].name, "CAG by VARREL");
  assert.equal(mlbb.matches[0].teams[0].logo, undefined);
  assert.equal(bo3FeedMatches(mlbb).length, 0);
  const r6Page = page([row({ discipline_id: 7 })], { discipline: 7 });
  const r6 = parseBo3Matches(r6Page, { game: "r6" }, now);
  assert.equal(r6.matches[0].game, "r6");
  assert.equal(bo3FeedMatches(r6).length, 0);
  assert.equal(bo3FeedMatches(parseBo3Matches(page([row()]), cs2, now)).length, 1);
});

test("rows the provider cannot identify are skipped without failing the whole page", () => {
  const unusable = [
    row({ id: 130217, slug: "UPPER-CASE-SLUG" }),
    row({ id: "not-a-number", slug: "bad-id-01-10-2026" }),
    row({ id: 130218, slug: "no-date-01-10-2026", start_date: "soon" }),
    row({ id: 130219, slug: "no-team-01-10-2026", team2: { id: 2, name: "" } }),
    row({ id: 130220, slug: "stale-upcoming-01-10-2026", status: "upcoming", start_date: iso(-60) }),
  ];
  const result = parseBo3Matches(page([row(), ...unusable]), cs2, now);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].id, "130215");
});
