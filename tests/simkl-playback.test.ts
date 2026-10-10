// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

// The harness swaps ./client and ./session but keeps the real id helpers, since
// the session gate matches on their exact key spellings.
const idsModule = (() => {
  const code = ts.transpileModule(readFileSync(new URL("../src/lib/simkl/ids.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", code)(
    () => ({
      anidbToMal: async () => null,
      anilistToMal: async () => null,
      kitsuToMal: async () => null,
    }),
    module,
    module.exports,
  );
  return module.exports;
})();

class StubSimklApiError extends Error {
  status: number;
  constructor(status: number, body = "") {
    super(`Simkl HTTP ${status}: ${body}`);
    this.status = status;
  }
}

function playback(sessions: unknown[], existing?: { ms: number; t: number }) {
  const writes: unknown[][] = [];
  let failure: Error | null = null;
  const session = {};
  const source = readFileSync(new URL("../src/lib/simkl/playback.ts", import.meta.url), "utf8");
  const mocks: Record<string, unknown> = {
    "./session": { getSession: () => session },
    "./ids": idsModule,
    "./client": {
      simklRequest: async () => {
        if (failure) throw failure;
        return sessions;
      },
      SimklApiError: StubSimklApiError,
    },
    "@/lib/cw-dismiss": { isCwDismissed: () => false },
    "@/lib/resume": {
      readResumeEntry: () => existing,
      saveResumeBatch: (entries: unknown[]) => writes.push(entries),
    },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return {
    api: module.exports as typeof import("../src/lib/simkl/playback"),
    writes,
    StubSimklApiError,
    failRequests: (error: Error | null) => {
      failure = error;
    },
  };
}

test("Simkl paused episodes retain timestamp, episode identity and resume progress", async () => {
  // Simkl's response example uses episode.episode; its item guide uses number.
  const pausedAt = "2026-09-29T10:30:00.000Z";
  const h = playback([
    {
      progress: 45.5,
      paused_at: pausedAt,
      show: { title: "Fixture show", ids: { imdb: "tt1234567" } },
      episode: { season: 1, episode: 5 },
    },
    {
      progress: 20,
      paused_at: pausedAt,
      show: { title: "Fixture show", ids: { imdb: "tt1234567" } },
      episode: { season: 1, number: 6 },
    },
  ]);
  const items = await h.api.fetchSimklPlaybackItems();
  assert.equal(items.length, 2, "distinct episodes must not collapse into one session");
  assert.deepEqual(
    items.map((item) => item.state?.video_id),
    ["tt1234567:1:5", "tt1234567:1:6"],
  );
  assert.equal(items[0].state?.lastWatched, pausedAt);
  assert.equal(items[0]._mtime, pausedAt);
  assert.equal(items[0].state?.timeOffset, 1_201_200);
  assert.deepEqual(h.writes[0], [
    {
      id: "tt1234567",
      ms: 1_201_200,
      season: 1,
      episode: 5,
      pct: 0.455,
      source: "simkl",
      t: Date.parse(pausedAt),
    },
  ]);
});

test("anime progress uses a season-scoped ID or an explicit franchise episode mapping", async () => {
  const h = playback([
    {
      progress: 45,
      anime: { title: "Season two", ids: { imdb: "tt100", kitsu: 42 } },
      episode: { number: 3, tvdb_season: 2, tvdb_number: 3 },
    },
    {
      progress: 50,
      anime: { title: "Mapped only", ids: { imdb: "tt200" } },
      episode: { number: 4, tvdb_season: 2, tvdb_number: 4 },
    },
    { progress: 40, anime: { title: "Unmapped", ids: { imdb: "tt300" } }, episode: { number: 5 } },
  ]);
  const items = await h.api.fetchSimklPlaybackItems();
  assert.deepEqual(
    items.map((i) => i.state?.video_id),
    ["kitsu:42:1:3", "tt200:2:4"],
  );
});

test("a remote pause does not overwrite more recent local progress", async () => {
  const h = playback(
    [{ progress: 45, paused_at: "2026-09-29T10:00:00Z", movie: { ids: { imdb: "tt100" } } }],
    { ms: 100, t: Date.parse("2026-09-29T10:01:00Z") },
  );
  await h.api.fetchSimklPlaybackItems();
  assert.deepEqual(h.writes, []);
});

test("Simkl prefers paused_at while retaining legacy watched_at compatibility", async () => {
  const pausedAt = "2026-09-29T10:30:00.000Z";
  const watchedAt = "2026-09-28T10:30:00.000Z";
  const h = playback([
    {
      progress: 25,
      paused_at: pausedAt,
      watched_at: watchedAt,
      movie: { ids: { imdb: "tt1234567" } },
    },
    { progress: 30, watched_at: watchedAt, movie: { ids: { imdb: "tt2345678" } } },
  ]);
  const items = await h.api.fetchSimklPlaybackItems();
  assert.deepEqual(
    items.map((item) => item.state?.lastWatched),
    [pausedAt, watchedAt],
  );
});

test("Simkl still excludes unstarted and finished sessions", async () => {
  const h = playback(
    [0, 45, 99, 100].map((progress, index) => ({
      progress,
      paused_at: "2026-09-29T10:30:00.000Z",
      movie: { ids: { imdb: `tt123456${index}` } },
    })),
  );
  const items = await h.api.fetchSimklPlaybackItems();
  assert.deepEqual(
    items.map((item) => item._id),
    ["tt1234561"],
  );
  assert.equal(h.writes.length, 1);
});

test("Simkl keeps the anime-native id and entry-relative coords for a mal-only node", async () => {
  const h = playback([
    {
      progress: 30,
      paused_at: "2026-09-29T10:30:00.000Z",
      anime: { title: "Fixture anime", ids: { mal: 51715 } },
      episode: { season: 1, number: 6 },
    },
  ]);
  const items = await h.api.fetchSimklPlaybackItems();
  assert.equal(items[0]._id, "mal:51715");
  assert.equal(items[0].isAnime, true);
  assert.deepEqual(items[0].state?.video_id, "mal:51715:1:6");
});

test("an active session for the same episode is detected for the replay gate", async () => {
  const h = playback([
    {
      progress: 40,
      paused_at: "2026-09-29T10:30:00.000Z",
      show: { ids: { imdb: "tt1234567" } },
      episode: { season: 1, number: 5 },
    },
  ]);
  assert.equal(await h.api.hasActiveSimklPlayback("tt1234567", { season: 1, episode: 5 }), true);
  assert.equal(await h.api.hasActiveSimklPlayback("tt1234567", { season: 1, episode: 6 }), false);
  assert.equal(await h.api.hasActiveSimklPlayback("tt7654321", { season: 1, episode: 5 }), false);
});

test("anime sessions match entry-relative or provider episode spellings", async () => {
  const h = playback([
    {
      progress: 40,
      paused_at: "2026-09-29T10:30:00.000Z",
      anime: { ids: { mal: 51715 } },
      episode: { season: 1, number: 2 },
    },
  ]);
  assert.equal(await h.api.hasActiveSimklPlayback("mal:51715", { season: 1, episode: 2 }), true);
  assert.equal(
    await h.api.hasActiveSimklPlayback("mal:51715",
      { season: 2, episode: 2, imdbSeason: 1, imdbEpisode: 2 }),
    true,
  );
  assert.equal(
    await h.api.hasActiveSimklPlayback("mal:51715",
      { season: 2, episode: 2, imdbSeason: 2, imdbEpisode: 2 }),
    false,
  );
});

test("a watch without episode coordinates matches any session for its item", async () => {
  const h = playback([
    { progress: 40, paused_at: "2026-09-29T10:30:00.000Z", movie: { ids: { imdb: "tt1234567" } } },
  ]);
  assert.equal(await h.api.hasActiveSimklPlayback("tt1234567", undefined), true);
  assert.equal(await h.api.hasActiveSimklPlayback("tt7654321", undefined), false);
});

test("a missing sessions endpoint reports no active playback", async () => {
  const h = playback([]);
  h.failRequests(new h.StubSimklApiError(404, "no sessions"));
  assert.equal(await h.api.hasActiveSimklPlayback("tt1234567", { season: 1, episode: 5 }), false);
});
