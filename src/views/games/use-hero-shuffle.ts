import { useEffect, useMemo, useState } from "react";

/** Fresh on entry, stable during rendering and artwork updates. */
export function useHeroShuffle<T extends { id: string }>(candidates: T[], active: boolean): T[] {
  const [seed, setSeed] = useState(Math.random);
  useEffect(() => { if (active) setSeed(Math.random()); }, [active]);
  return useMemo(() => {
    // A seeded score keeps the order stable even if metadata objects refresh.
    const score = (id: string) => {
      let hash = Math.floor(seed * 0xffffffff) | 0;
      for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
      hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
      return (hash ^ (hash >>> 16)) >>> 0;
    };
    return [...new Map(candidates.map(game => [game.id, game])).values()]
      .sort((a, b) => score(a.id) - score(b.id) || a.id.localeCompare(b.id));
  }, [candidates, seed]);
}
