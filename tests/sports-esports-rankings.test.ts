import test from "node:test";
import assert from "node:assert/strict";
import {
  createEsportsRankingsClient,
  createEsportsRankedTeamStatsClient,
  parseEsportsRankedTeamStats,
  parseEsportsRankings,
} from "../src/lib/sports/esports-rankings.ts";

const date = "2026-09-14",
  now = Date.UTC(2026, 8, 14, 10);
const team = (id: number, rank: number) => ({
  rank,
  score: "2029.4534",
  rank_diff: 0,
  team_id: id,
  ranking_date: date,
  team: {
    id,
    name: `Team ${id}`,
    slug: `team-${id}`,
    image_url: `https://files.bo3.gg/team-${id}.png`,
  },
  roster_players: [
    {
      id: id * 10,
      nickname: `Player ${id}`,
      slug: `player-${id}`,
      image_url: `https://files.bo3.gg/player-${id}.png`,
    },
  ],
});

test("tracked team history preserves incomplete win/loss breakdown and never invents a timeframe", () => {
  const stats = parseEsportsRankedTeamStats(
    {
      team_id: 654,
      matches_count: 424,
      matches_won_count: 282,
      matches_lost_count: 137,
      games_count: 938,
      kills_sum: 76162,
      deaths_sum: 69939,
      assists_sum: 20737,
    },
    "654",
  );
  assert.equal(stats.matches, 424);
  assert.equal(stats.matchWins, 282);
  assert.equal(stats.matchLosses, 137);
  assert.equal(stats.maps, 938);
  assert.equal(stats.rounds, undefined);
  assert.equal(stats.kills, 76162);
  assert.throws(() => parseEsportsRankedTeamStats({ team_id: 655 }, "654"));
});

test("team history only fetches when opened, caches successes and honors cancellation and retry", async () => {
  let calls = 0;
  const urls: string[] = [];
  const client = createEsportsRankedTeamStatsClient(async (url) => {
    calls++;
    urls.push(url);
    if (calls === 1) throw Error("503");
    return { team_id: 1, matches_count: 424, matches_won_count: 282, matches_lost_count: 137 };
  });
  assert.equal(calls, 0);
  const ranked = parseEsportsRankings(payload(), now).teams[0];
  await assert.rejects(client(ranked, new AbortController().signal), /503/);
  const stats = await client(ranked, new AbortController().signal);
  assert.equal(stats.matches, 424);
  await client(ranked, new AbortController().signal);
  assert.equal(calls, 2);
  assert.equal(urls[0], "https://api.bo3.gg/api/v1/teams/team-1/general_stats");
  const c = new AbortController();
  const pending = createEsportsRankedTeamStatsClient(async () => new Promise(() => {}))(
    ranked,
    c.signal,
  );
  c.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
const payload = () => ({
  meta: {
    discipline_id: 1,
    region: "worldwide",
    ranking_date: date,
    is_official: false,
    source: "internal",
    updated_at: "2026-09-14T02:10:40Z",
  },
  data: [team(2, 2), team(1, 1)],
});
test("current CS2 ranks retain source order, logos, source date and actual roster without claiming official", () => {
  const result = parseEsportsRankings(payload(), now);
  assert.deepEqual(
    result.teams.map((t) => [t.id, t.rank]),
    [
      ["1", 1],
      ["2", 2],
    ],
  );
  assert.equal(result.asOf, date);
  assert.equal(result.isOfficial, false);
  assert.equal(result.sourceName, "Bo3.gg");
  assert.equal(result.stale, false);
  assert.equal(result.teams[0].players[0].name, "Player 1");
  assert.equal(result.teams[0].url, "https://bo3.gg/teams/team-1");
  assert.equal(result.teams[0].points, 2029.4534);
  assert.equal(result.teams[0].rankChange, 0);
});

test("ranking points and movement retain provider values without substituting invalid or missing fields", () => {
  const raw = payload();
  const result = parseEsportsRankings(
    {
      ...raw,
      data: [
        { ...team(1, 1), score: 0, rank_diff: -2 },
        { ...team(2, 2), score: false, rank_diff: 1.5 },
        { ...team(3, 3), score: "", rank_diff: undefined },
      ],
    },
    now,
  );
  assert.equal(result.teams[0].points, 0);
  assert.equal(result.teams[0].rankChange, -2);
  assert.equal(result.teams[1].points, undefined);
  assert.equal(result.teams[1].rankChange, undefined);
  assert.equal(result.teams[2].points, undefined);
  assert.equal(result.teams[2].rankChange, undefined);
});
test("mixed snapshot rows, invalid ranks and unsafe links are rejected; team dedup preserves real rank", () => {
  const raw = payload();
  raw.data.push(
    team(1, 9),
    { ...team(3, 3), ranking_date: "2024-01-01" },
    team(4, 0),
    team(5, 101),
  );
  raw.data[0].team.image_url = "https://attacker.example/image";
  raw.data[0].team.slug = "../fake";
  const result = parseEsportsRankings(raw, now);
  assert.deepEqual(
    result.teams.map((t) => t.id),
    ["1", "2"],
  );
  assert.equal(result.teams[1].logo, "");
  assert.equal(result.teams[1].url, undefined);
  assert.throws(() =>
    parseEsportsRankings({ ...raw, meta: { ...raw.meta, discipline_id: 3 } }, now),
  );
  assert.throws(() =>
    parseEsportsRankings({ ...raw, meta: { ...raw.meta, region: "europe" } }, now),
  );
});
test("old rankings are explicitly stale and future or invalid dates are refused", () => {
  assert.equal(parseEsportsRankings(payload(), now + 20 * 86400000).stale, true);
  assert.throws(() => parseEsportsRankings(payload(), now - 5 * 86400000));
  assert.throws(() =>
    parseEsportsRankings(
      { ...payload(), meta: { ...payload().meta, ranking_date: "2026-02-31" } },
      now,
    ),
  );
});
test("one request is shared; cancelling a consumer preserves its peer and failure preserves dated cache", async () => {
  let calls = 0,
    fail = false;
  const client = createEsportsRankingsClient(async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fail) throw Error("offline");
    return JSON.stringify(payload());
  });
  const one = new AbortController(),
    two = new AbortController();
  const first = client(one.signal),
    second = client(two.signal);
  const rejected = assert.rejects(first);
  one.abort();
  await rejected;
  const result = await second;
  assert.equal(calls, 1);
  assert.equal(result.teams.length, 2);
  await client(two.signal);
  assert.equal(calls, 1);
  fail = true;
  const stale = await client(two.signal, true);
  assert.equal(calls, 2);
  assert.equal(stale.stale, true);
  assert.equal(stale.asOf, date);
});
