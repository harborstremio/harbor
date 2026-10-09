import assert from "node:assert/strict";
import test from "node:test";
import { isTarkov, parseTarkovSeasons, parseTarkovWipes, tarkovRemaining, tarkovSeasonAt } from "../src/lib/games/tarkov-data.ts";
const season = { season: "1", start: "2026-08-02T00:00:00.000Z", end: "2026-12-07T00:00:00.000Z" };
const start = Date.parse(season.start), end = Date.parse(season.end);
test("exact Tarkov identity excludes Arena and similarly named games", () => {
  assert.equal(isTarkov({ igdbId: 15536 }), true);
  assert.equal(isTarkov({ igdbId: 203610 }), false);
  assert.equal(isTarkov({}), false);
});
test("season dates retain the community source's UTC boundaries, without inferring a reset", () => {
  const parsed = parseTarkovSeasons([season]);
  assert.deepEqual(parsed, [{ season: "1", start, end }]);
  assert.equal(tarkovSeasonAt(parsed, start - 1)?.kind, "upcoming");
  assert.equal(tarkovSeasonAt(parsed, start)?.kind, "active");
  assert.equal(tarkovSeasonAt(parsed, end - 1)?.kind, "active");
  assert.equal(tarkovSeasonAt(parsed, end), null);
  assert.equal(tarkovSeasonAt([], Date.now()), null);
});
test("source transitions select the next listed season; missing schedules are not extrapolated", () => {
  const second = { season: "2", start: "2026-12-10T00:00:00.000Z", end: "2027-05-01T00:00:00.000Z" };
  const parsed = parseTarkovSeasons([second, season]);
  assert.equal(tarkovSeasonAt(parsed, end)?.kind, "upcoming");
  assert.equal(tarkovSeasonAt(parsed, end)?.target, Date.parse(second.start));
  assert.equal(tarkovSeasonAt(parsed, Date.parse(second.end)), null);
});
test("malformed, overlapping, duplicated or unbounded schedules fail instead of producing a false clock", () => {
  for (const value of [{}, [null], [{ ...season, season: "<b>1</b>" }], [season, season], [{ ...season, end: season.start }], [{ ...season, start: "2026-02-30T00:00:00.000Z" }], [{ ...season, start: "2026-08-02" }], [season, { ...season, season: "2" }], Array(201).fill(season)]) assert.throws(() => parseTarkovSeasons(value));
});
test("wipe history remains separate, newest-first, with strict date and patch validation", () => {
  const wipes = parseTarkovWipes([{ name: "0.16.8.0", start: "2025-07-09T07:00:00.000Z" }, { name: "1.0.0.0", start: "2025-11-15T09:00:00.000Z" }]);
  assert.equal(wipes[0].name, "1.0.0.0");
  assert.throws(() => parseTarkovWipes([{ name: "1.0", start: season.start }, { name: "1.1", start: season.start }]));
  assert.throws(() => parseTarkovWipes([{ name: "1.0", start: "yesterday" }]));
  assert.deepEqual(parseTarkovWipes([]), []);
});
test("countdown has stable minute rounding and cannot become negative after expiry", () => {
  assert.deepEqual(tarkovRemaining(end, end - 86400000 - 2 * 3600000 - 3 * 60000), { days: 1, hours: 2, minutes: 3 });
  assert.deepEqual(tarkovRemaining(end, end - 1), { days: 0, hours: 0, minutes: 1 });
  assert.deepEqual(tarkovRemaining(end, end + 1), { days: 0, hours: 0, minutes: 0 });
});
