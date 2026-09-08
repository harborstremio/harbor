import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { Meta } from "../src/lib/cinemeta.ts";

type Actions = typeof import("../src/lib/media-context-actions.ts");
const movie = { id: "tt123", type: "movie", name: "Fixture" } as Meta;
const series = { ...movie, type: "series" } as Meta;

function harness() {
  const calls: Array<{ provider: string; value: unknown }> = [];
  const fetches: string[] = [];
  let profile = { activeId: "fixture", settingsLinked: false };
  let full: Meta = {
    ...series,
    videos: [
      { id: "tt123:1:1", season: 1, episode: 1, released: "2020-01-01" },
      { id: "tt123:1:2", season: 1, episode: 2, released: "2999-01-01" },
    ],
  };
  const failures = new Set<string>();
  const step =
    (provider: string) =>
    async (...value: unknown[]) => {
      calls.push({ provider, value });
      if (failures.has(provider)) throw new Error("Fixture failure");
    };
  const mocks: Record<string, unknown> = {
    "./i18n": {
      t: (key: string, vars?: Record<string, string | number>) => {
        for (const [name, value] of Object.entries(vars ?? {}))
          key = key.replaceAll(`{${name}}`, String(value));
        return key;
      },
    },
    "./cinemeta": {
      meta: async (_type: string, id: string) => {
        fetches.push(id);
        if (failures.has("native-catalog") && /^(kitsu|mal|anilist|anidb):/.test(id)) return null;
        if (failures.has("fetch")) throw new Error("offline");
        return full;
      },
    },
    "./aired": {
      airedOnly: (eps: Array<{ released: string }>, get: (e: { released: string }) => string) =>
        eps.filter((e) => Date.parse(get(e)) < Date.now()),
    },
    "./membership-operations": { captureMembershipProfile: () => profile },
    "./auth": { readActiveStremioAuthKey: () => "fixture-auth" },
    "./stremio": { ANIME_CLOUD_ID: /^(kitsu|mal|anilist|anidb):/ },
    "./watchlist": {
      setLocalWatchlistAcknowledged: step("local-watchlist"),
      clearWatchlistAggregate: step("aggregate"),
    },
    "./media-favorites": {
      setMediaFavoriteSafely: () => ({
        status: failures.has("favorite") ? "error" : "added",
        reason: "storage-failed",
      }),
    },
    "./movie-watched": { setMovieWatchedLocalAcknowledged: step("local-movie") },
    "./watched-flag": { setWatchedFlagAcknowledged: step("flag") },
    "./manual-watched": {
      setManualWatchedManyAcknowledged: step("local-episodes"),
      recordManualWatchedMeta: () => {},
    },
    "./playback-history": { savePlayback: () => {} },
    "./watch-events": { recordWatchEvent: () => {} },
    "./media-provider-actions": {
      watchlistProviderWrites: (_input: unknown, on: boolean) => [
        { provider: "Trakt", run: () => step("trakt-watchlist")(on) },
        {
          provider: "Simkl",
          preflight: async () => {
            if (failures.has("preflight")) throw new Error("offline");
            return failures.has("unsafe") ? "History would be removed." : undefined;
          },
          run: async () =>
            failures.has("unsafe") ? "History would be removed." : step("simkl-watchlist")(on),
        },
      ],
      watchedProviderWrites: (_meta: unknown, on: boolean, options: unknown) => [
        { provider: "Trakt", run: () => step("trakt-watched")(on, options) },
        { provider: "Simkl", run: () => step("simkl-watched")(on, options) },
      ],
    },
  };
  const output = ts.transpileModule(
    readFileSync(new URL("../src/lib/media-context-actions.ts", import.meta.url), "utf8"),
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
    actions: module.exports as Actions,
    calls,
    fetches,
    failures,
    setFull: (next: Meta) => {
      full = next;
    },
    switchProfile: () => {
      profile = { activeId: "other", settingsLinked: false };
    },
  };
}

test("explicit watchlist removal reports provider failure and preserves aggregate evidence", async () => {
  const h = harness();
  h.failures.add("simkl-watchlist");
  const result = await h.actions.setContextWatchlist(movie, false);
  assert.deepEqual(
    result.outcomes.map((o) => [o.provider, o.status]),
    [
      ["Harbor", "updated"],
      ["Trakt", "updated"],
      ["Simkl", "failed"],
    ],
  );
  assert.equal(
    h.calls.some((c) => c.provider === "aggregate"),
    false,
  );
  assert.throws(() => h.actions.requireMediaActionSuccess(result), /Harbor.*Trakt.*Simkl/s);
});

test("partial provider errors translate their labels and reasons before interpolation", () => {
  const h = harness();
  const translated: Record<string, string> = {
    "Updated: {providers}.": "تم التحديث لدى: {providers}.",
    "{provider}: {reason}": "{provider}: {reason}",
    "The destination is no longer available.": "لم تعد الوجهة متاحة.",
  };
  const translate = (key: string, vars?: Record<string, string | number>) => {
    let value = translated[key] ?? key;
    for (const [name, replacement] of Object.entries(vars ?? {}))
      value = value.replaceAll(`{${name}}`, String(replacement));
    return value;
  };
  assert.throws(
    () =>
      h.actions.requireMediaActionSuccess(
        {
          outcomes: [
            { provider: "Harbor", status: "updated" },
            {
              provider: "Simkl",
              status: "unsupported",
              reason: "The destination is no longer available.",
            },
          ],
        },
        translate,
      ),
    { message: "تم التحديث لدى: Harbor.\nSimkl: لم تعد الوجهة متاحة." },
  );
});

test("local watchlist failure prevents provider writes", async () => {
  const h = harness();
  h.failures.add("local-watchlist");
  const result = await h.actions.setContextWatchlist(movie, true);
  assert.equal(result.outcomes[0]?.status, "failed");
  assert.deepEqual(
    h.calls.map((c) => c.provider),
    ["local-watchlist"],
  );
});

test("blocking an unsafe provider prevents every local and remote write", async () => {
  const h = harness();
  h.failures.add("unsafe");
  const result = await h.actions.setContextWatchlist(movie, false, "block");
  assert.deepEqual(h.calls, []);
  assert.equal(result.outcomes[0]?.status, "unsupported");
  assert.equal(result.noChanges, true);
  assert.throws(() => h.actions.requireMediaActionSuccess(result), /No changes were made/);
});

test("skipping an unsafe provider keeps confirmed safe changes and reports it", async () => {
  const h = harness();
  h.failures.add("unsafe");
  const result = await h.actions.setContextWatchlist(movie, false, "skip");
  assert.deepEqual(
    result.outcomes.map((o) => [o.provider, o.status]),
    [
      ["Harbor", "updated"],
      ["Trakt", "updated"],
      ["Simkl", "unsupported"],
    ],
  );
  assert.equal(
    h.calls.some((c) => c.provider === "aggregate"),
    false,
  );
});

test("blocking policy fails closed when current provider state cannot be read", async () => {
  const h = harness();
  h.failures.add("preflight");
  const result = await h.actions.setContextWatchlist(movie, true, "block");
  assert.deepEqual(h.calls, []);
  assert.equal(result.outcomes[0]?.status, "failed");
});

test("series loading failure never sets a global watched flag or writes providers", async () => {
  const h = harness();
  h.failures.add("fetch");
  await assert.rejects(() => h.actions.setContextWatched(series, true), /offline|episode/i);
  assert.deepEqual(h.calls, []);
});

test("empty series episode metadata never claims the series is watched", async () => {
  const h = harness();
  h.setFull(series);
  await assert.rejects(() => h.actions.setContextWatched(series, true), /episode/i);
  assert.deepEqual(h.calls, []);
});

test("series actions send only released exact episodes, not a whole-show mutation", async () => {
  const h = harness();
  await h.actions.setContextWatched(series, true);
  const local = h.calls.find((c) => c.provider === "local-episodes")!;
  assert.deepEqual(local.value, ["tt123", [{ season: 1, episode: 1 }], true]);
  const provider = h.calls.find((c) => c.provider === "trakt-watched")!;
  assert.deepEqual((provider.value as unknown[])[1], {
    episodes: [{ season: 1, episode: 1 }],
    videos: [
      { id: "tt123:1:1", season: 1, episode: 1, released: "2020-01-01" },
      { id: "tt123:1:2", season: 1, episode: 2, released: "2999-01-01" },
    ],
    imdbId: undefined,
  });
});

test("episode unwatch keeps exact identity and clears the all-watched flag", async () => {
  const h = harness();
  await h.actions.setContextWatched(series, false, { episode: { season: 2, episode: 4 } });
  assert.deepEqual(h.calls.find((c) => c.provider === "local-episodes")?.value, [
    "tt123",
    [{ season: 2, episode: 4 }],
    false,
  ]);
  assert.deepEqual(h.calls.find((c) => c.provider === "flag")?.value, ["tt123", false]);
  assert.equal(h.calls.filter((c) => c.provider.endsWith("watched")).length, 2);
});

test("favorite reports rejected local persistence", async () => {
  const h = harness();
  h.failures.add("favorite");
  const result = await h.actions.setContextFavorite(movie, true);
  assert.equal(result.outcomes[0]?.status, "failed");
});

test("an explicit multi-episode selection never sets the whole-series flag", async () => {
  const h = harness();
  await h.actions.setContextWatched(series, true, {
    episodes: [
      { season: 1, episode: 2 },
      { season: 2, episode: 3 },
      { season: 1, episode: 2 },
    ],
  });
  assert.deepEqual(h.calls.find((c) => c.provider === "local-episodes")?.value, [
    "tt123",
    [
      { season: 1, episode: 2 },
      { season: 2, episode: 3 },
    ],
    true,
  ]);
  assert.equal(
    h.calls.some((c) => c.provider === "flag"),
    false,
  );
});

test("anime source identity stays local while an explicit provider mapping is used remotely", async () => {
  const h = harness();
  await h.actions.setContextWatched({ ...series, id: "kitsu:10" }, true, {
    imdbId: "tt123",
    episode: { season: 1, episode: 13 },
    providerEpisode: { season: 2, episode: 1 },
  });
  assert.deepEqual(h.calls.find((c) => c.provider === "local-episodes")?.value, [
    "kitsu:10",
    [{ season: 1, episode: 13 }],
    true,
  ]);
  const providerCall = h.calls.find((c) => c.provider === "trakt-watched");
  assert.ok(providerCall);
  const options = (providerCall.value as unknown[])[1] as {
    episodes: unknown;
    verifiedEpisodeMapping: boolean;
  };
  assert.deepEqual(options.episodes, [{ season: 2, episode: 1 }]);
  assert.equal(options.verifiedEpisodeMapping, true);
});

test("native anime without source metadata never borrows the IMDb TV catalog for a title write", async () => {
  const h = harness();
  h.failures.add("native-catalog");
  await assert.rejects(
    h.actions.setContextWatched({ ...series, id: "kitsu:10" }, true, { imdbId: "tt123" }),
    /Episode information is unavailable/,
  );
  assert.deepEqual(h.fetches, ["kitsu:10"]);
  assert.deepEqual(h.calls, []);
});

test("unmapped anime unwatch preserves every IMDb alias flag and episode override", async () => {
  const h = harness();
  await h.actions.setContextWatched({ ...series, id: "kitsu:10" }, false, {
    imdbId: "tt123",
    episode: { season: 1, episode: 13 },
  });
  assert.deepEqual(
    h.calls.filter((call) => call.provider === "local-episodes" || call.provider === "flag"),
    [
      { provider: "local-episodes", value: ["kitsu:10", [{ season: 1, episode: 13 }], false] },
      { provider: "flag", value: ["kitsu:10", false] },
    ],
  );
});

test("verified anime unwatch clears only the mapped IMDb episode alias", async () => {
  const h = harness();
  await h.actions.setContextWatched({ ...series, id: "kitsu:10" }, false, {
    imdbId: "tt123",
    episode: { season: 1, episode: 13 },
    providerEpisode: { season: 2, episode: 1 },
  });
  assert.deepEqual(
    h.calls.filter((call) => call.provider === "local-episodes").map((call) => call.value),
    [
      ["kitsu:10", [{ season: 1, episode: 13 }], false],
      ["tt123", [{ season: 2, episode: 1 }], false],
    ],
  );
});
