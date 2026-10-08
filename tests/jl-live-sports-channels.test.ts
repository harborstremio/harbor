import assert from "node:assert/strict";
import test from "node:test";
import type { IptvChannel } from "../src/lib/iptv/types.ts";
import {
  applyLiveState,
  channelKey,
  chipCounts,
  cleanChannelName,
  collectSportsChannels,
  filterSportsEntries,
  isLiveGameTitle,
  isSportsChannel,
  sportOfText,
  sportsChannelRows,
} from "../src/lib/jl/sports/sports-channels.ts";

function ch(id: string, name: string, group = "", tvgId: string | null = null): IptvChannel {
  return {
    id,
    tvgId,
    name,
    logo: null,
    group,
    url: `http://example.test/${id}`,
    catchupSource: null,
    durationSec: null,
    attrs: {},
  };
}

const NOW = new Date("2026-09-26T16:30:00Z");

test("messy provider names clean up and share a key", () => {
  assert.deepEqual(cleanChannelName("US| ESPN FHD"), {
    clean: "ESPN",
    country: "US",
    backup: false,
  });
  assert.equal(cleanChannelName("UK: Sky Sports Main Event [HD]").clean, "Sky Sports Main Event");
  assert.equal(cleanChannelName("UK: Sky Sports Main Event [HD]").country, "UK");
  assert.equal(cleanChannelName("🏈 USA NFL NETWORK *").clean, "NFL NETWORK");
  assert.equal(cleanChannelName("🏈 USA NFL NETWORK *").backup, true);
  assert.equal(cleanChannelName("ESPN 2 ᴴᴰ").clean, "ESPN 2");
  assert.equal(cleanChannelName("USA Network HD").clean, "USA Network");
  assert.equal(cleanChannelName("|US| FS1 (Backup)").backup, true);
  assert.equal(channelKey("US: ESPN HD"), channelKey("USA| ESPN FHD *"));
  assert.notEqual(channelKey("US: beIN Sports"), channelKey("FR: beIN Sports"));
});

test("sports detection by group and by name", () => {
  assert.ok(isSportsChannel("US: ESPN HD", "USA Entertainment"));
  assert.ok(isSportsChannel("Some Feed 1", "USA Sports"));
  assert.ok(isSportsChannel("US: Big Ten Network", ""));
  assert.ok(isSportsChannel("DAZN 1 HD", "DE| DAZN"));
  assert.ok(isSportsChannel("PPV 05", "USA PPV"));
  assert.ok(!isSportsChannel("US: CNN HD", "USA News"));
  assert.ok(!isSportsChannel("US: TNT HD", "USA Entertainment"));
  assert.ok(!isSportsChannel("##### SPORTS #####", "USA Sports"));
  assert.ok(!isSportsChannel("Box Office 1", "PPV Movies"));
});

test("sport categories from names and groups", () => {
  assert.equal(sportOfText("NFL NETWORK"), "football");
  assert.equal(sportOfText("NBA TV"), "basketball");
  assert.equal(sportOfText("MLB Network"), "baseball");
  assert.equal(sportOfText("NHL Network"), "hockey");
  assert.equal(sportOfText("beIN Sports"), "soccer");
  assert.equal(sportOfText("UFC Fight Pass"), "combat");
  assert.equal(sportOfText("SEC Network"), "college");
  assert.equal(sportOfText("ESPNU"), "college");
  assert.equal(sportOfText("Sky Sports F1"), "racing");
  assert.equal(sportOfText("Golf Channel"), "golf-tennis");
  assert.equal(sportOfText("Sky Sports Football", "UK"), "soccer");
  assert.equal(sportOfText("USA Football"), "football");
  assert.equal(sportOfText("ESPN"), null);
});

const CHANNELS = [
  ch("a::e1", "NCAAF 03: #1 Texas vs. #14 Tennessee @ 26 Sep 12:00 PM ET", "USA NCAAF"),
  ch("b::e1", "CFB 12: #1 Texas vs. #14 Tennessee @ 26 Sep 12:00 PM ET", "US| College Football"),
  ch("a::e2", "NCAAF 05:", "USA NCAAF"),
  ch("a::ppv", "PPV 01", "USA PPV", "ppv1"),
  ch("a::espn", "US: ESPN HD", "USA Sports", "espn.us"),
  ch("b::espn", "USA| ESPN FHD", "Sports", "espn.us"),
  ch("a::nfln", "USA NFL NETWORK *", "USA Sports", "nfln.us"),
  ch("a::nba", "US: NBA TV", "USA Sports", "nbatv.us"),
  ch("a::sky", "UK: Sky Sports Premier League", "UK Sports"),
  ch("a::cnn", "US: CNN", "USA News"),
];

test("collect: one entry per channel, providers and quality grouped, preferred source first", () => {
  const entries = collectSportsChannels(CHANNELS, { now: NOW, preferredSourceId: "b" });
  const espn = entries.find((e) => e.title === "ESPN");
  assert.deepEqual(
    espn?.channels.map((c) => c.id),
    ["b::espn", "a::espn"],
  );
  const game = entries.find((e) => e.event && e.title.includes("Texas"));
  assert.equal(game?.sport, "college");
  assert.equal(game?.title, "#1 Texas vs. #14 Tennessee");
  assert.deepEqual(
    game?.channels.map((c) => c.id),
    ["b::e1", "a::e1"],
  );
  assert.equal(entries.find((e) => e.channels[0].id === "a::e2")?.idle, true);
  assert.equal(entries.find((e) => e.channels[0].id === "a::nfln")?.sport, "football");
  assert.equal(entries.find((e) => e.channels[0].id === "a::sky")?.sport, "soccer");
  assert.ok(!entries.some((e) => e.channels.some((c) => c.id === "a::cnn")));
});

test("live now: kick-off in the name, or the guide on an event feed; favourites first", () => {
  const entries = collectSportsChannels(CHANNELS, { now: NOW });
  const titles: Record<string, string> = {
    ppv1: "UFC 310: Main Card",
    "espn.us": "SportsCenter",
    "nbatv.us": "Lakers vs. Celtics",
  };
  const live = applyLiveState(entries, {
    now: NOW.getTime(),
    currentTitle: (c) => (c.tvgId ? (titles[c.tvgId] ?? null) : null),
    favoriteIds: new Set(["a::nfln"]),
  });
  assert.equal(live[0].channels[0].id, "a::nfln");
  const ids = live
    .filter((e) => e.liveNow)
    .map((e) => e.channels[0].id)
    .sort();
  assert.deepEqual(ids, ["a::e1", "a::nba", "a::ppv"]);
  // The PPV feed had no sport in its name; the guide says it is a fight.
  assert.equal(live.find((e) => e.channels[0].id === "a::ppv")?.sport, "combat");

  const { live: liveRow, rows } = sportsChannelRows(live);
  assert.deepEqual(
    liveRow.map((e) => e.event),
    [true, true, false],
  );
  assert.deepEqual(
    rows.map((r) => r.sport),
    ["football", "basketball", "soccer", "combat", "college", "other"],
  );

  const counts = chipCounts(live);
  assert.equal(counts.get("live"), 3);
  assert.equal(filterSportsEntries(live, { chip: "live", query: "" }).length, 3);
  assert.deepEqual(
    filterSportsEntries(live, { chip: "all", query: "tennessee" }).map((e) => e.sport),
    ["college"],
  );
  assert.equal(filterSportsEntries(live, { chip: "basketball", query: "" }).length, 1);
});

test("a game is live from kick-off until its expected end", () => {
  const entries = collectSportsChannels(
    [ch("a::x", "NFL 04: Bills at Chiefs @ 27 Sep 04:25 PM ET", "USA NFL")],
    { now: NOW },
  );
  const at = (iso: string) =>
    applyLiveState(entries, { now: Date.parse(iso), currentTitle: () => null })[0].liveNow;
  assert.equal(at("2026-09-26T16:30:00Z"), false);
  assert.equal(at("2026-09-27T20:30:00Z"), true);
  assert.equal(at("2026-09-28T02:00:00Z"), false);
});

test("guide titles: games vs studio shows and placeholders", () => {
  assert.ok(isLiveGameTitle("College Football: Texas at Tennessee"));
  assert.ok(isLiveGameTitle("NFL Football"));
  assert.ok(isLiveGameTitle("Arsenal v Chelsea"));
  assert.ok(!isLiveGameTitle("NFL Live"));
  assert.ok(!isLiveGameTitle("Postgame: Texas vs. Tennessee"));
  assert.ok(!isLiveGameTitle("No Event Streaming"));
  assert.ok(!isLiveGameTitle("SportsCenter"));
});
