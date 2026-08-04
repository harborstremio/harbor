import { safeFetch } from "@/lib/safe-fetch";

export type CommunitySource = {
  id: string;
  name: string;
  kind: "builtin" | "suwayomi";
  provider?: string;
  baseUrl?: string;
  iconUrl?: string;
  note?: string;
  lang?: string;
  order?: number;
};

const ENDPOINT = "https://harbor.site/api/manga-sources";
const CACHE_KEY = "harbor.manga.catalog.v1";

const SEED: CommunitySource[] = [];

function withSeed(list: CommunitySource[]): CommunitySource[] {
  if (SEED.length === 0) return list;
  const ids = new Set(list.map((c) => c.id));
  return [...list, ...SEED.filter((s) => !ids.has(s.id))];
}

let memo: CommunitySource[] | null = null;
const listeners = new Set<() => void>();

function readCache(): CommunitySource[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function communityCatalog(): CommunitySource[] {
  if (!memo) memo = readCache();
  return withSeed(memo);
}

export function subscribeCommunity(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function refreshCommunityCatalog(): Promise<CommunitySource[]> {
  try {
    const res = await safeFetch(`${ENDPOINT}/list`);
    if (!res.ok) return communityCatalog();
    const data = await res.json();
    if (Array.isArray(data)) {
      memo = data as CommunitySource[];
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        /* noop */
      }
      for (const l of listeners) l();
    }
    return memo ?? [];
  } catch {
    return communityCatalog();
  }
}

export async function suggestSource(input: {
  name: string;
  url: string;
  note?: string;
  icon?: string;
}): Promise<boolean> {
  try {
    const res = await safeFetch(`${ENDPOINT}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}
