// A Continue Watching launch must hand the player the identity the stream
// picker itself resolves. Stamping the row's base entry onto the episode
// short-circuits that resolution and plays the wrong cour: JoJo's provider
// season 6 is Steel Ball Run (kitsu:49847), not the 2012 series (kitsu:7158).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { pickEpisodeTitle } from "../src/lib/providers/anizip.ts";
import { animeTrackerTarget } from "../src/lib/tracker-progress.ts";
import { buildBody } from "../src/lib/simkl/scrobble-body.ts";

function load(mocks: Record<string, unknown>) {
  const source = readFileSync("src/lib/cw-anime-play.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in mocks, `unexpected import ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}

// Real AniZip shape for kitsu:49847 episode 2: the localized map ships under
// the singular `title` key, and there is no `titles` key at all.
const STEEL_BALL_RUN = {
  mappings: { kitsu_id: 49847, imdb_id: "tt2359704", thetvdb_id: 262954 },
  episodes: {
    "2": {
      seasonNumber: 6,
      episodeNumber: 2,
      absoluteEpisodeNumber: 192,
      tvdbId: 11871657,
      title: { en: "The Sheriff's Request to Mountain Tim", ja: "マウンテン・ティムへの依頼" },
      image: "sbr-2.jpg",
      runtime: 24,
    },
  },
};

function mocks(overrides: Record<string, unknown> = {}) {
  return {
    "@/lib/anime-cw-ids": { getAnimeCwId: () => "kitsu:7158" },
    "@/lib/anime-detect": { isDetectedAnime: () => true },
    "@/lib/streams/anime-identity": {
      resolveAnimeIdentity: async () => ({ streamId: "kitsu:49847:2", kitsuId: 49847, number: 2 }),
    },
    "@/lib/providers/anizip": {
      aniZipByKitsu: async () => STEEL_BALL_RUN,
      pickEpisodeTitle,
    },
    ...overrides,
  };
}

test("a split-franchise row takes the cour the picker resolves", async () => {
  const { resolveCwAnimePlayEpisode } = load(mocks());
  const out = await resolveCwAnimePlayEpisode({ metaId: "tt2359704", season: 6, episode: 2 });
  assert.equal(out?.kitsuStreamId, "kitsu:49847:2");
  assert.equal(out?.sourceMetaId, "kitsu:49847", "the cour owns its episodes");
  assert.equal(out?.episode, 2);
  assert.equal(out?.imdbSeason, 6);
  assert.equal(out?.imdbEpisode, 2);
  assert.equal(out?.name, "The Sheriff's Request to Mountain Tim");
});

test("the resolved cour reaches AniList/MAL, not the row's base entry", async () => {
  const { resolveCwAnimePlayEpisode } = load(mocks());
  const out = await resolveCwAnimePlayEpisode({ metaId: "tt2359704", season: 6, episode: 2 });
  assert.ok(out);
  assert.deepEqual(animeTrackerTarget("tt2359704", out, out.episode), {
    id: "kitsu:49847",
    episode: 2,
  });
});

test("AniZip's singular title map still names the episode", () => {
  assert.equal(
    pickEpisodeTitle(STEEL_BALL_RUN.episodes["2"] as never),
    "The Sheriff's Request to Mountain Tim",
  );
});

test("the resolved entry never names the row's own base entry", async () => {
  const seen: unknown[] = [];
  const { resolveCwAnimePlayEpisode } = load(
    mocks({
      "@/lib/streams/anime-identity": {
        resolveAnimeIdentity: async (...args: unknown[]) => {
          seen.push(args);
          return { streamId: "kitsu:49847:2", kitsuId: 49847, number: 2 };
        },
      },
    }),
  );
  await resolveCwAnimePlayEpisode({ metaId: "tt2359704", season: 6, episode: 2 });
  // The resolver is handed the row's own coordinates, not a pre-resolved entry.
  assert.deepEqual((seen[0] as unknown[])[2], {
    season: 6,
    episode: 2,
    imdbSeason: undefined,
    imdbEpisode: undefined,
  });
});

test("an unresolvable row falls through to legacy resolution", async () => {
  const { resolveCwAnimePlayEpisode } = load(
    mocks({ "@/lib/streams/anime-identity": { resolveAnimeIdentity: async () => null } }),
  );
  assert.equal(await resolveCwAnimePlayEpisode({ metaId: "tt100", season: 1, episode: 2 }), null);
});

test("an ordinary series never pays for an identity lookup", async () => {
  let calls = 0;
  const { resolveCwAnimePlayEpisode } = load(
    mocks({
      "@/lib/anime-cw-ids": { getAnimeCwId: () => null },
      "@/lib/anime-detect": { isDetectedAnime: () => false },
      "@/lib/streams/anime-identity": {
        resolveAnimeIdentity: async () => {
          calls += 1;
          return null;
        },
      },
    }),
  );
  assert.equal(await resolveCwAnimePlayEpisode({ metaId: "tt100", season: 1, episode: 2 }), null);
  assert.equal(calls, 0);
});

test("a named anime entry owns the scrobble, not the row's IMDb show", () => {
  // Simkl keeps split cours as their own single-season entries; the provider
  // season is not the number that entry counts.
  const body = buildBody(
    "tt2359704",
    {
      season: 6,
      episode: 2,
      imdbSeason: 6,
      imdbEpisode: 2,
      kitsuStreamId: "kitsu:49847:2",
      sourceMetaId: "kitsu:49847",
    },
    100,
    { imdb: "tt2359704" },
  ) as { anime: { ids: Record<string, unknown> }; episode: { season: number; number: number } };
  assert.equal(body.anime.ids.kitsu, 49847);
  assert.deepEqual(body.episode, { season: 1, number: 2 });
});

test("an anime scrobble never carries the row's IMDb id", () => {
  // tt2359704 resolves to Stone Ocean in Simkl's catalogue, while the episode
  // belongs to Steel Ball Run (kitsu 49847). Merging the row's IMDb id into the
  // anime node records the watch on the wrong entry.
  const body = buildBody(
    "tt2359704",
    {
      season: 6,
      episode: 2,
      imdbSeason: 6,
      imdbEpisode: 2,
      kitsuStreamId: "kitsu:49847:2",
      sourceMetaId: "kitsu:49847",
    },
    100,
    { imdb: "tt2359704", title: "JoJo's Bizarre Adventure" },
  ) as { anime: { ids: Record<string, unknown> } };
  assert.deepEqual(body.anime.ids, { kitsu: 49847 });
  assert.equal(body.anime.ids.imdb, undefined);
});

test("a plain show still scrobbles by provider coordinates", () => {
  const body = buildBody("tt123", { season: 1, episode: 6, imdbSeason: 3, imdbEpisode: 6 }, 100, {
    imdb: "tt123",
  }) as { episode: { season: number; number: number } };
  assert.deepEqual(body.episode, { season: 3, number: 6 });
});

test("a non-anime card carries its episode title to the player", () => {
  // Simkl/Trakt rows are Cinemeta-keyed, so the anime resolver declines them and
  // the episode would reach the player nameless — the presence then shows only
  // "S6 E2". The title the card already fetched must ride along.
  const src = readFileSync("src/components/continue-card.tsx", "utf8");
  assert.match(
    src,
    /if \(episode && !episode\.name && episodeTitle\) episode = \{ \.\.\.episode, name: episodeTitle \};/,
  );
  assert.match(
    src,
    /if \(episode && !episode\.still && epStill\) episode = \{ \.\.\.episode, still: epStill \};/,
  );
});

test("the continue card resolves the anime identity before playing", () => {
  const src = readFileSync("src/components/continue-card.tsx", "utf8");
  assert.match(src, /import \{ resolveCwAnimePlayEpisode \} from "@\/lib\/cw-anime-play";/);
  assert.match(src, /const animePlay = await resolveCwAnimePlayEpisode\(\{/);
  assert.match(src, /if \(animePlay\) return animePlay;/);
});
