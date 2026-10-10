import assert from "node:assert/strict";
import test from "node:test";
import {
  createNascarClient,
  matchNascarRace,
  nascarRaceStart,
  parseNascarCareerHtml,
  parseNascarDrivers,
  parseNascarRace,
  parseNascarStandings,
} from "../src/lib/sports/nascar-data.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

const game: SportsGame = {
  id: "202609134249",
  league: "NASCAR",
  state: "post",
  startMs: Date.parse("2026-09-13T19:00:00Z"),
  detail: "Final",
  home: {
    id: "",
    name: "NASCAR Cup Series at World Wide Technology Raceway",
    abbr: "",
    logo: "",
    score: "",
    winner: false,
  },
  away: { id: "", name: "", abbr: "", logo: "", score: "", winner: false },
  context: {
    id: "202609134249",
    name: "NASCAR Cup Series at World Wide Technology Raceway",
    venue: "",
    round: "",
    draw: "",
    major: false,
  },
};
const race = {
  race_id: 5625,
  series_id: 1,
  race_season: 2026,
  race_name: "Enjoy Illinois 300",
  track_name: "World Wide Technology Raceway",
  track_id: 45,
  date_scheduled: "2026-09-13T15:00:00",
  scheduled_laps: 240,
  actual_laps: 247,
  scheduled_distance: 300,
  inspection_complete: true,
  schedule: [{ run_type: 3, event_name: "Race", start_time_utc: "2026-09-13T19:00:00" }],
};
const driverData = {
  response: [
    {
      Nascar_Driver_ID: 4030,
      Driver_ID: "374504",
      Full_Name: "Kyle Larson",
      Driver_Series: "nascar-cup-series",
      Team: "Hendrick Motorsports",
      Badge: "5",
      Image_Small: "https://www.nascar.com/larson-small.png",
      Firesuit_Image: "https://www.nascar.com/larson.png",
      Driver_Page: "https://www.nascar.com/drivers/kyle-larson",
      DOB: "1992-07-31T00:00:00",
      Career_Stats: "",
      Points: "0",
      No_Wins: "0",
      Crew_Chief: "Cliff Daniels",
    },
  ],
};
const pointRows = [
  {
    driver_id: 4030,
    driver_name: "Kyle Larson",
    position: 2,
    points: 2159,
    starts: 28,
    wins: 1,
    poles: 0,
    top_5: 11,
    top_10: 15,
    laps_led: 838,
    dnf: 3,
    car_no: "5",
    manufacturer: "Chevrolet",
  },
];
const raceResult = {
  race_id: 5625,
  series_id: 1,
  race_season: 2026,
  driver_id: 4030,
  driver_fullname: "Kyle Larson",
  team_name: "Hendrick Motorsports",
  car_number: "5",
  car_make: "Chevrolet",
  finishing_position: 1,
  starting_position: 2,
  laps_completed: 247,
  laps_led: 80,
  points_earned: 73,
  finishing_status: "Running",
};
const weekend = {
  weekend_race: [{ ...race, results: [raceResult] }],
  weekend_runs: [],
};
const drivers = parseNascarDrivers(driverData, 1);

test("ESPN's sparse venue-only title maps to the exact NASCAR race and series", () => {
  assert.equal(matchNascarRace(game, { series_1: [race] })?.race_id, 5625);
  assert.equal(
    matchNascarRace({ ...game, league: "NXS" }, { series_1: [race], series_2: [race] }),
    undefined,
  );
  assert.equal(
    matchNascarRace({ ...game, startMs: game.startMs + 7 * 86400_000 }, { series_1: [race] }),
    undefined,
  );
  assert.equal(matchNascarRace({ ...game, league: "F1" }, { series_1: [race] }), undefined);
});

test("ambiguous same-track double headers are not guessed; named races disambiguate", () => {
  const other = { ...race, race_id: 5626, race_name: "Another 300" };
  assert.equal(matchNascarRace(game, { series_1: [race, other] }), undefined);
  assert.equal(
    matchNascarRace(
      { ...game, context: { ...game.context!, name: "Enjoy Illinois 300" } },
      { series_1: [race, other] },
    )?.race_id,
    5625,
  );
});

test("official UTC race schedules take precedence and Eastern fallback handles daylight saving", () => {
  assert.equal(nascarRaceStart(race), game.startMs);
  assert.equal(nascarRaceStart({ date_scheduled: "2026-09-13T15:00:00" }), game.startMs);
  assert.equal(
    nascarRaceStart({ date_scheduled: "2026-02-15T15:00:00" }),
    Date.parse("2026-02-15T20:00:00Z"),
  );
});

test("portraits use official identities while event and series fields override stale driver directory fields", () => {
  assert.equal(drivers[0].id, "4030");
  assert.equal(drivers[0].image, "https://www.nascar.com/larson-small.png");
  assert.equal(parseNascarDrivers(driverData, 2)[0].carNumber, undefined);
  assert.equal(parseNascarDrivers(driverData, 2)[0].team, undefined);
  const data = {
    response: [
      {
        ...driverData.response[0],
        Image_Small: "https://other.example/photo.png",
        Firesuit_Image: "javascript:evil",
      },
    ],
  };
  assert.equal(parseNascarDrivers(data, 1)[0].image, undefined);
});

test("season points preserve real zero poles without consuming directory placeholder stats", () => {
  const standings = parseNascarStandings(pointRows, drivers);
  assert.equal(standings[0].wins, 1);
  assert.equal(standings[0].poles, 0);
  assert.equal(standings[0].driver.manufacturer, "Chevrolet");
  assert.equal(standings[0].driver.team, "Hendrick Motorsports");
});

test("race classification contains positions, grid, laps led, points and actual driver portraits", () => {
  const result = parseNascarRace(game, race, weekend, drivers);
  assert.equal(result.raceId, "5625");
  assert.equal(result.state, "post");
  assert.equal(result.completedLaps, 247);
  assert.equal(result.results[0].grid, 2);
  assert.equal(result.results[0].lapsLed, 80);
  assert.equal(result.results[0].driver.image, drivers[0].image);
});

test("a different or stale live race/series cannot overwrite the selected race", () => {
  const active = { ...game, state: "in" as const };
  const unfinished = { ...race, inspection_complete: false };
  const detail = { weekend_race: [{ ...unfinished, results: [raceResult] }] };
  const live = {
    race_id: 5625,
    series_id: 1,
    run_type: 3,
    lap_number: 100,
    vehicles: [
      {
        driver: { driver_id: 4030, full_name: "Kyle Larson (C)" },
        vehicle_number: "5",
        running_position: 7,
        starting_position: 2,
        laps_completed: 100,
        laps_led: [{ start_lap: 80, end_lap: 84 }],
      },
    ],
  };
  assert.equal(parseNascarRace(active, unfinished, detail, drivers, live).results[0].position, 7);
  assert.equal(parseNascarRace(active, unfinished, detail, drivers, live).results[0].lapsLed, 5);
  for (const bad of [
    { ...live, race_id: 999 },
    { ...live, series_id: 2 },
    { ...live, run_type: 1 },
  ])
    assert.equal(parseNascarRace(active, unfinished, detail, drivers, bad).results[0].position, 1);
  assert.equal(parseNascarRace(game, race, weekend, drivers, live).results[0].position, 1);
});

test("upcoming races do not mistake scheduled actual_laps placeholder or practice for finished results", () => {
  const upcoming = { ...game, state: "pre" as const };
  const result = parseNascarRace(
    upcoming,
    { ...race, inspection_complete: false },
    {
      weekend_race: [{ ...race, inspection_complete: false }],
      weekend_runs: [
        { race_id: 5625, run_type: 1, results: [raceResult] },
        {
          race_id: 5625,
          run_type: 2,
          results: [
            {
              driver_id: 4030,
              driver_name: "Kyle Larson",
              finishing_position: 4,
            },
          ],
        },
      ],
    },
    drivers,
  );
  assert.equal(result.state, "pre");
  assert.equal(result.completedLaps, undefined);
  assert.equal(result.results[0].position, undefined);
  assert.equal(result.results[0].grid, 4);
});

test("career parser reads only published all-time table rows and keeps separate series", () => {
  const html = `<div aria-label="2026 SEASON Table"><div class="table-row"><div class="row-col year">1900</div></div></div><div aria-label="All-Time Career Table"><div class="table-row"><div class="row-col year">2025</div><div class="row-col series seriesId-1"></div><div class="row-col wins">3</div><div class="row-col poles">0</div></div><div class="table-row"><div class="row-col year">2025</div><div class="row-col series seriesId-2"></div><div class="row-col wins">2</div></div></div>`;
  const rows = parseNascarCareerHtml(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].season, 2025);
  assert.equal(rows[0].series, 1);
  assert.equal(rows[0].poles, 0);
  assert.equal(rows[1].wins, 2);
  assert.equal(parseNascarCareerHtml("403 Forbidden").length, 0);
  assert.equal(
    parseNascarCareerHtml(
      `<link rel="canonical" href="https://www.nascar.com/drivers/another-person">${html}`,
      "https://www.nascar.com/drivers/kyle-larson",
    ).length,
    0,
  );
});

test("race open is bounded, cached and falls back to verified schedule when weekend feed fails", async () => {
  const calls: string[] = [];
  const client = createNascarClient({
    json: async (url) => {
      calls.push(url);
      if (url.includes("race_list_basic")) return { series_1: [race] };
      if (url.includes("drivers-combined")) return driverData;
      throw new Error("weekend unavailable");
    },
    text: async () => "",
  });
  const signal = new AbortController().signal;
  const data = await client.loadNascarRace(game, signal);
  assert.equal(data?.name, "Enjoy Illinois 300");
  assert.equal(data?.partial, true);
  assert.equal(calls.length, 3);
  assert.strictEqual(await client.loadNascarRace(game, signal), data);
  assert.equal(calls.length, 3);
});

test("blocked career HTML retains actual season stats and legal official profile link", async () => {
  const client = createNascarClient({
    json: async (url) => (url.includes("points-feed") ? pointRows : driverData),
    text: async () => {
      throw new Error("403");
    },
  });
  const data = await client.loadNascarDriver("4030", 2026, 1, new AbortController().signal);
  assert.equal(data.standing?.wins, 1);
  assert.equal(data.career?.[0].season, 2026);
  assert.equal(data.career?.[0].wins, 1);
  assert.equal(data.partial, true);
  assert.equal(data.driver.url, "https://www.nascar.com/drivers/kyle-larson");
});

test("failed calendar reads can be retried immediately instead of caching a missing race", async () => {
  let calendarCalls = 0;
  const client = createNascarClient({
    json: async (url) => {
      if (url.includes("race_list_basic")) {
        if (++calendarCalls === 1) throw new Error("503");
        return { series_1: [race] };
      }
      if (url.includes("drivers-combined")) return driverData;
      return {};
    },
    text: async () => "",
  });
  const signal = new AbortController().signal;
  assert.equal(await client.loadNascarRace(game, signal), null);
  assert.equal((await client.loadNascarRace(game, signal))?.raceId, "5625");
  assert.equal(calendarCalls, 2);
});

test("shared in-flight requests keep running for remaining consumers and cancel final subscriber", async () => {
  let signal: AbortSignal | undefined;
  let count = 0;
  const client = createNascarClient({
    json: async (_url, abort) => {
      count++;
      signal = abort;
      return new Promise(() => {});
    },
    text: async () => "",
  });
  const a = new AbortController(),
    b = new AbortController();
  const first = client.loadNascarRace(game, a.signal),
    second = client.loadNascarRace(game, b.signal);
  a.abort();
  await assert.rejects(first, { name: "AbortError" });
  assert.equal(count, 2); // One calendar + one roster, shared by both event consumers.
  assert.equal(signal?.aborted, false);
  b.abort();
  await assert.rejects(second, { name: "AbortError" });
  assert.equal(signal?.aborted, true);
});
