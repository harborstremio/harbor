import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/lib/simkl/", import.meta.url));
const compiled = new Map();
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers });

function harness(responses = []) {
  const calls = [];
  const waits = [];
  const state = {
    now: Date.parse("2026-09-30T12:00:00Z"),
    profile: "first",
    session: { accessToken: "first-token", username: "first" },
    clears: 0,
    onWait: null,
  };
  class Clock extends Date {
    static now() {
      return state.now;
    }
  }
  const mocks = {
    "@/lib/safe-fetch": {
      safeFetch: async (url, init) => {
        calls.push({ url: new URL(url), init, at: state.now });
        const response = responses.shift();
        assert.ok(response, `Unexpected request: ${new URL(url).pathname}`);
        return typeof response === "function" ? response() : response;
      },
    },
    "@/lib/active-profile-id": { activeProfileId: () => state.profile },
    [path.join(root, "session.ts")]: {
      getSession: () => state.session,
      setSession: (value) => {
        state.session = value;
        state.clears++;
      },
    },
    [path.join(root, "config.ts")]: {
      SIMKL_API_BASE: "https://api.simkl.com",
      SIMKL_APP_NAME: "harbor-test",
      SIMKL_APP_VERSION: "test",
      SIMKL_CLIENT_ID: "test-client",
      SIMKL_USER_AGENT: "Harbor/Test",
    },
    [path.join(root, "activities/gate.ts")]: { currentActivitiesAll: async () => "unchanged" },
    [path.join(root, "ids.ts")]: { simklTargetIds: (value) => value },
  };
  const cache = new Map();
  function load(filename) {
    const full = path.resolve(root, filename);
    if (mocks[full]) return mocks[full];
    if (cache.has(full)) return cache.get(full).exports;
    if (!compiled.has(full)) {
      compiled.set(
        full,
        ts.transpileModule(readFileSync(full, "utf8"), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
        }).outputText,
      );
    }
    const module = { exports: {} };
    cache.set(full, module);
    const require = (name) => {
      if (mocks[name]) return mocks[name];
      assert.ok(name.startsWith("."), `Unexpected import: ${name}`);
      return load(path.resolve(path.dirname(full), `${name}.ts`));
    };
    new Function("require", "module", "exports", "Date", "Math", "setTimeout", compiled.get(full))(
      require,
      module,
      module.exports,
      Clock,
      Object.assign(Object.create(Math), { random: () => 0.25 }),
      (resolve, ms) => {
        assert.ok(Number.isFinite(ms) && ms <= 31000, `Unbounded queue wait: ${ms}`);
        waits.push(ms);
        state.now += ms;
        state.onWait?.(ms);
        queueMicrotask(resolve);
      },
    );
    return module.exports;
  }
  return { load, calls, waits, state };
}

const calendar = {
  calendar: [
    { simkl_id: 10, date: "2026-10-01T03:00:00Z", episode: { season: 2, episode: 1 } },
    { simkl_id: 10, date: "2026-10-08T03:00:00Z", episode: { season: 2, episode: 2 } },
    { simkl_id: 20, date: "2026-10-02T00:00:00Z" },
  ],
  metadata: {
    10: {
      title: "A show",
      poster: "10/image",
      ids: { imdb: "tt123", tmdb: "30" },
      ratings: { simkl: { rating: 8.2 } },
      release_date: "2020-01-01",
    },
    20: { title: "A movie", poster: null, ids: { tmdb: "40" } },
  },
};

test("v2 calendar joins metadata per airing without deduplicating episodes or mutating payload", () => {
  const h = harness();
  const before = JSON.stringify(calendar);
  const items = h.load("calendar-data.ts").parseSimklCalendar(calendar);
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((x) => x.ids.simkl_id),
    [10, 10, 20],
  );
  assert.deepEqual(
    items.slice(0, 2).map((x) => x.episode.episode),
    [1, 2],
  );
  assert.equal(items[0].title, "A show");
  assert.equal(items[0].date, "2026-10-01T03:00:00Z");
  assert.equal(items[2].episode, undefined);
  assert.equal(JSON.stringify(calendar), before);
});

test("sparse anime metadata and missing seasons are supported; malformed rows are isolated", () => {
  const parse = harness().load("calendar-data.ts").parseSimklCalendar;
  const result = parse({
    calendar: [
      null,
      { simkl_id: 999, date: "2026-10-01" },
      { simkl_id: 10, date: "bad date" },
      { simkl_id: 10, date: "2026-10-01", episode: { episode: 12 } },
    ],
    metadata: { 10: { title: "Anime", poster: null, ids: { mal: "55", kitsu: "56" } } },
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].ids.mal, "55");
  assert.equal(result[0].episode.season, undefined);
  for (const invalid of [null, [], { calendar: [] }, { calendar: {}, metadata: {} }]) {
    assert.deepEqual(parse(invalid), []);
  }
});

test("rolling and archive calendar readers consume v2 and map episode dates, IDs, ratings and posters", async () => {
  const h = harness([json(calendar), json(calendar)]);
  const api = h.load("calendar.ts");
  const tv = await api.fetchSimklCdnRolling("tv");
  const movies = await api.fetchSimklCdnArchive(2026, 9, "movie");
  assert.equal(tv.length, 3);
  assert.equal(tv[0].name, "A show S02E01");
  assert.equal(tv[0].releaseDate, "2026-10-01");
  assert.equal(tv[0].voteAverage, 8.2);
  assert.equal(tv[0].poster, "https://wsrv.nl/?url=https://simkl.in/posters/10/image_m.webp&q=90");
  assert.equal(movies[2].id, "tmdb:movie:40");
  assert.equal(movies[2].poster, null);
  assert.deepEqual(
    h.calls.map((x) => x.url.pathname),
    ["/calendar/v2/tv.json", "/calendar/v2/2026/10/movie_release.json"],
  );
  assert.equal(h.calls[0].url.searchParams.get("app-name"), "harbor-test");
});

test("home Up Next calendar receives joined TV and anime entries and retains its cache", async () => {
  const h = harness([json(calendar), json(calendar)]);
  const api = h.load("home-rails/cdn.ts");
  const result = await api.fetchCdnCalendarCombined();
  assert.equal(result.length, 6);
  assert.equal(result[0].ids.imdb, "tt123");
  assert.strictEqual(await api.fetchCdnCalendarCombined(), result);
  assert.deepEqual(
    h.calls.map((x) => x.url.pathname),
    ["/calendar/v2/tv.json", "/calendar/v2/anime.json"],
  );
});

test("watchlist requests full external identity while keeping the activity-gated cache", async () => {
  const h = harness([
    json({
      movies: [{ movie: { title: "Movie", year: 2026, ids: { simkl: 9, tmdb: "45" } } }],
      shows: [],
      anime: [],
    }),
  ]);
  const api = h.load("watchlist.ts");
  const result = await api.fetchWatchlist();
  assert.equal(result[0].ids.tmdb, 45);
  assert.equal(result[0].title, "Movie");
  assert.equal(h.calls[0].url.searchParams.get("extended"), "full");
  assert.deepEqual(await api.fetchWatchlist(), result);
  assert.equal(h.calls.length, 1);
});

test("server errors use bounded exponential backoff, jitter, and stop after five retries", async () => {
  const h = harness(Array.from({ length: 6 }, () => json({ error: "temporary" }, 503)));
  const api = h.load("client.ts");
  await assert.rejects(api.simklRequest("/sync/activities"), { status: 503 });
  assert.deepEqual(h.waits, [1250, 2250, 4250, 8250, 16250]);
  assert.equal(h.calls.length, 6);
});

test("Retry-After seconds and HTTP dates are respected on transient server failures", async () => {
  for (const header of ["8", "Wed, 30 Sep 2026 12:00:08 GMT"]) {
    const h = harness([json({}, 503, { "Retry-After": header }), json({ ok: true })]);
    assert.deepEqual(await h.load("client.ts").simklRequest("/sync/activities"), { ok: true });
    assert.equal(h.waits[0], 8250);
  }
});

test("burst 429 ignores a daily-reset header and retries shortly", async () => {
  for (const body of [{ error: "rate_limit" }, {}]) {
    const h = harness([json(body, 429, { "Retry-After": "45000" }), json({ ok: true })]);
    await h.load("client.ts").simklRequest("/sync/activities");
    assert.deepEqual(h.waits, [1250]);
    assert.equal(h.calls.length, 2);
  }
});

test("daily user quota fails promptly, blocks only that token, and expires at the server reset", async () => {
  const h = harness([
    json({ error: "user_limit_exceeded" }, 429, { "Retry-After": "45000" }),
    json({ other: true }),
    json({ recovered: true }),
  ]);
  const api = h.load("client.ts");
  const start = h.state.now;
  await assert.rejects(api.simklRequest("/sync/activities"), {
    status: 429,
    retryAt: start + 45000000,
  });
  assert.equal(api.isSimklBlocked(), true);
  await assert.rejects(api.simklRequest("/sync/all-items/all/watching"), { status: 429 });
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.waits, []);
  const previous = h.state.session;
  h.state.session = { accessToken: "other-token", username: "other" };
  assert.equal(api.isSimklBlocked(), false);
  assert.deepEqual(await api.simklRequest("/sync/activities"), { other: true });
  h.state.session = previous;
  h.state.now = start + 45000000;
  assert.equal(api.isSimklBlocked(), false);
  assert.deepEqual(await api.simklRequest("/sync/activities"), { recovered: true });
});

test("app quota and long server cooldowns reject queued calls without long-running timers", async () => {
  for (const [status, error] of [
    [429, "app_limit_exceeded"],
    [503, "unavailable"],
  ]) {
    const h = harness([json({ error }, status, { "Retry-After": "3600" })]);
    const api = h.load("client.ts");
    const first = api.simklRequest("/sync/activities");
    const queued = api.simklRequest("/sync/all-items/all/watching");
    const results = await Promise.allSettled([first, queued]);
    assert.ok(results.every((x) => x.status === "rejected" && x.reason.status === status));
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.waits, []);
    h.state.session = { accessToken: "second-token", username: "second" };
    assert.equal(api.isSimklBlocked(), true);
  }
});

test("malformed Retry-After values fall back without overflowing timers", () => {
  const policy = harness().load("retry-policy.ts").simklRetryPolicy;
  for (const header of [null, "", "invalid", "-1", "Infinity", "9".repeat(400)]) {
    assert.equal(policy(503, "", header, 0).delayMs, 1250);
  }
});

test("account or profile changes cancel both a retry and queued writes without sending them to another account", async () => {
  for (const change of [
    (s) => {
      s.session = { accessToken: "second-token" };
    },
    (s) => {
      s.profile = "second";
    },
  ]) {
    const h = harness([json({}, 503)]);
    h.state.onWait = () => change(h.state);
    const api = h.load("client.ts");
    const first = api.simklRequest("/sync/activities");
    const queued = api.simklRequest("/sync/history", {
      method: "POST",
      body: { movies: [{ ids: { simkl: 9 } }] },
    });
    const result = await Promise.allSettled([first, queued]);
    assert.ok(result.every((x) => x.status === "rejected" && x.reason.name === "AbortError"));
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].init.headers.Authorization, "Bearer first-token");
    assert.equal(h.state.clears, 0);
  }
});

test("late unauthorized responses cannot clear a replacement session", async () => {
  const h = harness([
    () => {
      h.state.session = { accessToken: "replacement-token" };
      return json({}, 401);
    },
  ]);
  await assert.rejects(h.load("client.ts").simklRequest("/sync/activities"), {
    name: "AbortError",
  });
  assert.equal(h.state.session.accessToken, "replacement-token");
  assert.equal(h.state.clears, 0);
});

test("public and explicit-token requests do not borrow or clear the connected session", async () => {
  const h = harness([json({ public: true }), json({}, 401)]);
  const api = h.load("client.ts");
  await api.simklRequest("/oauth/pin", { authed: false });
  await assert.rejects(
    api.simklRequest("/users/settings", { authed: false, token: "pending-token" }),
    { status: 401 },
  );
  assert.equal(h.calls[0].init.headers.Authorization, undefined);
  assert.equal(h.calls[1].init.headers.Authorization, "Bearer pending-token");
  assert.equal(h.state.clears, 0);
});

test("ordinary 401, 412 and 204 behavior is preserved", async () => {
  const unauthorized = harness([json({}, 401)]);
  await assert.rejects(unauthorized.load("client.ts").simklRequest("/sync/activities"), {
    status: 401,
  });
  assert.equal(unauthorized.state.session, null);
  const blocked = harness([json({ error: "client_id_failed" }, 412)]);
  const api = blocked.load("client.ts");
  await assert.rejects(api.simklRequest("/sync/activities"), { status: 412 });
  await assert.rejects(api.simklRequest("/sync/activities"), { status: 412 });
  assert.equal(blocked.calls.length, 1);
  const empty = harness([new Response(null, { status: 204 })]);
  assert.equal(
    await empty.load("client.ts").simklRequest("/sync/playback/1", { method: "DELETE" }),
    undefined,
  );
});
