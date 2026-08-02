import { useEffect, useMemo, useState } from "react";
import { setItemWithRecovery, freeStorageSpace } from "@/lib/storage-recovery";
import { randomUuid } from "@/lib/uuid";

const KEY = "harbor.collections.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const subs = new Set<() => void>();

function activeCollectionsKey(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return KEY;
    const s = JSON.parse(raw) as {
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
      activeId?: string | null;
    };
    const id = s.activeId;
    if (!id) return KEY;
    const p = s.profiles?.find((x) => x.id === id);
    if (!p || p.settingsLinked !== false) return KEY;
    return `harbor.collections.${id}`;
  } catch {
    return KEY;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("harbor:profiles-updated", () => {
    memoryFallback = null;
    for (const s of subs) s();
  });
}

export type CollectionItemType = "movie" | "series" | "manga";

export type CollectionItem = {
  id: string;
  type: CollectionItemType;
  name: string;
  poster?: string;
};

export type CollectionItemInput = {
  id: string;
  type?: string;
  name?: string;
  poster?: string;
};

export type Collection = {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  bgImage?: string;
  tags?: string[];
  shared?: boolean;
  items: CollectionItem[];
  createdAt: number;
  updatedAt: number;
};

export const MAX_COLLECTIONS = 24;
export const MAX_COLLECTION_ITEMS = 100;
export const MAX_COLLECTION_NAME = 80;
export const MAX_COLLECTION_DESCRIPTION = 500;
export const MAX_COLLECTION_TAGS = 8;
export const MAX_TAG_LENGTH = 24;

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, MAX_TAG_LENGTH);
}

let memoryFallback: Collection[] | null = null;

function inferType(id: string): "movie" | "series" {
  if (/^(kitsu|mal|anilist|anidb):/i.test(id)) return "series";
  return id.includes(":tv:") || id.includes(":series:") ? "series" : "movie";
}

function normalizeType(type: string | undefined, id: string): CollectionItemType {
  if (type === "series" || type === "tv" || type === "anime") return "series";
  if (type === "movie") return "movie";
  if (type === "manga") return "manga";
  return inferType(id);
}

function toItem(input: CollectionItemInput): CollectionItem {
  return {
    id: input.id,
    type: normalizeType(input.type, input.id),
    name: input.name ?? "",
    poster: input.poster,
  };
}

function read(): Collection[] {
  if (memoryFallback) return memoryFallback.map((c) => ({ ...c, items: [...c.items] }));
  try {
    const key = activeCollectionsKey();
    const raw = localStorage.getItem(key) ?? (key !== KEY ? localStorage.getItem(KEY) : null);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: Collection[] = [];
    for (const el of arr) {
      if (!el || typeof el !== "object") continue;
      const e = el as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.name !== "string") continue;
      const items: CollectionItem[] = [];
      if (Array.isArray(e.items)) {
        for (const rawItem of e.items) {
          if (!rawItem || typeof rawItem !== "object") continue;
          const it = rawItem as Record<string, unknown>;
          if (typeof it.id !== "string") continue;
          items.push({
            id: it.id,
            type: it.type === "series" ? "series" : it.type === "manga" ? "manga" : "movie",
            name: typeof it.name === "string" ? it.name : "",
            poster: typeof it.poster === "string" ? it.poster : undefined,
          });
        }
      }
      const tags: string[] = [];
      if (Array.isArray(e.tags)) {
        for (const raw of e.tags) {
          if (typeof raw !== "string") continue;
          const tag = normalizeTag(raw);
          if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
          if (tags.length >= MAX_COLLECTION_TAGS) break;
        }
      }
      out.push({
        id: e.id,
        name: e.name,
        description: typeof e.description === "string" ? e.description : undefined,
        coverImage: typeof e.coverImage === "string" ? e.coverImage : undefined,
        bgImage: typeof e.bgImage === "string" ? e.bgImage : undefined,
        tags: tags.length ? tags : undefined,
        shared: e.shared === true ? true : undefined,
        items,
        createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
        updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function write(collections: Collection[]): void {
  const key = activeCollectionsKey();
  const payload = JSON.stringify(collections);
  const ok = setItemWithRecovery(key, payload);
  if (!ok) {
    freeStorageSpace();
    const retry = setItemWithRecovery(key, payload);
    if (!retry) {
      memoryFallback = collections;
      console.warn("[collections] localStorage exhausted, holding collections in memory only");
    } else {
      memoryFallback = null;
    }
  } else {
    memoryFallback = null;
  }
  for (const s of subs) s();
}

export function readCollections(): Collection[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCollection(id: string): Collection | null {
  return read().find((c) => c.id === id) ?? null;
}

export function subscribeCollections(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function createCollection(name: string): string | null {
  const trimmed = name.trim().slice(0, MAX_COLLECTION_NAME);
  if (!trimmed) return null;
  const collections = read();
  if (collections.length >= MAX_COLLECTIONS) return null;
  const id = randomUuid();
  const now = Date.now();
  collections.push({ id, name: trimmed, items: [], createdAt: now, updatedAt: now });
  write(collections);
  return id;
}

export function renameCollection(id: string, name: string): void {
  const trimmed = name.trim().slice(0, MAX_COLLECTION_NAME);
  if (!trimmed) return;
  const collections = read();
  const c = collections.find((x) => x.id === id);
  if (!c) return;
  c.name = trimmed;
  c.updatedAt = Date.now();
  write(collections);
}

export function setCollectionDescription(id: string, description: string): void {
  const collections = read();
  const c = collections.find((x) => x.id === id);
  if (!c) return;
  const trimmed = description.trim().slice(0, MAX_COLLECTION_DESCRIPTION);
  c.description = trimmed || undefined;
  c.updatedAt = Date.now();
  write(collections);
}

export function deleteCollection(id: string): void {
  const collections = read();
  const next = collections.filter((c) => c.id !== id);
  if (next.length === collections.length) return;
  write(next);
}

export function addToCollection(collectionId: string, item: CollectionItemInput): void {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c || c.items.length >= MAX_COLLECTION_ITEMS) return;
  if (c.items.some((it) => it.id === item.id)) return;
  c.items.push(toItem(item));
  c.updatedAt = Date.now();
  write(collections);
}

export function removeFromCollection(collectionId: string, itemId: string): void {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return;
  const next = c.items.filter((it) => it.id !== itemId);
  if (next.length === c.items.length) return;
  c.items = next;
  c.updatedAt = Date.now();
  write(collections);
}

export function toggleInCollection(collectionId: string, item: CollectionItemInput): boolean {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return false;
  const has = c.items.some((it) => it.id === item.id);
  if (has) {
    c.items = c.items.filter((it) => it.id !== item.id);
    c.updatedAt = Date.now();
    write(collections);
    return false;
  }
  if (c.items.length >= MAX_COLLECTION_ITEMS) return false;
  c.items.push(toItem(item));
  c.updatedAt = Date.now();
  write(collections);
  return true;
}

export function reorderCollectionItems(collectionId: string, orderedIds: string[]): void {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return;
  const byId = new Map(c.items.map((it) => [it.id, it] as const));
  const next: CollectionItem[] = [];
  for (const id of orderedIds) {
    const it = byId.get(id);
    if (it) {
      next.push(it);
      byId.delete(id);
    }
  }
  for (const it of c.items) if (byId.has(it.id)) next.push(it);
  c.items = next;
  c.updatedAt = Date.now();
  write(collections);
}

export function clearCollectionItems(collectionId: string): void {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c || c.items.length === 0) return;
  c.items = [];
  c.updatedAt = Date.now();
  write(collections);
}

export function addCollectionTag(collectionId: string, raw: string): void {
  const tag = normalizeTag(raw);
  if (!tag) return;
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return;
  const tags = c.tags ?? [];
  if (tags.length >= MAX_COLLECTION_TAGS) return;
  if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
  c.tags = [...tags, tag];
  c.updatedAt = Date.now();
  write(collections);
}

export function removeCollectionTag(collectionId: string, tag: string): void {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c || !c.tags) return;
  const next = c.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
  if (next.length === c.tags.length) return;
  c.tags = next.length ? next : undefined;
  c.updatedAt = Date.now();
  write(collections);
}

export function setCollectionShared(collectionId: string, shared: boolean): void {
  const collections = read();
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return;
  if (!!c.shared === shared) return;
  c.shared = shared ? true : undefined;
  c.updatedAt = Date.now();
  write(collections);
}

export function setCollectionCover(id: string, coverImage: string | null): void {
  const collections = read();
  const c = collections.find((x) => x.id === id);
  if (!c) return;
  c.coverImage = coverImage || undefined;
  c.updatedAt = Date.now();
  write(collections);
}

export function setCollectionBackground(id: string, bgImage: string | null): void {
  const collections = read();
  const c = collections.find((x) => x.id === id);
  if (!c) return;
  c.bgImage = bgImage || undefined;
  c.updatedAt = Date.now();
  write(collections);
}

export function collectionContains(collectionId: string, itemId: string): boolean {
  const c = read().find((x) => x.id === collectionId);
  return !!c && c.items.some((it) => it.id === itemId);
}

export function useCollections(): Collection[] {
  const [collections, setCollections] = useState<Collection[]>(readCollections);
  useEffect(() => {
    const tick = () => setCollections(readCollections());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
  }, []);
  return collections;
}

export function useCollection(id: string | null): Collection | null {
  const collections = useCollections();
  return useMemo(
    () => (id ? collections.find((c) => c.id === id) ?? null : null),
    [collections, id],
  );
}

export function useCollectionsContaining(itemId: string | undefined): Set<string> {
  const collections = useCollections();
  return useMemo(() => {
    const set = new Set<string>();
    if (!itemId) return set;
    for (const c of collections) if (c.items.some((it) => it.id === itemId)) set.add(c.id);
    return set;
  }, [collections, itemId]);
}
