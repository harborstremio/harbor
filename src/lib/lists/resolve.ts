import { resolveImdb } from "./sources/imdb";
import { resolveLetterboxd } from "./sources/letterboxd";
import { resolveMal } from "./sources/mal";
import { resolveMdblist } from "./sources/mdblist";
import { resolveTmdb } from "./sources/tmdb";
import { resolveTrakt } from "./sources/trakt";
import type { CustomList, ListItem, ListKeys, ResolveResult } from "./types";

const CAP = 500;

function dedupe(items: ListItem[]): ListItem[] {
  const seen = new Set<string>();
  const out: ListItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= CAP) break;
  }
  return out;
}

export async function resolveList(list: CustomList, keys: ListKeys): Promise<ResolveResult> {
  let items: ListItem[];
  switch (list.source) {
    case "mdblist":
      items = await resolveMdblist(list.ref, keys.mdblistKey);
      break;
    case "trakt":
      items = await resolveTrakt(list.ref);
      break;
    case "tmdb":
      items = await resolveTmdb(list.ref, keys.tmdbKey);
      break;
    case "letterboxd":
      items = await resolveLetterboxd(list.ref);
      break;
    case "imdb":
      items = await resolveImdb(list.ref);
      break;
    case "mal":
      items = await resolveMal(list.ref);
      break;
  }
  return { items: dedupe(items) };
}
