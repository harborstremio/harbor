import assert from "node:assert/strict";
import test from "node:test";
import {
  dotaBroadcastMatchUrl,
  parseDotaBroadcasts,
} from "../src/lib/sports/esports-dota-broadcasts.ts";
import type { EsportsMatch } from "../src/lib/sports/esports-feeds";
const match = {
  id: "1",
  game: "dota2",
  state: "live",
  startMs: Date.parse("2026-09-14T19:52:00Z"),
  teams: [
    { id: "a", name: "Stray Club" },
    { id: "b", name: "Rostikfacekid Club" },
  ],
  event: { id: "1", name: "Dota" },
  streams: [],
  sourceUrl: "https://www.opendota.com/matches/1",
} as EsportsMatch;
const series = {
  id: 100359,
  slug: "rostikfacekid-club-vs-stray-club",
  championship: { slug: "winline-star-series-season-4" },
  team1: { name: "Rostikfacekid Club" },
  team2: { name: "Stray Club" },
  startAt: "2026-09-14T18:45:00Z",
  streams: [
    { name: "stray228", url: "https://player.twitch.tv/?channel=stray228" },
    { name: "rostikfacekid", url: "https://player.twitch.tv/?channel=rostikfacekid" },
  ],
};
const page = (props: unknown) =>
  `<div data-page="${JSON.stringify({ props }).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></div>`;
test("Dota matches either team order, reads only exact event streams and normalizes Twitch embeds", () => {
  assert.match(
    dotaBroadcastMatchUrl(page({ seriesList: [series] }), match) || "",
    /winline-star-series-season-4\/rostikfacekid-club-vs-stray-club$/,
  );
  assert.deepEqual(
    parseDotaBroadcasts(
      page({
        seriesPageData: series,
        headToHeadSeriesList: [{ streams: [{ url: "https://www.twitch.tv/dota2ti" }] }],
      }),
      match,
    ).map((s) => s.url),
    ["https://www.twitch.tv/stray228", "https://www.twitch.tv/rostikfacekid"],
  );
});
test("reject wrong opponent, wrong date, ambiguous rematch and unsafe or generic stream links", () => {
  assert.equal(
    dotaBroadcastMatchUrl(page({ seriesList: [{ ...series, team2: { name: "Stray" } }] }), match),
    null,
  );
  assert.deepEqual(
    parseDotaBroadcasts(
      page({ seriesPageData: { ...series, startAt: "2026-05-26T18:45:00Z" } }),
      match,
    ),
    [],
  );
  assert.equal(
    dotaBroadcastMatchUrl(page({ seriesList: [series, { ...series, slug: "rematch" }] }), match),
    null,
  );
  assert.deepEqual(
    parseDotaBroadcasts(
      page({
        seriesPageData: {
          ...series,
          streams: [
            { url: "javascript:alert(1)" },
            { url: "https://evil.test/?channel=stray228" },
            { url: "https://www.youtube.com/@dota2" },
            { url: "https://player.twitch.tv.evil.test/?channel=stray228" },
          ],
        },
      }),
      match,
    ),
    [],
  );
});
test("lookup is not hardcoded to this match or these channels", () => {
  const other = {
    ...match,
    teams: [
      { id: "c", name: "Team A" },
      { id: "d", name: "Team B" },
    ],
  } as EsportsMatch;
  const listed = {
    ...series,
    team1: { name: "Team A" },
    team2: { name: "Team B" },
    streams: [
      { name: "Tournament broadcast", url: "https://player.twitch.tv/?channel=eventchannel" },
    ],
  };
  assert.equal(
    parseDotaBroadcasts(page({ seriesPageData: listed }), other)[0]?.url,
    "https://www.twitch.tv/eventchannel",
  );
});
