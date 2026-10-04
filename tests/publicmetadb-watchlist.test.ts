// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  addToPmdbWatchlist,
  clearPmdbWatchlistCache,
  fetchPmdbWatchlist,
  pmdbWatchlistContains,
  pmdbWatchlistItemToMeta,
  removeFromPmdbWatchlist,
} from "../src/lib/publicmetadb/watchlist.ts";
import { setSession } from "../src/lib/publicmetadb/session.ts";

function authed() {
  setSession({ apiKey: "pm-testkey", validatedAt: Date.now() });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | null) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const mocked = handler(String(input), init);
    if (mocked) return mocked;
    return original(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function item(id: string, tmdb: number, media: string) {
  return { id, list_id: "wl", tmdb_id: tmdb, media_type: media };
}

test("fetch paginates list items and caches the watchlist id", async () => {
  localStorage.clear();
  authed();
  clearPmdbWatchlistCache();
  let listsHits = 0;
  const page1 = Array.from({ length: 100 }, (_, i) => item(`p1-${i}`, 1000 + i, "movie"));
  const restore = mockFetch((url) => {
    if (url.includes("/api/external/lists") && !url.includes("/items")) {
      listsHits += 1;
      return json({ items: [{ id: "wl", type: "watchlist" }] });
    }
    if (url.includes("/items?page=1") || (url.includes("/items") && !url.includes("page=2"))) {
      return json({ items: page1, total: 101 });
    }
    if (url.includes("page=2")) {
      return json({ items: [item("p2-0", 2000, "tv")], total: 101 });
    }
    return null;
  });
  try {
    const items = await fetchPmdbWatchlist();
    assert.equal(items.length, 101);
    await fetchPmdbWatchlist();
    assert.equal(listsHits, 1);
  } finally {
    restore();
    setSession(null);
  }
});

test("add posts tmdb_id and media_type only", async () => {
  localStorage.clear();
  authed();
  clearPmdbWatchlistCache();
  let body: unknown = null;
  const restore = mockFetch((url, init) => {
    if (url.includes("/api/external/lists") && !url.includes("/items")) {
      return json({ items: [{ id: "wl", type: "watchlist" }] });
    }
    if (url.includes("/items") && init?.method === "POST") {
      body = JSON.parse(String(init.body));
      return json({ success: true });
    }
    return null;
  });
  try {
    // ID-only targets are rejected client-side: the server requires tmdb_id.
    assert.equal(
      await addToPmdbWatchlist({ id_type: "imdb", id_value: "tt0133093", media_type: "movie" }),
      false,
    );
    assert.equal(await addToPmdbWatchlist({ tmdb_id: 603, media_type: "movie" }), true);
    assert.deepEqual(body, { tmdb_id: 603, media_type: "movie" });
  } finally {
    restore();
    setSession(null);
  }
});

test("remove deletes the matching item id", async () => {
  localStorage.clear();
  authed();
  clearPmdbWatchlistCache();
  let deleted: string | null = null;
  const restore = mockFetch((url, init) => {
    if (url.includes("/api/external/lists") && !url.includes("/items")) {
      return json({ items: [{ id: "wl", type: "watchlist" }] });
    }
    if (url.includes("/items") && (!init || init.method === "GET")) {
      return json({ items: [item("abc", 603, "movie"), item("def", 604, "movie")], total: 2 });
    }
    if (url.includes("/items/") && init?.method === "DELETE") {
      deleted = url;
      return json({ success: true });
    }
    return null;
  });
  try {
    assert.equal(await removeFromPmdbWatchlist({ tmdb_id: 603, media_type: "movie" }), true);
    assert.ok(deleted?.endsWith("/items/abc"));
  } finally {
    restore();
    setSession(null);
  }
});

test("contains matches on tmdb id and media type", () => {
  const items = [item("a", 603, "movie")];
  assert.ok(pmdbWatchlistContains(items, { tmdb_id: 603, media_type: "movie" }));
  assert.equal(pmdbWatchlistContains(items, { tmdb_id: 603, media_type: "tv" }), null);
  assert.equal(pmdbWatchlistContains(items, { tmdb_id: 604, media_type: "movie" }), null);
  assert.equal(
    pmdbWatchlistContains(items, { id_type: "imdb", id_value: "x", media_type: "movie" }),
    null,
  );
});

test("item to meta maps ids, titles, and poster shapes", () => {
  const movie = pmdbWatchlistItemToMeta({
    id: "1",
    list_id: "wl",
    tmdb_id: 603,
    media_type: "movie",
    title: "The Matrix",
    poster: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    year: 1999,
    created: "2026-01-01",
  });
  assert.deepEqual(movie, {
    id: "tmdb:movie:603",
    type: "movie",
    name: "The Matrix",
    releaseInfo: "1999",
    poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  });

  const show = pmdbWatchlistItemToMeta({
    id: "2",
    list_id: "wl",
    tmdb_id: 1399,
    media_type: "tv",
    title: "GOT",
    poster: "https://cdn.example.com/p.jpg",
    created: "2026-01-01",
  });
  assert.equal(show?.id, "tmdb:tv:1399");
  assert.equal(show?.type, "series");
  assert.equal(show?.poster, "https://cdn.example.com/p.jpg");

  assert.equal(
    pmdbWatchlistItemToMeta({ id: "3", list_id: "wl", media_type: "movie", created: "" })?.id,
    undefined,
  );
  assert.equal(
    pmdbWatchlistItemToMeta({
      id: "4",
      list_id: "wl",
      tmdb_id: 603,
      media_type: "movie",
      created: "",
    })?.poster,
    undefined,
  );
});
