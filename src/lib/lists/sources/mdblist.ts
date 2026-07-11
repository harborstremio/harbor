import { safeFetch } from "@/lib/safe-fetch";

import type { ListItem } from "../types";
import { ListResolveError } from "../types";

type Row = {
  imdb_id?: string | null;
  tmdb_id?: number | null;
  title?: string;
  release_year?: number | null;
  mediatype?: string;
};

function rowToItem(r: Row): ListItem | null {
  const isShow = r.mediatype === "show" || r.mediatype === "tv";
  const id = r.imdb_id ? r.imdb_id : r.tmdb_id ? (isShow ? `tmdb:tv:${r.tmdb_id}` : `tmdb:movie:${r.tmdb_id}`) : null;
  if (!id) return null;
  return {
    id,
    type: isShow ? "series" : "movie",
    name: r.title ?? "",
    releaseInfo: r.release_year ? String(r.release_year) : undefined,
  };
}

function collectRows(json: unknown): Row[] {
  if (Array.isArray(json)) return json as Row[];
  if (json && typeof json === "object") {
    const obj = json as { movies?: Row[]; shows?: Row[] };
    const movies = (obj.movies ?? []).map((r) => ({ ...r, mediatype: r.mediatype ?? "movie" }));
    const shows = (obj.shows ?? []).map((r) => ({ ...r, mediatype: r.mediatype ?? "show" }));
    return [...movies, ...shows];
  }
  return [];
}

export async function resolveMdblist(ref: string, apikey: string): Promise<ListItem[]> {
  if (!apikey) throw new ListResolveError("missing-key", "mdblist");
  const url = `https://api.mdblist.com/lists/${ref}/items?apikey=${encodeURIComponent(apikey)}`;
  let res: Response;
  try {
    res = await safeFetch(url);
  } catch {
    throw new ListResolveError("network", "mdblist");
  }
  if (res.status === 404) throw new ListResolveError("not-found", "mdblist");
  if (!res.ok) throw new ListResolveError("network", "mdblist");
  const json = await res.json().catch(() => null);
  const items: ListItem[] = [];
  for (const row of collectRows(json)) {
    const item = rowToItem(row);
    if (item) items.push(item);
  }
  return items;
}
