import assert from "node:assert/strict";
import test from "node:test";
import {
  createTeamProviderTransport,
  readSportsDbTeamSchedule,
} from "../src/lib/sports/team-provider.ts";

const event = {
  idEvent: "2561116",
  idLeague: "4829",
  idHomeTeam: "138995",
  idAwayTeam: "156496",
  strEvent: "Al Ahly vs Abou Qir Fertilizers",
  dateEvent: "2026-09-15",
};

test("numeric team schedules accept both free response envelopes and reject mismatched provider IDs", async () => {
  const calls: string[] = [];
  const result = await readSportsDbTeamSchedule({ path: "4829" }, "138995", async (url) => {
    calls.push(url);
    return url.includes("eventsnext")
      ? {
          events: [
            event,
            { ...event, idEvent: "badLeague", idLeague: "4396" },
            { ...event, idEvent: "badTeam", idHomeTeam: "133607" },
          ],
        }
      : { results: [event, { ...event, idEvent: "2561096", strEvent: "Al Ahly vs Smouha" }] };
  });
  assert.deepEqual(
    result.map((row) => row.idEvent),
    ["2561116", "2561096"],
  );
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      (url) => url.startsWith("https://www.thesportsdb.com/") && url.endsWith("id=138995"),
    ),
  );
});

test("failed next feed preserves actual last results; invalid ESPN/path IDs issue no TSDB request", async () => {
  const result = await readSportsDbTeamSchedule({ path: "4829" }, "138995", async (url) => {
    if (url.includes("eventsnext")) throw new Error("rate limited");
    return { results: [event] };
  });
  assert.equal(result.length, 1);
  const never = async () => {
    throw new Error("Must not fetch");
  };
  assert.deepEqual(await readSportsDbTeamSchedule({ path: "soccer/eng.1" }, "138995", never), []);
  assert.deepEqual(await readSportsDbTeamSchedule({ path: "4829" }, "bad/id", never), []);
});

test("paced provider releases a stalled body on timeout and honors queued cancellation", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let bodySignal: AbortSignal | undefined;
  const transport = createTeamProviderTransport(
    async (_url, signal) => {
      calls++;
      bodySignal = signal;
      return new Promise(() => {});
    },
    0,
    100,
  );
  const controller = new AbortController();
  const first = transport("https://www.thesportsdb.com/first", new AbortController().signal);
  const second = transport("https://www.thesportsdb.com/second", controller.signal);
  const firstRejected = assert.rejects(first, { name: "TimeoutError" });
  const secondRejected = assert.rejects(second, { name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  t.mock.timers.tick(100);
  await Promise.all([firstRejected, secondRejected]);
  assert.equal(bodySignal?.aborted, true);
  assert.equal(calls, 1);
});

test("429 pauses later requests without issuing a retry storm", async () => {
  let calls = 0;
  const transport = createTeamProviderTransport(async () => {
    calls++;
    throw new Error("HTTP429");
  }, 0);
  await assert.rejects(
    transport("https://www.thesportsdb.com/first", new AbortController().signal),
  );
  await assert.rejects(
    transport("https://www.thesportsdb.com/second", new AbortController().signal),
    /rate limited/,
  );
  assert.equal(calls, 1);
});
