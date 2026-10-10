import assert from "node:assert/strict";
import test from "node:test";
import {
  MOTORSPORT_LEAGUES,
  motorsportOfficialWebsite,
} from "../src/lib/sports/motorsport-catalog.ts";
import {
  createMotorsportScheduleCache,
  utcCalendarDates,
} from "../src/lib/sports/motorsport-schedule-cache.ts";

test("a selected local day includes both overlapping UTC calendar dates", () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = "America/Chicago";
    assert.deepEqual(utcCalendarDates("20260918"), ["2026-09-18", "2026-09-19"]);
    process.env.TZ = "Asia/Tokyo";
    assert.deepEqual(utcCalendarDates("20260918"), ["2026-09-17", "2026-09-18"]);
    process.env.TZ = "UTC";
    assert.deepEqual(utcCalendarDates("20260918"), ["2026-09-18"]);
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});

test("new motorsport schedules have distinct provider IDs and real image URLs", () => {
  assert.equal(new Set(MOTORSPORT_LEAGUES.map((l) => l.path)).size, MOTORSPORT_LEAGUES.length);
  for (const key of ["WRC", "MXGP", "SMX", "F2", "F3", "MOTOGP", "ARCA", "IMSA", "WEC"]) {
    const league = MOTORSPORT_LEAGUES.find((l) => l.key === key)!;
    assert.ok(league, key);
    assert.match(league.path, /^\d+$/);
    assert.match(
      league.logo,
      /^https:\/\/r2\.thesportsdb\.com\/images\/media\/league\/badge\/[\w]+\.png$/,
    );
    assert.match(motorsportOfficialWebsite(key)!, /^https:\/\//);
  }
  assert.equal(motorsportOfficialWebsite("UNKNOWN"), undefined);
});

test("concurrent calendar reads reuse cached responses and expired entries refresh", async () => {
  let time = 0,
    calls = 0;
  const request = createMotorsportScheduleCache(0, 1000, () => time);
  const signal = new AbortController().signal;
  const load = async () => {
    calls++;
    return { events: [{ idEvent: "1" }] };
  };
  const [a, b] = await Promise.all([request("one", signal, load), request("one", signal, load)]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  time = 1001;
  await request("one", signal, load);
  assert.equal(calls, 2);
});

test("cancelled queued calendars do not fetch and do not block the next request", async () => {
  const request = createMotorsportScheduleCache(0);
  const controller = new AbortController();
  let release!: () => void,
    calls = 0;
  const first = request("first", new AbortController().signal, async () => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return { events: [] };
  });
  await Promise.resolve();
  await Promise.resolve();
  const second = request("second", controller.signal, async () => {
    calls++;
    return { events: [] };
  });
  controller.abort();
  release();
  await first;
  await assert.rejects(second);
  await request("third", new AbortController().signal, async () => {
    calls++;
    return { events: [] };
  });
  assert.equal(calls, 1);
});

test("a provider rate limit pauses queued requests instead of a retry storm", async () => {
  let time = 0,
    calls = 0;
  const request = createMotorsportScheduleCache(0, 1000, () => time);
  const signal = new AbortController().signal;
  await assert.rejects(
    request("first", signal, async () => {
      throw new Error("Sports feed 429");
    }),
  );
  await assert.rejects(
    request("second", signal, async () => {
      calls++;
      return { events: [] };
    }),
  );
  assert.equal(calls, 0);
  time = 60_001;
  await request("second", signal, async () => {
    calls++;
    return { events: [] };
  });
  assert.equal(calls, 1);
});

test("malformed calendar responses are not cached", async () => {
  const request = createMotorsportScheduleCache(0);
  const signal = new AbortController().signal;
  await assert.rejects(request("one", signal, async () => ({ error: "Unavailable" })));
  const result = await request("one", signal, async () => ({ events: null }));
  assert.equal(result.events, null);
});
