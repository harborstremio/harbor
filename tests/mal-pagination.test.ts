// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { MAL_API_BASE } from "../src/lib/mal/config.ts";
import { resolveMalRequestUrl } from "../src/lib/mal/url.ts";

test("keeps absolute MyAnimeList pagination URLs intact", () => {
  const nextPage = `${MAL_API_BASE}/users/@me/animelist?offset=1000&limit=1000`;

  assert.equal(resolveMalRequestUrl(MAL_API_BASE, nextPage), nextPage);
});

test("prefixes relative MyAnimeList API paths", () => {
  assert.equal(
    resolveMalRequestUrl(MAL_API_BASE, "/users/@me/animelist?limit=1000"),
    `${MAL_API_BASE}/users/@me/animelist?limit=1000`,
  );
});
