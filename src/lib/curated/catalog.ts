import { REGISTRY_SEEDS } from "./catalog-registry";
import { WIKIDATA_SEEDS } from "./catalog-wikidata";
import type { CuratedListSeed } from "./types";

const POLL_SEEDS: readonly CuratedListSeed[] = [
  {
    id: "nyt-tv-100",
    title: "The 100 Best TV Shows of the 21st Century",
    curator: "The New York Times",
    blurb:
      "The paper's critics ranked the century's television, from Breaking Bad down to Scandal, and argued for every placement.",
    ordering: "ranked",
    kind: "series",
    source: { kind: "bundled" },
    expectedCount: 100,
    rowCount: 100,
    discoverRow: true,
    brand: "nyt",
    publishedYear: 2026,
    companion: {
      youtubeId: "55iwZR_xCDQ",
      title: "Why Breaking Bad topped the list",
      forRank: 1,
    },
  },
  {
    id: "sight-and-sound-2022",
    title: "The Greatest Films of All Time",
    curator: "Sight and Sound",
    blurb:
      "1,639 critics, programmers and academics voted in the British Film Institute's decennial poll. Jeanne Dielman took first place and the argument has not stopped since.",
    ordering: "ranked",
    kind: "movie",
    source: { kind: "trakt", listId: 24346444, url: "https://trakt.tv/lists/24346444" },
    expectedCount: 100,
    rowCount: 30,
    publishedYear: 2022,
  },
  {
    id: "criterion-collection",
    title: "The Criterion Collection",
    curator: "Criterion",
    blurb:
      "Everything Criterion has released, in spine order, which is the order the collection grew rather than any ranking of it.",
    ordering: "spine",
    kind: "movie",
    source: { kind: "trakt", listId: 10851163, url: "https://trakt.tv/lists/10851163" },
    expectedCount: 1518,
    rowCount: 30,
  },
  {
    id: "afi-100-1998",
    title: "100 Years, 100 Movies",
    curator: "American Film Institute",
    blurb:
      "The AFI's first century list, chosen by 1,500 filmmakers, critics and historians. Citizen Kane leads it and Casablanca is second.",
    ordering: "ranked",
    kind: "movie",
    source: { kind: "trakt", listId: 851497, url: "https://trakt.tv/lists/851497" },
    expectedCount: 100,
    rowCount: 30,
    publishedYear: 1998,
  },
];

export const LIST_SEEDS: readonly CuratedListSeed[] = [
  ...POLL_SEEDS,
  ...REGISTRY_SEEDS,
  ...WIKIDATA_SEEDS,
];
