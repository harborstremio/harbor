import { useEffect, useMemo, useState } from "react";
import {
  addToWatchlist as traktAdd,
  removeFromWatchlist as traktRemove,
} from "@/lib/trakt/watchlist";
import { stremioIdToTraktTarget } from "@/lib/trakt/ids";
import {
  addToWatchlist as simklAdd,
  removeFromWatchlist as simklRemove,
} from "@/lib/simkl/watchlist";
import { stremioIdToSimklTarget } from "@/lib/simkl/ids";
import { isAuthenticated as simklConnected } from "@/lib/simkl/session";
import { setItemWithRecovery, freeStorageSpace } from "@/lib/storage-recovery";
import { cloudWriteId, saveStremioBookmark, removeStremioBookmark } from "@/lib/stremio";
import { readActiveStremioAuthKey } from "@/lib/auth";

const KEY = "harbor.watchlist.v1";
const AGG_KEY = "harbor.watchlist.aggregate.v1";
const subs = new Set<() => void>();

export type LocalEntry = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  addedAt: number;
};

export type WatchlistInput = {
  id: string;
  type?: string;
  name?: string;
  poster?: string;
  imdbId?: string | null;
};

let memoryFallback: Map<string, LocalEntry> | null = null;

function inferType(id: string): "movie" | "series" {
  return id.includes(":tv:") || id.includes(":series:") ? "series" : "movie";
}

function normalizeType(type: string | undefined, id: string): "movie" | "series" {
  if (type === "series" || type === "tv") return "series";
  if (type === "movie") return "movie";
  return inferType(id);
}

function toEntry(input: string | WatchlistInput): LocalEntry {
  if (typeof input === "string") {
    return { id: input, type: inferType(input), name: "", addedAt: Date.now() };
  }
  return {
    id: input.id,
    type: normalizeType(input.type, input.id),
    name: input.name ?? "",
    poster: input.poster,
    addedAt: Date.now(),
  };
}

function read(): Map<string, LocalEntry> {
  if (memoryFallback) return new Map(memoryFallback);
  const map = new Map<string, LocalEntry>();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return map;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return map;
    for (const el of arr) {
      if (typeof el === "string") {
        map.set(el, { id: el, type: inferType(el), name: "", addedAt: 0 });
      } else if (el && typeof el === "object" && typeof (el as { id?: unknown }).id === "string") {
        const e = el as {
          id: string;
          type?: string;
          name?: string;
          poster?: string;
          addedAt?: number;
        };
        map.set(e.id, {
          id: e.id,
          type: e.type === "series" ? "series" : "movie",
          name: typeof e.name === "string" ? e.name : "",
          poster: typeof e.poster === "string" ? e.poster : undefined,
          addedAt: typeof e.addedAt === "number" ? e.addedAt : 0,
        });
      }
    }
  } catch {
    return new Map();
  }
  return map;
}

function write(map: Map<string, LocalEntry>) {
  const payload = JSON.stringify(Array.from(map.values()));
  const ok = setItemWithRecovery(KEY, payload);
  if (!ok) {
    freeStorageSpace();
    const retry = setItemWithRecovery(KEY, payload);
    if (!retry) {
      memoryFallback = new Map(map);
      console.warn("[watchlist] localStorage exhausted, holding watchlist in memory only");
    } else {
      memoryFallback = null;
    }
  } else {
    memoryFallback = null;
  }
  for (const s of subs) s();
}

export function readLocalEntries(): LocalEntry[] {
  return Array.from(read().values());
}

export function subscribeWatchlist(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

let aggregateIds: Set<string> = readAggregateCache();

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

function readAggregateCache(): Set<string> {
  try {
    const raw = localStorage.getItem(AGG_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(
      Array.isArray(arr) ? (arr as string[]).filter((v) => typeof v === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function writeAggregateCache(set: Set<string>) {
  try {
    localStorage.setItem(AGG_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* swallow */
  }
}

export function setWatchlistAggregate(ids: Iterable<string>): void {
  const next = new Set(ids);
  if (setsEqual(aggregateIds, next)) return;
  aggregateIds = next;
  writeAggregateCache(aggregateIds);
  for (const s of subs) s();
}

export function watchlistHas(id: string): boolean {
  return read().has(id) || aggregateIds.has(id);
}

export function watchlistAllIds(): string[] {
  const out = new Set<string>(read().keys());
  for (const id of aggregateIds) out.add(id);
  return Array.from(out);
}

export function addToWatchlist(input: string | WatchlistInput): void {
  const map = read();
  const entry = toEntry(input);
  map.set(entry.id, entry);
  write(map);
}

export function removeFromWatchlist(id: string): void {
  const map = read();
  map.delete(id);
  write(map);
}

export function toggleWatchlist(input: string | WatchlistInput): boolean {
  const map = read();
  const id = typeof input === "string" ? input : input.id;
  const imdb = typeof input === "string" ? null : (input.imdbId ?? null);
  const has = map.has(id) || aggregateIds.has(id) || (!!imdb && aggregateIds.has(imdb));
  if (has) {
    map.delete(id);
    aggregateIds.delete(id);
    if (imdb) aggregateIds.delete(imdb);
    writeAggregateCache(aggregateIds);
  } else {
    map.set(id, toEntry(input));
  }
  write(map);
  void syncWithTrakt(id, !has);
  void syncWithSimkl(id, !has);
  void syncWithStremio(input, !has);
  return !has;
}

async function syncWithTrakt(metaId: string, added: boolean): Promise<void> {
  try {
    const r = stremioIdToTraktTarget(metaId);
    if (!r.ok) return;
    if (added) await traktAdd(r.target);
    else await traktRemove(r.target);
  } catch {
    /* swallow */
  }
}

async function syncWithSimkl(metaId: string, added: boolean): Promise<void> {
  try {
    if (!simklConnected()) return;
    const r = stremioIdToSimklTarget(metaId);
    if (!r.ok) return;
    if (added) await simklAdd(r.target);
    else await simklRemove(r.target);
  } catch {
    /* swallow */
  }
}

async function syncWithStremio(input: string | WatchlistInput, added: boolean): Promise<void> {
  const authKey = readActiveStremioAuthKey();
  if (!authKey) return;
  const id = typeof input === "string" ? input : input.id;
  const imdb = typeof input === "string" ? null : (input.imdbId ?? null);
  const writeId = cloudWriteId(id, imdb, !!imdb);
  if (!writeId) return;
  try {
    if (added) {
      const meta =
        typeof input === "string"
          ? {}
          : { type: input.type, name: input.name, poster: input.poster };
      await saveStremioBookmark(authKey, writeId, meta);
    } else {
      await removeStremioBookmark(authKey, writeId);
    }
  } catch (e) {
    console.warn("[watchlist] stremio sync failed", e);
  }
}

export function useInWatchlist(
  id: string | undefined,
  altIds?: Array<string | null | undefined>,
): boolean {
  const candidates = useMemo(() => {
    const arr: string[] = [];
    if (id) arr.push(id);
    if (altIds) for (const a of altIds) if (a) arr.push(a);
    return arr;
  }, [id, altIds?.join("|")]);

  const check = () => {
    if (candidates.length === 0) return false;
    const local = read();
    return candidates.some((c) => local.has(c) || aggregateIds.has(c));
  };

  const [has, setHas] = useState<boolean>(check);
  useEffect(() => {
    setHas(check());
    const tick = () => setHas(check());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.join("|")]);
  return has;
}
