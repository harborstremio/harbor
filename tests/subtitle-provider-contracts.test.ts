// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  buildSubdlSearchUrl,
  searchSubdl,
} from "../src/lib/subtitles/autosync/sub-source-subdl.ts";
import {
  buildSubsourceMovieSearchUrl,
  searchSubsource,
} from "../src/lib/subtitles/autosync/sub-source-subsource.ts";
import { rateLimitDelaySeconds } from "../src/lib/subtitles/autosync/sub-source-contract.ts";

const providerContext = {
  userAgent: "Harbor-Test",
  subdlApiKey: "subdl-secret",
  subsourceApiKey: "subsource-secret",
};

test("SubDL v1 sends the release filename and maps the exact unpacked episode", async () => {
  let requestedUrl = "";
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        status: true,
        results: [{ imdb_id: "tt1234567", tmdb_id: 42 }],
        subtitles: [
          {
            n_id: "parent-1",
            name: "Show.S01.Pack.zip",
            release_name: "Show S01 WEB-DL",
            url: "/subtitle/parent-1.zip",
            season: 1,
            fps: "23.976",
            production_type: 3,
            match_score: 0.91,
            match_confidence: "high",
            match_type: "filename",
            match_reasons: ["provider filename match"],
            unpack_files: [
              {
                file_n_id: "episode-1",
                name: "Show.S01E01.WEB-DL.srt",
                release_name: "Show S01E01 WEB-DL",
                season: 1,
                episode: 1,
                language: "EN",
                format: "srt",
                url: "/subtitle/parent-1/episode-1",
              },
              {
                file_n_id: "episode-2",
                name: "Show.S01E02.WEB-DL.srt",
                release_name: "Show S01E02 WEB-DL",
                season: 1,
                episode: 2,
                language: "EN",
                hi: true,
                forced: true,
                format: "srt",
                size: 4567,
                md5: "episode-two-md5",
                url: "/subtitle/parent-1/episode-2",
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const results = await searchSubdl(
    {
      imdbId: "tt1234567",
      type: "series",
      season: 1,
      episode: 2,
      langs: ["en"],
      filename: "Show.S01E02.1080p.WEB-DL-GROUP.mkv",
    },
    providerContext,
    fetchImpl,
  );

  const request = new URL(requestedUrl);
  assert.equal(request.origin + request.pathname, "https://api.subdl.com/api/v1/subtitles");
  assert.equal(request.searchParams.get("api_key"), "subdl-secret");
  assert.equal(request.searchParams.get("file_name"), "Show.S01E02.1080p.WEB-DL-GROUP.mkv");
  assert.equal(request.searchParams.get("imdb_id"), "tt1234567");
  assert.equal(request.searchParams.get("season_number"), "1");
  assert.equal(request.searchParams.get("episode_number"), "2");
  assert.equal(request.searchParams.get("unpack"), "1");
  assert.equal(request.searchParams.get("hi"), "1");
  assert.equal(request.searchParams.get("client"), "stremio");

  assert.ok(results);
  assert.equal(results.length, 1);
  const result = results[0];
  assert.equal(result.id, "episode-2");
  assert.equal(result.url, "https://dl.subdl.com/subtitle/parent-1/episode-2");
  assert.equal(result.release, "Show S01E02 WEB-DL");
  assert.equal(result.rawFilename, "Show.S01E02.WEB-DL.srt");
  assert.equal(result.format, "srt");
  assert.equal(result.archive, false);
  assert.equal(result.fps, 23.976);
  assert.equal(result.hearingImpaired, true);
  assert.equal(result.forced, true);
  assert.equal(result.machineTranslated, true);
  assert.equal(result.fileSize, 4567);
  assert.equal(result.checksum, "episode-two-md5");
  assert.equal(result.season, 1);
  assert.equal(result.episode, 2);
  assert.equal(result.episodeConfirmed, true);
  assert.equal(result.idConfirmed, true);
  assert.deepEqual(result.providerMatch, {
    score: 0.91,
    confidence: "high",
    matchedBy: ["filename", "id", "episode"],
    reasons: [
      "provider filename match",
      "SubDL returned the requested provider ID",
      "SubDL unpack metadata matched the requested episode",
    ],
    degraded: undefined,
  });
});

test("SubDL retains the parent archive when an unpacked pack has no requested episode", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        status: true,
        results: [{ imdb_id: "tt1234567" }],
        subtitles: [
          {
            n_id: "parent-2",
            name: "Show.S01.Pack.zip",
            url: "/subtitle/parent-2.zip",
            season: 1,
            unpack_files: [
              {
                file_n_id: "episode-1",
                season: 1,
                episode: 1,
                language: "EN",
                format: "srt",
                url: "/subtitle/parent-2/episode-1",
              },
            ],
          },
        ],
      }),
      { status: 200 },
    );
  const results = await searchSubdl(
    { imdbId: "tt1234567", type: "series", season: 1, episode: 2, langs: ["en"] },
    providerContext,
    fetchImpl,
  );
  assert.equal(results?.length, 1);
  assert.equal(results?.[0].archive, true);
  assert.equal(results?.[0].format, "zip");
  assert.equal(results?.[0].rawFilename, "Show.S01.Pack.zip");
  assert.equal(results?.[0].episodeConfirmed, false);
});

test("SubSource uses its official two-step API, header auth, release filter, and download URL", async () => {
  const calls: Array<{ url: URL; headers: Headers; redirect: RequestRedirect | undefined }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, headers: new Headers(init?.headers), redirect: init?.redirect });
    if (url.pathname.endsWith("/movies/search")) {
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            { movieId: 11, title: "Wrong", type: "tvseries", imdbId: "tt0000001", season: 1 },
            {
              movieId: 22,
              title: "Show",
              type: "tvseries",
              imdbId: "tt1234567",
              tmdbId: "42",
              season: 1,
            },
          ],
        }),
        { status: 200 },
      );
    }
    const exact = url.searchParams.has("releaseInfo");
    const rows = [
      {
        subtitleId: 55,
        movieId: 22,
        language: "english",
        releaseInfo: ["WEB-DL", "1080p", "GROUP"],
        size: 125000,
        hearingImpaired: false,
        foreignParts: false,
        framerate: "23.976",
        productionType: "retail",
        releaseType: "web",
        downloads: 150,
        rating: { good: 12, bad: 4, total: 16 },
        createdAt: "2026-08-30T10:30:00Z",
        contributors: [{ id: 9, displayname: "Uploader" }],
      },
    ];
    if (!exact) {
      rows.push({
        subtitleId: 56,
        movieId: 22,
        language: "english",
        releaseInfo: ["BluRay", "1080p"],
        size: 100000,
        hearingImpaired: true,
        foreignParts: true,
        framerate: "24.00",
        productionType: "machine",
        releaseType: "bluray",
        downloads: 25,
        rating: { good: 1, bad: 1, total: 2 },
        createdAt: "2026-08-29T10:30:00Z",
        contributors: [{ id: 10, displayname: "Translator" }],
      });
    }
    return new Response(JSON.stringify({ success: true, data: rows }), { status: 200 });
  };

  const results = await searchSubsource(
    {
      imdbId: "tt1234567",
      type: "series",
      title: "Show",
      season: 1,
      episode: 2,
      langs: ["en"],
      filename: "C:\\video\\Show.S01E02.1080p.WEB-DL-GROUP.mkv",
    },
    providerContext,
    fetchImpl,
  );

  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.url.origin, "https://api.subsource.net");
    assert.equal(call.headers.get("x-api-key"), "subsource-secret");
    assert.equal(call.headers.get("authorization"), null);
    assert.equal(call.url.searchParams.has("api_key"), false);
    assert.equal(
      call.redirect,
      "error",
      "credentialed browser calls must fail closed on redirects",
    );
  }
  const movieRequest = calls[0].url;
  assert.equal(movieRequest.pathname, "/api/v1/movies/search");
  assert.equal(movieRequest.searchParams.get("searchType"), "imdb");
  assert.equal(movieRequest.searchParams.get("imdb"), "tt1234567");
  assert.equal(movieRequest.searchParams.get("type"), "series");
  assert.equal(movieRequest.searchParams.get("season"), "1");

  const exactRequest = calls.find((call) => call.url.searchParams.has("releaseInfo"))?.url;
  assert.ok(exactRequest);
  assert.equal(exactRequest.pathname, "/api/v1/subtitles");
  assert.equal(exactRequest.searchParams.get("movieId"), "22");
  assert.equal(exactRequest.searchParams.get("language"), "english");
  assert.equal(exactRequest.searchParams.get("releaseInfo"), "Show.S01E02.1080p.WEB-DL-GROUP");
  assert.equal(exactRequest.searchParams.get("sort"), "rating");

  assert.ok(results);
  assert.equal(results.length, 2, "the exact result is deduplicated ahead of the broad result");
  const exact = results[0];
  assert.equal(exact.id, "55");
  assert.equal(exact.url, "https://api.subsource.net/api/v1/subtitles/55/download");
  assert.equal(exact.downloadAuth, "subsource-api-key");
  assert.equal(exact.format, "zip");
  assert.equal(exact.archive, true);
  assert.equal(exact.release, "WEB-DL 1080p GROUP");
  assert.equal(exact.fps, 23.976);
  assert.equal(exact.productionType, "retail");
  assert.equal(exact.releaseType, "web");
  assert.equal(exact.fromTrusted, true);
  assert.equal(exact.author, "Uploader");
  assert.equal(exact.uploadedAt, "2026-08-30T10:30:00Z");
  assert.deepEqual(exact.rating, { score: 0.75, good: 12, bad: 4, total: 16 });
  assert.equal(exact.fileSize, 125000);
  assert.equal(exact.season, 1);
  assert.equal(exact.episode, null);
  assert.equal(exact.idConfirmed, true);
  assert.deepEqual(exact.providerMatch?.matchedBy, ["id", "release"]);
  assert.equal(results[1].machineTranslated, true);
  assert.equal(results[1].foreignOnly, true);
});

test("SubSource title search uses the documented text contract", () => {
  const url = new URL(
    buildSubsourceMovieSearchUrl({ title: "Dune", type: "movie", year: 2021 }) as string,
  );
  assert.equal(url.searchParams.get("searchType"), "text");
  assert.equal(url.searchParams.get("q"), "Dune");
  assert.equal(url.searchParams.get("type"), "movie");
  assert.equal(url.searchParams.get("year"), "2021");
  assert.equal(url.searchParams.has("tmdb_id"), false);
});

test("SubSource title fallback rejects unrelated and wrong-year movie hits", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        success: true,
        data: [
          { movieId: 1, title: "Unrelated", type: "movie", releaseYear: 2021 },
          { movieId: 2, title: "Dune", type: "movie", releaseYear: 1984 },
        ],
      }),
      { status: 200 },
    );
  };

  const results = await searchSubsource(
    { title: "Dune", type: "movie", year: 2021, langs: ["en"] },
    providerContext,
    fetchImpl,
  );

  assert.deepEqual(results, []);
  assert.equal(calls, 1, "an unverified movie must not trigger subtitle download searches");
});

test("provider rate-limit cooldown honors standard response headers", () => {
  assert.equal(
    rateLimitDelaySeconds(new Response(null, { status: 429, headers: { "retry-after": "17" } })),
    17,
  );
});

test("SubDL request builder can search solely by the official file_name parameter", () => {
  const built = buildSubdlSearchUrl({ filename: "Movie.2026.BluRay.mkv", langs: ["en"] }, "key");
  const url = new URL(built as string);
  assert.equal(url.searchParams.get("file_name"), "Movie.2026.BluRay.mkv");
  assert.equal(url.searchParams.has("film_name"), false);
});

test("native provider calls fail closed when no vault binding is available", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: { __TAURI_INTERNALS__: {} },
    configurable: true,
  });
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  };

  try {
    assert.equal(
      await searchSubdl(
        { imdbId: "tt1234567", type: "movie", langs: ["en"] },
        providerContext,
        fetchImpl,
      ),
      null,
    );
    assert.equal(
      await searchSubsource(
        { imdbId: "tt1234567", type: "movie", langs: ["en"] },
        providerContext,
        fetchImpl,
      ),
      null,
    );
    assert.equal(calls, 0);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
