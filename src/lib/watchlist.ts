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
import {
  ANIME_CLOUD_ID,
  cloudWriteId,
  saveStremioBookmark,
  removeStremioBookmark,
} from "@/lib/stremio";
import { readActiveStremioAuthKey } from "@/lib/auth";
import { persistableAddonOrigin, persistableVideos, type Meta } from "@/lib/cinemeta";

const KEY_PREFIX = "harbor.watchlist.v1.";
const LEGACY_KEY = "harbor.watchlist.v1";
const AGG_KEY_PREFIX = "harbor.watchlist.aggregate.v1.";
const LEGACY_AGG_KEY = "harbor.watchlist.aggregate.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const subs = new Set<() => void>();

export type LocalEntry = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  addedAt: number;
  addonOrigin?: Meta["addonOrigin"];
  videos?: Meta["videos"];
};

export type WatchlistInput = {
  id: string;
  type?: string;
  name?: string;
  poster?: string;
  imdbId?: string | null;
  addonOrigin?: Meta["addonOrigin"];
  videos?: Meta["videos"];
};

let memoryFallback: Map<string, LocalEntry> | null = null;

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as {
      activeId?: string;
      profiles?: Array<{ id?: string; isPrimary?: boolean; shareStremioWith?: string | null }>;
    };
    const profiles = Array.isArray(s.profiles) ? s.profiles : [];
    const active = profiles.find((p) => p.id === s.activeId) ?? null;
    const own = active?.id ?? profiles.find((p) => p?.isPrimary)?.id ?? "";
    if (!own) return "";
    if (active && typeof active.shareStremioWith === "string" && active.shareStremioWith) {
      const shared = profiles.find((p) => p.id === active.shareStremioWith);
      if (shared?.id) return shared.id;
    }
    return own;
  } catch {
    return "";
  }
}

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const s = raw
      ? (JSON.parse(raw) as { profiles?: Array<{ id?: string; isPrimary?: boolean }> })
      : null;
    const primary = s?.profiles?.find((p) => p?.isPrimary);
    return (primary && typeof primary.id === "string" && primary.id) || activeProfileId();
  } catch {
    return activeProfileId();
  }
}

function storeKey(): string {
  const id = activeProfileId();
  return id ? KEY_PREFIX + id : LEGACY_KEY;
}

function aggStoreKey(): string {
  const id = activeProfileId();
  return id ? AGG_KEY_PREFIX + id : LEGACY_AGG_KEY;
}

function migrateLegacy(): void {
  try {
    const pid = primaryProfileId();
    if (!pid) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const perKey = KEY_PREFIX + pid;
      if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
    const legacyAgg = localStorage.getItem(LEGACY_AGG_KEY);
    if (legacyAgg) {
      const perKey = AGG_KEY_PREFIX + pid;
      if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacyAgg);
      localStorage.removeItem(LEGACY_AGG_KEY);
    }
  } catch {
    /* noop */
  }
}

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
    addonOrigin: persistableAddonOrigin(input.addonOrigin),
    videos: persistableVideos(input.videos),
  };
}

function read(): Map<string, LocalEntry> {
  if (memoryFallback) return new Map(memoryFallback);
  migrateLegacy();
  const map = new Map<string, LocalEntry>();
  try {
    const raw = localStorage.getItem(storeKey());
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
          addonOrigin?: unknown;
          videos?: unknown;
        };
        map.set(e.id, {
          id: e.id,
          type: e.type === "series" ? "series" : "movie",
          name: typeof e.name === "string" ? e.name : "",
          poster: typeof e.poster === "string" ? e.poster : undefined,
          addedAt: typeof e.addedAt === "number" ? e.addedAt : 0,
          addonOrigin: persistableAddonOrigin(e.addonOrigin),
          videos: persistableVideos(e.videos),
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
  const ok = setItemWithRecovery(storeKey(), payload);
  if (!ok) {
    freeStorageSpace();
    const retry = setItemWithRecovery(storeKey(), payload);
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

function readAggregateCache(): Set<string> {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(aggStoreKey());
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
    localStorage.setItem(aggStoreKey(), JSON.stringify(Array.from(set)));
  } catch {
    /* swallow */
  }
}

export function setWatchlistAggregate(ids: Iterable<string>): void {
  aggregateIds = new Set(ids);
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
  try {
    if (added) {
      const writeId = cloudWriteId(id, imdb, !!imdb);
      if (!writeId) return;
      const meta =
        typeof input === "string"
          ? {}
          : { type: input.type, name: input.name, poster: input.poster };
      await saveStremioBookmark(authKey, writeId, meta);
    } else {
      const forms = new Set<string>();
      const withImdb = cloudWriteId(id, imdb, !!imdb);
      const withMeta = cloudWriteId(id, imdb, false);
      if (withImdb) forms.add(withImdb);
      if (withMeta) forms.add(withMeta);
      if (ANIME_CLOUD_ID.test(id)) forms.add(id);
      for (const rid of forms) await removeStremioBookmark(authKey, rid);
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

if (typeof window !== "undefined") {
  let lastProfile = activeProfileId();
  const onProfileChange = () => {
    const p = activeProfileId();
    if (p === lastProfile) return;
    lastProfile = p;
    memoryFallback = null;
    aggregateIds = readAggregateCache();
    for (const s of subs) s();
  };
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}
