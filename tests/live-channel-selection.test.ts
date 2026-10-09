// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { buildSportsChannelIndex, matchChannelsForGame } from "../src/lib/sports/iptv-match.ts";
import type { IptvChannel } from "../src/lib/iptv/types.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

const game: SportsGame = {
  id: "test-match",
  league: "NFL",
  state: "in",
  detail: "First quarter",
  home: { id: "home", name: "Home team", abbr: "HOME", logo: "", score: "0", winner: false },
  away: { id: "away", name: "Away team", abbr: "AWAY", logo: "", score: "0", winner: false },
  startMs: 0,
};

test("a match does not supply streams when no playlist channels are connected", () => {
  const index = buildSportsChannelIndex([]);
  assert.deepEqual(matchChannelsForGame(game, index, {
    attachedIds: ["saved-channel-that-no-longer-exists"],
    broadcastNames: ["ESPN"],
  }), []);
});

test("an attached match channel retains the user's playlist URL", () => {
  const channel: IptvChannel = {
    id: "my-channel",
    name: "My Sports Channel",
    group: "Sports",
    url: "https://playlist.example.invalid/user-channel.m3u8",
    tvgId: null,
    logo: null,
    catchupSource: null,
    durationSec: null,
    attrs: {},
  };
  const matches = matchChannelsForGame(game, buildSportsChannelIndex([channel]), {
    attachedIds: [channel.id],
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].channel, channel);
  assert.equal(matches[0].channel.url, channel.url);
  assert.equal(matches[0].attached, true);
});
