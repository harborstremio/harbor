import test from "node:test";
import assert from "node:assert/strict";
import {
  ESPORTS_ROW_GAMES,
  ESPORTS_SERIES,
  ESPORTS_UPCOMING_SOURCE,
  LIQUIPEDIA_WIKI,
  esportsRowFallbacks,
  esportsTierRank,
  isMajorEventName,
  matchEsportsSeries,
  normalizeSeriesName,
  rankEsportsEvents,
  scoreEsportsEvent,
  type SeriesCandidate,
} from "../src/lib/sports/esports-series.ts";

const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 30, 12);
const event = (over: Partial<SeriesCandidate> & { name: string }): SeriesCandidate => ({
  id: over.name,
  game: "cs2",
  startMs: now + 3 * DAY,
  ...over,
});
const series = (name: string, game?: SeriesCandidate["game"]) => matchEsportsSeries(name, game)?.id;

test("real event names from the source audit resolve to their series", () => {
  const cases: [string, SeriesCandidate["game"], string | undefined][] = [
    ["ESL Pro League Season 22", "cs2", "esl-pro-league"],
    ["IEM Katowice 2026", "cs2", "iem"],
    ["IEM Cologne 2026 Playoffs", "cs2", "iem"],
    ["BLAST Premier: World Final", "cs2", "blast-premier"],
    ["BLAST Open 2026 Fall", "cs2", "blast-open"],
    ["PGL Cluj-Napoca 2025", "cs2", "pgl"],
    ["Esports World Cup 2026", "cs2", "ewc"],
    ["IEM Rio Major 2022", "cs2", "major"],
    ["StarLadder/2025/Major", "cs2", "major"],
    ["The International 2025", "dota2", "ti"],
    ["TI13", "dota2", "ti"],
    ["TI Main Event", "dota2", "ti"],
    ["BLAST Slam VIII", "dota2", "blast-slam"],
    ["DreamLeague Season 26", "dota2", "dreamleague"],
    ["ESL One Birmingham 2026", "dota2", "esl-one"],
    ["Riyadh Masters 2026", "dota2", "riyadh-masters"],
    ["Worlds 2025", "lol", "worlds"],
    ["worlds_2026", "lol", "worlds"],
    ["2025 World Championship", "lol", "worlds"],
    ["Worlds 2025 Knockout Stage", "lol", "worlds"],
    ["MSI 2026", "lol", "msi"],
    ["LCK Cup 2026", "lol", "lck"],
    ["VALORANT Champions 2025", "valorant", "vct-champions"],
    ["Champions Tour 2026: Masters Toronto", "valorant", "vct-masters"],
    ["VCT 2026: Masters Bangkok", "valorant", "vct-masters"],
    ["Champions Tour 2026: EMEA Stage 2", "valorant", "vct-league"],
    ["RLCS World Championship 2026", "rocketleague", "rlcs-worlds"],
    ["RLCS 2026 Open 1", "rocketleague", "rlcs"],
    ["RLCS 2026 Major 1", "rocketleague", "major"],
  ];
  for (const [name, game, expected] of cases)
    assert.equal(series(name, game), expected, `${name} (${game})`);
});

test("names that are not top events stay off the allowlist", () => {
  // Measured LoL league prefixes from the live feed; none of them is a top event.
  for (const name of ["EMEA MASTERS", "CBLOL", "ASIAN GAMES", "WSCI", "DCGI"])
    assert.equal(series(name, "lol"), undefined, name);
  assert.equal(series("LCK Challengers League 2026", "lol"), undefined);
  assert.equal(series("Game Changers Championship 2026", "valorant"), undefined);
  assert.equal(series("Major Ranking Qualifier 2026", "cs2"), undefined);
  assert.equal(isMajorEventName("Europe RMR 2026"), false);
  assert.equal(isMajorEventName("PGL Major Copenhagen 2024"), true);
});

test("a world final is not a World Championship, with or without a title hint", () => {
  assert.equal(series("BLAST Premier: World Final"), "blast-premier");
  assert.equal(series("RLCS World Championship 2026"), "rlcs-worlds");
  assert.equal(series("Riyadh Masters 2026"), "riyadh-masters");
});

test("case, punctuation, season and year suffixes fold away", () => {
  assert.equal(normalizeSeriesName("BLAST Premier: World Final"), "blast premier world final");
  assert.equal(normalizeSeriesName("PGL Cluj-Napoca 2025"), "pgl cluj napoca 2025");
  assert.equal(normalizeSeriesName("The International/2025"), "the international 2025");
  assert.equal(normalizeSeriesName("IEM Koln 2026"), "iem koln 2026");
  assert.equal(normalizeSeriesName("  esl   pro league  "), "esl pro league");
  assert.equal(series("esl pro league season 22", "cs2"), "esl-pro-league");
  assert.equal(series("ESL PRO LEAGUE SEASON 22", "cs2"), "esl-pro-league");
});

test("matching is locale invariant, which Turkish lowercasing would break", () => {
  assert.equal("IEM".toLocaleLowerCase("tr"), "ıem");
  assert.equal(normalizeSeriesName("IEM Katowice 2026"), "iem katowice 2026");
  assert.equal(series("IEM Katowice 2026", "cs2"), "iem");
});

test("tier spellings from all three feeds fold onto two bands", () => {
  assert.equal(esportsTierRank({ liquipedia: "S-Tier" }), "s");
  assert.equal(esportsTierRank({ liquipedia: "A-Tier" }), "a");
  assert.equal(esportsTierRank({ liquipedia: "tier_1" }), "s");
  assert.equal(esportsTierRank({ publisher: "premium" }), "s");
  assert.equal(esportsTierRank({ liquipedia: "professional" }), "a");
  assert.equal(esportsTierRank({ liquipedia: "B-Tier" }), undefined);
  assert.equal(esportsTierRank(undefined), undefined);
  // A tier string must never reach Object.prototype through a plain lookup.
  assert.equal(esportsTierRank({ liquipedia: "constructor" }), undefined);
});

test("score adds series weight, tier, prize and proximity", () => {
  const plain = scoreEsportsEvent(event({ name: "IEM Katowice 2026" }), now);
  assert.equal(plain.weight, 60);
  assert.equal(plain.score, 90);
  assert.equal(plain.series?.name, "Intel Extreme Masters");
  assert.equal(plain.tierChip, undefined);

  const rich = scoreEsportsEvent(
    event({
      name: "IEM Katowice 2026",
      tier: { liquipedia: "S-Tier" },
      prize: { totalUsd: 1_250_000 },
    }),
    now,
  );
  assert.equal(rich.score, 154);
  assert.equal(rich.tierChip, "S-Tier");

  const major = scoreEsportsEvent(
    event({
      name: "StarLadder Budapest Major 2026",
      startMs: now + 10 * DAY,
      prize: { totalUsd: 1_250_000 },
    }),
    now,
  );
  assert.equal(major.weight, 80);
  assert.equal(major.score, 149);
  assert.equal(major.tierChip, "Major");

  const capped = scoreEsportsEvent(
    event({
      name: "The International 2026",
      game: "dota2",
      startMs: now + DAY,
      prize: { totalUsd: 1_000_000_000 },
    }),
    now,
  );
  assert.equal(capped.score, 160);
});

test("proximity reads the event window, never a clock promotion", () => {
  const score = (over: Partial<SeriesCandidate>) =>
    scoreEsportsEvent(event({ name: "IEM Katowice 2026", ...over }), now).score;
  assert.equal(score({ startMs: now + 3 * DAY }), 90);
  assert.equal(score({ startMs: now + 20 * DAY }), 75);
  assert.equal(score({ startMs: now + 60 * DAY }), 60);
  assert.equal(score({ startMs: now - DAY, endMs: now + DAY }), 110);
  assert.equal(score({ startMs: now - DAY, endMs: now + DAY, status: "completed" }), 60);
  assert.equal(score({ startMs: undefined, status: "live" }), 110);
});

test("an unlisted S-Tier event still enters the row; an unlisted B-Tier one does not", () => {
  const hatch = event({ name: "Nebula Open 2026", tier: { liquipedia: "S-Tier" } });
  const scored = scoreEsportsEvent(hatch, now);
  assert.equal(scored.series, undefined);
  assert.equal(scored.weight, 70);
  assert.equal(scored.score, 140);
  assert.deepEqual(
    rankEsportsEvents([hatch, event({ name: "Nebula Open 2026 Qualifier" })], { now }).map(
      (entry) => entry.event.name,
    ),
    ["Nebula Open 2026"],
  );
});

test("finished and undated events leave the row", () => {
  const ended = event({ name: "IEM Cologne 2026", startMs: now - 10 * DAY, endMs: now - 3 * DAY });
  const yesterday = event({ name: "IEM Dallas 2026", startMs: now - 8 * DAY, endMs: now - DAY });
  const undated = event({ name: "ESL One Berlin", game: "dota2", startMs: undefined });
  const running = { ...undated, status: "live" as const };
  assert.deepEqual(rankEsportsEvents([ended], { now }), []);
  assert.deepEqual(
    rankEsportsEvents([yesterday], { now }).map((entry) => entry.score),
    [60],
  );
  assert.deepEqual(rankEsportsEvents([undated], { now }), []);
  assert.equal(rankEsportsEvents([running], { now }).length, 1);
});

test("ranking is deterministic and the weight floor filters bands", () => {
  const events = [
    event({ name: "IEM Dallas 2027", startMs: now + 60 * DAY }),
    event({ name: "IEM Katowice 2026" }),
    event({ name: "The International 2026", game: "dota2", startMs: now + DAY }),
    { ...event({ name: "IEM Cologne 2026" }), id: "b-tie" },
    { ...event({ name: "IEM Shanghai 2026" }), id: "a-tie" },
  ];
  assert.deepEqual(
    rankEsportsEvents(events, { now }).map((entry) => entry.event.id),
    ["The International 2026", "IEM Katowice 2026", "a-tie", "b-tie", "IEM Dallas 2027"],
  );
  assert.deepEqual(
    rankEsportsEvents(events, { now, minWeight: 80 }).map((entry) => entry.series?.id),
    ["ti"],
  );
  assert.deepEqual(rankEsportsEvents([], { now }), []);
});

test("a title with no ranked event is still represented, never dropped", () => {
  assert.deepEqual(esportsRowFallbacks([], ESPORTS_ROW_GAMES), [
    { game: "cs2", reason: "no-events" },
    { game: "lol", reason: "no-events" },
    { game: "valorant", reason: "no-events" },
    { game: "dota2", reason: "no-events" },
    { game: "rocketleague", reason: "no-source" },
  ]);
  const ranked = rankEsportsEvents([event({ name: "IEM Katowice 2026" })], { now });
  assert.deepEqual(
    esportsRowFallbacks(ranked).map((fallback) => fallback.game),
    ["lol", "valorant", "dota2", "rocketleague"],
  );
  assert.equal(ESPORTS_UPCOMING_SOURCE.rocketleague, null);
});

test("the table itself stays well formed", () => {
  const ids = ESPORTS_SERIES.map((def) => def.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const def of ESPORTS_SERIES) {
    assert.ok(def.name.length > 1, def.id);
    assert.ok(def.games.length > 0, def.id);
    assert.ok(def.match.length > 0, def.id);
    assert.ok([40, 60, 80, 100].includes(def.weight), `${def.id} weight ${def.weight}`);
    // A global flag would carry lastIndex between calls and make matching order dependent.
    for (const pattern of [...def.match, ...(def.deny ?? [])])
      assert.equal(pattern.global, false, `${def.id} ${pattern}`);
  }
  for (const game of ESPORTS_ROW_GAMES) {
    assert.ok(LIQUIPEDIA_WIKI[game], game);
    assert.ok(
      ESPORTS_SERIES.some((def) => def.games.includes(game)),
      game,
    );
  }
});
