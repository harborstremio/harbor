import assert from "node:assert/strict";
import test from "node:test";
import { parseCsMatchDetail } from "../src/lib/sports/esports-cs-detail.ts";

const match = {
  id: 129320,
  slug: "luminosity-cs-go-vs-m80-cs-go-13-09-2026",
  discipline_id: 1,
  team1: {
    id: 776,
    name: "Luminosity",
    image_url: "https://files.bo3.gg/team.webp",
  },
  team2: { id: 7430, name: "M80" },
  games: [
    {
      id: 9,
      number: 2,
      map_name: "de_cache",
      status: "finished",
      winner_team_clan: { team_id: 7430 },
      loser_team_clan: { team_id: 776 },
      winner_clan_score: 13,
      loser_clan_score: 10,
    },
  ],
  streams: [
    {
      official: true,
      raw_url: "https://www.twitch.tv/officialcaster",
      name: "Official caster",
    },
    { official: false, raw_url: "https://www.twitch.tv/unverified" },
    { official: true, raw_url: "javascript:alert(1)" },
  ],
};
const athlete = {
  id: 33841,
  slug: "azuwu",
  nickname: "AZUWU",
  first_name: "Oscar",
  last_name: "Bell",
  image_url: "https://files.bo3.gg/player.webp",
  team_id: 999,
  country: { name: "United Kingdom" },
};

test("match broadcasts include unflagged channels, rank official first and exclude blocked channels", () => {
  const detail = parseCsMatchDetail(
    {
      ...match,
      streams: [
        {
          official: true,
          blocked: false,
          name: "fiesta_cs",
          raw_url: "https://kick.com/fiesta_cs",
        },
        { official: true, blocked: true, raw_url: "https://kick.com/blocked" },
        {
          official: false,
          raw_url: "https://kick.com/unlisted",
          name: "Listed caster",
          viewers: 50000,
        },
      ],
    },
    [],
  );
  assert.deepEqual(detail.streams, [
    { title: "fiesta_cs", url: "https://kick.com/fiesta_cs", platform: "kick" },
    { title: "Listed caster", url: "https://kick.com/unlisted", platform: "kick" },
  ]);
});
const stats = {
  kills: 29,
  death: 31,
  assists: 10,
  adr: 78.6304,
  kast: 0.73913,
  first_kills: 8,
  headshots: 16,
  damage: 3617,
  trade_kills: 3,
  team_clan: { team_id: 776 },
  steam_profile: { player: athlete },
};

test("CS match players preserve match team after transfers and expose real match statistics", () => {
  const detail = parseCsMatchDetail(match, [stats, stats]);
  assert.equal(detail.rosterBasis, "match");
  assert.equal(detail.teams[0].players.length, 1);
  const player = detail.teams[0].players[0];
  assert.equal(player.name, "AZUWU");
  assert.equal(player.fullName, "Oscar Bell");
  assert.equal(player.url, "https://bo3.gg/players/azuwu");
  assert.equal(player.stats.find((stat) => stat.label === "ADR")?.value, "78.6");
  assert.equal(player.stats.find((stat) => stat.label === "KAST")?.value, "73.9%");
  assert.deepEqual(detail.maps[0].teamScores, [10, 13]);
  assert.equal(player.stats.find((stat) => stat.label === "Headshots")?.value, "16");
  assert.equal(player.stats.find((stat) => stat.label === "Damage")?.value, "3617");
  assert.equal(player.stats.find((stat) => stat.label === "Trade kills")?.value, "3");
  assert.equal(detail.streams.length, 2);
  assert.equal(detail.streams[0].url, "https://www.twitch.tv/officialcaster");
  assert.ok(detail.streams.every((stream) => stream.url.startsWith("https://")));
});

test("missing match lineups may use labelled current squads, excluding coaches and inactive players", () => {
  const roster = {
    results: [
      { ...athlete, team_id: 776, status: 1 },
      { ...athlete, id: 2, team_id: 776, status: 1, is_coach: true },
      { ...athlete, id: 3, team_id: 776, status: 0 },
    ],
  };
  const detail = parseCsMatchDetail(match, [], roster);
  assert.equal(detail.rosterBasis, "current-team");
  assert.equal(detail.teams[0].players.length, 1);
  assert.equal(detail.teams[0].players[0].stats.length, 0);
});

test("missing lineup data stays unavailable and current squads never mix into known match lineups", () => {
  assert.equal(parseCsMatchDetail(match, []).rosterBasis, "unavailable");
  const detail = parseCsMatchDetail(match, [stats], {
    results: [{ ...athlete, id: 7, team_id: 7430, status: 1 }],
  });
  assert.equal(detail.teams[1].players.length, 0);
  assert.equal(detail.rosterBasis, "match");
});

test("unsafe destinations, invalid numeric stats and foreign games are not accepted", () => {
  const detail = parseCsMatchDetail(match, [
    {
      ...stats,
      kills: "NaN",
      kast: 2,
      steam_profile: {
        player: {
          ...athlete,
          slug: "../secret",
          image_url: "https://unrelated.example/image",
        },
      },
    },
  ]);
  const player = detail.teams[0].players[0];
  assert.equal(player.url, undefined);
  assert.equal(player.image, undefined);
  assert.equal(
    player.stats.some((stat) => stat.label === "Kills" || stat.label === "KAST"),
    false,
  );
  assert.throws(() => parseCsMatchDetail({ ...match, discipline_id: 2 }, []));
  assert.throws(() => parseCsMatchDetail(match, { error: "Unavailable" }));
});
