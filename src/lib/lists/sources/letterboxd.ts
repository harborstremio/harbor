import { safeFetch } from "@/lib/safe-fetch";

import type { ListItem } from "../types";
import { ListResolveError } from "../types";

function rssUrl(ref: string): string {
  const clean = ref.replace(/\/$/, "");
  return `https://letterboxd.com/${clean}/rss/`;
}

function tag(item: Element, name: string): string {
  const el = item.getElementsByTagName(name)[0];
  return el?.textContent?.trim() ?? "";
}

export async function resolveLetterboxd(ref: string): Promise<ListItem[]> {
  let text: string;
  try {
    const res = await safeFetch(rssUrl(ref));
    if (res.status === 404) throw new ListResolveError("not-found", "letterboxd");
    if (!res.ok) throw new ListResolveError("network", "letterboxd");
    text = await res.text();
  } catch (e) {
    if (e instanceof ListResolveError) throw e;
    throw new ListResolveError("network", "letterboxd");
  }
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new ListResolveError("unparseable", "letterboxd");
  }
  const items: ListItem[] = [];
  for (const item of Array.from(doc.getElementsByTagName("item"))) {
    const tvId = tag(item, "tmdb:tvId");
    const movieId = tag(item, "tmdb:movieId");
    if (!tvId && !movieId) continue;
    const year = tag(item, "letterboxd:filmYear");
    const filmName = tag(item, "letterboxd:filmTitle") || tag(item, "title");
    items.push({
      id: tvId ? `tmdb:tv:${tvId}` : `tmdb:movie:${movieId}`,
      type: tvId ? "series" : "movie",
      name: filmName,
      releaseInfo: year || undefined,
    });
  }
  return items;
}
