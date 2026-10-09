import assert from "node:assert/strict";
import test from "node:test";
import { eventChannelEvidence } from "../src/lib/sports/event-match.ts";
import { buildSportsChannelIndex, matchChannelsForGame } from "../src/lib/sports/iptv-match.ts";
import { dueReminderChannels, type SportsReminder } from "../src/lib/sports/reminder-state.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";
import type { IptvChannel } from "../src/lib/iptv/types.ts";
const fight: SportsGame = {
  id: "123",
  league: "UFC",
  state: "pre",
  detail: "",
  startMs: Date.parse("2026-09-20T01:00:00Z"),
  home: { id: "1", name: "Joshua Van", abbr: "VAN", logo: "", score: "", winner: false },
  away: { id: "2", name: "Alexandre Pantoja", abbr: "PAN", logo: "", score: "", winner: false },
  context: {
    id: "331",
    name: "UFC 331: Van vs. Pantoja 2",
    round: "",
    draw: "",
    venue: "",
    major: true,
  },
};
const channel = (id: string, name: string): IptvChannel => ({
  id,
  name,
  url: `https://example.com/${id}.m3u8`,
  logo: null,
  group: "Sports",
  tvgId: null,
  attrs: {},
  catchupSource: null,
  durationSec: null,
});
test("both fighters including short Van rank above generic UFC and stale named channels", () => {
  const index = buildSportsChannelIndex([
    channel("generic", "US: UFC HD"),
    channel("old", "UFC 02: NOCHE UFC SILVA VS DELGADO start:2026-09-12 22:55:00"),
    channel("exact", "PPV: VAN vs PANTOJA 2 HD start:2026-09-19 20:00:00"),
    channel("number", "UFC 331 Main Card"),
  ]);
  const matches = matchChannelsForGame(fight, index);
  assert.equal(matches[0].channel.id, "exact");
  assert.equal(matches[0].tier, "exact");
  assert.equal(matches.find((m) => m.channel.id === "generic")?.tier, "likely");
  assert.ok(!matches.some((m) => m.channel.id === "old"));
  assert.equal(matches.find((m) => m.channel.id === "number")?.tier, "exact");
});
test("wrong numbered events and replays are excluded; explicit attached choice is preserved", () => {
  const index = buildSportsChannelIndex([
    channel("old", "UFC 330 Van vs Pantoja"),
    channel("replay", "UFC 331 REPLAY"),
    channel("generic", "UFC HD"),
  ]);
  assert.deepEqual(
    matchChannelsForGame(fight, index).map((m) => m.channel.id),
    ["generic"],
  );
  assert.equal(matchChannelsForGame(fight, index, { attachedIds: ["old"] })[0].channel.id, "old");
});
test("a timed guide matchup promotes a generic network, but another day's program does not", () => {
  const base = buildSportsChannelIndex([channel("guide", "ESPN HD"), channel("generic", "UFC HD")]);
  const program = {
    channelTvgId: "guide",
    title: "UFC 331: Van vs Pantoja",
    description: null,
    category: null,
    iconUrl: null,
    startMs: fight.startMs - 3600_000,
    endMs: fight.startMs + 3600_000,
  };
  const index = { ...base, programs: new Map([["guide", [program]]]) };
  assert.equal(matchChannelsForGame(fight, index)[0].channel.id, "guide");
  assert.equal(matchChannelsForGame(fight, index)[0].tier, "exact");
  const stale = {
    ...base,
    programs: new Map([
      [
        "guide",
        [
          {
            ...program,
            startMs: program.startMs - 7 * 86400_000,
            endMs: program.endMs - 7 * 86400_000,
          },
        ],
      ],
    ]),
  };
  assert.notEqual(matchChannelsForGame(fight, stale)[0].tier, "exact");
});
test("name matching normalizes accents and does not treat shared United as both teams", () => {
  const game = {
    ...fight,
    context: undefined,
    league: "EPL",
    home: { ...fight.home, name: "Manchester United" },
    away: { ...fight.away, name: "Newcastle United" },
  };
  assert.equal(eventChannelEvidence(game, "United Sports").both, false);
  assert.equal(eventChannelEvidence(game, "Manchester United vs Newcastle United").both, true);
  assert.equal(
    eventChannelEvidence(
      { ...fight, away: { ...fight.away, name: "Alexandre Pântoja" } },
      "VAN VS PANTOJA",
    ).both,
    true,
  );
});
const now = Date.parse("2026-09-19T18:00:00Z");
const reminder: SportsReminder = {
  id: "event",
  name: "Test",
  league: "UFC",
  startMs: now + 15 * 60_000,
  leadMinutes: 15,
  channels: ["discord", "telegram"],
  sent: {},
  attempted: {},
  failed: [],
};
test("reminders are due at the selected lead time, never before or after the expiry window", () => {
  assert.deepEqual(dueReminderChannels(reminder, now - 1), []);
  assert.deepEqual(dueReminderChannels(reminder, now), ["discord", "telegram"]);
  assert.deepEqual(dueReminderChannels(reminder, reminder.startMs + 10 * 60_000 + 1), []);
});
test("successful notification destination is not retried when its peer failed", () => {
  assert.deepEqual(
    dueReminderChannels(
      { ...reminder, sent: { discord: now }, attempted: { telegram: now }, failed: ["telegram"] },
      now + 59_000,
    ),
    [],
  );
  assert.deepEqual(
    dueReminderChannels(
      { ...reminder, sent: { discord: now }, attempted: { telegram: now }, failed: ["telegram"] },
      now + 60_000,
    ),
    ["telegram"],
  );
});
