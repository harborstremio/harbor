import assert from "node:assert/strict";
import test from "node:test";
import { mergeLoadedHomeRows } from "../src/views/home/merge-loaded-rows";
import type { HomeRow } from "../src/views/home/home-types";

const fetcher = async () => [];
const firstPage: HomeRow = {
  key: "tmdb-popular-movies", type: "movie", name: "Popular Movies",
  metas: Array.from({ length: 6 }, (_, i) => ({ id: `movie:${i}`, type: "movie", name: `Movie ${i}` })),
  page: 1, hasMore: true, fetcher,
};
const loaded: HomeRow = {
  ...firstPage,
  metas: [...firstPage.metas, { id: "movie:6", type: "movie", name: "Seventh poster" }],
  page: 2, hasMore: false,
};

test("a late addon stage cannot remove the seventh poster or reset pagination", () => {
  const addon: HomeRow = { ...firstPage, key: "addon:movies", name: "Addon movies" };
  const merged = mergeLoadedHomeRows([loaded], [firstPage, addon]);
  assert.deepEqual(merged[0].metas, loaded.metas);
  assert.equal(merged[0].page, 2);
  assert.equal(merged[0].hasMore, false);
  assert.equal(merged[1], addon);
});

test("a fresh feed or changed settings replace earlier pages even with the same row key", () => {
  const refreshed = { ...firstPage, fetcher: async () => [] };
  assert.equal(mergeLoadedHomeRows([loaded], [refreshed])[0], refreshed);
});

test("new metadata applies normally when the current row has not advanced", () => {
  const updated = { ...firstPage, name: "Updated title", metas: [...firstPage.metas].reverse() };
  assert.equal(mergeLoadedHomeRows([firstPage], [updated])[0], updated);
});

test("removed rows stay removed and unpaged sources do not retain stale cards", () => {
  assert.deepEqual(mergeLoadedHomeRows([loaded], []), []);
  const unpaged = { ...firstPage, fetcher: undefined };
  assert.equal(mergeLoadedHomeRows([{ ...loaded, fetcher: undefined }], [unpaged])[0], unpaged);
});
