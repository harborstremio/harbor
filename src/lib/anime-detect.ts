import { meta as fetchMeta } from "@/lib/cinemeta";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "harbor.anime.detected.v1";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

const detected = load();
const checked = new Set<string>();
const pending = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...detected]));
  } catch {}
}

function bump(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function isDetectedAnime(id: string): boolean {
  return detected.has(id);
}

export function useDetectedAnimeVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
}

function isJapaneseAnime(m: { genres?: string[]; country?: string }): boolean {
  if (!(m.country ?? "").toLowerCase().includes("japan")) return false;
  return (m.genres ?? []).some((g) => {
    const l = g.toLowerCase();
    return l === "animation" || l === "anime";
  });
}

export async function detectAnimeForCw(items: Array<{ _id: string; type: string }>): Promise<void> {
  for (const it of items) {
    const id = it._id;
    if (!/^tt\d+$/.test(id)) continue;
    if (detected.has(id) || checked.has(id) || pending.has(id)) continue;
    pending.add(id);
    try {
      const m = await fetchMeta(it.type === "movie" ? "movie" : "series", id);
      checked.add(id);
      if (m && isJapaneseAnime(m as { genres?: string[]; country?: string })) {
        detected.add(id);
        persist();
        bump();
      }
    } catch {
    } finally {
      pending.delete(id);
    }
  }
}
