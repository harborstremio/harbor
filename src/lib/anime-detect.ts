import { useSyncExternalStore } from "react";
import { meta as fetchMeta } from "@/lib/cinemeta";
import { imdbToKitsu } from "@/lib/providers/anime-mapping";

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

function hasAnimationGenre(m: { genres?: string[] }): boolean {
  return (m.genres ?? []).some((g) => {
    const l = g.toLowerCase();
    return l === "animation" || l === "anime";
  });
}

function isJapaneseAnime(m: { genres?: string[]; country?: string }): boolean {
  const c = (m.country ?? "").toLowerCase();
  if (!(c.includes("japan") || c === "jp" || c === "jpn")) return false;
  return hasAnimationGenre(m);
}

export async function detectAnimeForCw(items: Array<{ _id: string; type: string }>): Promise<void> {
  for (const it of items) {
    const id = it._id;
    if (!/^tt\d+$/.test(id)) continue;
    if (detected.has(id) || checked.has(id) || pending.has(id)) continue;
    pending.add(id);
    try {
      const m = (await fetchMeta(it.type === "movie" ? "movie" : "series", id)) as {
        genres?: string[];
        country?: string;
      } | null;
      checked.add(id);
      let anime = !!m && isJapaneseAnime(m);
      if (!anime && (!m || hasAnimationGenre(m) || (m.genres ?? []).length === 0)) {
        anime = (await imdbToKitsu(id).catch(() => null)) != null;
      }
      if (anime) {
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
