import { get } from "@/lib/providers/tmdb/tmdb-client";
import { movieMeta, seriesMeta, type RawMovie, type RawSeries } from "@/lib/providers/tmdb/tmdb-meta-mappers";

import type { ListItem } from "../types";
import { ListResolveError } from "../types";

type ListRow = (RawMovie & RawSeries) & { media_type?: "movie" | "tv" };
type ListResponse = { items?: ListRow[] };

export async function resolveTmdb(ref: string, tmdbKey: string): Promise<ListItem[]> {
  if (!tmdbKey) throw new ListResolveError("missing-key", "tmdb");
  let data: ListResponse | null;
  try {
    data = await get<ListResponse>(tmdbKey, `list/${ref}`);
  } catch {
    throw new ListResolveError("network", "tmdb");
  }
  if (!data) throw new ListResolveError("not-found", "tmdb");
  const rows = data.items ?? [];
  const items: ListItem[] = [];
  for (const row of rows) {
    if (row.media_type === "tv") items.push(seriesMeta(row));
    else if (row.media_type === "movie") items.push(movieMeta(row));
  }
  return items;
}
