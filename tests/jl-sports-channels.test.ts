import assert from "node:assert/strict";
import test from "node:test";
import type { EpgIndex, EpgProgram, IptvChannel } from "../src/lib/iptv/types.ts";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import { buildSportsChannelIndex, channelsForGame, networkChannel } from "../src/lib/jl/sports/channels.ts";

function ch(id: string, name: string, group = "", tvgId: string | null = null): IptvChannel {
  return { id, tvgId, name, logo: null, group, url: `http://example.test/${id}`, catchupSource: null, durationSec: null, attrs: {} };
}

function side(name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr: "", logo: "", score: "", winner: false, ...extra };
}

function program(tvgId: string, title: string, startIso: string, hours: number, description = ""): EpgProgram {
  const startMs = Date.parse(startIso);
  return { channelTvgId: tvgId, title, description, startMs, endMs: startMs + hours * 3600000, category: null, iconUrl: null };
}

function epgOf(programs: EpgProgram[]): EpgIndex {
  const byChannel = new Map<string, EpgProgram[]>();
  for (const p of programs) byChannel.set(p.channelTvgId, [...(byChannel.get(p.channelTvgId) ?? []), p]);
  return { byChannel, fetchedAt: 0 };
}

const NOW = new Date("2026-09-26T16:30:00Z");

const CHANNELS = [
  ch("e1", "NCAAF 03: #1 Texas vs. #14 Tennessee @ 26 Sep 12:00 PM ET", "USA NCAAF"),
  ch("e2", "USA ESPN+ 019: NCAA Football: #1 Texas vs. #14 Tennessee (ESP) (2026-09-26 12:00:05)", "ESPN Events"),
  ch("e3", "NCAAF 06: Bucknell vs. Pittsburgh @ 26 Sep 12:00 PM ET", "USA NCAAF"),
  ch("abc", "US: ABC HD", "USA Entertainment", "abc.us"),
  ch("espn", "US: ESPN HD", "USA Sports", "espn.us"),
  ch("espn-news", "US: ESPN NEWS", "USA Sports", "espnews.us"),
  ch("espn2", "US: ESPN 2", "USA Sports", "espn2.us"),
  ch("nfln", "USA NFL NETWORK *", "USA Sports", "nfln.us"),
  ch("snp", "US: SportsNet Philadelphia", "USA Regional", "snp.us"),
  ch("snp-backup", "US: SportsNet Philadelphia Backup", "USA Regional", "snp.us"),
];

test("event channels match by kickoff and a shared team; Spanish feed goes after the network", () => {
  const index = buildSportsChannelIndex(CHANNELS, null, NOW);
  const game: SportsGame = {
    id: "1",
    league: "NCAAF",
    state: "in",
    detail: "",
    away: side("Texas Longhorns", { location: "Texas" }),
    home: side("Tennessee Volunteers", { location: "Tennessee" }),
    startMs: Date.parse("2026-09-26T16:00:00Z"),
    network: "ABC",
  };
  const found = channelsForGame(game, index, NOW);
  assert.deepEqual(
    found.map((c) => [c.channel.id, c.via, c.alternate]),
    [
      ["e1", "event", false],
      ["abc", "network", false],
      ["e2", "event", true],
    ],
  );
});

test("a different kickoff is a different game", () => {
  const index = buildSportsChannelIndex(CHANNELS, null, NOW);
  const game: SportsGame = {
    id: "2",
    league: "NCAAF",
    state: "pre",
    detail: "",
    away: side("Texas Longhorns", { location: "Texas" }),
    home: side("Oklahoma Sooners", { location: "Oklahoma" }),
    startMs: Date.parse("2026-10-10T19:30:00Z"),
  };
  assert.deepEqual(channelsForGame(game, index, NOW), []);
});

test("network matching: plain channel beats spin-offs; aliases; streaming-only has no channel", () => {
  const index = buildSportsChannelIndex(CHANNELS, null, NOW);
  assert.equal(networkChannel("ESPN", index)?.id, "espn");
  assert.equal(networkChannel("ESPN2", index)?.id, "espn2");
  assert.equal(networkChannel("NFL Net", index)?.id, "nfln");
  assert.equal(networkChannel("ESPN+", index), null);
  assert.equal(networkChannel("Peacock", index), null);
  assert.equal(networkChannel("Hallmark", index), null);
});

test("guide listings: both team names in a title; backups ranked last", () => {
  const epg = epgOf([program("snp.us", "MLB Baseball: Phillies at Mets", "2026-09-26T16:00:00Z", 3)]);
  const index = buildSportsChannelIndex(CHANNELS, epg, NOW);
  const game: SportsGame = {
    id: "3",
    league: "MLB",
    state: "in",
    detail: "",
    away: side("Philadelphia Phillies", { location: "Philadelphia", nickname: "Phillies" }),
    home: side("New York Mets", { location: "New York", nickname: "Mets" }),
    startMs: Date.parse("2026-09-26T16:10:00Z"),
  };
  assert.deepEqual(
    channelsForGame(game, index, NOW).map((c) => [c.channel.id, c.via]),
    [
      ["snp", "guide"],
      ["snp-backup", "guide"],
    ],
  );
});

test("guide listings: the league's generic listing in the home city", () => {
  const epg = epgOf([
    program("snp.us", "MLB Baseball", "2026-09-26T16:00:00Z", 3, "From Citizens Bank Park in Philadelphia."),
  ]);
  const index = buildSportsChannelIndex(CHANNELS, epg, NOW);
  const game: SportsGame = {
    id: "4",
    league: "MLB",
    state: "in",
    detail: "",
    away: side("Atlanta Braves", { location: "Atlanta", nickname: "Braves" }),
    home: side("Philadelphia Phillies", { location: "Philadelphia", nickname: "Phillies" }),
    startMs: Date.parse("2026-09-26T16:05:00Z"),
  };
  assert.equal(channelsForGame(game, index, NOW)[0]?.channel.id, "snp");
});
