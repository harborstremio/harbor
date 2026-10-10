import assert from "node:assert/strict";
import test from "node:test";
import { parseM3u } from "../src/lib/iptv/m3u.ts";
import { parseM3uAsync } from "../src/lib/iptv/parse-m3u-async.ts";
import { prepareSportsChannels } from "../src/lib/sports/channel-index.ts";
import { matchChannelsForGame, matchChannelsForGameAsync } from "../src/lib/sports/iptv-match.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

const playlist =
  '#EXTM3U\n#EXTGRP:Sports\n#EXTINF:-1 tvg-id="espn" tvg-name="ESPN HD",ESPN\n#EXTVLCOPT:http-user-agent=HarborTest\nhttps://example.com/live.m3u8|Referer=https%3A%2F%2Fexample.com\n#EXTINF:-1,UFC Van vs Pantoja\nhttps://example.com/fight.m3u8';
test("cooperative M3U parsing preserves IDs, groups and playback headers", async () => {
  assert.deepEqual(await parseM3uAsync(playlist, "qa"), parseM3u(playlist, "qa"));
});
test("50,000-channel library publishes partial results and yields while indexing and matching", async () => {
  const text =
    "#EXTM3U\n" +
    Array.from(
      { length: 50_000 },
      (_, i) =>
        `#EXTINF:-1 group-title="Sports",${i === 49_999 ? "Van vs Pantoja" : "ESPN " + i}\nhttps://example.com/${i}.m3u8`,
    ).join("\n");
  let ticks = 0;
  const timer = setInterval(() => ticks++, 0);
  const publications: number[] = [];
  try {
    const channels = await parseM3uAsync(text, "large", (partial) =>
      publications.push(partial.length),
    );
    assert.equal(channels.length, 50_000);
    assert.ok(publications.some((count) => count > 0 && count < 50_000));
    const controller = new AbortController();
    const index = await prepareSportsChannels(channels, controller.signal, () => {});
    const game: SportsGame = {
      id: "1",
      league: "UFC",
      startMs: Date.now(),
      state: "pre",
      detail: "",
      home: {
        id: "1",
        name: "Joshua Van",
        abbr: "VAN",
        logo: "",
        score: "",
        winner: false,
      },
      away: {
        id: "2",
        name: "Alexandre Pantoja",
        abbr: "PAN",
        logo: "",
        score: "",
        winner: false,
      },
    };
    const matches = await matchChannelsForGameAsync(game, index, {}, controller.signal);
    assert.equal(matches[0].channel.name, "Van vs Pantoja");
    assert.deepEqual(matches, matchChannelsForGame(game, index));
    assert.ok(ticks > 10, "UI work can run between batches");
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(matchChannelsForGameAsync(game, index, {}, abort.signal), {
      name: "AbortError",
    });
  } finally {
    clearInterval(timer);
  }
});
