import { setItemWithRecovery, freeStorageSpace } from "@/lib/storage-recovery";
import { randomUuid } from "@/lib/uuid";
import { useEffect, useMemo, useState } from "react";

const KEY = "harbor.customlists.v1";
const subs = new Set<() => void>();

export type ListItem = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  addedAt: number;
};

export type ListItemInput = { id: string; type?: string; name?: string; poster?: string };

export type CustomList = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: ListItem[];
};

export const MAX_LISTS = 24;
export const MAX_ITEMS = 100;

let memoryFallback: CustomList[] | null = null;

function inferType(id: string): "movie" | "series" {
  return id.includes(":tv:") || id.includes(":series:") ? "series" : "movie";
}

function normalizeType(type: string | undefined, id: string): "movie" | "series" {
  if (type === "series" || type === "tv") return "series";
  if (type === "movie") return "movie";
  return inferType(id);
}

function toItem(input: ListItemInput): ListItem {
  return {
    id: input.id,
    type: normalizeType(input.type, input.id),
    name: input.name ?? "",
    poster: input.poster,
    addedAt: Date.now(),
  };
}

function read(): CustomList[] {
  if (memoryFallback) return memoryFallback.map((l) => ({ ...l, items: [...l.items] }));
  try {
    const raw = localStorage.getItem(KEY);
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
            type: it.type === "series" ? "series" : "movie",
            name: typeof it.name === "string" ? it.name : "",
            poster: typeof it.poster === "string" ? it.poster : undefined,
            addedAt: typeof it.addedAt === "number" ? it.addedAt : 0,
          });
        }
      }
      out.push({
        id: e.id,
        name: e.name,
        createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
        updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : 0,
        items,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function write(lists: CustomList[]): void {
  const payload = JSON.stringify(lists);
  const ok = setItemWithRecovery(KEY, payload);
  if (!ok) {
    freeStorageSpace();
    const retry = setItemWithRecovery(KEY, payload);
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
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
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
