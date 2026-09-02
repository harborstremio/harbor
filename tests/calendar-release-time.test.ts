// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { localDateTimeFromIso } from "../src/lib/calendar-time.ts";

test("calendar timestamps retain their exact release instant", () => {
  const iso = "2026-08-31T18:30:00Z";
  const result = localDateTimeFromIso(iso);
  assert.equal(result.atMs, Date.parse(iso));
  assert.match(result.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(result.time ?? "", /^\d{1,2}:\d{2} (AM|PM)$/);
});

test("AniZip calendar entries prefer the UTC timestamp over the date-only fallback", () => {
  const source = readFileSync(new URL("../src/lib/calendar-library.ts", import.meta.url), "utf8");
  assert.match(source, /localDateTimeFromIso\(ep\.airDateUtc \?\? ep\.airDate\)/);
});
