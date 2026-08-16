// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  isGenericEpisodeTitle,
  mergeSeriesEpisodeTitles,
  pickPreferredEpisodeTitle,
  resolveEpisodeTitleOnDemand,
  waitForEpisodeTitles,
} from "../src/lib/episode-title.ts";

test("recognizes empty, unnumbered, and numbered placeholder episode titles", () => {
  assert.equal(isGenericEpisodeTitle(undefined, 1), true);
  assert.equal(isGenericEpisodeTitle("   ", 1), true);
  assert.equal(isGenericEpisodeTitle("Episode 1", 1), true);
  assert.equal(isGenericEpisodeTitle(" episode 01 ", 1), true);
  assert.equal(isGenericEpisodeTitle("EPISODE\t1", 1), true);
  assert.equal(isGenericEpisodeTitle("Untitled", 1), true);
  assert.equal(isGenericEpisodeTitle("TBD", 1), true);
  assert.equal(isGenericEpisodeTitle(" TBA ", 1), true);
});

test("preserves real titles and placeholders for a different episode", () => {
  assert.equal(isGenericEpisodeTitle("An Encounter", 1), false);
  assert.equal(isGenericEpisodeTitle("Episode One", 1), false);
  assert.equal(isGenericEpisodeTitle("Episode 2", 1), false);
  assert.equal(isGenericEpisodeTitle("Episode 1: The Beginning", 1), false);
});

test("provider precedence keeps a real primary title and replaces a generic one", () => {
  assert.equal(
    pickPreferredEpisodeTitle(1, "Kitsu title", "AniZip title"),
    "Kitsu title",
  );
  assert.equal(
    pickPreferredEpisodeTitle(1, "Episode 1", "AniZip title"),
    "AniZip title",
  );
  assert.equal(pickPreferredEpisodeTitle(1, undefined, undefined), null);
});

test("video source precedence lets a real name replace a generic title", () => {
  assert.equal(
    pickPreferredEpisodeTitle(14, "Episode 14", "Bringing Jay Home"),
    "Bringing Jay Home",
  );
  assert.equal(
    pickPreferredEpisodeTitle(14, "A real title", "Alternate name"),
    "A real title",
  );
});

test("generic rows wait for enrichment before becoming displayable", async () => {
  const episodes = [{ number: 1, title: "Episode 1" }];
  let release!: (value: typeof episodes) => void;
  const enrichment = new Promise<typeof episodes>((resolve) => {
    release = resolve;
  });
  let settled = false;
  const ready = waitForEpisodeTitles(episodes, enrichment).then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  episodes[0].title = "An Encounter";
  release(episodes);
  assert.equal((await ready)[0].title, "An Encounter");
});

test("real episode titles do not wait for unrelated enrichment", async () => {
  const episodes = [{ number: 1, title: "An Encounter" }];
  const never = new Promise<typeof episodes>(() => {});
  assert.equal((await waitForEpisodeTitles(episodes, never))[0].title, "An Encounter");
});

test("ordinary series titles fall through TMDB and TVDB placeholders to matching Cinemeta", () => {
  const tmdb = [{ seasonNumber: 34, episodeNumber: 14, name: "Episode 14" }];
  const cachedTvdb = [{ seasonNumber: 34, number: 14, name: "Episode 14" }];
  const cinemeta = [
    { season: 34, episode: 14, name: "Bringing Jay Home", title: "Episode 14" },
  ];

  const [resolved] = mergeSeriesEpisodeTitles(cachedTvdb.map((episode) => ({
    ...episode,
    episodeNumber: episode.number,
  })), { tmdb, tvdb: cachedTvdb, cinemeta });

  assert.equal(resolved.name, "Bringing Jay Home");
});

test("ordinary series titles preserve a real primary title over later providers", () => {
  const tmdb = [{ seasonNumber: 1, episodeNumber: 1, name: "Pilot" }];
  const [resolved] = mergeSeriesEpisodeTitles(tmdb, {
    tmdb,
    tvdb: [{ seasonNumber: 1, number: 1, name: "TVDB title" }],
    cinemeta: [{ season: 1, episode: 1, name: "Cinemeta title" }],
  });

  assert.equal(resolved.name, "Pilot");
});

test("ordinary series titles never merge a different season or episode", () => {
  const tmdb = [{ seasonNumber: 34, episodeNumber: 14, name: "Episode 14" }];
  const [resolved] = mergeSeriesEpisodeTitles(tmdb, {
    tmdb,
    tvdb: [{ seasonNumber: 34, number: 13, name: "Wrong TVDB title" }],
    cinemeta: [
      { season: 33, episode: 14, name: "Wrong season" },
      { season: 34, episode: 15, name: "Wrong episode" },
    ],
  });

  assert.equal(resolved.name, "Episode 14");
});

test("Continue-card title resolution waits for the exact episode during an early click", async () => {
  let release!: (episodes: Array<{ season: number; episode: number; name?: string }>) => void;
  let loads = 0;
  const pending = resolveEpisodeTitleOnDemand(
    { season: 34, episode: 14, runtime: 60 },
    "Episode 14",
    () => {
      loads += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  );

  await Promise.resolve();
  assert.equal(loads, 1);
  release([
    { season: 34, episode: 13, name: "A different episode" },
    { season: 34, episode: 14, name: "Bringing Jay Home" },
  ]);
  assert.deepEqual(await pending, {
    season: 34,
    episode: 14,
    runtime: 60,
    name: "Bringing Jay Home",
  });
});

test("Continue-card title resolution uses a real displayed title without loading again", async () => {
  let loads = 0;
  const resolved = await resolveEpisodeTitleOnDemand(
    { season: 1, episode: 1 },
    "Pilot",
    async () => {
      loads += 1;
      return [{ season: 1, episode: 1, name: "Other title" }];
    },
  );

  assert.deepEqual(resolved, { season: 1, episode: 1, name: "Pilot" });
  assert.equal(loads, 0);
});

test("Continue-card title resolution falls back at its explicit wait deadline", async () => {
  let loads = 0;
  const episode = { season: 34, episode: 14, runtime: 60 };
  const resolved = await Promise.race([
    resolveEpisodeTitleOnDemand(
      episode,
      "Episode 14",
      () => {
        loads += 1;
        return new Promise(() => {});
      },
      0,
    ),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("episode title lookup exceeded its deadline")), 100);
    }),
  ]);

  assert.deepEqual(resolved, { ...episode, name: "Episode 14" });
  assert.equal(loads, 1);
});

test("Continue-card title resolution treats provider failure as a title miss", async () => {
  const episode = { season: 34, episode: 14 };
  const resolved = await resolveEpisodeTitleOnDemand(
    episode,
    "Episode 14",
    async () => {
      throw new Error("provider unavailable");
    },
    50,
  );

  assert.deepEqual(resolved, { ...episode, name: "Episode 14" });
});
