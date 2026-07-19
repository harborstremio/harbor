// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { getSearchDisplayState } from "../src/lib/search-display-state.ts";
import { normalizeSearchQuery } from "../src/lib/search-query.ts";
import type { SearchResults } from "../src/lib/search.ts";

function results(query: string, tmdbUnavailable = false): SearchResults {
  return {
    query,
    topMatch: null,
    people: [],
    movies: [],
    series: [],
    liveTv: [],
    anime: [],
    addonGroups: [],
    addons: [],
    intent: null,
    tmdbUnavailable,
  };
}

test("normalizes cache and result comparisons consistently", () => {
  assert.equal(normalizeSearchQuery("  Ｂａｔｍａｎ   "), "batman");
  assert.equal(normalizeSearchQuery("Batman"), normalizeSearchQuery("batman"));

  const state = getSearchDisplayState(results("Batman"), "  batman  ", "done");
  assert.equal(state.currentResults?.query, "Batman");
});

test("does not present a TMDB outage as no matches", () => {
  const state = getSearchDisplayState(results("Batman", true), "batman", "done");

  assert.equal(state.tmdbUnavailable, true);
  assert.equal(state.hasResults, false);
  assert.equal(state.noResults, false);
});

test("shows no matches only after a complete successful search", () => {
  const state = getSearchDisplayState(results("Batman"), "batman", "done");

  assert.equal(state.tmdbUnavailable, false);
  assert.equal(state.noResults, true);
});
