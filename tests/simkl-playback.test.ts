// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

function playback(sessions: unknown[], existing?: { ms: number; t: number }) {
  const writes: unknown[][] = [];
  const session = {};
  const source = readFileSync(new URL("../src/lib/simkl/playback.ts", import.meta.url), "utf8");
  const mocks: Record<string, unknown> = {
    "./session": { getSession: () => session },
    "./client": { simklRequest: async () => sessions },
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
  return { api: module.exports as typeof import("../src/lib/simkl/playback"), writes };
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
