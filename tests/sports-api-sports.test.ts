import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiSportsProvider } from "../src/lib/sports/providers/api-sports.ts";
import {
  createApiSportsTransport,
  ApiSportsError,
} from "../src/lib/sports/providers/api-sports-transport.ts";

// Contract fixtures modeled on official football v3 / hockey v1 documentation;
// deliberately synthetic team names, no subscription or private credentials.
const teams = {
  home: { id: 1, name: "Home", logo: "https://example.test/home.png" },
  away: { id: 2, name: "Away" },
};
const football = (id = 100, league = 233) => ({
  fixture: { id, timestamp: 1789380000, status: { short: "1H", elapsed: 23 } },
  league: { id: league },
  teams,
  goals: { home: 1, away: 0 },
});
const hockey = (events = false) => ({
  id: 200,
  timestamp: 1789380000,
  status: { short: "P2" },
  league: { id: 35 },
  teams,
  scores: { home: 2, away: 1 },
  events,
});
const response = (rows: unknown[] = [], headers: Record<string, string> = {}, extra = {}) =>
  new Response(JSON.stringify({ errors: [], response: rows, ...extra }), { headers });
const unavailable = (error: unknown) =>
  error instanceof ApiSportsError && error.code === "unavailable";
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("no key makes no request and errors do not become an empty schedule", async () => {
  let calls = 0;
  const api = createApiSportsProvider({
    getKey: () => "",
    fetch: async () => {
      calls++;
      return response();
    },
  });
  await assert.rejects(api.fetchScoreboard("EGY", "20260914"), { code: "missing-key" });
  assert.equal(calls, 0);
});

test("documented sport endpoints, direct auth, shared daily board and healthy empty", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createApiSportsProvider({
    getKey: () => "fixture-key",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response(
        url.includes("hockey") ? [hockey()] : [football(), football(101, 305), football(102, 39)],
      );
    },
  });
  const [egy, qsl, khl] = await Promise.all([
    api.fetchScoreboard("EGY", "20260914"),
    api.fetchScoreboard("QSL", "20260914"),
    api.fetchScoreboard("KHL", "20260914"),
  ]);
  assert.equal(calls.length, 2);
  assert.equal(egy[0].source, "api-sports");
  assert.equal(egy[0].detail, "23'");
  assert.equal(qsl[0].id, "101");
  assert.equal(khl[0].state, "in");
  assert.ok(
    calls.some((c) => c.url === "https://v3.football.api-sports.io/fixtures?date=2026-09-14"),
  );
  assert.ok(calls.some((c) => c.url === "https://v1.hockey.api-sports.io/games?date=2026-09-14"));
  for (const call of calls)
    assert.equal(new Headers(call.init.headers).get("x-apisports-key"), "fixture-key");
  assert.deepEqual(await api.fetchScoreboard("UAE", "20260914"), []);
  await assert.rejects(api.fetchScoreboard("EGY", "20261399"), unavailable);
  assert.equal(calls.length, 2);
});

test("malformed envelopes, pagination and malformed selected fixtures reject", async () => {
  for (const body of [
    {},
    { errors: [], response: null },
    { errors: [], response: [null] },
    { errors: [], response: [], paging: { current: 1, total: 2 } },
    { errors: [], response: [{ ...football(), fixture: { ...football().fixture, status: {} } }] },
  ]) {
    const api = createApiSportsProvider({
      getKey: () => "fixture-key",
      fetch: async () => new Response(JSON.stringify(body)),
    });
    await assert.rejects(api.fetchScoreboard("EGY", "20260914"), unavailable);
  }
  const api = createApiSportsProvider({
    getKey: () => "fixture-key",
    fetch: async () => response([], {}, { errors: {} }),
  });
  assert.deepEqual(await api.fetchScoreboard("EGY", "20260914"), []);
});

test("401 stops retries until key rotation; provider messages stay sanitized", async () => {
  let key = "first-fixture-key",
    calls = 0;
  const api = createApiSportsProvider({
    getKey: () => key,
    fetch: async () => {
      calls++;
      return key.startsWith("first")
        ? new Response("secret echo", { status: 401 })
        : response([football()]);
    },
  });
  await assert.rejects(api.fetchScoreboard("EGY", "20260914"), { code: "invalid-key" });
  await assert.rejects(api.fetchScoreboard("EGY", "20260915"), { code: "invalid-key" });
  assert.equal(calls, 1);
  assert.equal(api.status().code, "invalid-key");
  key = "replacement-fixture-key";
  api.invalidate();
  assert.equal((await api.fetchScoreboard("EGY", "20260914")).length, 1);
  assert.equal(calls, 2);
  const transport = createApiSportsTransport({
    getKey: () => key,
    fetch: async () => response([], {}, { errors: { token: `invalid ${key}` } }),
  });
  await assert.rejects(
    transport.get("football", "/fixtures?date=2026-09-14"),
    (error) =>
      error instanceof ApiSportsError &&
      !error.message.includes(key) &&
      error.code === "invalid-key",
  );
});

test("daily quota returns last successful data, blocks queued requests, resets at UTC midnight", async () => {
  let time = Date.UTC(2026, 8, 14, 23, 59),
    calls = 0;
  const transport = createApiSportsTransport({
    getKey: () => "key",
    now: () => time,
    fetch: async () => {
      calls++;
      return response([{ id: 1 }], { "x-ratelimit-requests-remaining": "0" });
    },
  });
  const first = transport.get("football", "/fixtures?date=2026-09-14");
  const second = transport.get("football", "/fixtures?date=2026-09-15");
  assert.equal((await first).length, 1);
  await assert.rejects(second, { code: "quota" });
  assert.equal(calls, 1);
  assert.equal(transport.status("football").retryAt, Date.UTC(2026, 8, 15));
  assert.equal(transport.status("hockey").code, "ready");
  time += 60_001;
  await transport.get("football", "/fixtures?date=2026-09-15");
  assert.equal(calls, 2);
});

test("429 respects Retry-After without a retry storm", async () => {
  let time = Date.UTC(2026, 8, 14),
    calls = 0;
  const transport = createApiSportsTransport({
    getKey: () => "key",
    now: () => time,
    fetch: async () =>
      ++calls === 1
        ? new Response("", { status: 429, headers: { "retry-after": "90" } })
        : response(),
  });
  await assert.rejects(transport.get("football", "/fixtures?date=2026-09-14"), {
    code: "rate-limit",
  });
  assert.equal(transport.status("football").retryAt, time + 90_000);
  await assert.rejects(transport.get("football", "/fixtures?date=2026-09-14"), {
    code: "rate-limit",
  });
  assert.equal(calls, 1);
  time += 90_001;
  assert.deepEqual(await transport.get("football", "/fixtures?date=2026-09-14"), []);
});

test("HTTP 200 quota errors are failures; 403 entitlement errors do not reject a key globally", async () => {
  const quota = createApiSportsTransport({
    getKey: () => "key",
    fetch: async () => response([], {}, { errors: { requests: "daily quota exhausted" } }),
  });
  await assert.rejects(quota.get("football", "/fixtures?date=2026-09-14"), { code: "quota" });
  const denied = createApiSportsTransport({
    getKey: () => "key",
    fetch: async () => new Response("", { status: 403 }),
  });
  await assert.rejects(denied.get("football", "/fixtures?date=2026-09-14"), unavailable);
  assert.equal(denied.status("hockey").code, "ready");
});

test("deadline covers a connected but stalled response body", async () => {
  let signal: AbortSignal | undefined;
  const transport = createApiSportsTransport({
    getKey: () => "key",
    timeoutMs: 25,
    fetch: async (_url, init) => {
      signal = init.signal as AbortSignal;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => new Promise(() => {}),
      } as Response;
    },
  });
  await assert.rejects(transport.get("football", "/fixtures?date=2026-09-14"), unavailable);
  assert.equal(signal?.aborted, true);
  assert.equal(transport.status("football").code, "unavailable");
});

test("rotation aborts old work and prevents old responses contaminating the new cache", async () => {
  let key = "old",
    resolveOld!: (value: Response) => void,
    oldSignal: AbortSignal | undefined;
  let calls = 0;
  const api = createApiSportsProvider({
    getKey: () => key,
    fetch: async (_url, init) => {
      calls++;
      if (new Headers(init.headers).get("x-apisports-key") === "old") {
        oldSignal = init.signal as AbortSignal;
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return response([football(999)]);
    },
  });
  const first = api.fetchScoreboard("EGY", "20260914");
  const rejected = assert.rejects(first, unavailable);
  await tick();
  key = "new";
  api.invalidate();
  const current = await api.fetchScoreboard("EGY", "20260914");
  await rejected;
  assert.equal(oldSignal?.aborted, true);
  assert.equal(current[0].id, "999");
  resolveOld(response([football(100)]));
  await tick();
  assert.equal((await api.fetchScoreboard("EGY", "20260914"))[0].id, "999");
  assert.equal(calls, 2);
});

test("subscriber abort leaves the other screen's shared request running", async () => {
  let complete!: (value: Response) => void,
    signal: AbortSignal | undefined,
    calls = 0;
  const api = createApiSportsProvider({
    getKey: () => "key",
    fetch: async (_url, init) => {
      calls++;
      signal = init.signal as AbortSignal;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  const controller = new AbortController();
  const first = api.fetchScoreboard("EGY", "20260914", controller.signal);
  const rejected = assert.rejects(first, { name: "AbortError" });
  const second = api.fetchScoreboard("EGY", "20260914");
  await tick();
  controller.abort();
  await rejected;
  assert.equal(signal?.aborted, false);
  complete(response([football()]));
  assert.equal((await second)[0].id, "100");
  assert.equal(calls, 1);
});

test("football bundled detail keeps away-only stats, missing values and player provenance", async () => {
  const calls: string[] = [];
  const f = {
    ...football(),
    statistics: [
      { team: { id: 1 }, statistics: [{ type: "Shots on Goal", value: 2 }] },
      { team: { id: 2 }, statistics: [{ type: "Ball Possession", value: "60%" }] },
    ],
    lineups: [
      {
        team: { id: 1 },
        formation: "4-3-3",
        startXI: [{ player: { id: 123, name: "Player", number: 9, pos: "F", grid: "4:1" } }],
      },
    ],
    players: [
      {
        team: { id: 1 },
        players: [{ player: { id: 123, photo: "https://example.test/player.png" } }],
      },
    ],
  };
  const api = createApiSportsProvider({
    getKey: () => "key",
    fetch: async (url) => {
      calls.push(url);
      return response([f]);
    },
  });
  const detail = await api.provider.fetchSummary("EGY", "100");
  assert.ok(detail);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith("/fixtures?ids=100"));
  assert.equal(detail.homeRoster[0].source, "api-sports");
  assert.equal(detail.homeRoster[0].image, "https://example.test/player.png");
  assert.ok(
    detail.allStats.some(
      (row) => row.label === "Possession" && row.homeValue === "—" && row.awayValue === "60%",
    ),
  );
  assert.equal(await api.provider.fetchSummary("EGY", "999"), null);
});

test("hockey events are fetched only when game declares availability", async () => {
  for (const available of [false, true]) {
    const calls: string[] = [];
    const api = createApiSportsProvider({
      getKey: () => "key",
      fetch: async (url) => {
        calls.push(url);
        return response(url.includes("/games/events") ? [] : [hockey(available)]);
      },
    });
    assert.ok(await api.provider.fetchSummary("KHL", "200"));
    assert.equal(calls.length, available ? 2 : 1);
    assert.ok(calls[0].endsWith("/games?id=200"));
    if (available) assert.ok(calls[1].endsWith("/games/events?game=200"));
  }
});

test("transport refuses absolute URLs so credentials cannot enter arbitrary endpoints", async () => {
  let calls = 0;
  const transport = createApiSportsTransport({
    getKey: () => "key",
    fetch: async () => {
      calls++;
      return response();
    },
  });
  await assert.rejects(
    transport.get("football", "https://example.test/fixtures?date=2026-09-14"),
    unavailable,
  );
  assert.equal(calls, 0);
});

test("summary validates both the requested event and league for each sport", async () => {
  for (const [key, id, row] of [
    ["EGY", "999", football()],
    ["QSL", "100", football()],
    ["KHL", "999", hockey()],
    ["KHL", "200", { ...hockey(), league: { id: 1 } }],
  ] as const) {
    const api = createApiSportsProvider({
      getKey: () => "key",
      fetch: async () => response([row]),
    });
    assert.equal(await api.provider.fetchSummary(key, id), null);
  }
});

test("deadline also releases stalled connection attempts and rejects late arrivals", async () => {
  let complete!: (value: Response) => void;
  const transport = createApiSportsTransport({
    getKey: () => "key",
    timeoutMs: 25,
    fetch: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  await assert.rejects(transport.get("football", "/fixtures?date=2026-09-14"), unavailable);
  complete(response([{ id: 1 }]));
  await tick();
  assert.equal(transport.status("football").code, "unavailable");
});

test("last board subscriber aborts active network work and allows a fresh request", async () => {
  let calls = 0,
    active: AbortSignal | undefined;
  const api = createApiSportsProvider({
    getKey: () => "key",
    fetch: async (_url, init) => {
      calls++;
      active = init.signal as AbortSignal;
      return calls === 1 ? new Promise(() => {}) : response([football()]);
    },
  });
  const controller = new AbortController();
  const request = api.fetchScoreboard("EGY", "20260914", controller.signal);
  const rejected = assert.rejects(request, { name: "AbortError" });
  await tick();
  controller.abort();
  await rejected;
  assert.equal(active?.aborted, true);
  assert.equal((await api.fetchScoreboard("EGY", "20260914")).length, 1);
  assert.equal(calls, 2);
});

test("date changes cancel queued boards before they consume quota", async () => {
  const calls: string[] = [];
  let complete!: (response: Response) => void;
  const api = createApiSportsProvider({
    getKey: () => "key",
    fetch: async (url) => {
      calls.push(url);
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  const retained = api.fetchScoreboard("EGY", "20260914");
  await tick();
  const controller = new AbortController();
  const cancelled = api.fetchScoreboard("EGY", "20260915", controller.signal);
  const rejected = assert.rejects(cancelled, { name: "AbortError" });
  controller.abort();
  await rejected;
  complete(response([football()]));
  await retained;
  await tick();
  assert.equal(calls.length, 1);
});
