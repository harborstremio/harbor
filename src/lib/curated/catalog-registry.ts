import type { CuratedListSeed } from "./types";

export const REGISTRY_SEEDS: readonly CuratedListSeed[] = [
  {
    id: "national-film-registry",
    title: "The National Film Registry",
    curator: "Library of Congress",
    blurb:
      "Every December the Library of Congress selects twenty-five films as culturally, historically or aesthetically significant, and preserves them. Each entry carries the Library's own note on why the film was chosen.",
    ordering: "unordered",
    kind: "movie",
    source: {
      kind: "bundled",
      url: "https://www.loc.gov/programs/national-film-preservation-board/film-registry/complete-national-film-registry-listing/",
    },
    expectedCount: 880,
    rowCount: 30,
    prose: true,
  },
  {
    id: "national-film-registry-latest",
    title: "New to the National Film Registry",
    curator: "Library of Congress",
    blurb: "The films the Library of Congress added in its most recent December selection.",
    ordering: "unordered",
    kind: "movie",
    source: {
      kind: "bundled",
      url: "https://www.loc.gov/programs/national-film-preservation-board/film-registry/complete-national-film-registry-listing/",
    },
    expectedCount: 20,
    rowCount: 25,
    discoverRow: true,
    prose: true,
  },
];
