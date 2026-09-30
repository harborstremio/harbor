// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error
import test from "node:test";
import { groupProgress, planGroup } from "../src/lib/anime-progress/plan.ts";
import { decideNextEpisode } from "../src/lib/anime-progress/decide.ts";
import {
  canonicalAnimeKey,
  countNextStatus,
  nextAfterCount,
  nextAfterExact,
  isSpecialEpisode,
  episodeKey,
  type EpisodeCatalog,
} from "../src/lib/anime-progress/normalize.ts";
import type {
  NormalizedAnimeProgress,
  AnimeProgressSource,
} from "../src/lib/anime-progress/types.ts";
import { normalizeMalProgress } from "../src/lib/anime-progress/adapters/mal.ts";
import { normalizeAnilistProgress } from "../src/lib/anime-progress/adapters/anilist.ts";

function exactProgress(source: AnimeProgressSource, watched: Set<string>): NormalizedAnimeProgress {
  return {
    key: "show",
    source,
    kind: "exact",
    watching: true,
    watchedEpisodes: watched,
    watchedCount: watched.size,
    totalEpisodes: null,
    ids: { kitsu: 1004 },
    titles: ["Fullmetal Alchemist: Brotherhood"],
    year: 2009,
    updatedAt: "2024-01-01T00:00:00Z",
  } as NormalizedAnimeProgress;
}

function exactSource(
  source: AnimeProgressSource,
  episodes: [number, number][],
): NormalizedAnimeProgress {
  const watched = new Set<string>();
  for (const [s, e] of episodes) watched.add(episodeKey(s, e));
  return exactProgress(source, watched);
}

function countProgress(source: AnimeProgressSource, count: number): NormalizedAnimeProgress {
  return {
    key: "show",
    source,
    kind: "inferred",
    watching: true,
    watchedEpisodes: null,
    watchedCount: count,
    totalEpisodes: null,
    ids: { kitsu: 1004 },
    titles: ["Fullmetal Alchemist: Brotherhood"],
    year: 2009,
    updatedAt: "2024-01-01T00:00:00Z",
  } as NormalizedAnimeProgress;
}

const PLAUSIBLE: EpisodeCatalog = {
  episodes: new Set(["1:1", "1:2", "1:3", "1:4", "2:1", "2:2"]),
  airDates: new Map([
    ["1:1", Date.UTC(2009, 3, 9)],
    ["1:2", Date.UTC(2009, 3, 16)],
    ["1:3", Date.UTC(2009, 3, 23)],
    ["1:4", Date.UTC(2009, 3, 30)],
    ["2:1", Date.UTC(2012, 7, 12)],
    ["2:2", Date.UTC(2012, 7, 12)],
  ]),
  total: 6,
};

const UNAIRED_OFFSET = Date.now() / 1000 + 3600 * 24 * 100;

function unreleasedEpisodeCatalog(forSeason?: number, forEpisode?: number): EpisodeCatalog {
  const eps = ["1:1", "1:2"];
  const air = new Map<string, number>();
  for (const k of eps) air.set(k, Date.now() + UNAIRED_OFFSET);
  if (forSeason != null && forEpisode != null)
    air.set(episodeKey(forSeason, forEpisode), Date.now());
  return { episodes: new Set(eps), airDates: air, total: null };
}

function exact(s: AnimeProgressSource, eps: [number, number][]): NormalizedAnimeProgress {
  return exactSource(s, eps);
}

function cnt(s: AnimeProgressSource, c: number): NormalizedAnimeProgress {
  return countProgress(s, c);
}

// planGroup: providers agreeing on the next episode produce a single entry.
test("planGroup merges agreeing providers into a single entry", () => {
  const group = groupProgress([cnt("mal", 3), cnt("anilist", 3)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 4);
  assert.equal(d.item.external, "merged");
  assert.equal(d.note, undefined);
});

// A disagreement used to drop the group as a conflict; the earliest proposal
// must win instead so the show still reaches Continue Watching.
test("planGroup takes the earliest episode when providers disagree", () => {
  const group = groupProgress([cnt("mal", 3), cnt("anilist", 1)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 2);
  assert.equal(d.item.external, "merged");
  assert.ok(d.note?.includes("disagreed"));
});

test("planGroup orders disagreements by season before episode", () => {
  // mal proposes 2:1, anilist proposes 1:2; the earliest is 1:2 even though a
  // naive episode-only comparison would pick 2:1.
  const group = groupProgress([cnt("mal", 4), cnt("anilist", 1)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 2);
});

test("planGroup keeps the show when one provider is finished and the other is not", () => {
  // simkl has watched the whole catalog (count 6 of 6) while mal sits at 3.
  const group = groupProgress([cnt("mal", 3), cnt("simkl", 6)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 4);
  // Only the provider that proposed an episode decides the entry's source tag.
  assert.equal(d.item.external, "mal");
});

test("planGroup still skips when every provider is finished", () => {
  const group = groupProgress([cnt("mal", 6), cnt("anilist", 7)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "skip");
  if (d.kind !== "skip") return;
  assert.equal(d.reason, "completed");
});

test("planGroup prefers the exact provider's earlier episode over a count-based one", () => {
  const group = groupProgress([exact("trakt", [[1, 1]]), cnt("mal", 3)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 2);
});

test("planGroup still skips when the next episode is unaired", () => {
  const unaired: EpisodeCatalog = {
    episodes: new Set(["1:1", "1:2"]),
    airDates: new Map([
      ["1:1", Date.now() + 86_400_000],
      ["1:2", Date.now() + 86_400_000],
    ]),
    total: null,
  };
  const group = groupProgress([cnt("mal", 1), cnt("anilist", 1)]);
  const d = planGroup(group[0], unaired, {});
  assert.equal(d.kind, "skip");
  if (d.kind !== "skip") return;
  assert.equal(d.reason, "unreleased");
});

test("planGroup still shows the next episode when one provider is behind", () => {
  const group = groupProgress([cnt("mal", 3), cnt("anilist", 6)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 4);
  assert.equal(d.item.external, "mal");
});

test("decideNextEpisode treats a zero total as unknown and follows the catalog", () => {
  const d = decideNextEpisode({
    progress: { ...cnt("mal", 5), totalEpisodes: 0 },
    catalog: PLAUSIBLE,
  });
  assert.equal("skip" in d, false);
  if ("skip" in d) return;
  assert.equal(d.season, 2);
  assert.equal(d.episode, 2);
});

test("decideNextEpisode infers the next episode without a catalog when the total is unknown", () => {
  const d = decideNextEpisode({
    progress: { ...cnt("mal", 5), totalEpisodes: 0 },
    catalog: null,
  });
  assert.equal("skip" in d, false);
  if ("skip" in d) return;
  assert.equal(d.season, 1);
  assert.equal(d.episode, 6);
});

test("planGroup falls back to the first episode when watching has not started", () => {
  const group = groupProgress([cnt("mal", 0), cnt("anilist", 0)]);
  const d = planGroup(group[0], PLAUSIBLE, {});
  assert.equal(d.kind, "entry");
  if (d.kind !== "entry") return;
  assert.equal(d.item.state?.season, 1);
  assert.equal(d.item.state?.episode, 1);
  assert.equal(d.item._id, "kitsu:1004");
  assert.equal(d.item.external, "merged");
  assert.ok(d.note?.includes("first episode"));
});

test("a MAL entry set to watching with zero episodes survives normalization", () => {
  const n = normalizeMalProgress({
    status: "watching",
    score: 0,
    numEpisodesWatched: 0,
    isRewatching: false,
    updatedAt: "2024-01-01T00:00:00Z",
    anime: {
      id: 41006,
      title: "Higurashi no Naku Koro ni Gou",
      mainPicture: null,
      numEpisodes: 24,
      mean: null,
    },
  });
  assert.ok(n);
  if (!n) return;
  assert.equal(n.watchedCount, 0);
  assert.equal(n.source, "mal");
  assert.equal(n.ids.mal, 41006);
});

test("finished and caught-up MAL entries are still dropped", () => {
  const base = {
    score: 0,
    isRewatching: false,
    updatedAt: "2024-01-01T00:00:00Z",
    anime: { id: 1, title: "X", mainPicture: null, numEpisodes: 24, mean: null },
  };
  assert.equal(
    normalizeMalProgress({ ...base, status: "completed", numEpisodesWatched: 24 }),
    null,
  );
  assert.equal(normalizeMalProgress({ ...base, status: "watching", numEpisodesWatched: 24 }), null);
});

test("a CURRENT AniList entry with zero progress survives normalization", () => {
  const n = normalizeAnilistProgress({
    id: 9,
    status: "CURRENT",
    progress: 0,
    score: 0,
    media: {
      id: 9,
      idMal: 41006,
      title: {
        romaji: "Higurashi",
        english: "Higurashi",
        native: "ひぐらし",
        userPreferred: "Higurashi",
      },
      coverImage: { extraLarge: null, large: null, medium: null },
      bannerImage: null,
      format: "TV",
      episodes: 24,
      averageScore: null,
      seasonYear: 2020,
    },
  });
  assert.ok(n);
  if (!n) return;
  assert.equal(n.watchedCount, 0);
  assert.equal(n.key, "mal:41006");
});
