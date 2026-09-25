import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { Meta } from "../src/lib/cinemeta.ts";

type Providers = typeof import("../src/lib/media-provider-actions.ts");
const series = { id: "tt123", type: "series", name: "Fixture" } as Meta;
const movie = { ...series, type: "movie" } as Meta;
function harness() {
  const calls: Array<{ provider: string; path: string; body: unknown }> = [];
  let response: unknown = {
    added: { movies: 1, shows: 1, episodes: 2 },
    deleted: { movies: 1, shows: 1, episodes: 2 },
    not_found: {},
  };
  let simklState = { status: null as string | null, watched: new Set<string>() };
  let readFails = false;
  let animeAccounts = false;
  let traktReadFails = false;
  let traktPages: unknown[] = [[]];
  const reads: string[] = [];
  let onTraktRead = () => {};
  let traktSession = {
    accessToken: "fixture",
    refreshToken: "fixture-refresh",
    username: "fixture",
  };
  const request =
    (provider: string) =>
    async (path: string, options: { body?: unknown } = {}) => {
      if (provider === "Trakt" && path.startsWith("/sync/watched/")) {
        reads.push(path);
        if (traktReadFails) throw new Error("fixture watched read failed");
        onTraktRead();
        const page = Number(new URL(path, "https://fixture.invalid").searchParams.get("page"));
        return traktPages[page - 1] ?? [];
      }
      calls.push({ provider, path, body: options.body });
      return response;
    };
  const id = (id: string) =>
    /^tt\d+$/.test(id) ? { ok: true, target: { kind: "movie", ids: { imdb: id } } } : { ok: false };
  const mocks: Record<string, unknown> = {
    "./cinemeta": { meta: async () => null },
    "./auth": { readActiveStremioAuthKey: () => null },
    "./stremio": { ANIME_CLOUD_ID: /^(kitsu|mal|anilist|anidb):/ },
    "./stremio-item-lock": {},
    "./stremio-watched-sync": {},
    "./trakt/client": { traktRequest: request("Trakt") },
    "./trakt/session": { isAuthenticated: () => true, getSession: () => traktSession },
    "./trakt/ids": { stremioIdToTraktTarget: id },
    "./simkl/client": { simklRequest: request("Simkl") },
    "./simkl/session": { isAuthenticated: () => true },
    "./anilist/session": { isAuthenticated: () => animeAccounts },
    "./mal/session": { isAuthenticated: () => animeAccounts },
    "./simkl/ids": { stremioIdToSimklTarget: id },
    "./simkl/list-status": {
      readSimklStateStrict: async () => {
        if (readFails) throw new Error("offline");
        return simklState;
      },
      invalidateSimklListStatus: () => {},
    },
    "./simkl/watchlist": { invalidateWatchlistCache: () => {} },
    "./simkl/history": { invalidateHistoryCache: () => {} },
  };
  const output = ts.transpileModule(
    readFileSync(new URL("../src/lib/media-provider-actions.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    module,
    module.exports,
  );
  return {
    providers: module.exports as Providers,
    calls,
    connectAnimeAccounts: () => {
      animeAccounts = true;
    },
    reads,
    watchedPages: (...pages: unknown[]) => {
      traktPages = pages;
    },
    failTraktRead: () => {
      traktReadFails = true;
    },
    switchTraktDuringRead: () => {
      onTraktRead = () => {
        traktSession = { accessToken: "other", refreshToken: "other-refresh", username: "other" };
      };
    },
    response: (next: unknown) => {
      response = next;
    },
    state: (status: string | null, watched: string[] = []) => {
      simklState = { status, watched: new Set(watched) };
    },
    failRead: () => {
      readFails = true;
    },
  };
}
const current = () => {};

test("IMDb series watchlist mutation uses shows and rejects not-found success bodies", async () => {
  const h = harness();
  h.response({ added: { shows: 0 }, not_found: { shows: [{ ids: { imdb: "tt123" } }] } });
  const write = h.providers
    .watchlistProviderWrites(series, true)
    .find((w) => w.provider === "Trakt")!;
  await assert.rejects(() => write.run(current), /identify|confirm/i);
  assert.deepEqual(h.calls[0]?.body, { shows: [{ ids: { imdb: "tt123" } }] });
});

test("Trakt watchlist idempotent existing result is confirmed", async () => {
  const h = harness();
  h.response({ added: { shows: 0 }, existing: { shows: 1 }, not_found: { shows: [] } });
  await h.providers.watchlistProviderWrites(series, true)[0]!.run(current);
});

test("Simkl watchlist removal never invokes the destructive history endpoint", async () => {
  const h = harness();
  h.state("plantowatch");
  const result = await h.providers
    .watchlistProviderWrites(series, false)
    .find((w) => w.provider === "Simkl")!
    .run(current);
  assert.match(result!, /history|Simkl/);
  assert.deepEqual(h.calls, []);
});

test("Simkl completed status is preserved by Add to watchlist", async () => {
  const h = harness();
  h.state("completed", ["1:1"]);
  const result = await h.providers
    .watchlistProviderWrites(series, true)
    .find((w) => w.provider === "Simkl")!
    .run(current);
  assert.match(result!, /already.*status/);
  assert.deepEqual(h.calls, []);
});

test("Simkl cannot treat an unreadable current status as an empty list", async () => {
  const h = harness();
  h.failRead();
  await assert.rejects(() =>
    h.providers
      .watchlistProviderWrites(movie, true)
      .find((w) => w.provider === "Simkl")!
      .run(current),
  );
  assert.deepEqual(h.calls, []);
});

test("Simkl Add requires the returned plan-to-watch status", async () => {
  const h = harness();
  h.response({ added: { movies: [{ to: "completed" }] }, not_found: {} });
  await assert.rejects(
    () =>
      h.providers
        .watchlistProviderWrites(movie, true)
        .find((w) => w.provider === "Simkl")!
        .run(current),
    /confirm/,
  );
});

test("movie Unwatched never silently removes the Simkl library item", async () => {
  const h = harness();
  const result = await h.providers
    .watchedProviderWrites(movie, false, { episodes: [] })
    .find((w) => w.provider === "Simkl")!
    .run(current);
  assert.match(result!, /library/);
  assert.deepEqual(h.calls, []);
});

test("episode unwatch uses exact episodes across seasons and keeps the show", async () => {
  const h = harness();
  h.state("watching", ["1:2", "2:1", "2:9"]);
  await h.providers
    .watchedProviderWrites(series, false, {
      episodes: [
        { season: 1, episode: 2 },
        { season: 2, episode: 1 },
      ],
    })
    .find((w) => w.provider === "Simkl")!
    .run(current);
  assert.equal(h.calls[0]?.path, "/sync/history/remove");
  assert.deepEqual(h.calls[0]?.body, {
    shows: [
      {
        ids: { imdb: "tt123" },
        seasons: [
          { number: 1, episodes: [{ number: 2 }] },
          { number: 2, episodes: [{ number: 1 }] },
        ],
      },
    ],
  });
});

test("partial episode acknowledgement never becomes full-series success", async () => {
  const h = harness();
  h.response({ added: { episodes: 1 }, not_found: {} });
  await assert.rejects(
    () =>
      h.providers
        .watchedProviderWrites(series, true, {
          episodes: [
            { season: 1, episode: 1 },
            { season: 1, episode: 2 },
          ],
        })[0]!
        .run(current),
    /every/,
  );
});

test("profile changes during provider preflight prevent the mutation", async () => {
  const h = harness();
  await assert.rejects(() =>
    h.providers
      .watchlistProviderWrites(series, true)
      .find((w) => w.provider === "Simkl")!
      .run(() => {
        throw new Error("profile changed");
      }),
  );
  assert.deepEqual(h.calls, []);
});

test("Trakt status marking does not add another event for an already watched movie", async () => {
  const h = harness();
  h.watchedPages([{ movie: { ids: { imdb: "tt123" } }, plays: 2 }]);
  await h.providers.watchedProviderWrites(movie, true, { episodes: [] })[0]!.run(current);
  assert.deepEqual(h.calls, []);
});

test("Trakt status marking only posts the unwatched subset of selected episodes", async () => {
  const h = harness();
  h.watchedPages([
    {
      show: { ids: { imdb: "tt123" } },
      plays: 2,
      seasons: [
        {
          number: 1,
          episodes: [
            { number: 1, plays: 1 },
            { number: 2, plays: 1 },
          ],
        },
      ],
    },
  ]);
  await h.providers
    .watchedProviderWrites(series, true, {
      episodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    })[0]!
    .run(current);
  assert.deepEqual(h.calls[0]?.body, {
    shows: [{ ids: { imdb: "tt123" }, seasons: [{ number: 1, episodes: [{ number: 3 }] }] }],
  });
});

test("Trakt watched lookup continues after a shortened page and requests season progress", async () => {
  const h = harness();
  h.watchedPages(
    [{ show: { ids: { imdb: "tt999" } }, seasons: [], plays: 1 }],
    [
      {
        show: { ids: { imdb: "tt123" } },
        seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
        plays: 1,
      },
    ],
  );
  await h.providers
    .watchedProviderWrites(series, true, { episodes: [{ season: 1, episode: 1 }] })[0]!
    .run(current);
  assert.equal(h.reads.length, 2);
  assert.ok(h.reads.every((path) => path.includes("extended=progress")));
  assert.deepEqual(h.calls, []);
});

test("Trakt current watched read failures and incomplete progress never cause a blind write", async () => {
  const offline = harness();
  offline.failTraktRead();
  await assert.rejects(() =>
    offline.providers.watchedProviderWrites(movie, true, { episodes: [] })[0]!.run(current),
  );
  assert.deepEqual(offline.calls, []);
  for (const page of [{ invalid: true }, [{ show: { ids: { imdb: "tt123" } }, plays: 1 }]]) {
    const h = harness();
    h.watchedPages(page);
    await assert.rejects(() =>
      h.providers
        .watchedProviderWrites(series, true, { episodes: [{ season: 1, episode: 1 }] })[0]!
        .run(current),
    );
    assert.deepEqual(h.calls, []);
  }
});

test("switching Trakt accounts during watched lookup prevents writing the new account", async () => {
  const h = harness();
  h.switchTraktDuringRead();
  await assert.rejects(
    () => h.providers.watchedProviderWrites(movie, true, { episodes: [] })[0]!.run(current),
    /account|session/i,
  );
  assert.deepEqual(h.calls, []);
});

test("Simkl rejects an unverified anime-to-TV episode mapping before any provider mutation", async () => {
  const h = harness();
  const write = h.providers
    .watchedProviderWrites({ ...series, id: "kitsu:10" }, true, {
      imdbId: "tt123",
      episodes: [{ season: 1, episode: 13 }],
    })
    .find((entry) => entry.provider === "Simkl")!;
  assert.match((await write.preflight?.(current)) ?? "", /could not identify/);
  assert.match((await write.run(current)) ?? "", /could not identify/);
  assert.deepEqual(h.calls, []);
});

test("Simkl native anime coordinates remain supported without a TV alias", async () => {
  const h = harness();
  const write = h.providers
    .watchedProviderWrites({ ...series, id: "mal:10" }, true, {
      episodes: [{ season: 1, episode: 13 }],
    })
    .find((entry) => entry.provider === "Simkl")!;
  assert.equal(await write.preflight?.(current), undefined);
  assert.equal(await write.run(current), undefined);
  assert.deepEqual(h.calls[0]?.body, {
    shows: [{ ids: { mal: 10 }, seasons: [{ number: 1, episodes: [{ number: 13 }] }] }],
  });
});

test("connected anime progress providers disclose unchanged state instead of silently succeeding", async () => {
  const h = harness();
  h.connectAnimeAccounts();
  const writes = h.providers
    .watchedProviderWrites({ ...series, id: "mal:10" }, false, {
      episodes: [{ season: 1, episode: 2 }],
    })
    .filter((entry) => entry.provider === "AniList" || entry.provider === "MyAnimeList");
  assert.deepEqual(
    writes.map((write) => write.provider),
    ["AniList", "MyAnimeList"],
  );
  for (const write of writes)
    assert.match((await write.run(current)) ?? "", /not synced.*Manage progress/);
  assert.deepEqual(h.calls, []);
});
