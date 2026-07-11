import { safeFetch } from "@/lib/safe-fetch";

import type { ListItem } from "../types";
import { ListResolveError } from "../types";

function pageUrl(ref: string): string {
  if (/^ur\d+$/i.test(ref)) return `https://www.imdb.com/user/${ref}/watchlist`;
  return `https://www.imdb.com/list/${ref}/`;
}

export async function resolveImdb(ref: string): Promise<ListItem[]> {
  let text: string;
  try {
    const res = await safeFetch(pageUrl(ref));
    if (res.status === 404) throw new ListResolveError("not-found", "imdb");
    if (!res.ok) throw new ListResolveError("network", "imdb");
    text = await res.text();
  } catch (e) {
    if (e instanceof ListResolveError) throw e;
    throw new ListResolveError("network", "imdb");
  }
  const seen = new Set<string>();
  const items: ListItem[] = [];
  for (const match of text.matchAll(/\btt\d{7,}\b/g)) {
    const id = match[0];
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, type: "movie", name: "" });
  }
  return items;
}
