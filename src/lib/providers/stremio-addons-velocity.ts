import { useEffect, useState } from "react";
import { ensureCommunityIndex, getCommunityIndex, type SACommunity } from "./stremio-addons-index";

const STORAGE_KEY = "harbor.stremio-addons.velocity.v1";
const MAX_SNAPSHOTS = 14;
const MIN_DELTA = 5;

type Snapshot = {
  fetchedAt: number;
  stars: Record<string, number>;
};

type Persisted = {
  snapshots: Snapshot[];
};

export type MoverEntry = {
  community: SACommunity;
  delta: number;
  windowDays: number;
};

function readPersisted(): Persisted {
  if (typeof localStorage === "undefined") return { snapshots: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { snapshots: [] };
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || !Array.isArray(parsed.snapshots)) return { snapshots: [] };
    return parsed;
  } catch {
    return { snapshots: [] };
  }
}

function writePersisted(p: Persisted): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    return;
  }
}

function captureSnapshot(): Snapshot | null {
  const idx = getCommunityIndex();
  if (!idx) return null;
  const stars: Record<string, number> = {};
  for (const entry of idx.byManifestId.values()) {
    stars[entry.uuid] = entry.stars;
  }
  return { fetchedAt: Date.now(), stars };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function shouldCapture(existing: Snapshot[]): boolean {
  if (existing.length === 0) return true;
  const last = existing[existing.length - 1];
  return Date.now() - last.fetchedAt > ONE_DAY_MS / 2;
}

export async function recordVelocitySnapshot(): Promise<void> {
  await ensureCommunityIndex().catch(() => {});
  const persisted = readPersisted();
  if (!shouldCapture(persisted.snapshots)) return;
  const snap = captureSnapshot();
  if (!snap) return;
  const next = [...persisted.snapshots, snap].slice(-MAX_SNAPSHOTS);
  writePersisted({ snapshots: next });
}

export function computeMovers(limit = 8): MoverEntry[] {
  const idx = getCommunityIndex();
  if (!idx) return [];
  const persisted = readPersisted();
  if (persisted.snapshots.length < 2) return [];
  const earliest = persisted.snapshots[0];
  const windowDays = Math.max(1, Math.round((Date.now() - earliest.fetchedAt) / ONE_DAY_MS));
  const out: MoverEntry[] = [];
  for (const entry of idx.byManifestId.values()) {
    const prior = earliest.stars[entry.uuid];
    if (prior == null) continue;
    const delta = entry.stars - prior;
    if (delta < MIN_DELTA) continue;
    out.push({ community: entry, delta, windowDays });
  }
  out.sort((a, b) => b.delta - a.delta);
  return out.slice(0, limit);
}

export function useTopMovers(limit = 8): MoverEntry[] {
  const [movers, setMovers] = useState<MoverEntry[]>(() => computeMovers(limit));
  useEffect(() => {
    let cancelled = false;
    void recordVelocitySnapshot().then(() => {
      if (cancelled) return;
      setMovers(computeMovers(limit));
    });
    return () => {
      cancelled = true;
    };
  }, [limit]);
  return movers;
}
