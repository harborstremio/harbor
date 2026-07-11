import type { Addon } from "@/lib/addons";
import { fetchCommunityAddons } from "@/lib/addons-store/community";
import { registerEvictable } from "@/lib/maintenance";
import { safeFetch as fetch } from "@/lib/safe-fetch";
import { useEffect, useState } from "react";

const API_BASE = "https://stremio-addons.net/api/v0";
const SITE = "https://stremio-addons.net";

export type SACategory = { name: string; slug: string };

export type SAAddon = {
  uuid: string;
  url: string;
  manifestUrl: string;
  manifest: Addon["manifest"];
  slug: string;
  stars: number;
  categories: SACategory[];
  configureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  documentation?: string;
};

export type SAAddonDetail = SAAddon & {
  instances: SAAddon[];
};

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  nsfw?: "only" | "exclude";
  category?: string | string[];
  sort_by?: "createdAt" | "stars";
  order?: "asc" | "desc";
  after?: string;
};

export type ListResult = {
  addons: SAAddon[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 48;
const cache = new Map<string, { at: number; data: unknown }>();

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data as T;
}

function writeCache(key: string, data: unknown): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), data });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function buildQuery(params: ListParams): string {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.search) q.set("search", params.search);
  if (params.nsfw) q.set("nsfw", params.nsfw);
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.order) q.set("order", params.order);
  if (params.after) q.set("after", params.after);
  if (params.category) {
    const cats = Array.isArray(params.category) ? params.category : [params.category];
    for (const c of cats) q.append("category", c);
  }
  return q.toString();
}

function slugifyId(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addonToSA(a: Addon): SAAddon {
  const id = a.manifest?.id ?? a.transportUrl;
  return {
    uuid: id,
    url: a.transportUrl,
    manifestUrl: a.transportUrl,
    manifest: a.manifest,
    slug: slugifyId(id),
    stars: 0,
    categories: [],
    configureUrl: null,
    createdAt: "",
    updatedAt: "",
  };
}

let fallbackCache: { at: number; addons: SAAddon[] } | null = null;

registerEvictable("stremio-addons-list", (aggressive) => {
  if (aggressive) {
    cache.clear();
    fallbackCache = null;
  }
});

async function loadFallbackAddons(): Promise<SAAddon[]> {
  if (fallbackCache && Date.now() - fallbackCache.at < CACHE_TTL_MS) {
    return fallbackCache.addons;
  }
  const community = await fetchCommunityAddons().catch(() => [] as Addon[]);
  const addons = community.map(addonToSA);
  fallbackCache = { at: Date.now(), addons };
  return addons;
}

function applyListParams(all: SAAddon[], params: ListParams): ListResult {
  let filtered = all;
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((a) => {
      const m = a.manifest as { name?: string; description?: string } | undefined;
      return (
        (m?.name ?? "").toLowerCase().includes(q) ||
        (m?.description ?? "").toLowerCase().includes(q) ||
        a.slug.includes(q)
      );
    });
  }
  if (params.nsfw === "exclude") {
    filtered = filtered.filter((a) => {
      const bh = (a.manifest as { behaviorHints?: { adult?: boolean } } | undefined)?.behaviorHints;
      return !bh?.adult;
    });
  }
  if (params.sort_by === "createdAt") {
    filtered = [...filtered].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }
  if (params.order === "asc") filtered = [...filtered].reverse();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.max(1, params.limit ?? 50);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const slice = filtered.slice(start, start + limit);
  return {
    addons: slice,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

function isAdult(a: SAAddon): boolean {
  const bh = (a.manifest as { behaviorHints?: { adult?: boolean } } | undefined)?.behaviorHints;
  return !!bh?.adult;
}

function matchesSearch(a: SAAddon, q: string): boolean {
  const m = a.manifest as { name?: string; description?: string } | undefined;
  return (
    (m?.name ?? "").toLowerCase().includes(q) ||
    (m?.description ?? "").toLowerCase().includes(q) ||
    a.slug.toLowerCase().includes(q)
  );
}

function eligibleExtra(a: SAAddon, params: ListParams): boolean {
  if (params.search) {
    if (!matchesSearch(a, params.search.toLowerCase())) return false;
  }
  if (params.nsfw === "exclude" && isAdult(a)) return false;
  if (params.category) {
    const cats = Array.isArray(params.category) ? params.category : [params.category];
    if (cats.includes("nsfw")) {
      if (!isAdult(a)) return false;
    } else {
      return false;
    }
  }
  return true;
}

export async function listAddons(params: ListParams = {}): Promise<ListResult> {
  const qs = buildQuery(params);
  const key = `list:${qs}`;
  const hit = readCache<ListResult>(key);
  if (hit) return hit;
  const url = qs ? `${API_BASE}/addons?${qs}` : `${API_BASE}/addons`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`stremio-addons list ${res.status}`);
    const json = (await res.json()) as ListResult;
    const community = await loadFallbackAddons();
    const seen = new Set(
      json.addons.map((a) => (a.manifest as { id?: string } | undefined)?.id).filter(Boolean) as string[],
    );
    const extras = community.filter((a) => {
      const id = (a.manifest as { id?: string } | undefined)?.id;
      if (!id || seen.has(id)) return false;
      return eligibleExtra(a, params);
    });
    const merged: ListResult = {
      ...json,
      addons: [...json.addons, ...extras],
      pagination: {
        ...json.pagination,
        total: json.pagination.total + extras.length,
      },
    };
    writeCache(key, merged);
    return merged;
  } catch (e) {
    console.warn("[stremio-addons] falling back to Stremio community catalog", e);
    const all = await loadFallbackAddons();
    const result = applyListParams(all, params);
    writeCache(key, result);
    return result;
  }
}

export async function getAddon(uuidOrSlug: string): Promise<SAAddonDetail> {
  const key = `addon:${uuidOrSlug}`;
  const hit = readCache<SAAddonDetail>(key);
  if (hit) return hit;
  try {
    const res = await fetch(`${API_BASE}/addons/${encodeURIComponent(uuidOrSlug)}`);
    if (!res.ok) throw new Error(`stremio-addons get ${res.status}`);
    const json = (await res.json()) as SAAddonDetail;
    writeCache(key, json);
    return json;
  } catch (e) {
    console.warn("[stremio-addons] addon detail falling back", e);
    const all = await loadFallbackAddons();
    const match = all.find((a) => a.slug === uuidOrSlug || a.uuid === uuidOrSlug);
    if (!match) throw e instanceof Error ? e : new Error("addon not found");
    const detail: SAAddonDetail = { ...match, instances: [] };
    writeCache(key, detail);
    return detail;
  }
}

export async function listCategories(): Promise<SACategory[]> {
  const key = "categories";
  const hit = readCache<SACategory[]>(key);
  if (hit && hit.length > 0) return hit;
  try {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error(`stremio-addons categories ${res.status}`);
    const json = (await res.json()) as { categories: SACategory[] };
    if (json.categories.length > 0) writeCache(key, json.categories);
    return json.categories;
  } catch (e) {
    console.warn("[stremio-addons] categories request failed", e);
    return [];
  }
}

const DEFAULT_SA_CATEGORIES: SACategory[] = [
  { name: "anime", slug: "anime" },
  { name: "asian drama", slug: "asian+drama" },
  { name: "bollywood", slug: "bollywood" },
  { name: "debrid support", slug: "debrid+support" },
  { name: "http streams", slug: "http+streams" },
  { name: "live tv", slug: "live+tv" },
  { name: "metadata", slug: "metadata" },
  { name: "misc", slug: "misc" },
  { name: "movies", slug: "movies" },
  { name: "music", slug: "music" },
  { name: "nsfw", slug: "nsfw" },
  { name: "radios", slug: "radios" },
  { name: "subtitles", slug: "subtitles" },
  { name: "torrents", slug: "torrents" },
  { name: "tv shows", slug: "tv+shows" },
  { name: "usenet", slug: "usenet" },
];

let categoriesCache: SACategory[] | null = null;
let categoriesInflight: Promise<SACategory[]> | null = null;
const categoriesSubs = new Set<() => void>();

export function useCategories(): SACategory[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    if ((!categoriesCache || categoriesCache.length === 0) && !categoriesInflight) {
      categoriesInflight = listCategories()
        .then((cats) => {
          if (cats.length > 0) {
            categoriesCache = cats;
            for (const fn of categoriesSubs) fn();
          }
          return cats;
        })
        .catch(() => [])
        .finally(() => {
          categoriesInflight = null;
        });
    }
    const fn = () => setTick((x) => x + 1);
    categoriesSubs.add(fn);
    return () => {
      categoriesSubs.delete(fn);
    };
  }, []);
  return categoriesCache && categoriesCache.length > 0 ? categoriesCache : DEFAULT_SA_CATEGORIES;
}

export type SARisingAddon = SAAddon & { recentStars: number };

export async function listRising(): Promise<SARisingAddon[]> {
  const key = "rising";
  const hit = readCache<SARisingAddon[]>(key);
  if (hit) return hit;
  const res = await fetch(`${API_BASE}/rising`);
  if (!res.ok) throw new Error(`stremio-addons rising ${res.status}`);
  const json = (await res.json()) as { addons?: SARisingAddon[] };
  const addons = (json.addons ?? []).filter((a) => a && a.manifest);
  writeCache(key, addons);
  return addons;
}

let risingCache: SARisingAddon[] | null = null;
let risingInflight: Promise<SARisingAddon[]> | null = null;
const risingSubs = new Set<() => void>();

export function useRising(): SARisingAddon[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!risingCache && !risingInflight) {
      risingInflight = listRising()
        .then((addons) => {
          risingCache = addons;
          for (const fn of risingSubs) fn();
          return addons;
        })
        .catch(() => [] as SARisingAddon[])
        .finally(() => {
          risingInflight = null;
        });
    }
    const fn = () => setTick((x) => x + 1);
    risingSubs.add(fn);
    return () => {
      risingSubs.delete(fn);
    };
  }, []);
  return risingCache ?? [];
}

export function risingEntryFor(
  list: SARisingAddon[],
  a: { uuid?: string; slug?: string; manifestUrl?: string },
): { rank: number; recentStars: number } | null {
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (
      (a.uuid && r.uuid === a.uuid) ||
      (a.slug && r.slug === a.slug) ||
      (a.manifestUrl && r.manifestUrl === a.manifestUrl)
    ) {
      return { rank: i + 1, recentStars: r.recentStars };
    }
  }
  return null;
}

export function addonSiteUrl(slug: string): string {
  return `${SITE}/addons/${encodeURIComponent(slug)}`;
}

export function rateOnSiteUrl(slug: string): string {
  return `${SITE}/addons/${encodeURIComponent(slug)}#rate`;
}
