// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { resolveMalRequestUrl } from "../src/lib/mal/url.ts";

const MAL_API_BASE = "https://api.myanimelist.net/v2";

test("the constant this file hardcodes still matches the app", () => {
  const config = readFileSync(new URL("../src/lib/mal/config.ts", import.meta.url), "utf8");
  assert.match(config, new RegExp(`MAL_API_BASE = "${MAL_API_BASE}"`));
});

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

test("the paginating client actually uses the resolver on both attempts", () => {
  const client = readFileSync(new URL("../src/lib/mal/client.ts", import.meta.url), "utf8");
  assert.match(client, /const requestUrl = resolveMalRequestUrl\(MAL_API_BASE, path\);/);
  assert.equal(client.match(/tauriFetch\(requestUrl,/g)?.length, 2);
  assert.doesNotMatch(client, /tauriFetch\(`\$\{MAL_API_BASE\}\$\{path\}`/);
});

test("the list loop still feeds paging.next straight back in", () => {
  const lists = readFileSync(new URL("../src/lib/mal/lists.ts", import.meta.url), "utf8");
  assert.match(lists, /cursor = data\.paging\?\.next \?\? null;/);
  assert.match(lists, /await malRequest\(cursor\)/);
});
