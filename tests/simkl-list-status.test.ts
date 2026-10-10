import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// The harness swaps ./client and ./session but keeps the real id helpers, since
// they are pure and the watched lookup relies on their exact key spellings.
const idsModule = (() => {
  const code = ts.transpileModule(readFileSync("src/lib/simkl/ids.ts", "utf8"), {
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

function harness() {
  let marker: string | null = "revision-1";
  let reset: () => void = () => {};
  let response: unknown = null;
  let gate: (() => Promise<string | null>) | undefined;
  let requests = 0;
  const mocks: Record<string, unknown> = {
    "./activities/gate": { currentActivitiesAll: () => (gate ? gate() : Promise.resolve(marker)) },
    "./client": {
      simklRequest: async (path: string, opts?: any) => {
        requests++;
        if (response instanceof Error) throw response;
        if (typeof response === "function") return response(path, opts);
        return response;
      },
    },
    "@/lib/active-profile-id": { activeProfileId: () => "fixture" },
    "./session": {
      getSession: () => ({ username: "fixture" }),
      subscribeSession: (fn: () => void) => {
        reset = fn;
      },
    },
    "./ids": idsModule,
  };
  const compiled = ts.transpileModule(readFileSync("src/lib/simkl/list-status.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", compiled)(
    (name: string) => {
      assert.ok(name in mocks, `unexpected import ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return {
    ...module.exports,
    setResponse: (value: unknown) => {
      response = value;
    },
    setMarker: (value: string | null) => {
      marker = value;
    },
    setGate: (value?: () => Promise<string | null>) => {
      gate = value;
    },
    reset: () => reset(),
    get requests() {
      return requests;
    },
  };
}

const watchedAt = "2026-09-29T21:00:00Z";
const shows = {
  shows: [
    {
      status: "watching",
      show: { ids: { imdb: "tt100", tmdb: 100 } },
      seasons: [{ number: 1, episodes: [{ number: 1, watched_at: watchedAt }] }],
    },
  ],
};
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

test("failed watched-history loads reject and can retry the same activity revision", async () => {
  const h = harness();
  h.setResponse(new Error("temporary failure"));
  await assert.rejects(h.loadSimklWatchedMap(), /temporary failure/);
  h.setResponse(shows);
  assert.deepEqual([...(await h.loadSimklWatchedMap()).get("tt100")], ["1:1"]);
  assert.equal(h.requests, 2);
});

test("a failed refresh cannot replace a successful snapshot with an empty success", async () => {
  const h = harness();
  h.setResponse(shows);
  const previous = await h.loadSimklWatchedMap();
  h.setMarker("revision-2");
  h.setResponse(new Error("offline"));
  await assert.rejects(h.loadSimklStatusMap(), /offline/);
  assert.deepEqual([...previous.get("tt100")], ["1:1"]);
  h.setResponse(shows);
  assert.equal((await h.loadSimklStatusMap()).get("tt100"), "watching");
  assert.equal(h.requests, 3);
});

test("the documented null response is a successful empty library", async () => {
  const h = harness();
  h.setResponse(null);
  assert.equal((await h.loadSimklWatchedMap()).size, 0);
  assert.equal((await h.loadSimklStatusMap()).size, 0);
  assert.equal(h.requests, 1);
});

test("concurrent status and watched readers share a request and reuse unchanged activities", async () => {
  const h = harness();
  h.setResponse(shows);
  const [statuses, watched] = await Promise.all([h.loadSimklStatusMap(), h.loadSimklWatchedMap()]);
  assert.equal(statuses.get("tt100"), "watching");
  assert.equal(watched.get("tt100"), watched.get("tmdb:tv:100"));
  await h.loadSimklWatchedMap();
  h.setMarker(null);
  await h.loadSimklWatchedMap();
  assert.equal(h.requests, 1);
});

test("a session change while waiting for activities cannot seed the new account's cache", async () => {
  const h = harness();
  let release!: (value: string) => void;
  h.setGate(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const old = h.loadSimklWatchedMap();
  h.reset();
  h.setGate();
  h.setResponse(null);
  release("old-revision");
  await assert.rejects(old, /session changed/i);
  assert.equal(h.requests, 0);
  assert.equal((await h.loadSimklWatchedMap()).size, 0);
  assert.equal(h.requests, 1);
});

test("a delayed previous-session reply is rejected without clearing a newer request", async () => {
  const h = harness();
  let release!: (value: unknown) => void;
  h.setResponse(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const old = h.loadSimklWatchedMap();
  await settle();
  h.reset();
  h.setResponse(null);
  assert.equal((await h.loadSimklStatusMap()).size, 0);
  release(shows);
  await assert.rejects(old, /session changed/i);
  assert.equal((await h.loadSimklWatchedMap()).size, 0);
  assert.equal(h.requests, 2);
});

test("completion times stay attached to their snapshot and all provider aliases", async () => {
  const h = harness();
  h.setResponse(shows);
  const data = await h.loadSimklProgress();
  assert.equal(data.watchedAt.get("tt100").get("1:1"), Date.parse(watchedAt));
  assert.equal(data.watchedAt.get("tt100"), data.watchedAt.get("tmdb:tv:100"));
  h.reset();
  h.setResponse(null);
  assert.equal((await h.loadSimklProgress()).watchedAt.size, 0);
  assert.equal(data.watchedAt.get("tt100").get("1:1"), Date.parse(watchedAt));
});

test("anime-shaped nodes and invalid timestamps retain status without inventing completion times", async () => {
  const h = harness();
  h.setResponse({
    anime: [
      {
        status: "watching",
        anime: { ids: { mal: 42 } },
        seasons: [
          {
            number: 1,
            episodes: [
              { number: 1, watched_at: watchedAt },
              { number: 2, watched_at: "invalid" },
            ],
          },
        ],
      },
    ],
  });
  const data = await h.loadSimklProgress();
  assert.equal(data.statuses.get("mal:42"), "watching");
  assert.equal(data.watched.get("mal:42").has("1:1"), true);
  assert.equal(data.watchedAt.get("mal:42").get("1:1"), Date.parse(watchedAt));
  assert.equal(data.watchedAt.get("mal:42").has("1:2"), false);
});

test("completion anchors retain the last watched regular episode and omit paused, dropped and unmapped anime titles", async () => {
  const h = harness();
  const show = (id: string, status = "watching") => ({
    status,
    show: { title: "Fixture", ids: { imdb: id } },
    seasons: [
      {
        number: 1,
        episodes: [
          { number: 1, watched_at: "2026-09-28T21:00:00Z" },
          { number: 2, watched_at: watchedAt },
        ],
      },
    ],
  });
  const specials = show("tt100");
  specials.seasons.push({
    number: 0,
    episodes: [{ number: 1, watched_at: "2026-09-30T21:00:00Z" }],
  });
  h.setResponse({
    shows: [
      specials,
      show("tt200", "completed"),
      show("tt300", "hold"),
      show("tt400", "dropped"),
      show("tt500", "plantowatch"),
    ],
    anime: [show("tt600")],
  });
  const data = await h.loadSimklProgress();
  assert.deepEqual(
    data.completedSeries.map((i: any) => i._id),
    ["tt100", "tt200"],
  );
  assert.equal(data.completedSeries[0].state.episode, 2);
  assert.equal(data.completedSeries[0].state.lastWatched, new Date(watchedAt).toISOString());
  assert.equal(data.completedSeries[0].state.timeOffset, 0);
  assert.equal(data.completedSeries[0].external, "simkl");
});

test("successful status writes are not reported as failed when refreshing the cache is offline", async () => {
  const h = harness();
  h.setResponse((_path: string, opts?: any) => {
    if (opts?.method === "POST") return { added: { shows: [{ to: "hold" }] } };
    throw new Error("refresh offline");
  });
  assert.equal(await h.setSimklStatus({ kind: "show", imdb: "tt100" }, "hold"), "hold");
  await h.clearSimklStatus({ kind: "show", imdb: "tt100" });
});

test("a queued watch is already covered when Simkl lists the episode watched", async () => {
  const h = harness(); h.setResponse(shows);
  assert.equal(await h.isSimklEpisodeWatched("tt100", { season: 1, episode: 1 }), true);
  assert.equal(await h.isSimklEpisodeWatched("tt100", { season: 1, episode: 2 }), false);
});

test("a season-scoped row id resolves to the show's own watched set", async () => {
  const h = harness();
  h.setResponse({ shows: [{ status: "watching", show: { ids: { imdb: "tt100" } },
    seasons: [{ number: 2, episodes: [{ number: 2, watched_at: watchedAt }] }] }] });
  assert.equal(await h.isSimklEpisodeWatched("tt100:2:2", { season: 2, episode: 2 }), true);
});

test("anime entry-relative and provider spellings both resolve against the watched set", async () => {
  const h = harness();
  h.setResponse({ anime: [{ status: "watching", anime: { ids: { kitsu: 9 } },
    seasons: [{ number: 1, episodes: [{ number: 2, watched_at: watchedAt }] }] }] });
  assert.equal(await h.isSimklEpisodeWatched("kitsu:9", { season: 1, episode: 2 }), true);
  assert.equal(await h.isSimklEpisodeWatched("kitsu:9",
    { season: 2, episode: 2, imdbSeason: 1, imdbEpisode: 2 }), true);
  assert.equal(await h.isSimklEpisodeWatched("kitsu:9",
    { season: 2, episode: 2, imdbSeason: 2, imdbEpisode: 2 }), false);
});

test("a completed show covers any queued episode without per-episode history", async () => {
  const h = harness();
  h.setResponse({ shows: [{ status: "completed", show: { ids: { imdb: "tt100" } } }] });
  assert.equal(await h.isSimklEpisodeWatched("tt100", { season: 3, episode: 7 }), true);
});

test("a watch without episode coordinates is left to the write path", async () => {
  const h = harness(); h.setResponse(shows);
  assert.equal(await h.isSimklEpisodeWatched("tt100", undefined), false);
});

test("anime seasons sharing a franchise ID combine TVDB coordinates without marking the wrong season", async () => {
  const h = harness();
  const season = (mal: number, tvSeason: number) => ({
    status: "watching",
    show: { title: `Season ${tvSeason}`, ids: { imdb: "tt100", mal } },
    seasons: [
      {
        number: 1,
        episodes: [{ number: 3, watched_at: watchedAt, tvdb: { season: tvSeason, episode: 3 } }],
      },
    ],
  });
  h.setResponse({ anime: [season(11, 2), season(12, 3)] });
  const data = await h.loadSimklProgress();
  assert.deepEqual([...data.watched.get("tt100")], ["2:3", "3:3"]);
  assert.deepEqual([...data.watched.get("mal:11")], ["1:3"]);
  assert.equal(data.watched.get("tt100").has("1:3"), false);
  assert.deepEqual(
    data.completedSeries.map((i: any) => i._id),
    ["mal:11", "mal:12"],
  );
});

test("unmapped anime still advances native IDs without inventing watched franchise episodes", async () => {
  const h = harness();
  h.setResponse({
    anime: [
      {
        status: "watching",
        show: { title: "Season two", ids: { imdb: "tt100", kitsu: 42 } },
        seasons: [{ number: 1, episodes: [{ number: 2, watched_at: watchedAt }] }],
      },
    ],
  });
  const data = await h.loadSimklProgress();
  assert.equal(data.watched.has("tt100"), false);
  assert.deepEqual([...data.watched.get("kitsu:42")], ["1:2"]);
  assert.equal(data.completedSeries[0].state.video_id, "kitsu:42:1:2");
});
