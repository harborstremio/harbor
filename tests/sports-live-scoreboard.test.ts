import assert from "node:assert/strict";
import test from "node:test";
import { fetchLiveScoreboardEvents } from "../src/lib/sports/live-scoreboard.ts";

const endpoint = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
const range = "20260912-20260914";
const days = ["20260912", "20260913", "20260914"];
const cap = Array.from({ length: 1000 }, (_, i) => ({ id: `range-${i}` }));
const signal = () => new AbortController().signal;

test("a range is read one UTC day at a time at the supported 1000 limit, never as a date range", async () => {
  for (const events of [[], [{ id: "live", state: "in" }]]) {
    const dates: string[] = [];
    const actual = await fetchLiveScoreboardEvents(endpoint, range, signal(), async (target) => {
      const url = new URL(target);
      assert.equal(url.searchParams.get("limit"), "1000");
      dates.push(url.searchParams.get("dates")!);
      return { events };
    });
    assert.deepEqual(dates, days);
    assert.ok(dates.every((day) => !day.includes("-")));
    assert.deepEqual(
      actual.map((event) => event.id),
      events.map((event) => event.id),
    );
    if (events.length) assert.equal(actual[0].state, "in");
  }
});

test("days are read sequentially and later live matches win for shared event IDs", async () => {
  const dates: string[] = [];
  let active = 0,
    peak = 0;
  const result = await fetchLiveScoreboardEvents(endpoint, range, signal(), async (target) => {
    peak = Math.max(peak, ++active);
    const day = new URL(target).searchParams.get("dates")!;
    dates.push(day);
    await Promise.resolve();
    active--;
    return {
      events: [
        { id: "shared", day },
        { id: day, state: day === "20260914" ? "in" : "post" },
      ],
    };
  });
  assert.deepEqual(dates, days);
  assert.equal(peak, 1);
  assert.equal(result.length, 4);
  assert.equal(result.find((event) => event.id === "20260914")?.state, "in");
  assert.equal(result.find((event) => event.id === "shared")?.day, "20260914");
});

test("duplicate tournament events retain distinct draw competitions across split dates", async () => {
  const result = await fetchLiveScoreboardEvents(
    endpoint,
    "20260913-20260914",
    signal(),
    async (target) => {
      const dates = new URL(target).searchParams.get("dates");
      return {
        events: [
          {
            id: "tournament",
            groupings: [
              {
                grouping: { displayName: "Men's Singles" },
                competitions: [{ id: dates, status: { type: { state: "in" } } }],
              },
            ],
          },
        ],
      };
    },
  );
  assert.equal(result.length, 1);
  assert.equal(
    (result[0].groupings as Array<{ competitions: unknown[] }>)[0].competitions.length,
    2,
  );
});

test("a capped day throws instead of reporting complete or empty live coverage", async () => {
  let calls = 0;
  await assert.rejects(
    fetchLiveScoreboardEvents(endpoint, range, signal(), async () => {
      calls++;
      return { events: cap };
    }),
    /coverage is incomplete/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    fetchLiveScoreboardEvents(endpoint, "20260913", signal(), async () => {
      calls++;
      return { events: cap };
    }),
    /coverage is incomplete/,
  );
  assert.equal(calls, 1);
});

test("a failing day and invalid envelopes propagate without publishing partial success", async () => {
  let calls = 0;
  await assert.rejects(
    fetchLiveScoreboardEvents(endpoint, range, signal(), async () => {
      calls++;
      if (calls === 1) return { events: [{ id: "live" }] };
      throw new Error("HTTP503");
    }),
    /HTTP503/,
  );
  assert.equal(calls, 2);
  for (const bad of [{}, { events: null }, { events: [{}] }]) {
    await assert.rejects(
      fetchLiveScoreboardEvents(endpoint, range, signal(), async () => bad),
      /Invalid live scoreboard response/,
    );
  }
});

test("abort stops the remaining days and wide or invalid ranges never create fanout", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    fetchLiveScoreboardEvents(endpoint, range, controller.signal, async () => {
      calls++;
      controller.abort();
      return { events: [] };
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
  for (const invalid of ["20260912-20260916", "20260230", "20260914-20260912", "all"]) {
    await assert.rejects(
      fetchLiveScoreboardEvents(endpoint, invalid, signal(), async () => {
        throw new Error("Should never reach transport");
      }),
      /Invalid live scoreboard|too wide/,
    );
  }
});
