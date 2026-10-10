// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  resolvePmdbEpisodeTarget,
  resolvePmdbTarget,
  stremioIdToPmdbTarget,
} from "../src/lib/publicmetadb/ids.ts";
import {
  getSession,
  setSession,
  updateSessionUsername,
} from "../src/lib/publicmetadb/session.ts";

test("stremioIdToPmdbTarget resolves TMDB movie IDs", () => {
  assert.deepEqual(stremioIdToPmdbTarget("tmdb:movie:550", undefined, "movie"), {
    tmdb_id: 550,
    media_type: "movie",
  });
});

test("stremioIdToPmdbTarget resolves TMDB TV show and episode IDs", () => {
  assert.deepEqual(stremioIdToPmdbTarget("tmdb:tv:1399", undefined, "series"), {
    tmdb_id: 1399,
    media_type: "tv",
  });

  assert.deepEqual(
    stremioIdToPmdbTarget("tmdb:tv:1399", { season: 1, episode: 1 }, "series"),
    {
      tmdb_id: 1399,
      media_type: "tv",
      season: 1,
      episode: 1,
    },
  );

  assert.deepEqual(stremioIdToPmdbTarget("tmdb:tv:1399:2:5"), {
    tmdb_id: 1399,
    media_type: "tv",
    season: 2,
    episode: 5,
  });
});

test("stremioIdToPmdbTarget resolves IMDb IDs for movies and series", () => {
  assert.deepEqual(stremioIdToPmdbTarget("tt0111161", undefined, "movie"), {
    id_type: "imdb",
    id_value: "tt0111161",
    media_type: "movie",
  });

  assert.deepEqual(stremioIdToPmdbTarget("tt0903747", undefined, "series"), {
    id_type: "imdb",
    id_value: "tt0903747",
    media_type: "tv",
  });

  assert.deepEqual(
    stremioIdToPmdbTarget("tt0903747", { season: 2, episode: 4 }, "series"),
    {
      id_type: "imdb",
      id_value: "tt0903747",
      media_type: "tv",
      season: 2,
      episode: 4,
    },
  );

  assert.deepEqual(stremioIdToPmdbTarget("tt0903747:1:1"), {
    id_type: "imdb",
    id_value: "tt0903747",
    media_type: "tv",
    season: 1,
    episode: 1,
  });
});

test("stremioIdToPmdbTarget resolves MAL and AniList targets", () => {
  assert.deepEqual(stremioIdToPmdbTarget("mal:21", { season: 1, episode: 5 }, "series"), {
    id_type: "mal",
    id_value: "21",
    media_type: "tv",
    season: 1,
    episode: 5,
  });

  assert.deepEqual(stremioIdToPmdbTarget("mal:5114", undefined, "movie"), {
    id_type: "mal",
    id_value: "5114",
    media_type: "movie",
  });

  assert.deepEqual(stremioIdToPmdbTarget("anilist:123", { season: 1, episode: 2 }, "series"), {
    id_type: "anilist",
    id_value: "123",
    media_type: "tv",
    season: 1,
    episode: 2,
  });
});

test("stremioIdToPmdbTarget returns null for invalid or unhandled IDs", () => {
  assert.equal(stremioIdToPmdbTarget(""), null);
  assert.equal(stremioIdToPmdbTarget("unknown:123"), null);
  assert.equal(stremioIdToPmdbTarget("tt_invalid"), null);
});

function stubOfflineAniZip() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("api.ani.zip/mappings")) {
      return new Response("not found", { status: 404 });
    }
    return originalFetch(input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("resolvePmdbEpisodeTarget resolves direct TMDB, IMDb, and MAL episodes", async () => {
  const restore = stubOfflineAniZip();
  try {
    assert.deepEqual(
      await resolvePmdbEpisodeTarget("tmdb:tv:1399", { season: 1, episode: 1 }),
      {
        tmdb_id: 1399,
        media_type: "tv",
        season: 1,
        episode: 1,
      },
    );

    assert.deepEqual(
      await resolvePmdbEpisodeTarget("tt0903747", { season: 3, episode: 2 }),
      {
        id_type: "imdb",
        id_value: "tt0903747",
        media_type: "tv",
        season: 3,
        episode: 2,
      },
    );

    assert.deepEqual(
      await resolvePmdbEpisodeTarget("mal:21", { season: 1, episode: 7 }),
      {
        id_type: "mal",
        id_value: "21",
        media_type: "tv",
        season: 1,
        episode: 7,
      },
    );
  } finally {
    restore();
  }
});

test("resolvePmdbEpisodeTarget prefers verified IMDb identity when provided", async () => {
  const restore = stubOfflineAniZip();
  try {
    assert.deepEqual(
      await resolvePmdbEpisodeTarget(
        "kitsu:1",
        { season: 1, episode: 14, imdbSeason: 2, imdbEpisode: 3 },
        "tt1234567",
      ),
      {
        id_type: "imdb",
        id_value: "tt1234567",
        media_type: "tv",
        season: 2,
        episode: 3,
      },
    );
  } finally {
    restore();
  }
});

test("resolvePmdbTarget resolves movies and series", async () => {
  const restore = stubOfflineAniZip();
  try {
    assert.deepEqual(await resolvePmdbTarget("tmdb:movie:603", "movie"), {
      tmdb_id: 603,
      media_type: "movie",
    });

    assert.deepEqual(await resolvePmdbTarget("tt0133093", "movie"), {
      id_type: "imdb",
      id_value: "tt0133093",
      media_type: "movie",
    });

    assert.deepEqual(await resolvePmdbTarget("mal:21", "series"), {
      id_type: "mal",
      id_value: "21",
      media_type: "tv",
    });
  } finally {
    restore();
  }
});

test("PmdbSession preserves and updates username", () => {
  setSession({
    apiKey: "pm-testkey123",
    username: "alice",
    validatedAt: 123456,
  });

  assert.equal(getSession()?.username, "alice");
  assert.equal(getSession()?.apiKey, "pm-testkey123");

  updateSessionUsername("bob");
  assert.equal(getSession()?.username, "bob");

  updateSessionUsername("");
  assert.equal(getSession()?.username, undefined);

  setSession(null);
  assert.equal(getSession(), null);
});

test("resolvePmdbEpisodeTarget maps anime cour episodes to canonical TMDB series coordinates via AniZip", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.ani.zip/mappings")) {
      return new Response(
        JSON.stringify({
          mappings: {
            kitsu_id: 45619,
            mal_id: 50602,
            anilist_id: 142838,
            themoviedb_id: "120089",
            imdb_id: "tt13706018",
          },
          episodes: {
            "1": {
              seasonNumber: 1,
              episodeNumber: 13,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input);
  };

  try {
    const kitsuTarget = await resolvePmdbEpisodeTarget("kitsu:45619", { season: 1, episode: 1 });
    assert.deepEqual(kitsuTarget, {
      tmdb_id: 120089,
      media_type: "tv",
      season: 1,
      episode: 13,
      id_type: "imdb",
      id_value: "tt13706018",
    });

    const malTarget = await resolvePmdbEpisodeTarget("mal:50602", { season: 1, episode: 1 });
    assert.deepEqual(malTarget, {
      tmdb_id: 120089,
      media_type: "tv",
      season: 1,
      episode: 13,
      id_type: "imdb",
      id_value: "tt13706018",
    });

    const anilistTarget = await resolvePmdbEpisodeTarget("anilist:142838", { season: 1, episode: 1 });
    assert.deepEqual(anilistTarget, {
      tmdb_id: 120089,
      media_type: "tv",
      season: 1,
      episode: 13,
      id_type: "imdb",
      id_value: "tt13706018",
    });

    const showTarget = await resolvePmdbTarget("kitsu:45619", "series");
    assert.deepEqual(showTarget, {
      tmdb_id: 120089,
      media_type: "tv",
      id_type: "imdb",
      id_value: "tt13706018",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolvePmdbEpisodeTarget falls back to imdbSeason and imdbEpisode for unmapped anime", async () => {
  const restore = stubOfflineAniZip();
  try {
    const target = await resolvePmdbEpisodeTarget(
      "kitsu:99999",
      { season: 1, episode: 1, imdbSeason: 1, imdbEpisode: 13 },
      "tt13706018",
    );
    assert.deepEqual(target, {
      id_type: "imdb",
      id_value: "tt13706018",
      media_type: "tv",
      season: 1,
      episode: 13,
    });
  } finally {
    restore();
  }
});

test("resolvePmdbEpisodeTarget maps Re:Zero S2E14 to S1 absolute episode 39 for single-season TMDb show", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.ani.zip/mappings")) {
      return new Response(
        JSON.stringify({
          mappings: {
            kitsu_id: 43247,
            themoviedb_id: "65942",
            imdb_id: "tt5607616",
          },
          episodes: {
            "14": {
              seasonNumber: 2,
              episodeNumber: 14,
              absoluteEpisodeNumber: 39,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input);
  };

  try {
    const target = await resolvePmdbEpisodeTarget("kitsu:43247", {
      season: 2,
      episode: 14,
      absoluteNumber: 39,
    });
    assert.deepEqual(target, {
      tmdb_id: 65942,
      media_type: "tv",
      season: 1,
      episode: 39,
      id_type: "imdb",
      id_value: "tt5607616",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolvePmdbEpisodeTarget maps direct TMDb single-season show to Season 1 when absoluteNumber is provided", async () => {
  const target = await resolvePmdbEpisodeTarget("tmdb:tv:65942", {
    season: 2,
    episode: 14,
    absoluteNumber: 39,
  });
  assert.deepEqual(target, {
    tmdb_id: 65942,
    media_type: "tv",
    season: 1,
    episode: 39,
  });
});

test("resolvePmdbEpisodeTarget preserves season for normal multi-season anime", async () => {
  const target = await resolvePmdbEpisodeTarget("tmdb:tv:120089", {
    season: 2,
    episode: 1,
    absoluteNumber: 26,
  });
  assert.deepEqual(target, {
    tmdb_id: 120089,
    media_type: "tv",
    season: 2,
    episode: 1,
  });
});


