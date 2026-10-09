import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnimeCatalogClient, catalogRetryDelay, ANIME_CATALOG_BASE, ANIME_CATALOG_FALLBACK } from "../src/lib/providers/anime-catalog-client.ts";
import { createBrowseCache } from "../src/lib/anilist/browse-cache.ts";
import { AnilistApiError } from "../src/lib/anilist/errors.ts";

const json = (data: unknown) => Response.json({ data });
const meta = { id: "mal:1", type: "series" as const, name: "Cowboy Bebop" };

test("catalog shares concurrent requests and never sends account credentials", async () => {
  const calls: string[] = [];
  const client = createAnimeCatalogClient({ intervalMs: 0, fetch: async (url, options) => {
    calls.push(String(url));
    assert.equal(options?.credentials, "omit");
    assert.equal(new Headers(options?.headers).get("authorization"), null);
    return json([{ mal_id: 1 }]);
  } });
  const [a, b] = await Promise.all([client("/seasons/now?sfw=true"), client("/seasons/now?sfw=true")]);
  assert.deepEqual(a, b);
  assert.deepEqual(calls, [`${ANIME_CATALOG_BASE}/seasons/now?sfw=true`]);
});

test("catalog supports detail and recommendation shapes without rewriting MAL identifiers", async () => {
  const client = createAnimeCatalogClient({ intervalMs: 0, fetch: async url => json(String(url).endsWith("recommendations") ? [{ entry: { mal_id: 205 }, votes: 10 }] : { mal_id: 1, score: 8.75 }) });
  assert.deepEqual(await client("/anime/1"), { data: { mal_id: 1, score: 8.75 } });
  assert.deepEqual(await client("/anime/1/recommendations"), { data: [{ entry: { mal_id: 205 }, votes: 10 }] });
});

test("429 uses fallback immediately, honors Retry-After, then returns to primary", async () => {
  let time = 0, calls = 0;
  const starts: [string, number][] = [];
  const client = createAnimeCatalogClient({ now: () => time, sleep: async ms => { time += ms; }, fetch: async url => {
    starts.push([new URL(String(url)).host, time]);
    return ++calls === 1 ? new Response("busy", { status: 429, headers: { "retry-after": "2" } }) : json([]);
  } });
  await Promise.all([client("/top/anime"), client("/seasons/now")]);
  assert.deepEqual(starts, [["api.tenrai.org", 0], ["jikanfortheweebs.midnightignite.me", 0], ["jikanfortheweebs.midnightignite.me", 1100]]);
  time = 2000;
  await client("/top/anime");
  assert.deepEqual(starts.at(-1), ["api.tenrai.org", 2000]);
  assert.equal(catalogRetryDelay("Thu, 01 Jan 1970 00:00:05 GMT", 1000), 4000);
  assert.equal(catalogRetryDelay("invalid", 0), 2000);
});

test("a failed or malformed response does not poison the queue or prevent retry", async () => {
  let calls = 0;
  const client = createAnimeCatalogClient({ intervalMs: 0, fallbackIntervalMs: 0, cooldownMs: 0, fetch: async () => {
    calls++;
    if (calls === 1) return new Response("down", { status: 500 });
    if (calls === 2) return Response.json({ error: "missing data" });
    return json([meta]);
  } });
  await assert.rejects(client("/top/anime"), /Invalid anime catalog/);
  assert.deepEqual(await client("/top/anime"), { data: [meta] });
});

test("network timeout starts after queue wait and releases the queue after abort", async () => {
  let calls = 0;
  const client = createAnimeCatalogClient({ intervalMs: 35, fallbackIntervalMs: 35, timeoutMs: 15, fetch: async (_url, options) => {
    calls++;
    assert.equal(options?.signal?.aborted, false);
    if (calls !== 1) return json({ mal_id: calls });
    return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  } });
  const hung = client("/anime/1");
  const queued = client("/anime/2");
  assert.deepEqual(await hung, { data: { mal_id: 2 } });
  assert.deepEqual(await queued, { data: { mal_id: 3 } });
});

test("fallback uses its own transport with unchanged queries and MAL IDs", async () => {
  const urls: string[] = [];
  const client = createAnimeCatalogClient({ fallbackIntervalMs: 0,
    fetch: async () => new Response("offline", { status: 503 }),
    fallbackFetch: async (url, init) => {
      urls.push(String(url));
      assert.equal(init?.credentials, "omit");
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      return json([{ mal_id: 21 }]);
    },
  });
  assert.deepEqual(await client("/top/anime?filter=airing&sfw=true"), { data: [{ mal_id: 21 }] });
  assert.deepEqual(urls, [`${ANIME_CATALOG_FALLBACK}/top/anime?filter=airing&sfw=true`]);
});

test("both providers failing rejects promptly and recovers after cooldown", async () => {
  let time = 0, calls = 0, failed = true;
  const client = createAnimeCatalogClient({ now: () => time, sleep: async ms => { time += ms; }, fetch: async () => {
    calls++;
    if (failed) throw new Error("offline");
    return json([]);
  } });
  await assert.rejects(client("/top/anime"), /offline/);
  await assert.rejects(client("/seasons/now"), /offline/);
  assert.equal(calls, 2);
  time = 60000; failed = false;
  assert.deepEqual(await client("/top/anime"), { data: [] });
  assert.equal(calls, 3);
});

test("a missing title does not disable unrelated discovery requests", async () => {
  const calls: string[] = [];
  const client = createAnimeCatalogClient({ intervalMs: 0, fetch: async url => {
    calls.push(String(url));
    return String(url).includes("/anime/999999") ? new Response("missing", { status: 404 }) : json([]);
  } });
  await assert.rejects(client("/anime/999999"), /HTTP 404/);
  await client("/seasons/now");
  assert.equal(calls.at(-1), `${ANIME_CATALOG_BASE}/seasons/now`);
});

test("catalog rejects unrelated destinations", async () => {
  const client = createAnimeCatalogClient({ fetch: async () => { throw new Error("should not fetch"); } });
  await assert.rejects(client("https://example.com"), /Invalid anime catalog path/);
  await assert.rejects(client("/anime/../users"), /Invalid anime catalog path/);
});

test("AniList retries after both failed and empty discovery responses", async () => {
  let calls = 0;
  const cache = createBrowseCache(async () => {
    if (++calls === 1) throw new Error("offline");
    return calls === 2 ? [] : [meta];
  });
  await assert.rejects(cache.load("top"), /offline/);
  await assert.rejects(cache.load("top"), /Empty AniList/);
  assert.deepEqual(await cache.load("top"), [meta]);
  assert.equal(calls, 3);
});

test("AniList shares in-flight work, expires successful data, and keeps cached cards on failure", async () => {
  let time = 0, calls = 0;
  const cache = createBrowseCache(async () => {
    if (++calls === 2) throw new Error("offline");
    return [meta];
  }, () => time);
  await Promise.all([cache.load("trending"), cache.load("trending")]);
  await cache.load("trending");
  assert.equal(calls, 1);
  time = 300_001;
  await assert.rejects(cache.load("trending"), /offline/);
  assert.deepEqual(cache.peek("trending"), [meta]);
  assert.deepEqual(await cache.load("trending"), [meta]);
  assert.equal(calls, 3);
});

test("AniList recognizes actual invalid-token responses without logging out on other errors", () => {
  assert.equal(new AnilistApiError(400, JSON.stringify({ errors: [{ message: "Invalid token", status: 400 }] })).isAuthenticationError, true);
  assert.equal(new AnilistApiError(401, "").isAuthenticationError, true);
  assert.equal(new AnilistApiError(200, "Invalid token").isAuthenticationError, true);
  assert.equal(new AnilistApiError(400, '{"errors":[{"message":"Unknown argument page"}]}').isAuthenticationError, false);
  assert.equal(new AnilistApiError(429, "Too many requests").isAuthenticationError, false);
  assert.equal(new AnilistApiError(500, "Invalid token").isAuthenticationError, false);
});
