import assert from "node:assert/strict";
import { test } from "node:test";
import { isSpooktoberSeason, nextSpooktoberDateCheck } from "../src/lib/spooktober-season.ts";

test("Spooktober opens early only in 2026, then every October", () => {
  assert.equal(isSpooktoberSeason(new Date(2026, 8, 27, 23, 59)), false);
  assert.equal(isSpooktoberSeason(new Date(2026, 8, 28)), true);
  for (const year of [2026, 2027, 2028, 2030]) {
    assert.equal(isSpooktoberSeason(new Date(year, 9, 1)), true);
    assert.equal(isSpooktoberSeason(new Date(year, 9, 31, 23, 59, 59)), true);
    assert.equal(isSpooktoberSeason(new Date(year, 10, 1)), false);
    assert.equal(isSpooktoberSeason(new Date(year, 0, 1)), false);
    if (year !== 2026) assert.equal(isSpooktoberSeason(new Date(year, 8, 28)), false);
  }
});
test("Rechecks at local midnight without a persistent test override", () => {
  assert.equal(nextSpooktoberDateCheck(new Date(2026, 8, 30, 23, 59, 58)), 2100);
  assert.ok(nextSpooktoberDateCheck(new Date(2026, 8, 28, 12)) <= 24 * 60 * 60 * 1000 + 100);
});
