import { topMovies, topSeries } from "@/lib/cinemeta";
import { useEffect, useState } from "react";

let cachedPool: string[] | null = null;
let inflight: Promise<string[]> | null = null;

function shuffle(list: string[]): string[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function loadPool(): Promise<string[]> {
  if (cachedPool) return cachedPool;
  if (!inflight) {
    inflight = (async () => {
      const [series, movies] = await Promise.all([topSeries(), topMovies()]);
      const seen = new Set<string>();
      const pool = [...series, ...movies]
        .map((m) => m.background)
        .filter((b): b is string => !!b && b.startsWith("http"))
        .filter((b) => (seen.has(b) ? false : (seen.add(b), true)));
      cachedPool = shuffle(pool).slice(0, 18);
      return cachedPool;
    })();
  }
  return inflight;
}

export function usePreviewBackdrop(): string | null {
  const [pool, setPool] = useState<string[]>(cachedPool ?? []);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadPool().then((p) => {
      if (alive) setPool(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (pool.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % pool.length), 18000);
    return () => clearInterval(id);
  }, [pool.length]);
  return pool.length ? pool[idx % pool.length] : null;
}
