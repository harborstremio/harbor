import { useSyncExternalStore } from "react";
import { meta as fetchMeta } from "@/lib/cinemeta";
import { imdbToKitsu } from "@/lib/providers/anime-mapping";
import { setItemWithRecovery } from "@/lib/storage-recovery";

const STORAGE_KEY = "harbor.anime.detected.v2";

function load(): Set<string> {
  try {
    localStorage.removeItem("harbor.anime.detected.v1");
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
    setItemWithRecovery(STORAGE_KEY, JSON.stringify([...detected]));
  } catch {}
}

function bump(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function isDetectedAnime(id: string): boolean {
  return detected.has(id);
}

const ANIME_ID_RE = /^(kitsu|mal|anilist|anidb):/;

export function metaLooksAnime(m: {
  id?: string;
  genres?: string[];
  country?: string;
  originalLanguage?: string;
}): boolean {
  const id = m.id ?? "";
  if (ANIME_ID_RE.test(id)) return true;
  if (detected.has(id)) return true;
  return isJapaneseAnime(m);
}

export function detectAnimeForMetas(metas: Array<{ id: string; type?: string }>): void {
  const items = metas
    .filter((m) => /^tt\d+$/.test(m.id))
    .map((m) => ({ _id: m.id, type: m.type === "movie" ? "movie" : "series" }));
  if (items.length > 0) void detectAnimeForCw(items);
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

function primaryCountry(m: { country?: string }): string {
  return (m.country ?? "").split(",")[0].trim().toLowerCase();
}

function isJapaneseAnime(m: {
  genres?: string[];
  country?: string;
  originalLanguage?: string;
}): boolean {
  if ((m.genres ?? []).some((g) => g.toLowerCase() === "anime")) return true;
  if (!hasAnimationGenre(m)) return false;
  const c = primaryCountry(m);
  const lang = (m.originalLanguage ?? "").toLowerCase();
  return c.includes("japan") || c === "jp" || c === "jpn" || lang === "ja" || lang === "jpn";
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
      const originUnknown = !m || !primaryCountry(m);
      if (
        !anime &&
        originUnknown &&
        (!m || hasAnimationGenre(m) || (m.genres ?? []).length === 0)
      ) {
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
