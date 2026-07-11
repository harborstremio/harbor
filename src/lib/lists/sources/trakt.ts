import { traktRequest, TraktApiError } from "@/lib/trakt/client";
import { traktItemToMeta } from "@/lib/trakt/to-meta";
import type { TraktItem } from "@/lib/trakt/types";

import type { ListItem } from "../types";
import { ListResolveError } from "../types";

type Row = {
  type: "movie" | "show" | string;
  movie?: { title: string; year: number | null; ids: { imdb?: string; tmdb?: number } };
  show?: { title: string; year: number | null; ids: { imdb?: string; tmdb?: number } };
};

function parseRef(ref: string): { user: string; listId: string } | null {
  const parts = ref.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { user: parts[0], listId: parts[parts.length - 1] };
}

export async function resolveTrakt(ref: string): Promise<ListItem[]> {
  const parsed = parseRef(ref);
  if (!parsed) throw new ListResolveError("unparseable", "trakt");
  let rows: Row[];
  try {
    rows = await traktRequest<Row[]>(
      `/users/${encodeURIComponent(parsed.user)}/lists/${encodeURIComponent(parsed.listId)}/items/movies,shows`,
    );
  } catch (e) {
    if (e instanceof TraktApiError) {
      if (e.status === 404 || e.status === 401) throw new ListResolveError("not-found", "trakt");
    }
    throw new ListResolveError("network", "trakt");
  }
  const items: ListItem[] = [];
  for (const r of rows) {
    const entry = r.type === "movie" ? r.movie : r.type === "show" ? r.show : null;
    if (!entry) continue;
    const traktItem: TraktItem = {
      type: r.type === "show" ? "show" : "movie",
      title: entry.title,
      year: entry.year,
      ids: entry.ids,
    };
    const meta = traktItemToMeta(traktItem);
    if (meta) items.push(meta);
  }
  return items;
}
