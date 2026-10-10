export type ListOrdering = "ranked" | "spine" | "unordered" | "awarded";

export type CuratedSource =
  | { kind: "trakt"; listId: number; url: string }
  | { kind: "wikidata"; award: string; awardYear: "ceremony" | "release"; url: string }
  | { kind: "bundled"; url?: string };

export type ListBrand = "nyt";

export type CuratedCompanion = {
  youtubeId: string;
  title: string;
  forRank?: number;
};

export type CuratedListSeed = {
  id: string;
  title: string;
  curator: string;
  blurb: string;
  ordering: ListOrdering;
  kind: "movie" | "series";
  source: CuratedSource;
  expectedCount: number;
  rowCount: number;
  discoverRow?: boolean;
  badge?: string;
  brand?: ListBrand;
  prose?: boolean;
  publishedYear?: number;
  companion?: CuratedCompanion;
};

export type CuratedListItem = {
  rank: number | null;
  imdb: string;
  tmdb?: number;
  title: string;
  year?: number;
  awardYear?: number;
  type?: "movie" | "series";
  note?: string;
};

export type CuratedList = CuratedListSeed & {
  count: number;
  snapshotDate: string;
  head: readonly CuratedListItem[];
};

export type CuratedSnapshot = {
  id: string;
  count: number;
  snapshotDate: string;
  items: CuratedListItem[];
};

export type CuratedListIndex = {
  builtAt: string;
  lists: Array<{
    id: string;
    count: number;
    snapshotDate: string;
    head: CuratedListItem[];
  }>;
};

export function rankInItems(
  items: readonly CuratedListItem[],
  imdbId: string | null | undefined,
): number | null {
  if (!imdbId) return null;
  for (const item of items) {
    if (item.imdb === imdbId) return item.rank;
  }
  return null;
}
