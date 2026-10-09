import { useEffect, useMemo, useState } from "react";
import { setItemWithRecovery, freeStorageSpace } from "@/lib/storage-recovery";
import type { MyRating } from "./types";

const KEY = "harbor.ratings.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const subs = new Set<() => void>();

type RatingMap = Record<string, MyRating>;

let memoryFallback: RatingMap | null = null;

function activeRatingsKey(): string {
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
    return `harbor.ratings.${id}`;
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

function coerce(raw: unknown): MyRating | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.itemKey !== "string" || typeof e.score !== "number") return null;
  const mt = e.mediaType;
  const mediaType =
    mt === "movie" || mt === "series" || mt === "anime" || mt === "manga" ? mt : "movie";
  return {
    itemKey: e.itemKey,
    mediaType,
    score: e.score,
    review: typeof e.review === "string" && e.review ? e.review : undefined,
    spoiler: e.spoiler === true || undefined,
    title: typeof e.title === "string" ? e.title : "",
    poster: typeof e.poster === "string" ? e.poster : undefined,
    updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : 0,
  };
}

function read(): RatingMap {
  if (memoryFallback) return { ...memoryFallback };
  try {
    const key = activeRatingsKey();
    const raw = localStorage.getItem(key) ?? (key !== KEY ? localStorage.getItem(KEY) : null);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const out: RatingMap = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const r = coerce(v);
      if (r) out[k] = r;
    }
    return out;
  } catch {
    return {};
  }
}

function write(map: RatingMap): boolean {
  const key = activeRatingsKey();
  const payload = JSON.stringify(map);
  let persisted = setItemWithRecovery(key, payload);
  if (!persisted) {
    freeStorageSpace();
    persisted = setItemWithRecovery(key, payload);
    if (!persisted) {
      memoryFallback = map;
      console.warn("[ratings] localStorage exhausted, holding ratings in memory only");
    } else {
      memoryFallback = null;
    }
  } else {
    memoryFallback = null;
  }
  for (const s of subs) s();
  return persisted;
}

function slimmed(map: RatingMap, dropReviews: boolean): RatingMap {
  const out: RatingMap = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { ...v, poster: undefined, review: dropReviews ? undefined : v.review };
  }
  return out;
}

export function subscribeRatings(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function readRatings(): MyRating[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getRating(itemKey: string): MyRating | null {
  return read()[itemKey] ?? null;
}

export function setRatingLocal(r: MyRating): void {
  const map = read();
  map[r.itemKey] = r;
  write(map);
}

export function setRatingsLocalBulk(list: MyRating[]): boolean {
  if (list.length === 0) return true;
  const map = read();
  for (const r of list) map[r.itemKey] = r;
  if (write(map)) return true;
  if (write(slimmed(map, false))) return true;
  if (write(slimmed(map, true))) return true;
  memoryFallback = map;
  for (const s of subs) s();
  return false;
}

export function removeRatingLocal(itemKey: string): void {
  const map = read();
  if (!(itemKey in map)) return;
  delete map[itemKey];
  write(map);
}

export function mergeServerRatings(list: MyRating[]): { localOnly: MyRating[] } {
  const local = read();
  const serverKeys = new Set(list.map((r) => r.itemKey));
  const localOnly = Object.values(local).filter((r) => !serverKeys.has(r.itemKey));
  const next: RatingMap = {};
  for (const r of localOnly) next[r.itemKey] = r;
  for (const r of list) next[r.itemKey] = r;
  write(next);
  return { localOnly };
}

export function useMyRatings(): MyRating[] {
  const [list, setList] = useState<MyRating[]>(readRatings);
  useEffect(() => {
    const tick = () => setList(readRatings());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
  }, []);
  return list;
}

export function useRating(itemKey: string | undefined): MyRating | null {
  const list = useMyRatings();
  return useMemo(() => (itemKey ? list.find((r) => r.itemKey === itemKey) ?? null : null), [list, itemKey]);
}
