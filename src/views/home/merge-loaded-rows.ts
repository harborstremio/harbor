import type { HomeRow } from "./home-types";

export function mergeLoadedHomeRows(current: HomeRow[], incoming: HomeRow[]): HomeRow[] {
  const byKey = new Map(current.map((row) => [row.key, row]));
  return incoming.map((row) => {
    const loaded = byKey.get(row.key);
    // The addon stage reuses this build's fetchers. A new feed/settings build does not.
    if (!row.fetcher || loaded?.fetcher !== row.fetcher || loaded.page <= row.page) return row;
    return { ...row, metas: loaded.metas, page: loaded.page, hasMore: loaded.hasMore };
  });
}
