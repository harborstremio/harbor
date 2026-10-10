import test from "node:test";
import assert from "node:assert/strict";
import {
  esportsEventDateRange,
  esportsEventSummaries,
  esportsPrizeLabel,
} from "../src/views/sports/esports-event-model.ts";
import {
  esportsRowFallbacks,
  rankEsportsEvents,
  type SeriesCandidate,
} from "../src/lib/sports/esports-series.ts";
import type { Bo3Tournament } from "../src/lib/sports/esports-bo3-api.ts";
import type { EsportsFeed, EsportsGameId, EsportsMatch } from "../src/lib/sports/esports-feeds.ts";

const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 30, 12);

const match = (over: {
  id: string;
  game: EsportsGameId;
  event: { id: string; name: string; logo?: string; stage?: string };
  state?: EsportsMatch["state"];
  startMs?: number;
  teams?: [string, string];
}): EsportsMatch => ({
  id: over.id,
  game: over.game,
  state: over.state ?? "upcoming",
  startMs: over.startMs ?? now + DAY,
  event: over.event,
  teams: [
    { id: `${over.teams?.[0] ?? "a"}-id`, name: over.teams?.[0] ?? "Team A" },
    { id: `${over.teams?.[1] ?? "b"}-id`, name: over.teams?.[1] ?? "Team B" },
  ],
  streams: [],
  sourceUrl: `https://example.invalid/${over.id}`,
});

const feed = (game: EsportsGameId, matches: EsportsMatch[]): EsportsFeed => ({
  game,
  matches,
  status: "ready",
  fetchedAt: now,
  source: { name: game, url: "https://example.invalid" },
});

const tournament = (over: Partial<Bo3Tournament> & { id: string; name: string }): Bo3Tournament =>
  over;

test("one tournament per title name, not per provider event id", () => {
  const summaries = esportsEventSummaries([
    feed("lol", [
      match({ id: "1", game: "lol", event: { id: "110", name: "LCK" } }),
      match({ id: "2", game: "lol", event: { id: "111", name: "LCK" } }),
      match({ id: "3", game: "lol", event: { id: "112", name: "LEC" } }),
    ]),
  ]);
  const lck = summaries.find((entry) => entry.name === "LCK");
  assert.equal(summaries.length, 2);
  assert.deepEqual(lck?.eventIds, ["110", "111"]);
  assert.equal(lck?.matchCount, 2);
});

test("a folded tournament keeps every match of every one of its splits findable", () => {
  const matches = [
    match({ id: "1", game: "lol", event: { id: "110", name: "LCK" } }),
    match({ id: "2", game: "lol", event: { id: "111", name: "LCK" } }),
  ];
  const summary = esportsEventSummaries([feed("lol", matches)])[0];
  const own = matches.filter(
    (entry) => entry.game === summary.game && summary.eventIds.includes(entry.event.id),
  );
  assert.equal(own.length, 2);
});

test("status comes from the provider states, never from the clock", () => {
  const [live] = esportsEventSummaries([
    feed("cs2", [
      match({ id: "1", game: "cs2", event: { id: "9", name: "IEM Katowice 2026" } }),
      match({
        id: "2",
        game: "cs2",
        state: "live",
        startMs: now - 3600_000,
        event: { id: "9", name: "IEM Katowice 2026" },
      }),
    ]),
  ]);
  assert.equal(live.status, "live");
  assert.equal(live.liveCount, 1);
  const [done] = esportsEventSummaries([
    feed("cs2", [
      match({
        id: "3",
        game: "cs2",
        state: "recent",
        startMs: now - DAY,
        event: { id: "8", name: "BLAST Open 2026 Fall" },
      }),
    ]),
  ]);
  assert.equal(done.status, "completed");
  const [ahead] = esportsEventSummaries([
    feed("cs2", [
      match({ id: "4", game: "cs2", event: { id: "7", name: "ESL Pro League Season 22" } }),
    ]),
  ]);
  assert.equal(ahead.status, "upcoming");
});

test("the window spans every match, and the bo3 tournament overrides it when it answers", () => {
  const matches = [
    match({ id: "1", game: "cs2", startMs: now + DAY, event: { id: "21", name: "IEM Cologne" } }),
    match({
      id: "2",
      game: "cs2",
      startMs: now + 4 * DAY,
      event: { id: "21", name: "IEM Cologne" },
    }),
  ];
  const [derived] = esportsEventSummaries([feed("cs2", matches)]);
  assert.equal(derived.startMs, now + DAY);
  assert.equal(derived.endMs, now + 4 * DAY);
  const [joined] = esportsEventSummaries(
    [feed("cs2", matches)],
    [
      tournament({
        id: "21",
        name: "IEM Cologne 2026",
        startMs: now,
        endMs: now + 9 * DAY,
        prize: 1_250_000,
        tier: "s",
        level: "major",
        logo: "https://files.bo3.gg/cologne.webp",
        sourceUrl: "https://bo3.gg/tournaments/iem-cologne-2026",
      }),
    ],
  );
  assert.equal(joined.name, "IEM Cologne 2026");
  assert.equal(joined.startMs, now);
  assert.equal(joined.endMs, now + 9 * DAY);
  assert.equal(joined.prize?.totalUsd, 1_250_000);
  assert.equal(joined.tier?.publisher, "s");
  assert.equal(joined.level, "major");
  assert.equal(joined.logo, "https://files.bo3.gg/cologne.webp");
});

test("a bo3 tournament id never joins a Dota row carrying an OpenDota league id", () => {
  const [summary] = esportsEventSummaries(
    [
      feed("dota2", [
        match({ id: "1", game: "dota2", event: { id: "21", name: "BLAST Slam VIII" } }),
      ]),
    ],
    [tournament({ id: "21", name: "IEM Cologne 2026", prize: 1_250_000 })],
  );
  assert.equal(summary.name, "BLAST Slam VIII");
  assert.equal(summary.prize, undefined);
});

test("teams are deduplicated across the whole tournament and capped", () => {
  const rows = Array.from({ length: 9 }, (_, index) =>
    match({
      id: String(index),
      game: "cs2",
      event: { id: "5", name: "BLAST Premier: World Final" },
      teams: [`Team ${index}`, `Team ${index + 1}`],
    }),
  );
  const [summary] = esportsEventSummaries([feed("cs2", rows)]);
  assert.equal(summary.teams.length, 10);
  assert.equal(new Set(summary.teams.map((team) => team.name)).size, 10);
});

test("an event with no name is not a tournament", () => {
  assert.deepEqual(
    esportsEventSummaries([
      feed("cs2", [match({ id: "1", game: "cs2", event: { id: "", name: "   " } })]),
    ]),
    [],
  );
});

test("the row ranks the allowlist and names every title that contributed nothing", () => {
  const summaries = esportsEventSummaries([
    feed("cs2", [
      match({ id: "1", game: "cs2", event: { id: "9", name: "IEM Katowice 2026" } }),
      match({ id: "2", game: "cs2", event: { id: "10", name: "Some Qualifier Cup 14" } }),
    ]),
    feed("dota2", [
      match({ id: "3", game: "dota2", event: { id: "19102", name: "BLAST Slam VIII" } }),
    ]),
  ]);
  const ranked = rankEsportsEvents(summaries as SeriesCandidate[], { now });
  assert.deepEqual(
    ranked.map((entry) => entry.event.name),
    ["IEM Katowice 2026", "BLAST Slam VIII"],
  );
  assert.deepEqual(
    esportsRowFallbacks(ranked).map((entry) => `${entry.game}:${entry.reason}`),
    ["lol:no-events", "valorant:no-events", "rocketleague:no-source"],
  );
});

test("a provider prize figure is never labelled as a currency", () => {
  assert.equal(esportsPrizeLabel(1_250_000, "USD", "en-US"), "$1.3M");
  assert.equal(esportsPrizeLabel(1_250_000, undefined, "en-US"), "1.3M");
  assert.equal(esportsPrizeLabel(0, "USD", "en-US"), "");
  assert.equal(esportsPrizeLabel(undefined, "USD", "en-US"), "");
});

test("a date range collapses a single day and keeps both months when they differ", () => {
  // Local noon, so a day boundary cannot move with the machine's time zone.
  const day = new Date(2026, 8, 24, 12).getTime();
  assert.equal(esportsEventDateRange(day, day, "en-US"), "Sep 24");
  assert.equal(esportsEventDateRange(day, day + 4 * DAY, "en-US"), "Sep 24 - 28");
  assert.equal(esportsEventDateRange(day, day + 10 * DAY, "en-US"), "Sep 24 - Oct 4");
  assert.equal(esportsEventDateRange(undefined, day, "en-US"), "");
  assert.equal(esportsEventDateRange(day, day, "en-US", true), "Sep 24, 2026");
});
