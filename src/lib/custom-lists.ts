import { useEffect, useMemo, useState } from "react";
import { setItemWithRecovery, freeStorageSpace } from "@/lib/storage-recovery";
import { randomUuid } from "@/lib/uuid";
import { persistableAddonOrigin, persistableVideos, type Meta } from "@/lib/cinemeta";

const KEY = "harbor.customlists.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const subs = new Set<() => void>();

function activeListsKey(): string {
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
    return `harbor.customlists.${id}`;
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

export type ListItem = {
  id: string;
  type: "movie" | "series" | "manga";
  name: string;
  poster?: string;
  addedAt: number;
  addonOrigin?: Meta["addonOrigin"];
  videos?: Meta["videos"];
};

export type ListItemInput = {
  id: string;
  type?: string;
  name?: string;
  poster?: string;
  addonOrigin?: Meta["addonOrigin"];
  videos?: Meta["videos"];
};

export type ListBgMode = "auto" | "custom";

export type CustomList = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order?: number;
  coverImage?: string;
  bgImage?: string;
  bgMode?: ListBgMode;
  items: ListItem[];
};

export const MAX_LISTS = 24;
export const MAX_ITEMS = 100;

let memoryFallback: CustomList[] | null = null;

function inferType(id: string): "movie" | "series" {
  if (/^(kitsu|mal|anilist|anidb):/i.test(id)) return "series";
  return id.includes(":tv:") || id.includes(":series:") ? "series" : "movie";
}

function normalizeType(type: string | undefined, id: string): "movie" | "series" | "manga" {
  if (type === "series" || type === "tv" || type === "anime") return "series";
  if (type === "movie") return "movie";
  if (type === "manga") return "manga";
  return inferType(id);
}

function toItem(input: ListItemInput): ListItem {
  return {
    id: input.id,
    type: normalizeType(input.type, input.id),
    name: input.name ?? "",
    poster: input.poster,
    addedAt: Date.now(),
    addonOrigin: persistableAddonOrigin(input.addonOrigin),
    videos: persistableVideos(input.videos),
  };
}

function read(): CustomList[] {
  if (memoryFallback) return memoryFallback.map((l) => ({ ...l, items: [...l.items] }));
  try {
    const key = activeListsKey();
    const raw = localStorage.getItem(key) ?? (key !== KEY ? localStorage.getItem(KEY) : null);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: CustomList[] = [];
    for (const el of arr) {
      if (!el || typeof el !== "object") continue;
      const e = el as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.name !== "string") continue;
      const items: ListItem[] = [];
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
            addedAt: typeof it.addedAt === "number" ? it.addedAt : 0,
            addonOrigin: persistableAddonOrigin(it.addonOrigin),
            videos: persistableVideos(it.videos),
          });
        }
      }
      out.push({
        id: e.id,
        name: e.name,
        createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
        updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : 0,
        order: typeof e.order === "number" ? e.order : undefined,
        coverImage: typeof e.coverImage === "string" ? e.coverImage : undefined,
        bgImage: typeof e.bgImage === "string" ? e.bgImage : undefined,
        bgMode: e.bgMode === "custom" ? "custom" : e.bgMode === "auto" ? "auto" : undefined,
        items,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function write(lists: CustomList[]): void {
  const key = activeListsKey();
  const payload = JSON.stringify(lists);
  const ok = setItemWithRecovery(key, payload);
  if (!ok) {
    freeStorageSpace();
    const retry = setItemWithRecovery(key, payload);
    if (!retry) {
      memoryFallback = lists;
      console.warn("[custom-lists] localStorage exhausted, holding lists in memory only");
    } else {
      memoryFallback = null;
    }
  } else {
    memoryFallback = null;
  }
  for (const s of subs) s();
}

export function readLists(): CustomList[] {
  return read().sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return b.updatedAt - a.updatedAt;
  });
}

export function reorderLists(orderedIds: string[]): void {
  const lists = read();
  const pos = new Map(orderedIds.map((id, i) => [id, i] as const));
  for (const l of lists) {
    const p = pos.get(l.id);
    if (p != null) l.order = p;
  }
  write(lists);
}

export function reorderListItems(listId: string, orderedIds: string[]): void {
  const lists = read();
  const list = lists.find((l) => l.id === listId);
  if (!list) return;
  const byId = new Map(list.items.map((it) => [it.id, it] as const));
  const next: ListItem[] = [];
  for (const id of orderedIds) {
    const it = byId.get(id);
    if (it) {
      next.push(it);
      byId.delete(id);
    }
  }
  for (const it of list.items) if (byId.has(it.id)) next.push(it);
  list.items = next;
  write(lists);
}

export function subscribeLists(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function createList(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const lists = read();
  if (lists.length >= MAX_LISTS) return null;
  const id = randomUuid();
  const now = Date.now();
  lists.push({ id, name: trimmed, createdAt: now, updatedAt: now, items: [] });
  write(lists);
  return id;
}

export function renameList(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const lists = read();
  const list = lists.find((l) => l.id === id);
  if (!list) return;
  list.name = trimmed;
  list.updatedAt = Date.now();
  write(lists);
}

export function deleteList(id: string): void {
  const lists = read();
  const next = lists.filter((l) => l.id !== id);
  if (next.length === lists.length) return;
  write(next);
}

export function addToList(listId: string, item: ListItemInput): void {
  const lists = read();
  const list = lists.find((l) => l.id === listId);
  if (!list || list.items.length >= MAX_ITEMS) return;
  if (list.items.some((it) => it.id === item.id)) return;
  list.items.push(toItem(item));
  list.updatedAt = Date.now();
  write(lists);
}

export function removeFromList(listId: string, itemId: string): void {
  const lists = read();
  const list = lists.find((l) => l.id === listId);
  if (!list) return;
  const next = list.items.filter((it) => it.id !== itemId);
  if (next.length === list.items.length) return;
  list.items = next;
  list.updatedAt = Date.now();
  write(lists);
}

export function toggleInList(listId: string, item: ListItemInput): boolean {
  const lists = read();
  const list = lists.find((l) => l.id === listId);
  if (!list) return false;
  const has = list.items.some((it) => it.id === item.id);
  if (has) {
    list.items = list.items.filter((it) => it.id !== item.id);
    list.updatedAt = Date.now();
    write(lists);
    return false;
  }
  if (list.items.length >= MAX_ITEMS) return false;
  list.items.push(toItem(item));
  list.updatedAt = Date.now();
  write(lists);
  return true;
}

export function listContains(listId: string, itemId: string): boolean {
  const list = read().find((l) => l.id === listId);
  return !!list && list.items.some((it) => it.id === itemId);
}

export function useCustomLists(): CustomList[] {
  const [lists, setLists] = useState<CustomList[]>(readLists);
  useEffect(() => {
    const tick = () => setLists(readLists());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
  }, []);
  return lists;
}

export function useList(id: string | null): CustomList | null {
  const lists = useCustomLists();
  return useMemo(() => (id ? (lists.find((l) => l.id === id) ?? null) : null), [lists, id]);
}

export function useListsContaining(itemId: string | undefined): Set<string> {
  const lists = useCustomLists();
  return useMemo(() => {
    const set = new Set<string>();
    if (!itemId) return set;
    for (const l of lists) if (l.items.some((it) => it.id === itemId)) set.add(l.id);
    return set;
  }, [lists, itemId]);
}
