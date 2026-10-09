import assert from "node:assert/strict";
import test from "node:test";
import { relevanceScore } from "../src/lib/streams/plugins/extension/match.ts";
import { mergeHits, searchGroups } from "../src/lib/streams/plugins/extension/search.ts";
import type { Meta } from "../src/lib/cinemeta.ts";

const hit = (id: string, name = id): Meta => ({ id, type: "movie", name });

test("the same item reached through two providers is one result", () => {
  // Two providers of the same plugin can both answer with the same title, and they arrive as
  // different Meta objects carrying the same id.
  const merged = mergeHits([[hit("a"), hit("b")], [hit("b"), hit("c")]], 100);
  assert.deepEqual(
    merged.map((m) => m.id),
    ["a", "b", "c"],
  );
  // The first one to arrive is the one kept, so the order the plugins answered in is respected.
  const first = mergeHits([[hit("a", "first")], [hit("a", "second")]], 100);
  assert.equal(first[0].name, "first");
});

test("each plugin keeps its own results, and one title found twice stays twice", () => {
  // Each plugin's answer is read on its own, so one plugin cannot see another's hits.
  const uhd = searchGroups(
    { id: "p1", name: "UHDmoviesProvider", icon: "u.png" },
    [{ providerId: "uhdmovies", providerName: "UHDmovies", metas: [hit("same"), hit("only-uhd")] }],
    10,
  );
  const mod = searchGroups(
    { id: "p2", name: "Moviesmod" },
    [{ providerId: "moviesmod", providerName: "Moviesmod", metas: [hit("same")] }],
    10,
  );
  const failed = searchGroups({ id: "p3", name: "Perverzija" }, null, 10);
  // p3 failed, so it leaves no rail behind.
  const groups = [uhd, mod].filter((g) => g !== null);
  assert.deepEqual(
    groups.map((g) => g.pluginId),
    ["p1", "p2"],
  );
  assert.equal(groups[0].pluginName, "UHDmoviesProvider");
  assert.equal(groups[0].pluginIcon, "u.png");
  assert.equal(failed, null);
  // The same title found by two plugins stays two groups: they are different sources of it.
  assert.deepEqual(
    groups.map((g) => g.metas.map((m) => m.id)),
    [["same", "only-uhd"], ["same"]],
  );
});

test("a plugin's providers are kept as their own shelves", () => {
  // VegaMovies is a plugin of two providers, and a title found on both is two listings with two
  // links. One may play where the other does not, so they are shown as two rather than folded.
  const plugin = { id: "vegamovies", name: "VegaMovies", icon: "v.png" };
  const group = searchGroups(
    plugin,
    [
      { providerId: "vegamovies", providerName: "VegaMovies", metas: [hit("a"), hit("b")] },
      { providerId: "rogmovies", providerName: "Rogmovies", metas: [hit("c")] },
    ],
    100,
  );
  assert.ok(group, "the plugin found something");
  assert.deepEqual(
    group.providers.map((p) => [p.providerName, p.metas.map((m) => m.id)]),
    [
      ["VegaMovies", ["a", "b"]],
      ["Rogmovies", ["c"]],
    ],
    "one shelf per provider, in the order they were asked in",
  );
  assert.deepEqual(group.metas.map((m) => m.id), ["a", "b", "c"], "and every hit kept");
});

test("one title on two providers is two results, because the links differ", () => {
  // The ids say which provider a listing came from, so nothing folds the two together.
  const plugin = { id: "vegamovies", name: "VegaMovies" };
  const group = searchGroups(
    plugin,
    [
      { providerId: "vegamovies", providerName: "VegaMovies", metas: [hit("vegamovies:1")] },
      { providerId: "rogmovies", providerName: "Rogmovies", metas: [hit("rogmovies:1")] },
    ],
    100,
  );
  assert.deepEqual(group?.metas.map((m) => m.id), ["vegamovies:1", "rogmovies:1"]);
});

test("a provider that found nothing leaves no empty shelf", () => {
  const plugin = { id: "vegamovies", name: "VegaMovies" };
  const group = searchGroups(
    plugin,
    [
      { providerId: "rogmovies", providerName: "Rogmovies", metas: [] },
      { providerId: "vegamovies", providerName: "VegaMovies", metas: [hit("a")] },
    ],
    100,
  );
  assert.deepEqual(group?.providers.map((p) => p.providerName), ["VegaMovies"]);
});

test("a plugin whose every provider found nothing gets no group at all", () => {
  const plugin = { id: "vegamovies", name: "VegaMovies" };
  assert.equal(
    searchGroups(plugin, [{ providerId: "vegamovies", providerName: "VegaMovies", metas: [] }], 10),
    null,
  );
  assert.equal(searchGroups(plugin, [], 10), null);
  assert.equal(searchGroups(plugin, null, 10), null);
});

test("the cap is across a plugin's providers, not one per provider", () => {
  // Otherwise a plugin of four providers could fill the page by answering from all four.
  const plugin = { id: "vegamovies", name: "VegaMovies" };
  const group = searchGroups(
    plugin,
    [
      { providerId: "vegamovies", providerName: "VegaMovies", metas: [hit("a"), hit("b")] },
      { providerId: "rogmovies", providerName: "Rogmovies", metas: [hit("c"), hit("d")] },
    ],
    3,
  );
  assert.equal(group?.metas.length, 3);
  assert.deepEqual(group?.metas.map((m) => m.id), ["a", "b", "c"]);
  assert.deepEqual(
    group?.providers.map((p) => p.metas.length),
    [2, 1],
    "the shelf it ran into is the one that stops short",
  );
});

test("a plugin that found nothing gets no group", () => {
  assert.equal(
    searchGroups({ id: "p1", name: "One" }, [{ providerId: "x", providerName: "X", metas: [] }], 10),
    null,
  );
  const two = searchGroups(
    { id: "p2", name: "Two" },
    [{ providerId: "y", providerName: "Y", metas: [hit("b")] }],
    10,
  );
  assert.deepEqual(two?.metas.map((m) => m.id), ["b"]);
});

test("a plugin's own results are still de-duplicated and capped", () => {
  const many = Array.from({ length: 5 }, (_, i) => hit(`m${i}`));
  const group = searchGroups(
    { id: "p1", name: "One" },
    [{ providerId: "one", providerName: "One", metas: [hit("m0"), hit("m0"), ...many] }],
    3,
  );
  assert.deepEqual(
    group?.metas.map((m) => m.id),
    ["m0", "m1", "m2"],
  );
});

test("a plugin's own results are still de-duplicated and capped", () => {
  const many = Array.from({ length: 5 }, (_, i) => hit(`m${i}`));
  const group = searchGroups(
    { id: "p1", name: "One" },
    [{ providerId: "one", providerName: "One", metas: [hit("m0"), hit("m0"), ...many] }],
    3,
  );
  assert.deepEqual(
    group?.metas.map((m) => m.id),
    ["m0", "m1", "m2"],
  );
});

test("the title that was asked for scores above loose matches of the same words", () => {
  // The apostrophe is furniture: it normalises away, so both spellings of the query score alike.
  for (const query of ["india got latent", "india's got latent"]) {
    const exact = relevanceScore("India's Got Latent", query);
    // A season range is furniture too, so the same show under a season heading is the same answer.
    assert.equal(exact, relevanceScore("India Got Latent Season 2", query), query);
    assert.ok(exact > relevanceScore("India", query), query);
    assert.ok(exact > relevanceScore("Got Latent", query), query);
    assert.ok(relevanceScore("India", query) > 0, query);
  }
  // A name with none of the words in it is worth nothing, and neither is an empty query.
  assert.equal(relevanceScore("Breaking Bad", "india got latent"), 0);
  assert.equal(relevanceScore("India's Got Latent", "   "), 0);
});

test("sorting by relevance puts the answer first, whatever order the provider used", () => {
  const query = "india got latent";
  // What a provider's own search returns: the wanted title buried among looser matches.
  const fromProvider = ["India", "Latent India", "India's Got Latent", "Best Of India"].map((name) =>
    hit(name, name),
  );
  const ordered = fromProvider
    .map((meta) => ({ meta, score: relevanceScore(meta.name, query) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.meta.name);
  assert.equal(ordered[0], "India's Got Latent");
});

test("results are capped without dropping one that came earlier", () => {
  const merged = mergeHits([[hit("a"), hit("b"), hit("c")], [hit("d")]], 2);
  assert.deepEqual(
    merged.map((m) => m.id),
    ["a", "b"],
  );
  assert.deepEqual(mergeHits([], 10), []);
  assert.deepEqual(mergeHits([[]], 10), []);
});
