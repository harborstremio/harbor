import type { CuratedListSeed } from "./types";

function wikidata(award: string, awardYear: "ceremony" | "release") {
  return {
    kind: "wikidata" as const,
    award,
    awardYear,
    url: `https://www.wikidata.org/wiki/${award}`,
  };
}

export const WIKIDATA_SEEDS: readonly CuratedListSeed[] = [
  {
    id: "nbr-top-ten",
    title: "Top Ten Films",
    curator: "National Board of Review",
    blurb:
      "A group of New York critics and academics has named ten films a year since 1930, which makes this the oldest unbroken top ten in American criticism.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q1966965", "release"),
    expectedCount: 894,
    rowCount: 30,
  },
  {
    id: "locarno-golden-leopard",
    title: "Golden Leopard",
    curator: "Locarno Film Festival",
    blurb:
      "Locarno's top prize, awarded since 1946 by the jury of its international competition.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q1700510", "ceremony"),
    badge: "Golden Leopard",
    expectedCount: 82,
    rowCount: 120,
  },
  {
    id: "golden-horse-best-feature",
    title: "Best Feature Film",
    curator: "Golden Horse Awards",
    blurb:
      "Taipei has honoured the year's best Chinese-language feature since 1962, and the winners come from Taiwan, Hong Kong and the mainland alike.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q5579574", "ceremony"),
    badge: "Golden Horse Best Film",
    expectedCount: 52,
    rowCount: 80,
  },
  {
    id: "sundance-documentary-jury",
    title: "Documentary Grand Jury Prize",
    curator: "Sundance Film Festival",
    blurb: "The documentary jury prize at Sundance, awarded every January since 1985.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q2366088", "ceremony"),
    badge: "Sundance Documentary Prize",
    expectedCount: 41,
    rowCount: 60,
  },
  {
    id: "annecy-cristal-feature",
    title: "Cristal for a Feature Film",
    curator: "Annecy International Animation Film Festival",
    blurb:
      "Annecy is where animation is judged by animators, and the Cristal is what it gives a feature. Awarded since 1985.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q30327044", "ceremony"),
    badge: "Annecy Cristal",
    expectedCount: 36,
    rowCount: 60,
  },
  {
    id: "karlovy-vary-crystal-globe",
    title: "Crystal Globe",
    curator: "Karlovy Vary International Film Festival",
    blurb:
      "The oldest top prize in central Europe. Karlovy Vary has run since 1946, and for decades it alternated years with Moscow, which is why the winners skip.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q2565389", "ceremony"),
    badge: "Crystal Globe",
    expectedCount: 32,
    rowCount: 60,
  },
  {
    id: "san-sebastian-golden-shell",
    title: "Golden Shell",
    curator: "San Sebastián International Film Festival",
    blurb:
      "Best film at San Sebastián since 1957, with a gap in the early eighties when the festival lost its competition.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q775086", "ceremony"),
    badge: "Golden Shell",
    expectedCount: 21,
    rowCount: 60,
  },
  {
    id: "cannes-camera-dor",
    title: "Caméra d'Or",
    curator: "Cannes Film Festival",
    blurb:
      "Cannes gives this to a first feature, whichever section it played in, so it is the one prize at the festival a director can only win once.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q775091", "ceremony"),
    badge: "Caméra d'Or",
    expectedCount: 11,
    rowCount: 60,
  },
  {
    id: "tiff-peoples-choice",
    title: "People's Choice Award",
    curator: "Toronto International Film Festival",
    blurb:
      "Toronto runs no competition jury. Its top award is counted from ballots handed in by festival audiences.",
    ordering: "awarded",
    kind: "movie",
    source: wikidata("Q39087364", "ceremony"),
    badge: "Toronto People's Choice",
    expectedCount: 7,
    rowCount: 60,
  },
];
