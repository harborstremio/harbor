import assert from "node:assert/strict";
import test from "node:test";
import {
  loadPublishedEvent,
  parseEspnVolleyballSets,
  parsePublishedEvent,
  readPublishedEvent,
} from "../src/lib/sports/event-enrichment.ts";
import type { LeagueDef, SportsGame } from "../src/lib/sports/espn-types.ts";

const league: LeagueDef = {
  key: "VNL",
  tag: "VNL",
  label: "VNL",
  labelEn: "VNL",
  path: "5083",
  group: "volleyball",
  logo: "",
};
const game: SportsGame = {
  id: "2557566",
  league: "VNL",
  source: "thesportsdb-hub",
  state: "pre",
  detail: "",
  startMs: Date.parse("2026-08-02T11:30:00Z"),
  home: {
    id: "141828",
    name: "USA Volleyball",
    abbr: "USA",
    logo: "",
    score: "",
    winner: false,
  },
  away: {
    id: "141825",
    name: "Poland Volleyball",
    abbr: "POL",
    logo: "",
    score: "",
    winner: false,
  },
};
// Published by lookupevent.php?id=2557566; missing team badges are genuinely absent.
const event = {
  idEvent: "2557566",
  idLeague: "5083",
  strEvent: "USA Volleyball vs Poland Volleyball",
  strTimestamp: "2026-08-02T11:30:00",
  strHomeTeam: "USA Volleyball",
  strAwayTeam: "Poland Volleyball",
  idHomeTeam: "141828",
  idAwayTeam: "141825",
  intHomeScore: "2",
  intAwayScore: "3",
  strStatus: "FT",
  strVenue: "Beilun Gymnasium",
  idVenue: "31620",
  strCity: "Ningbo",
  strCountry: "China",
  strSeason: "2026",
  strThumb: "https://r2.thesportsdb.com/images/media/event/thumb/vbem0m1784729643.jpg",
  strVideo: "https://www.youtube.com/watch?v=SAjrSUNCQbc",
};

test("opened individual results share athlete enrichment while provider failure preserves the event", async () => {
  const selected = { ...game, id: "761", league: "WST" };
  const snooker = { ...league, key: "WST", tag: "WST", path: "4555", group: "snooker" };
  const urls: string[] = [];
  const json = async (url: string) => {
    urls.push(url);
    if (url.includes("eventresults")) return { results: [
      { idEvent: "761", idResult: "999", idPlayer: "1234", strPlayer: "Published Player", intPosition: "1" },
      { idEvent: "other", idPlayer: "5678", strPlayer: "Other Player", intPosition: "2" },
    ] };
    return { events: [{ ...event, idEvent: "761", idLeague: "4555" }] };
  };
  const first = loadPublishedEvent(selected, snooker, new AbortController().signal, json);
  const second = loadPublishedEvent(selected, snooker, new AbortController().signal, json);
  const [a, b] = await Promise.all([first, second]);
  assert.strictEqual(a, b);
  assert.equal(urls.length, 2, "One event lookup and one shared athlete classification request");
  assert.equal(a?.entrants?.[0].athletes?.[0].id, "1234");
  assert.equal(a?.entrants?.length, 1);
  await loadPublishedEvent(selected, snooker, new AbortController().signal, json);
  assert.equal(urls.length, 2);
  const partial = await loadPublishedEvent(
    { ...selected, id: "762" }, snooker, new AbortController().signal,
    async (url) => {
      if (url.includes("eventresults")) throw new Error("Classification unavailable");
      return { events: [{ ...event, idEvent: "762", idLeague: "4555" }] };
    },
  );
  assert.equal(partial?.game.state, "post");
  assert.equal(partial?.partial, true);
  assert.equal(partial?.entrants, undefined);
});

test("a verified TSDB volleyball event keeps its published score, photography and venue", () => {
  const found = parsePublishedEvent(game, league, event)!;
  assert.equal(found.game.state, "post");
  assert.equal(found.game.home.score, "2");
  assert.equal(found.game.away.score, "3");
  assert.equal(found.game.away.winner, true);
  assert.equal(found.game.home.logo, "");
  assert.equal(found.game.startMs, Date.parse("2026-08-02T11:30:00Z"));
  assert.equal(found.game.artwork, event.strThumb);
  assert.deepEqual(found.venue, {
    id: "31620",
    name: "Beilun Gymnasium",
    location: "Ningbo, China",
  });
  assert.equal(found.videoUrl, event.strVideo);
  assert.equal(found.sourceUrl, "https://www.thesportsdb.com/event/2557566");
});

test("event and league identity must both match before provider data can replace details", () => {
  assert.equal(parsePublishedEvent(game, league, { ...event, idLeague: "5084" }), null);
  assert.equal(parsePublishedEvent(game, league, { ...event, idEvent: "2557567" }), null);
  assert.equal(
    parsePublishedEvent(game, { ...league, path: "volleyball/womens-college-volleyball" }, event),
    null,
  );
  assert.equal(parsePublishedEvent(game, league, null), null);
});

test("a missing score stays missing, a reported zero stays zero, and old timestamps never manufacture live games", () => {
  const found = parsePublishedEvent(game, league, {
    ...event,
    strStatus: "Not Started",
    intHomeScore: 0,
    intAwayScore: null,
  })!;
  assert.equal(found.game.home.score, "0");
  assert.equal(found.game.away.score, "");
  assert.equal(found.game.state, "pre");
  assert.equal(found.game.home.winner, false);
  const unfinished = parsePublishedEvent(game, league, {
    ...event,
    strStatus: "Not Finished",
  })!;
  assert.equal(unfinished.game.state, "pre");
});

test("replaced participants cannot inherit the previous team's score or badge", () => {
  const prior = {
    ...game,
    home: {
      ...game.home,
      score: "3",
      logo: "https://r2.thesportsdb.com/images/media/team/badge/usa.png",
    },
  };
  const found = parsePublishedEvent(prior, league, {
    ...event,
    idHomeTeam: "141826",
    strHomeTeam: "Brazil Volleyball",
    intHomeScore: null,
  })!;
  assert.equal(found.game.home.name, "Brazil Volleyball");
  assert.equal(found.game.home.logo, "");
  assert.equal(found.game.home.score, "");
  assert.equal(found.game.home.abbr, "");
});

test("untrusted artwork and links cannot enter enriched event data", () => {
  for (const url of [
    "https://r2.thesportsdb.com.evil.example/images/media/event/a.jpg",
    "https://user:pass@r2.thesportsdb.com/images/media/event/a.jpg",
    "http://127.0.0.1/private.jpg",
    "https://r2.thesportsdb.com:444/images/media/event/a.jpg",
    "javascript:alert(1)",
  ]) {
    const found = parsePublishedEvent(game, league, {
      ...event,
      strThumb: url,
      strPoster: url,
      strSquare: url,
      strVideo: url,
    })!;
    assert.equal(found.game.artwork, undefined, url);
    assert.equal(found.game.poster, undefined, url);
    assert.equal(found.square, undefined, url);
    assert.equal(found.videoUrl, undefined, url);
  }
  const found = parsePublishedEvent(game, league, {
    ...event,
    strVideo: "https://youtu.be/SAjrSUNCQbc?autoplay=1&unrelated=1",
  })!;
  assert.equal(found.videoUrl, event.strVideo);
});

test("text remains bounded and event result prose is preserved without invented participants", () => {
  const found = parsePublishedEvent(game, league, {
    ...event,
    strDescriptionEN: "x".repeat(10000),
    strResult: "Published result report",
    strRound: "Final",
  })!;
  assert.equal(found.description?.length, 8000);
  assert.equal(found.resultText, "Published result report");
  assert.equal(found.round, "Final");
  assert.equal("homeRoster" in found.game, false);
});

// Header line-score shape from ESPN event401884323 (Pittsburgh–Wright State).
const volleyball = {
  header: {
    id: "401884323",
    competitions: [
      {
        id: "401884323",
        competitors: [
          {
            homeAway: "away",
            score: "0",
            linescores: [{ displayValue: "10" }, { displayValue: "14" }, { displayValue: "14" }],
          },
          {
            homeAway: "home",
            score: "3",
            linescores: [{ displayValue: "25" }, { displayValue: "25" }, { displayValue: "25" }],
          },
        ],
      },
    ],
  },
};
test("ESPN volleyball exposes points per set independently of the aggregate sets-won score", () => {
  assert.deepEqual(parseEspnVolleyballSets(volleyball, "401884323"), [
    { label: "Set 1", homeValue: "25", awayValue: "10" },
    { label: "Set 2", homeValue: "25", awayValue: "14" },
    { label: "Set 3", homeValue: "25", awayValue: "14" },
  ]);
  assert.deepEqual(parseEspnVolleyballSets(volleyball, "401884324"), []);
});

test("incomplete volleyball points preserve zeros, gaps and set numbering without guessing", () => {
  const raw = {
    header: {
      id: "11",
      competitions: [
        {
          id: "11",
          competitors: [
            null,
            {
              homeAway: "home",
              linescores: [{ value: 0 }, null, { displayValue: "25" }],
            },
            {
              homeAway: "away",
              linescores: [{ displayValue: "0" }, null, { displayValue: "22" }],
            },
          ],
        },
      ],
    },
  };
  assert.deepEqual(parseEspnVolleyballSets(raw, "11"), [
    { label: "Set 1", homeValue: "0", awayValue: "0" },
    { label: "Set 3", homeValue: "25", awayValue: "22" },
  ]);
  assert.deepEqual(parseEspnVolleyballSets(null, "11"), []);
});

test("opening the same event shares a single lookup and warm details avoid another request", async () => {
  const selected = { ...game, id: "301" };
  let calls = 0;
  let finish!: (value: unknown) => void;
  const json = async (url: string) => {
    calls++;
    assert.equal(url, "https://www.thesportsdb.com/api/v1/json/123/lookupevent.php?id=301");
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const first = loadPublishedEvent(selected, league, new AbortController().signal, json);
  const second = loadPublishedEvent(selected, league, new AbortController().signal, json);
  finish({ events: [{ ...event, idEvent: "301" }] });
  const [one, two] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(one, two);
  assert.equal(readPublishedEvent(selected, league), one);
  assert.equal(await loadPublishedEvent(selected, league, new AbortController().signal, json), one);
  assert.equal(calls, 1);
});

test("one closing consumer cannot cancel another, but closing the last one aborts provider work", async () => {
  const selected = { ...game, id: "302" };
  let providerSignal!: AbortSignal;
  const json = async (_url: string, signal: AbortSignal) => {
    providerSignal = signal;
    return new Promise(() => {});
  };
  const a = new AbortController();
  const b = new AbortController();
  const first = loadPublishedEvent(selected, league, a.signal, json);
  const second = loadPublishedEvent(selected, league, b.signal, json);
  const firstRejected = assert.rejects(first, { name: "AbortError" });
  const secondRejected = assert.rejects(second, { name: "AbortError" });
  a.abort();
  await firstRejected;
  assert.equal(providerSignal.aborted, false);
  b.abort();
  await secondRejected;
  assert.equal(providerSignal.aborted, true);
  assert.equal(readPublishedEvent(selected, league), undefined);
});

test("failed responses remain retryable and unsupported IDs never request a provider", async () => {
  const selected = { ...game, id: "303" };
  await assert.rejects(
    loadPublishedEvent(selected, league, new AbortController().signal, async () => ({
      error: "unavailable",
    })),
  );
  const found = await loadPublishedEvent(
    selected,
    league,
    new AbortController().signal,
    async () => ({ events: [{ ...event, idEvent: "303" }] }),
  );
  assert.ok(found);
  let calls = 0;
  const json = async () => {
    calls++;
    return {};
  };
  assert.equal(
    await loadPublishedEvent(
      game,
      { ...league, path: "volleyball/womens-college-volleyball" },
      new AbortController().signal,
      json,
    ),
    null,
  );
  assert.equal(
    await loadPublishedEvent(
      { ...game, id: "../../private" },
      league,
      new AbortController().signal,
      json,
    ),
    null,
  );
  assert.equal(calls, 0);
});
