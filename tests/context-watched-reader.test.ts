import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { Meta } from "../src/lib/cinemeta.ts";

type Reader = typeof import("../src/lib/context-watched-state.ts");
const videos = [
  { id: "tt123:1:1", season: 1, episode: 1, released: "2020-01-01" },
  { id: "tt123:1:2", season: 1, episode: 2, released: "2020-01-02" },
  { id: "tt123:1:3", season: 1, episode: 3, released: "2999-01-01" },
];
const meta: Meta = { id: "tt123", type: "series", name: "Fixture", videos };

function harness() {
  let profile = "fixture";
  let stremio = true;
  let trakt = false;
  let simkl = false;
  let anilist = false;
  let animeEntry = { episodes: 12 as number | null, entry: { status: "CURRENT", progress: 3 } };
  let failTrakt = false;
  let afterRead = () => {};
  const calls: string[] = [];
  const mappings = (id: string) =>
    /^tt\d+$/.test(id) ? { ok: true, target: { kind: "movie", ids: { imdb: id } } } : { ok: false };
  const mocks: Record<string, unknown> = {
    react: {},
    "./cinemeta": { meta: async () => ({ ...meta }) },
    "./aired": {
      airedOnly: (
        values: Array<{ released?: string }>,
        dateOf: (v: { released?: string }) => string,
      ) => values.filter((value) => Date.parse(dateOf(value)) < Date.now()),
    },
    "./auth": { readActiveStremioAuthKey: () => (stremio ? profile : null) },
    "./membership-operations": {
      captureMembershipProfile: () => ({ activeId: profile, settingsLinked: false }),
      isMembershipProfileCurrent: (captured: { activeId: string }) => captured.activeId === profile,
    },
    "./stremio": {
      ANIME_CLOUD_ID: /^(kitsu|mal|anilist|anidb):/,
      cloudWriteId: (id: string, imdb: string | null) => imdb || id,
      libraryGetOneStrict: async () => {
        calls.push("Stremio");
        afterRead();
        return { state: { watched: "fixture", flaggedWatched: 1 } };
      },
    },
    "./stremio-watched": {
      decodeWatchedEpisodes: async (_field: string, _videos: unknown, strict: boolean) => {
        assert.equal(strict, true);
        return new Set(["1:1"]);
      },
      stremioMovieWatched: () => true,
    },
    "./trakt/session": {
      isAuthenticated: () => trakt,
      getSession: () => (trakt ? { username: profile, refreshToken: profile } : null),
    },
    "./simkl/session": {
      isAuthenticated: () => simkl,
      getSession: () => (simkl ? { accessToken: profile } : null),
    },
    "./anilist/session": {
      isAuthenticated: () => anilist,
      getSession: () => (anilist ? { userId: profile, accessToken: profile } : null),
    },
    "./mal/session": { isAuthenticated: () => false, getSession: () => null },
    "./anilist/sync": { resolveAnilistMediaId: async () => 123 },
    "./anilist/mutations": {
      fetchListEntry: async (_id: number, strict: boolean) => {
        assert.equal(strict, true);
        return animeEntry;
      },
    },
    "./mal/mutations": {},
    "./trakt/ids": { stremioIdToTraktTarget: mappings },
    "./simkl/ids": { stremioIdToSimklTarget: mappings },
    "./media-provider-actions": {
      readTraktWatched: async () => {
        calls.push("Trakt");
        if (failTrakt) throw new Error("offline");
        return { movie: true, episodes: new Set(["4:7"]) };
      },
    },
    "./simkl/list-status": {
      readSimklStateStrict: async () => ({ status: null, watched: new Set(["1:2"]) }),
    },
    "./manual-watched": {},
    "./movie-watched": {},
    "./watched-flag": {},
    "./episode-progress": {},
  };
  const output = ts.transpileModule(
    readFileSync(new URL("../src/lib/context-watched-state.ts", import.meta.url), "utf8"),
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
    reader: module.exports as Reader,
    calls,
    simklOnly: () => {
      stremio = false;
      simkl = true;
    },
    animeCompletedWithoutTotal: () => {
      animeEntry = { episodes: null, entry: { status: "COMPLETED", progress: 0 } };
    },
    traktOnly: () => {
      stremio = false;
      trakt = true;
    },
    failTrakt: () => {
      failTrakt = true;
    },
    anilistOnly: () => {
      stremio = false;
      anilist = true;
    },
    switchDuringRead: () => {
      afterRead = () => {
        profile = "other";
      };
    },
  };
}

test("menu reads Stremio's actual bitfield against released episode scope", async () => {
  const h = harness();
  const state = await h.reader.readContextWatchedSnapshot({ meta });
  assert.deepEqual(state.keys, ["1:1", "1:2"]);
  assert.deepEqual(state.providers, [{ provider: "Stremio", watched: new Set(["1:1"]) }]);
});

test("mapped anime episode normalizes provider coordinates without marking sibling episodes", async () => {
  const h = harness();
  h.traktOnly();
  const state = await h.reader.readContextWatchedSnapshot({
    meta: { ...meta, id: "kitsu:123", type: "anime" },
    imdbId: "tt123",
    episode: { sourceMetaId: "kitsu:456", season: 1, episode: 2, imdbSeason: 4, imdbEpisode: 7 },
  });
  assert.deepEqual(state.keys, ["1:2"]);
  assert.deepEqual(state.providers[0]?.watched, new Set(["1:2"]));
});

test("a failed provider read remains unknown instead of an empty watched set", async () => {
  const h = harness();
  h.traktOnly();
  h.failTrakt();
  const state = await h.reader.readContextWatchedSnapshot({ meta });
  assert.equal(state.providers[0]?.watched, null);
});

test("a profile switch discards an in-flight watched snapshot", async () => {
  const h = harness();
  h.switchDuringRead();
  await assert.rejects(h.reader.readContextWatchedSnapshot({ meta }), /profile.*changed/i);
});

test("movie watched state reads provider flags without relying on the local title flag", async () => {
  const h = harness();
  const state = await h.reader.readContextWatchedSnapshot({ meta: { ...meta, type: "movie" } });
  assert.deepEqual(state.keys, ["movie"]);
  assert.deepEqual(state.providers[0]?.watched, new Set(["movie"]));
});

test("AniList watched progress uses source-local order, ignoring franchise absolute numbers", async () => {
  const h = harness();
  h.anilistOnly();
  const state = await h.reader.readContextWatchedSnapshot({
    meta: { ...meta, id: "kitsu:123", type: "anime" },
    episode: { season: 1, episode: 2, absoluteNumber: 13 },
  });
  assert.deepEqual(state.providers, [{ provider: "AniList", watched: new Set(["1:2"]) }]);
});

test("unmapped anime progress remains unknown instead of becoming unwatched", async () => {
  const h = harness();
  h.anilistOnly();
  const state = await h.reader.readContextWatchedSnapshot({
    meta: { ...meta, id: "kitsu:123", type: "anime" },
    episode: { sourceMetaId: "kitsu:456", season: 1, episode: 1, absoluteNumber: 13 },
  });
  assert.equal(state.providers[0]?.watched, null);
});

test("Simkl native anime IDs compare native coordinates even when TV hints are present", async () => {
  const h = harness();
  h.simklOnly();
  const state = await h.reader.readContextWatchedSnapshot({
    meta: { ...meta, id: "mal:123", type: "anime" },
    episode: { season: 1, episode: 2, imdbSeason: 4, imdbEpisode: 7 },
  });
  assert.deepEqual(state.providers[0]?.watched, new Set(["1:2"]));
});

test("Simkl title-only anime IMDb mapping does not guess episode coordinates", async () => {
  const h = harness();
  h.simklOnly();
  const state = await h.reader.readContextWatchedSnapshot({
    meta: { ...meta, id: "mal:123", type: "anime" },
    imdbId: "tt123",
    episode: { season: 1, episode: 2 },
  });
  assert.equal(state.providers[0]?.watched, null);
});

test("completed anime with no verified total never becomes unwatched", async () => {
  const h = harness();
  h.anilistOnly();
  h.animeCompletedWithoutTotal();
  const state = await h.reader.readContextWatchedSnapshot({
    meta: { ...meta, id: "kitsu:123", type: "anime" },
    episode: { season: 1, episode: 2, absoluteNumber: 2 },
  });
  assert.equal(state.providers[0]?.watched, null);
});

test("strict anime entry readers reject missing content and accept verified absent membership", async () => {
  for (const provider of ["anilist", "mal"] as const) {
    let payload: unknown = {};
    const module = { exports: {} };
    const output = ts.transpileModule(
      readFileSync(new URL(`../src/lib/${provider}/mutations.ts`, import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    new Function("require", "module", "exports", output)(
      () => ({ anilistRequest: async () => payload, malRequest: async () => payload }),
      module,
      module.exports,
    );
    const read = (
      module.exports as { fetchListEntry: (id: number, strict: boolean) => Promise<unknown> }
    ).fetchListEntry;
    await assert.rejects(read(123, true), /could not be read safely/);
    payload = provider === "anilist" ? { Media: null } : { id: 456, num_episodes: 12 };
    await assert.rejects(read(123, true), /could not be read safely/);
    payload =
      provider === "anilist"
        ? { Media: { episodes: 12, mediaListEntry: null } }
        : { id: 123, num_episodes: 12, my_list_status: null };
    assert.equal(((await read(123, true)) as { entry: unknown }).entry, null);
    if (provider === "mal") {
      payload = { id: 123, num_episodes: 12 };
      assert.equal(((await read(123, true)) as { entry: unknown }).entry, null);
      payload = { id: 123, num_episodes: 12, my_list_status: {} };
      await assert.rejects(read(123, true), /could not be read safely/);
    }
  }
});
