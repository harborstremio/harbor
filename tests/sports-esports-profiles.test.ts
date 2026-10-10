import test from "node:test";
import assert from "node:assert/strict";
import {
  createEsportsProfileClient,
  esportsImage,
  parseEsportsMatches,
  parseEsportsPlayer,
  parseEsportsRoster,
  parseEsportsTeams,
  parseEsportsTeamLogos,
} from "../src/lib/sports/esports-profiles.ts";

test("team discovery excludes inactive history, deduplicates and preserves unknown ratings", () => {
  const now = Date.UTC(2026, 8, 14),
    recent = now / 1000 - 86400;
  const result = parseEsportsTeams(
    [
      { team_id: 1, name: "Active", last_match_time: recent, rating: 1700 },
      {
        team_id: 2,
        name: "Retired",
        last_match_time: recent - 100 * 86400,
        rating: 3000,
      },
      { team_id: 3, name: "No rating", last_match_time: recent, rating: null },
      {
        team_id: 1,
        name: "Active updated",
        last_match_time: recent,
        rating: 1800,
      },
      {
        team_id: 4,
        name: "Future corrupt",
        last_match_time: recent + 10 * 86400,
        rating: 3000,
      },
    ],
    now,
  );
  assert.deepEqual(
    result.map((team) => team.id),
    [1, 3],
  );
  assert.equal(result[0].name, "Active updated");
  assert.equal(result[1].rating, null);
  assert.equal(esportsImage("javascript:alert(1)"), "");
  assert.equal(esportsImage("https://a:b@example.com/a.png"), "");
});
test("schedule logos retain inactive teams and reject missing or unsafe artwork", async () => {
  const data = [
    { team_id: 1, name: "Older team", last_match_time: 1, logo_url: "https://cdn.example.com/old.png" },
    { team_id: 2, name: "No logo" },
    { team_id: 3, name: "Unsafe", logo_url: "javascript:alert(1)" },
    { team_id: 4, name: "Credentials", logo_url: "https://user:secret@example.com/logo.png" },
    { team_id: 0, name: "Unknown", logo_url: "https://cdn.example.com/unknown.png" },
  ];
  assert.deepEqual([...parseEsportsTeamLogos(data)], [["1", "https://cdn.example.com/old.png"]]);
  let calls = 0;
  const client = createEsportsProfileClient(async () => { calls++; return data; });
  const signal = new AbortController().signal;
  const [logos, active] = await Promise.all([client.fetchTeamLogos(signal), client.fetchTeams(signal)]);
  assert.equal(logos.get("1"), "https://cdn.example.com/old.png");
  assert.equal(active.length, 0);
  assert.equal(calls, 1, "logo enrichment and active profiles share one directory request");
  await client.fetchTeamLogos(signal);
  assert.equal(calls, 1, "reopening the schedule uses the shared cache");
});

test("rosters distinguish current membership and refuse anonymous identities", () => {
  const roster = parseEsportsRoster(
    [
      {
        account_id: 1,
        name: "Past",
        games_played: 100,
        wins: 70,
        is_current_team_member: false,
      },
      {
        account_id: 2,
        name: "Now",
        games_played: 20,
        is_current_team_member: true,
      },
      { account_id: 4294967295, name: "Anonymous" },
    ],
    [{ account_id: 2, avatarfull: "https://cdn.example.com/avatar.png" }],
  );
  assert.deepEqual(
    roster.map((player) => player.accountId),
    [2, 1],
  );
  assert.equal(roster[0].wins, null);
  assert.equal(roster[0].avatar, "https://cdn.example.com/avatar.png");
});
test("match outcomes require known sides; career totals retain sample counts", () => {
  const matches = parseEsportsMatches(
    [
      { match_id: 1, player_slot: 128, radiant_win: false },
      { match_id: 2, radiant_win: true },
      { match_id: 3, player_slot: 0, radiant_win: false },
    ],
    "player",
  );
  assert.deepEqual(
    matches.map((match) => match.won),
    [true, null, false],
  );
  const profile = parseEsportsPlayer(
    12,
    { profile: { personaname: "Player", avatarfull: "http://unsafe/avatar" } },
    { win: 100, lose: 40 },
    [
      { field: "kills", n: 22, sum: 100 },
      { field: "deaths", n: 0, sum: 0 },
      { field: "assists", n: 20, sum: null },
    ],
    [],
  );
  assert.equal(profile.avatar, "");
  assert.equal(profile.losses, 40);
  assert.deepEqual(profile.totals, [{ field: "kills", count: 22, sum: 100 }]);
});
test("profile requests share cache, cap concurrency at three and tolerate a partial endpoint", async () => {
  let active = 0,
    peak = 0,
    calls = 0;
  const client = createEsportsProfileClient(async (url) => {
    calls++;
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    if (url.endsWith("/totals")) throw Error("unavailable");
    if (url.endsWith("/wl")) return { win: 10, lose: 5 };
    if (url.endsWith("/recentMatches")) return [];
    return { profile: { personaname: "Same player" } };
  });
  const signal = new AbortController().signal;
  const [a, b] = await Promise.all([
    client.fetchPlayer(22, signal),
    client.fetchPlayer(22, signal),
  ]);
  assert.equal(calls, 4);
  assert.equal(peak, 3);
  assert.equal(a.wins, 10);
  assert.equal(b.partial, true);
  await client.fetchPlayer(22, signal);
  assert.equal(calls, 5, "only failed endpoint retries; successful responses are cached");
});
test("one profile subscriber cancelling does not cancel another and queued abandoned work stops", async () => {
  let aborted = 0,
    calls = 0;
  const client = createEsportsProfileClient(async (_url, signal) => {
    calls++;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 25);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          aborted++;
          reject(signal.reason);
        },
        { once: true },
      );
    });
    return {};
  });
  const first = new AbortController(),
    second = new AbortController();
  const a = client.fetchPlayer(1, first.signal),
    b = client.fetchPlayer(1, second.signal);
  const aRejected = assert.rejects(a);
  first.abort();
  await aRejected;
  await b;
  assert.equal(aborted, 0);
  assert.equal(calls, 4);
  const third = new AbortController();
  const c = client.fetchPlayer(2, third.signal);
  await new Promise((resolve) => setTimeout(resolve, 2));
  const rejected = assert.rejects(c);
  third.abort();
  await rejected;
  assert.equal(calls, 7, "the fourth queued endpoint is cancelled before it starts");
  assert.equal(aborted, 3);
});
