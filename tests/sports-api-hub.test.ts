import test from "node:test";
import assert from "node:assert/strict";
import { optionalApiHubSlice } from "../src/lib/sports/api-hub-leagues";
import type { SportsGame } from "../src/lib/sports/espn-types";
import { mergeSlices } from "../src/lib/sports/hub-cache";

const fixture = (id: string, state: SportsGame["state"] = "in"): SportsGame => ({
  id,
  league: "EGY",
  state,
  startMs: new Date(2026, 8, 14, 12).getTime(),
  detail: "",
  home: { id: "7", name: "Home", abbr: "", logo: "", score: "0", winner: false },
  away: { id: "8", name: "Away", abbr: "", logo: "", score: "0", winner: false },
});

test("paid hub aliases retain provider IDs and deduplicate UTC date overlap", async () => {
  const calls: string[] = [];
  const result = await optionalApiHubSlice(
    "EGYPT",
    "20260914",
    "day",
    new AbortController().signal,
    async (league, date) => {
      calls.push(`${league}:${date}`);
      return [fixture("123")];
    },
  );
  assert.ok(calls.every((call) => /^EGY:202609\d{2}$/.test(call)));
  assert.equal(result?.length, 1);
  assert.equal(result?.[0].league, "EGYPT");
  assert.equal(result?.[0].id, "123");
  assert.equal(result?.[0].source, "api-sports");
});
test("healthy empty differs from account failure; unsupported and upcoming do not spend requests", async () => {
  const signal = new AbortController().signal;
  assert.deepEqual(await optionalApiHubSlice("UAE", "20260914", "day", signal, async () => []), []);
  assert.equal(
    await optionalApiHubSlice("UAE", "20260914", "day", signal, async () => {
      throw Error("quota");
    }),
    null,
  );
  let calls = 0;
  for (const [league, mode] of [
    ["PLL", "day"],
    ["IPL", "day"],
    ["UAE", "upcoming"],
  ]) {
    assert.equal(
      await optionalApiHubSlice(league, "20260914", mode, signal, async () => {
        calls++;
        return [];
      }),
      null,
    );
  }
  assert.equal(calls, 0);
});
test("live mode excludes scheduled/final and cancellation cannot fall back", async () => {
  const controller = new AbortController();
  const result = await optionalApiHubSlice(
    "QATAR",
    "20260914",
    "live",
    controller.signal,
    async () => [fixture("1"), fixture("2", "pre"), fixture("3", "post")],
  );
  assert.deepEqual(
    result?.map((game) => game.id),
    ["1"],
  );
  controller.abort();
  await assert.rejects(
    optionalApiHubSlice("QATAR", "20260914", "day", controller.signal, async () => []),
    { name: "AbortError" },
  );
});
test("paid dated boards replace overlapping public upcoming league days without comparing provider IDs", () => {
  const paid = { ...fixture("123"), source: "api-sports" };
  const calendar = { ...fixture("987"), source: "thesportsdb-hub" };
  const tomorrow = { ...calendar, id: "988", startMs: calendar.startMs + 86400000 };
  assert.deepEqual(
    mergeSlices([
      { at: 1, games: [calendar, tomorrow] },
      { at: 2, games: [paid] },
    ]).map((game) => game.id),
    ["123", "988"],
  );
});
