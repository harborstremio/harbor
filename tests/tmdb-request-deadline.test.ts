import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientSource = readFileSync(
  new URL("../src/lib/providers/tmdb/tmdb-client.ts", import.meta.url),
  "utf8",
);

const helperStart = clientSource.indexOf("function runWithDeadline");
const onceStart = clientSource.indexOf("function fetchTmdbOnce");
const onceEnd = clientSource.indexOf("export async function get");
const fetchOnce = clientSource.slice(onceStart, onceEnd);

test("the TMDB request deadline covers the response body, not only the headers", () => {
  assert.ok(helperStart >= 0);
  assert.ok(onceStart > helperStart);
  assert.ok(onceEnd > onceStart);
  const deadline = fetchOnce.indexOf("runWithDeadline");
  assert.ok(deadline >= 0);
  assert.ok(fetchOnce.indexOf("safeFetch(") > deadline);
  assert.ok(fetchOnce.indexOf("readJsonBody(") > deadline);
  assert.ok(fetchOnce.lastIndexOf("readJsonBody(") > deadline);
});

test("the TMDB transport keeps one deadline and never releases it at the headers", () => {
  assert.doesNotMatch(clientSource, /tmdbHttpFetch/u);
  assert.equal(clientSource.match(/clearTimeout/gu)?.length, 1);
  assert.equal(clientSource.match(/runWithDeadline/gu)?.length, 2);
});

test("the deadline settles on its own timer rather than relying on abort propagation", () => {
  const helper = clientSource.slice(helperStart, onceStart);
  assert.match(helper, /controller\.abort\(\)/u);
  assert.match(helper, /reject\(new Error\("tmdb-timeout"\)\)/u);
  assert.match(helper, /let settled = false;/u);
});
