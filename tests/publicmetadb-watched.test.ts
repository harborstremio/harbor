// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  fetchPmdbWatchedKeySet,
  invalidatePmdbWatchedCache,
  watchedItemMatchesTarget,
} from "../src/lib/publicmetadb/history.ts";
import {
  clearPmdbMappingsCache,
  extractImdbId,
  extractTmdbId,
  getImdbForTmdb,
  getTmdbForExternal,
} from "../src/lib/publicmetadb/mappings.ts";
import {
  clearPmdbWatchedPeek,
  normalizePmdbWatchedKeys,
  peekPmdbWatched,
  rememberPmdbWatched,
} from "../src/lib/publicmetadb/watched-keys.ts";
import { setSession } from "../src/lib/publicmetadb/session.ts";

function authed() {
  setSession({ apiKey: "pm-testkey", validatedAt: Date.now() });
}

function mockFetch(handler: (url: string) => Response | null, calls: string[]) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const mocked = handler(url);
    if (mocked) return mocked;
    return original(input);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("normalize converts PMDB shapes to Trakt shapes", () => {
  const out = normalizePmdbWatchedKeys(
    new Set([
      "tmdb:movie:550",
      "tmdb:tv:1399:1:2",
      "imdb:tt0903747:3:4",
      "imdb:tt0111161",
      "1:2",
      "",
      "tmdb:movie:oops",
    ]),
  );
  assert.ok(out.has("tmdb:550"));
  assert.ok(out.has("tmdb:1399"));
  assert.ok(out.has("tmdb:1399:1:2"));
  assert.ok(out.has("imdb:tt0903747:3:4"));
  assert.ok(out.has("imdb:tt0111161"));
  assert.ok(!out.has("1:2"));
  assert.ok(![...out].some((k) => k.includes("oops")));
});

test("watchedItemMatchesTarget scopes to the target show", () => {
  const target = { tmdb_id: 1399, media_type: "tv" as const };
  assert.equal(
    watchedItemMatchesTarget(
      { id: "a", tmdb_id: 1399, media_type: "tv", season: 1, episode: 2, watched_at: null },
      target,
    ),
    true,
  );
  assert.equal(
    watchedItemMatchesTarget(
      { id: "b", tmdb_id: 9999, media_type: "tv", season: 1, episode: 2, watched_at: null },
      target,
    ),
    false,
  );
  assert.equal(
    watchedItemMatchesTarget(
      { id: "c", tmdb_id: 1399, media_type: "tv", season: 1, episode: 2, watched_at: null },
      { tmdb_id: 1399, media_type: "tv", season: 2, episode: 1 },
    ),
    false,
  );
});

test("targeted fetch drops other shows (server ignores filter params)", async () => {
  localStorage.clear();
  authed();
  invalidatePmdbWatchedCache();
  const calls: string[] = [];
  const restore = mockFetch(
    (url) =>
      url.includes("/api/external/watched")
        ? json({
            items: [
              { id: "a", tmdb_id: 1399, media_type: "tv", season: 1, episode: 2, watched_at: null },
              { id: "b", tmdb_id: 9999, media_type: "tv", season: 1, episode: 2, watched_at: null },
            ],
            total: 2,
            page: 1,
            perPage: 100,
            totalPages: 1,
          })
        : null,
    calls,
  );
  try {
    const set = await fetchPmdbWatchedKeySet({ tmdb_id: 1399, media_type: "tv" });
    assert.ok(set.has("tmdb:tv:1399:1:2"));
    assert.ok(![...set].some((k) => k.includes("9999")));
  } finally {
    restore();
    setSession(null);
  }
});

test("id-only target resolves through mappings lookup", async () => {
  localStorage.clear();
  authed();
  invalidatePmdbWatchedCache();
  clearPmdbMappingsCache();
  const calls: string[] = [];
  const restore = mockFetch((url) => {
    if (url.includes("/api/external/mappings/lookup")) {
      return json({ results: [{ tmdb_id: 1399, media_type: "tv" }] });
    }
    if (url.includes("/api/external/watched")) {
      return json({
        items: [
          { id: "a", tmdb_id: 1399, media_type: "tv", season: 2, episode: 3, watched_at: null },
        ],
        total: 1,
        page: 1,
        perPage: 100,
        totalPages: 1,
      });
    }
    return null;
  }, calls);
  try {
    const set = await fetchPmdbWatchedKeySet({
      id_type: "imdb",
      id_value: "tt0903747",
      media_type: "tv",
    });
    assert.ok(set.has("tmdb:tv:1399:2:3"));
    assert.ok(set.has("imdb:tt0903747:2:3"));
  } finally {
    restore();
    setSession(null);
  }
});

test("unresolvable id-only target yields an empty set, not global history", async () => {
  localStorage.clear();
  authed();
  invalidatePmdbWatchedCache();
  clearPmdbMappingsCache();
  const calls: string[] = [];
  const restore = mockFetch(
    (url) => (url.includes("/api/external/mappings/lookup") ? json({ results: [] }) : null),
    calls,
  );
  try {
    const set = await fetchPmdbWatchedKeySet({
      id_type: "mal",
      id_value: "999999",
      media_type: "tv",
    });
    assert.equal(set.size, 0);
    assert.ok(!calls.some((u) => u.includes("/api/external/watched")));
  } finally {
    restore();
    setSession(null);
  }
});

test("mappings extractors handle documented and nested shapes", () => {
  assert.equal(extractImdbId({ mappings: { imdb_id: "tt0133093" } }), "tt0133093");
  assert.equal(extractImdbId([{ id_type: "imdb", id_value: "tt0133093" }]), "tt0133093");
  assert.equal(extractImdbId({ results: [{ imdb: "tt0133093" }] }), "tt0133093");
  assert.equal(extractImdbId({ mappings: { tvdb_id: 123 } }), null);
  assert.equal(extractImdbId({ note: "tt0133093 fan edit" }), null);
  assert.deepEqual(extractTmdbId({ results: [{ tmdb_id: 1399, media_type: "tv" }] }), {
    tmdb_id: 1399,
    media_type: "tv",
  });
  assert.deepEqual(extractTmdbId({ tmdb_id: "550", media_type: "movie" }), {
    tmdb_id: 550,
    media_type: "movie",
  });
  assert.equal(extractTmdbId({ results: [] }), null);
});

test("mappings cache 404s and avoids repeat lookups", async () => {
  localStorage.clear();
  authed();
  clearPmdbMappingsCache();
  const calls: string[] = [];
  const restore = mockFetch(
    (url) => (url.includes("/api/external/mappings") ? new Response("nope", { status: 404 }) : null),
    calls,
  );
  try {
    assert.equal(await getImdbForTmdb(1, "movie"), null);
    assert.equal(await getImdbForTmdb(1, "movie"), null);
    assert.equal(
      calls.filter((u) => u.includes("/api/external/mappings")).length,
      1,
    );
    assert.equal(await getTmdbForExternal("mal", "1"), null);
  } finally {
    restore();
    setSession(null);
  }
});

test("peek/remember round-trips within TTL and account", () => {
  localStorage.clear();
  authed();
  assert.equal(peekPmdbWatched().size, 0);
  rememberPmdbWatched(new Set(["tmdb:550"]));
  assert.ok(peekPmdbWatched().has("tmdb:550"));
  clearPmdbWatchedPeek();
  assert.equal(peekPmdbWatched().size, 0);
  setSession(null);
});
