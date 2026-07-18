import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { resolveLogo } from "@/lib/logo";

const CACHE_KEY = "harbor.anime.herologos.v2";
const POS_TTL = 30 * 24 * 60 * 60 * 1000;
const NEG_TTL = 24 * 60 * 60 * 1000;
const CAP = 300;
const CONCURRENCY = 4;

type Entry = { u: string | null; t: number };

function load(): Record<string, Entry> {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as {
      v?: number;
      map?: Record<string, Entry>;
    };
    if (raw.v !== 2 || !raw.map) return {};
    const now = Date.now();
    const out: Record<string, Entry> = {};
    for (const [id, e] of Object.entries(raw.map)) {
      if (now - e.t < (e.u ? POS_TTL : NEG_TTL)) out[id] = e;
    }
    return out;
  } catch {
    return {};
  }
}

function persist(map: Record<string, Entry>) {
  const entries = Object.entries(map);
  const trimmed =
    entries.length > CAP
      ? Object.fromEntries(entries.sort((a, b) => b[1].t - a[1].t).slice(0, CAP))
      : map;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 2, map: trimmed }));
  } catch {
    /* ignore */
  }
}

export function useHeroLogos(slides: Meta[], tmdbKey: string): Record<string, string> {
  const [cache, setCache] = useState<Record<string, Entry>>(load);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const triedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = slides.filter(
      (m) => !m.logo && !(m.id in cacheRef.current) && !triedRef.current.has(m.id),
    );
    if (pending.length === 0) return;
    for (const m of pending) triedRef.current.add(m.id);
    let cancelled = false;
    const queue = [...pending];
    const runNext = async (): Promise<void> => {
      while (!cancelled) {
        const m = queue.shift();
        if (!m) return;
        const url = await resolveLogo(tmdbKey, m).catch(() => undefined);
        if (cancelled) return;
        setCache((prev) => {
          const next = { ...prev, [m.id]: { u: url ?? null, t: Date.now() } };
          persist(next);
          return next;
        });
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, runNext));
    return () => {
      cancelled = true;
    };
  }, [slides, tmdbKey]);

  const out: Record<string, string> = {};
  for (const [id, e] of Object.entries(cache)) if (e.u) out[id] = e.u;
  return out;
}
