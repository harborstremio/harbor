import { useSyncExternalStore } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import type { AwardSourceId, AwardWin } from "@/lib/anime-awards";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

type MasterIds = {
  imdb?: string;
  tmdb?: number;
  kitsu?: number;
  mal?: number;
  anilist?: number;
  anidb?: number;
};

type MasterWin = {
  source: AwardSourceId;
  year: number;
  categoryKey: string;
  categoryName: string;
  isAOTY: boolean;
};

type MasterEntry = { title: string; ids: MasterIds | null; wins: MasterWin[] };
type Master = { updatedAt?: string; entries?: MasterEntry[] };

const URL = `${HARBOR_API_BASE}/anime-awards.json`;

let idIndex: Map<string, AwardWin[]> | null = null;
let loading: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function idForms(ids: MasterIds): string[] {
  const out: string[] = [];
  if (ids.imdb) out.push(ids.imdb);
  if (ids.tmdb != null) out.push(`tmdb:tv:${ids.tmdb}`, `tmdb:movie:${ids.tmdb}`);
  if (ids.kitsu != null) out.push(`kitsu:${ids.kitsu}`);
  if (ids.mal != null) out.push(`mal:${ids.mal}`);
  if (ids.anilist != null) out.push(`anilist:${ids.anilist}`);
  if (ids.anidb != null) out.push(`anidb:${ids.anidb}`);
  return out;
}

function build(master: Master | null): Map<string, AwardWin[]> {
  const idx = new Map<string, AwardWin[]>();
  for (const e of master?.entries ?? []) {
    if (!e.ids) continue;
    const wins: AwardWin[] = e.wins.map((w) => ({
      source: w.source,
      year: w.year,
      categoryKey: w.categoryKey,
      categoryName: w.categoryName,
      title: e.title,
      isAOTY: w.isAOTY,
    }));
    for (const form of idForms(e.ids)) {
      const arr = idx.get(form);
      if (arr) arr.push(...wins);
      else idx.set(form, [...wins]);
    }
  }
  return idx;
}

async function load(): Promise<void> {
  let master: Master | null = null;
  try {
    const res = await safeFetch(URL);
    master = res.ok ? ((await res.json()) as Master) : null;
  } catch {
    master = null;
  }
  idIndex = build(master);
  version += 1;
  for (const l of listeners) l();
}

export function ensureAwardMaster(): Promise<void> {
  if (idIndex) return Promise.resolve();
  if (!loading) loading = load();
  return loading;
}

export function peekAwardWinsById(id: string | undefined | null): AwardWin[] | null {
  if (!id || !idIndex) return null;
  return idIndex.get(id) ?? null;
}

export function useAwardMasterVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
}
