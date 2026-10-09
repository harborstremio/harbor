import test from "node:test";
import assert from "node:assert/strict";
import { isRecentRelease } from "../src/lib/music/release-recency.ts";

test("Just released accepts only valid, released dates in the last 30 calendar days", () => {
  const now = Date.parse("2026-09-29T15:00:00Z");
  for (const date of ["2026-09-29", "2026-09-01", "2026-08-31"]) assert.equal(isRecentRelease(date, now), true);
  for (const date of ["2026-08-30", "2026-09-30", "2025-09-29", "2026-02-30", "2026", "", undefined]) {
    assert.equal(isRecentRelease(date, now), false, String(date));
  }
  assert.equal(isRecentRelease("2026-08-31", Date.parse("2026-09-30T00:00:00Z")), false);
});
