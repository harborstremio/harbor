import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { resolveLogo } from "@/lib/logo";
import { staticHeroArt } from "@/lib/providers/anime-hero-art-static";
import { imageLangParam } from "@/lib/providers/tmdb/tmdb-image-lang";

const CACHE_KEY = "harbor.anime.herologos.v7";
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
    if (raw.v !== 7 || !raw.map) return {};
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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 7, map: trimmed }));
  } catch {
    /* ignore */
  }
}

type LogoSettings = { tmdbKey: string; fanartKey: string };

export function useHeroLogos(slides: Meta[], settings: LogoSettings): Record<string, string> {
  const [cache, setCache] = useState<Record<string, Entry>>(load);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const triedRef = useRef<Set<string>>(new Set());
  const { tmdbKey } = settings;
  const languageKey = imageLangParam();

  useEffect(() => {
    const pending = slides.filter((m) => {
      const key = `${m.id}::${languageKey}`;
      return !(key in cacheRef.current) && !triedRef.current.has(key);
    });
    if (pending.length === 0) return;
    for (const m of pending) triedRef.current.add(`${m.id}::${languageKey}`);
    let cancelled = false;
    const queue = [...pending];
    const runNext = async (): Promise<void> => {
      while (!cancelled) {
        const m = queue.shift();
        if (!m) return;
        const resolved = await resolveLogo(tmdbKey, m, { preferOwn: true }).catch(() => undefined);
        const url = resolved ?? (await staticHeroArt(m.id).catch(() => undefined))?.logo;
        if (cancelled) return;
        setCache((prev) => {
          const next = { ...prev, [`${m.id}::${languageKey}`]: { u: url ?? null, t: Date.now() } };
          persist(next);
          return next;
        });
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, runNext));
    return () => {
      cancelled = true;
    };
  }, [slides, tmdbKey, languageKey]);

  const out: Record<string, string> = {};
  for (const m of slides) {
    const entry = cache[`${m.id}::${languageKey}`];
    if (entry?.u) out[m.id] = entry.u;
  }
  return out;
}
