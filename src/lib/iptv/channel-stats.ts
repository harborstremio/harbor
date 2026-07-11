import { useSyncExternalStore } from "react";

import type { IptvChannel } from "./types";

const KEY = "harbor.iptv.stats.v1";
const MAX_ENTRIES = 600;
export const MOST_WATCHED_MIN = 3;

export type ChannelStat = {
  id: string;
  name: string;
  logo: string | null;
  group: string | null;
  url: string;
  sourceId: string;
  count: number;
  lastAt: number;
};

let cache: Record<string, ChannelStat> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function load(): Record<string, ChannelStat> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as Record<string, ChannelStat>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(map: Record<string, ChannelStat>) {
  cache = map;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
  version += 1;
  for (const l of listeners) l();
}

function prune(map: Record<string, ChannelStat>): Record<string, ChannelStat> {
  const entries = Object.values(map);
  if (entries.length <= MAX_ENTRIES) return map;
  entries.sort((a, b) => b.lastAt - a.lastAt);
  const kept: Record<string, ChannelStat> = {};
  for (const e of entries.slice(0, MAX_ENTRIES)) kept[e.id] = e;
  return kept;
}

export function recordChannelPlay(ch: IptvChannel): void {
  if (!ch.url) return;
  const map = { ...load() };
  const prev = map[ch.id];
  map[ch.id] = {
    id: ch.id,
    name: ch.name,
    logo: ch.logo,
    group: ch.group,
    url: ch.url,
    sourceId: ch.id.split("::")[0] ?? "",
    count: (prev?.count ?? 0) + 1,
    lastAt: Date.now(),
  };
  persist(prune(map));
}

export function channelPlayCount(id: string): number {
  return load()[id]?.count ?? 0;
}

function bySource(stats: ChannelStat[], sourceId?: string): ChannelStat[] {
  const usable = stats.filter((s) => s.url);
  return sourceId ? usable.filter((s) => s.sourceId === sourceId) : usable;
}

export function topChannels(limit: number, sourceId?: string): ChannelStat[] {
  const all = bySource(Object.values(load()), sourceId);
  all.sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
  return all.slice(0, limit);
}

export function recentChannels(limit: number, sourceId?: string): ChannelStat[] {
  const all = bySource(Object.values(load()), sourceId);
  all.sort((a, b) => b.lastAt - a.lastAt);
  return all.slice(0, limit);
}

export function clearChannelStats(): void {
  persist({});
}

export function removeStatsForSource(sourceId: string): void {
  if (!sourceId) return;
  const map = load();
  const next: Record<string, ChannelStat> = {};
  let changed = false;
  for (const [id, stat] of Object.entries(map)) {
    if (stat.sourceId === sourceId || id.startsWith(`${sourceId}::`)) {
      changed = true;
      continue;
    }
    next[id] = stat;
  }
  if (changed) persist(next);
}

export function useChannelStatsVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
}
