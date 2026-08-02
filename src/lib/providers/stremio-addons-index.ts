import { useEffect, useState } from "react";
import { listAddons, type SAAddon } from "./stremio-addons";

const INDEX_TTL_MS = 60 * 60 * 1000;
const MAX_PAGES = 6;
const PAGE_SIZE = 100;

export type SACommunity = {
  uuid: string;
  slug: string;
  url: string;
  stars: number;
  categories: Array<{ name: string; slug: string }>;
  createdAt: string;
  updatedAt: string;
  manifestId?: string;
  manifestUrl: string;
  name?: string;
  description?: string;
  logo?: string;
  background?: string;
};

type IndexState = {
  byManifestId: Map<string, SACommunity>;
  bySlug: Map<string, SACommunity>;
  fetchedAt: number;
  totalAddons: number;
};

let cached: IndexState | null = null;
let inflight: Promise<IndexState> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

function fresh(state: IndexState | null): state is IndexState {
  return state !== null && Date.now() - state.fetchedAt < INDEX_TTL_MS;
}

export function getCommunityIndex(): IndexState | null {
  return fresh(cached) ? cached : null;
}

export function communityFor(manifestId: string | undefined | null): SACommunity | null {
  if (!manifestId || !cached) return null;
  return cached.byManifestId.get(manifestId) ?? null;
}

export function communityForLoose(manifestId: string | undefined | null): SACommunity | null {
  if (!manifestId || !cached) return null;
  const exact = cached.byManifestId.get(manifestId);
  if (exact) return exact;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = manifestId.replace(/\.[A-Za-z0-9]{2,8}$/, "");
  const want = norm(base);
  if (want.length < 4) return null;
  let best: SACommunity | null = null;
  let bestLen = 0;
  for (const [key, entry] of cached.byManifestId) {
    const k = norm(key);
    const hit = k === want || k.startsWith(want) || want.startsWith(k);
    if (hit && k.length > bestLen) {
      best = entry;
      bestLen = k.length;
    }
  }
  return best;
}

export function communityBySlug(slug: string): SACommunity | null {
  if (!cached) return null;
  return cached.bySlug.get(slug) ?? null;
}

function buildEntry(a: SAAddon): SACommunity {
  const m = a.manifest as
    | {
        id?: string;
        name?: string;
        description?: string;
        logo?: string;
        background?: string;
      }
    | undefined;
  return {
    uuid: a.uuid,
    slug: a.slug,
    url: a.url,
    stars: a.stars,
    categories: a.categories,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    manifestId: m?.id,
    manifestUrl: a.manifestUrl,
    name: m?.name,
    description: m?.description,
    logo: m?.logo,
    background: m?.background,
  };
}

async function fetchIndex(): Promise<IndexState> {
  const byManifestId = new Map<string, SACommunity>();
  const bySlug = new Map<string, SACommunity>();
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await listAddons({
      page,
      limit: PAGE_SIZE,
      sort_by: "stars",
      order: "desc",
    });
    for (const a of res.addons) {
      const entry = buildEntry(a);
      const mid = a.manifest?.id;
      if (mid) byManifestId.set(mid, entry);
      if (a.slug) bySlug.set(a.slug, entry);
    }
    if (res.addons.length === 0) break;
    total = Math.max(total, res.pagination?.total ?? 0);
  }
  return { byManifestId, bySlug, fetchedAt: Date.now(), totalAddons: total };
}

export async function ensureCommunityIndex(): Promise<IndexState> {
  if (fresh(cached)) return cached;
  if (inflight) return inflight;
  inflight = fetchIndex()
    .then((s) => {
      cached = s;
      notify();
      return s;
    })
    .catch((e) => {
      console.warn("[stremio-addons-index] fetch failed", e);
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function subscribeCommunityIndex(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function useCommunityIndex(): { ready: boolean; total: number } {
  const [, force] = useState(0);
  useEffect(() => {
    void ensureCommunityIndex();
    return subscribeCommunityIndex(() => force((n) => n + 1));
  }, []);
  return { ready: cached !== null, total: cached?.totalAddons ?? 0 };
}

export function useCommunity(manifestId: string | undefined | null): SACommunity | null {
  const [, force] = useState(0);
  useEffect(() => {
    void ensureCommunityIndex();
    return subscribeCommunityIndex(() => force((n) => n + 1));
  }, []);
  return communityFor(manifestId);
}
