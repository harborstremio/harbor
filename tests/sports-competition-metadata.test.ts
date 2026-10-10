import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCompetitionMetadata,
  parseCompetitionResults,
  parseCompetitionResultText,
  parseDbCompetition,
  parseEspnCompetition,
  publicCompetitionUrl,
  mergeCompetitionEntrants,
} from "../src/lib/sports/competition-metadata.ts";
import { toSide } from "../src/lib/sports/espn-parse.ts";
import type { LeagueDef, SportsGame } from "../src/lib/sports/espn-types.ts";

const league: LeagueDef = {
  key: "SUPERCARS",
  tag: "SUPERCARS",
  label: "Supercars",
  labelEn: "Supercars",
  path: "4489",
  group: "motorsport",
  logo: "",
};
const game: SportsGame = {
  id: "2419070",
  league: "SUPERCARS",
  source: "thesportsdb-hub",
  state: "post",
  startMs: Date.parse("2026-09-13T04:15:00Z"),
  detail: "FT",
  home: {
    id: "",
    name: "AirTouch 500",
    logo: "",
    abbr: "",
    score: "",
    winner: false,
  },
  away: { id: "", name: "", logo: "", abbr: "", score: "", winner: false },
  context: {
    id: "2419070",
    name: "AirTouch 500",
    venue: "The Bend",
    major: false,
    round: "",
    draw: "",
  },
};
const event = {
  idEvent: game.id,
  idLeague: "4489",
  idVenue: "15987",
  strVenue: "The Bend Motorsport Park",
  strEvent: "AirTouch 500 at The Bend Race 29",
  strStatus: "FT",
  strDescriptionEN: "Published race report.",
  strResult: "Published results",
};
const results = [
  {
    idResult: "1",
    idEvent: game.id,
    intPosition: "1",
    strPlayer: "Chaz Mostert",
    strDetail: "3:36:02.669",
  },
  {
    idResult: "2",
    idEvent: game.id,
    intPosition: "1",
    strPlayer: "Fabian Coulthard",
    strDetail: "Fabian Coulthard",
  },
  {
    idResult: "3",
    idEvent: game.id,
    intPosition: "2",
    strPlayer: "Kai Allen",
    strDetail: "3:36:21.156",
  },
  {
    idResult: "4",
    idEvent: "wrong-event",
    intPosition: "1",
    strPlayer: "Other winner",
  },
];

test("classification identities preserve real athlete IDs separately from row and team IDs", () => {
  const image = "https://r2.thesportsdb.com/images/media/player/cutout/published.png";
  const parsed = parseCompetitionResults([
    { ...results[0], idPlayer: "314", strThumb: image },
    { ...results[1], idPlayer: "159" },
    { ...results[2], idPlayer: "" },
  ], game.id);
  assert.equal(parsed[0].id, "position:1");
  assert.deepEqual(parsed[0].athletes?.map((person) => person.id), ["314", "159"]);
  assert.equal(parsed[0].athletes?.[0].image, image);
  assert.equal(parsed[1].athletes?.[0].id, "", "An absent athlete ID is never filled from idResult");
  assert.equal(parsed[1].athletes?.[0].source, "thesportsdb");
  const report = parseCompetitionResultText(
    "1\tChaz Mostert / Fabian Coulthard\t3:36:02\n2\tUnknown entrant\t3:38:00\n3\tAnother entry\t3:40:00",
  );
  const merged = mergeCompetitionEntrants(report, parsed);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged[0].athletes?.map((person) => person.id), ["314", "159"]);
  assert.equal(merged[1].athletes, undefined, "Matching a finishing position cannot establish a person");
  assert.equal(report[0].athletes, undefined, "The unstructured report remains non-interactive on its own");
});

test("ESPN field identity uses only explicit athlete records, never team or competitor row IDs", () => {
  const portrait = "https://a.espncdn.com/i/headshots/golf/players/full/9478.png";
  const person = { id: "9478", displayName: "Scottie Scheffler", headshot: { href: portrait } };
  const side = toSide({ id: "row-1", type: "athlete", athlete: person }, "golf");
  assert.equal(side.athleteId, "9478");
  assert.equal(side.athleteSource, "espn");
  assert.equal(side.athleteImage, portrait);
  assert.equal(toSide({ id: "row-1", type: "athlete", athlete: { displayName: person.displayName } }, "golf").athleteId, "");
  assert.equal(toSide({ type: "team", team: { id: "9478", displayName: "Golf team" } }, "golf").athleteSource, undefined);
  const detail = parseEspnCompetition({ ...game, id: "event", context: undefined }, {
    events: [{ id: "event", competitions: [{ id: "race", competitors: [
      { id: "row-1", type: "athlete", athlete: person },
      { id: "row-2", type: "team", team: { id: "7", displayName: "National team" } },
    ] }] }],
  });
  assert.equal(detail.entrants[0].id, "row-1");
  assert.equal(detail.entrants[0].athletes?.[0].id, "9478");
  assert.equal(detail.entrants[1].athletes, undefined);
});

test("Supercars metadata uses matching event/venue records and pairs co-driver results", () => {
  const detail = parseDbCompetition(
    game,
    league,
    event,
    {
      idVenue: "15987",
      strLocation: "Tailem Bend, South Australia",
      strThumb: "https://r2.thesportsdb.com/images/media/venue/thumb/track.jpg",
      strWebsite: "www.thebend.com.au",
    },
    { idLeague: "4489", strWebsite: "www.supercars.com" },
    results,
  );
  assert.equal(detail.entrants.length, 2);
  assert.equal(detail.entrants[0].name, "Chaz Mostert / Fabian Coulthard");
  assert.equal(detail.entrants[0].result, "3:36:02.669");
  assert.equal(detail.venue?.website, "https://www.thebend.com.au/");
  assert.equal(detail.website, "https://www.supercars.com/");
  assert.equal(detail.results, true);
  assert.equal(detail.sessions[0].startMs, game.startMs);
  assert.equal(parseCompetitionResults(results, "missing").length, 0);
});

test("metadata rejects unrelated records, unsafe links and non-image map coordinates", () => {
  const detail = parseDbCompetition(
    game,
    league,
    event,
    {
      idVenue: "wrong",
      strThumb: "https://r2.thesportsdb.com/wrong.jpg",
      strWebsite: "www.wrong.example",
    },
    { idLeague: "wrong", strWebsite: "www.wrong.example" },
  );
  assert.equal(detail.venue?.image, undefined);
  assert.equal(detail.website, undefined);
  assert.equal(detail.resultText, "Published results");
  assert.equal(
    parseDbCompetition(game, league, { ...event, idEvent: "other" }).description,
    undefined,
  );
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@example.com",
    "http://127.0.0.1",
    "https://localhost",
    "https://device.local",
    "35°18′30″S 139°31′0″E",
  ])
    assert.equal(publicCompetitionUrl(url), undefined);
});

test("full published race classification survives the limited free structured result endpoint", () => {
  const report =
    "1\t/Chaz Mostert/Fabian Coulthard\t\t/Mobil1 Optus Racing\t\t/3:36:02.669\r\n2\t/Kai Allen/Tim Slade\t\t/Penrite Racing\t\t/3:36:21.156\r\n3\t/Ryan Wood/Jaxon Evans\t\t/Mobil1 Truck Assist Racing\t/3:36:35.952";
  const parsed = parseCompetitionResultText(report);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[2].name, "Ryan Wood / Jaxon Evans");
  assert.equal(parsed[2].team, "Mobil1 Truck Assist Racing");
  const detail = parseDbCompetition(game, league, { ...event, strResult: report }, {}, {}, results);
  assert.equal(detail.entrants.length, 3);
  assert.equal(detail.entrants[2].result, "3:36:35.952");
  assert.equal(parseCompetitionResultText("An unstructured race report.").length, 0);
});

test("ESPN selects the actual race field while retaining every weekend session", () => {
  const f1Game = {
    ...game,
    id: "race|main",
    context: { ...game.context!, id: "race" },
  };
  const detail = parseEspnCompetition(f1Game, {
    events: [
      {
        id: "race",
        competitions: [
          {
            id: "practice",
            type: { abbreviation: "FP1" },
            date: "2026-09-24T08:30Z",
            competitors: [{ id: "wrong", athlete: { displayName: "Practice leader" } }],
          },
          {
            id: "main",
            type: { abbreviation: "Race" },
            date: "2026-09-26T08:00Z",
            status: { type: { completed: true } },
            competitors: [
              {
                id: "right",
                athlete: { displayName: "Race winner" },
                score: "1:32:10",
                order: 1,
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(detail.sessions.length, 2);
  assert.equal(detail.entrants[0].name, "Race winner");
  assert.equal(detail.results, true);
});

test("numeric TSDB leagues never request ESPN; optional lookup failures preserve results and cache", async () => {
  const urls: string[] = [];
  const fixtureGame = {
    ...game,
    id: "222",
    context: { ...game.context!, id: "222" },
  };
  const json = async (url: string) => {
    urls.push(url);
    if (url.includes("lookupvenue")) throw new Error("venue unavailable");
    if (url.includes("lookupleague"))
      return {
        leagues: [{ idLeague: "4489", strWebsite: "www.supercars.com" }],
      };
    if (url.includes("eventresults"))
      return { results: results.map((row) => ({ ...row, idEvent: "222" })) };
    return { events: [{ ...event, idEvent: "222" }] };
  };
  const detail = await loadCompetitionMetadata(
    fixtureGame,
    league,
    new AbortController().signal,
    json,
  );
  assert.equal(detail.partial, true);
  assert.equal(detail.results, true);
  assert.equal(detail.description, event.strDescriptionEN);
  assert.equal(urls.length, 4);
  assert.ok(urls.every((url) => new URL(url).hostname === "www.thesportsdb.com"));
  assert.strictEqual(
    await loadCompetitionMetadata(fixtureGame, league, new AbortController().signal, json),
    detail,
  );
  assert.equal(urls.length, 4);
});

test("shared requests survive one consumer closing and abort when the final consumer closes", async () => {
  const fixtureGame = { ...game, id: "333" };
  let calls = 0;
  let signal: AbortSignal | undefined;
  const json = async (_url: string, requestSignal: AbortSignal) => {
    calls++;
    signal = requestSignal;
    return new Promise<Record<string, unknown>>(() => {});
  };
  const a = new AbortController();
  const b = new AbortController();
  const first = loadCompetitionMetadata(fixtureGame, league, a.signal, json);
  const second = loadCompetitionMetadata(fixtureGame, league, b.signal, json);
  a.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, false);
  b.abort();
  await assert.rejects(second, { name: "AbortError" });
  assert.equal(signal?.aborted, true);
});

test("ESPN request is scoped to the event day and unsupported provider paths stay schedule-only", async () => {
  const urls: string[] = [];
  const json = async (url: string) => {
    urls.push(url);
    return {};
  };
  await loadCompetitionMetadata(
    { ...game, id: "444" },
    { ...league, path: "racing/f1" },
    new AbortController().signal,
    json,
  );
  assert.match(urls[0], /racing\/f1\/scoreboard\?dates=20260913&limit=100$/);
  const detail = await loadCompetitionMetadata(
    { ...game, id: "555" },
    { ...league, path: "official-one" },
    new AbortController().signal,
    json,
  );
  assert.equal(urls.length, 1);
  assert.equal(detail.sessions.length, 1);
});
