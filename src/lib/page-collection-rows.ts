import { useMemo, useSyncExternalStore } from "react";
import { useCollections, type Collection } from "@/lib/collections";

const KEY = "harbor.pagecollrows.v1";
const CAP_PER_PAGE = 6;
const subs = new Set<() => void>();

export type CollectionRowPage = "home" | "movies" | "shows" | "anime";

export const COLLECTION_ROW_PAGES: { id: CollectionRowPage; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "movies", label: "Movies" },
  { id: "shows", label: "Series" },
  { id: "anime", label: "Anime" },
];

const PAGE_IDS: CollectionRowPage[] = ["home", "movies", "shows", "anime"];

type Store = Record<CollectionRowPage, string[]>;

function empty(): Store {
  return { home: [], movies: [], shows: [], anime: [] };
}

let cache: Store = load();

function load(): Store {
  const out = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return out;
    const p = parsed as Record<string, unknown>;
    for (const page of PAGE_IDS) {
      const list = p[page];
      if (!Array.isArray(list)) continue;
      const seen = new Set<string>();
      for (const id of list) {
        if (typeof id !== "string" || seen.has(id)) continue;
        seen.add(id);
        out[page].push(id);
        if (out[page].length >= CAP_PER_PAGE) break;
      }
    }
    return out;
  } catch {
    return out;
  }
}

function commit(next: Store): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  for (const s of subs) s();
}

function clone(): Store {
  return {
    home: [...cache.home],
    movies: [...cache.movies],
    shows: [...cache.shows],
    anime: [...cache.anime],
  };
}

export function collectionPageIds(page: CollectionRowPage): string[] {
  return cache[page];
}

export function isCollectionOnPage(page: CollectionRowPage, collectionId: string): boolean {
  return cache[page].includes(collectionId);
}

export function collectionPageCap(page: CollectionRowPage): boolean {
  return cache[page].length >= CAP_PER_PAGE;
}

export function addCollectionToPage(page: CollectionRowPage, collectionId: string): boolean {
  if (cache[page].includes(collectionId)) return true;
  if (cache[page].length >= CAP_PER_PAGE) return false;
  const next = clone();
  next[page].push(collectionId);
  commit(next);
  return true;
}

export function removeCollectionFromPage(page: CollectionRowPage, collectionId: string): void {
  if (!cache[page].includes(collectionId)) return;
  const next = clone();
  next[page] = next[page].filter((id) => id !== collectionId);
  commit(next);
}

export function toggleCollectionOnPage(page: CollectionRowPage, collectionId: string): boolean {
  if (isCollectionOnPage(page, collectionId)) {
    removeCollectionFromPage(page, collectionId);
    return false;
  }
  return addCollectionToPage(page, collectionId);
}

export function purgeCollectionFromPages(collectionId: string): void {
  let touched = false;
  const next = clone();
  for (const page of PAGE_IDS) {
    const filtered = next[page].filter((id) => id !== collectionId);
    if (filtered.length !== next[page].length) {
      next[page] = filtered;
      touched = true;
    }
  }
  if (touched) commit(next);
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

function usePageIds(page: CollectionRowPage): string[] {
  return useSyncExternalStore(
    subscribe,
    () => cache[page],
    () => cache[page],
  );
}

export function useCollectionRowsForPage(page: CollectionRowPage): Collection[] {
  const ids = usePageIds(page);
  const collections = useCollections();
  return useMemo(() => {
    const byId = new Map(collections.map((c) => [c.id, c] as const));
    const out: Collection[] = [];
    for (const id of ids) {
      const c = byId.get(id);
      if (c) out.push(c);
    }
    return out;
  }, [ids, collections]);
}

export function usePagesForCollection(collectionId: string): Set<CollectionRowPage> {
  const home = usePageIds("home");
  const movies = usePageIds("movies");
  const shows = usePageIds("shows");
  const anime = usePageIds("anime");
  return useMemo(() => {
    const set = new Set<CollectionRowPage>();
    if (home.includes(collectionId)) set.add("home");
    if (movies.includes(collectionId)) set.add("movies");
    if (shows.includes(collectionId)) set.add("shows");
    if (anime.includes(collectionId)) set.add("anime");
    return set;
  }, [home, movies, shows, anime, collectionId]);
}

export const COLLECTION_ROW_CAP = CAP_PER_PAGE;
