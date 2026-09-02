import { useSyncExternalStore } from "react";
import { meta as fetchMeta } from "@/lib/cinemeta";
import { imdbToKitsu } from "@/lib/providers/anime-mapping";
import { setItemWithRecovery } from "@/lib/storage-recovery";

const STORAGE_KEY = "harbor.anime.detected.v2";
const NEGATIVE_KEY = "harbor.anime.notanime.v1";
const NEGATIVE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const NEGATIVE_MAX = 1500;
const NEGATIVE_FLUSH_MS = 2000;
const CONCURRENCY = 6;
const EAGER_BUDGET = 24;
const DEFER_MS = 6000;

type DetectItem = { _id: string; type: string };

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

let negativesSince = 0;

function loadNegatives(): Set<string> {
  try {
    const raw = localStorage.getItem(NEGATIVE_KEY);
    const c = raw ? (JSON.parse(raw) as { t?: number; ids?: string[] } | null) : null;
    if (c && typeof c.t === "number" && Date.now() - c.t < NEGATIVE_TTL_MS && Array.isArray(c.ids)) {
      negativesSince = c.t;
      return new Set(c.ids);
    }
  } catch {
    /* ignore */
  }
  negativesSince = Date.now();
  return new Set();
}

const detected = load();
const negatives = loadNegatives();
const checked = new Set<string>();
const pending = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const queue: DetectItem[] = [];
let version = 0;
const listeners = new Set<() => void>();

function persist(): void {
  try {
    setItemWithRecovery(STORAGE_KEY, JSON.stringify([...detected]));
  } catch {}
}

let negativeTimer: ReturnType<typeof setTimeout> | null = null;

function persistNegatives(): void {
  if (negativeTimer != null) return;
  negativeTimer = setTimeout(() => {
    negativeTimer = null;
    try {
      const all = [...negatives];
      const ids = all.length > NEGATIVE_MAX ? all.slice(-NEGATIVE_MAX) : all;
      setItemWithRecovery(NEGATIVE_KEY, JSON.stringify({ t: negativesSince, ids }));
    } catch {}
  }, NEGATIVE_FLUSH_MS);
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

function isJapaneseAnime(m: { genres?: string[]; country?: string; originalLanguage?: string }): boolean {
  if ((m.genres ?? []).some((g) => g.toLowerCase() === "anime")) return true;
  if (!hasAnimationGenre(m)) return false;
  const c = primaryCountry(m);
  const lang = (m.originalLanguage ?? "").toLowerCase();
  return c.includes("japan") || c === "jp" || c === "jpn" || lang === "ja" || lang === "jpn";
}

function settled(id: string): boolean {
  return detected.has(id) || negatives.has(id) || checked.has(id);
}

async function checkOne(it: DetectItem): Promise<void> {
  const id = it._id;
  try {
    const m = (await fetchMeta(it.type === "movie" ? "movie" : "series", id)) as
      | { genres?: string[]; country?: string }
      | null;
    checked.add(id);
    let anime = !!m && isJapaneseAnime(m);
    const originUnknown = !m || !primaryCountry(m);
    if (!anime && originUnknown && (!m || hasAnimationGenre(m) || (m.genres ?? []).length === 0)) {
      anime = (await imdbToKitsu(id).catch(() => null)) != null;
    }
    if (anime) {
      detected.add(id);
      persist();
      bump();
    } else if (m) {
      negatives.add(id);
      persistNegatives();
    }
  } catch {
  } finally {
    pending.delete(id);
  }
}

function runOne(it: DetectItem): Promise<void> {
  const p = checkOne(it).finally(() => {
    inflight.delete(it._id);
  });
  inflight.set(it._id, p);
  return p;
}

async function runPool(items: DetectItem[]): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const it = items[next++];
      if (!it) return;
      await runOne(it);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));
}

let draining = false;

async function drain(): Promise<void> {
  try {
    while (queue.length > 0) {
      await runPool(queue.splice(0, EAGER_BUDGET));
    }
  } finally {
    draining = false;
  }
}

function scheduleDrain(): void {
  if (draining || queue.length === 0) return;
  draining = true;
  setTimeout(() => {
    void drain();
  }, DEFER_MS);
}

export async function detectAnimeForCw(items: Array<{ _id: string; type: string }>): Promise<void> {
  const urgent = items.length <= CONCURRENCY;
  const eligible: DetectItem[] = [];
  const waits: Array<Promise<void>> = [];
  const seen = new Set<string>();
  for (const it of items) {
    const id = it._id;
    if (!/^tt\d+$/.test(id)) continue;
    if (seen.has(id) || settled(id)) continue;
    seen.add(id);
    const running = inflight.get(id);
    if (running) {
      if (urgent) waits.push(running);
      continue;
    }
    const queuedAt = urgent ? queue.findIndex((q) => q._id === id) : -1;
    if (queuedAt >= 0) {
      eligible.push(...queue.splice(queuedAt, 1));
      continue;
    }
    if (pending.has(id)) continue;
    pending.add(id);
    eligible.push({ _id: id, type: it.type });
  }
  if (eligible.length === 0 && waits.length === 0) return;
  for (const it of eligible.slice(EAGER_BUDGET)) queue.push(it);
  scheduleDrain();
  await Promise.all([runPool(eligible.slice(0, EAGER_BUDGET)), ...waits]);
}
