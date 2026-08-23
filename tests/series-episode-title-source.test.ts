// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const seriesEpisodesSource = readFileSync(
  new URL("../src/lib/series-episodes.ts", import.meta.url),
  "utf8",
);

test("addon and Cinemeta conversions use placeholder-aware title precedence", () => {
  const selections = seriesEpisodesSource.match(
    /name:\s*pickPreferredEpisodeTitle\(episode, v\.title, v\.name\) \?\? undefined/g,
  );

  assert.equal(selections?.length, 2);
  assert.doesNotMatch(seriesEpisodesSource, /name:\s*v\.title \|\| v\.name/);
});
