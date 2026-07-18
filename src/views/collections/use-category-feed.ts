import { useEffect, useRef, useState } from "react";
import { tmdbCollection, tmdbSearchCollections, type TmdbCollection } from "@/lib/providers/tmdb";

const FEED_QUERY = "collection";
const PAGES_PER_PULL = 4;
const MIN_MATCHES_PER_PULL = 6;

const GENRE_IDS: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  "Sci-Fi": 878,
  Fantasy: 14,
  Animation: 16,
  Horror: 27,
  Comedy: 35,
  Crime: 80,
};

const HERO_RX =
  /(marvel|dc\b|batman|superman|spider|x-men|avengers|hulk|thor|captain america|justice league|super.?hero)/i;

function matchesCategory(col: TmdbCollection, category: string): boolean {
  if (col.parts.length < 2) return false;
  const total = col.parts.length;
  const cnt = (id: number) => col.genreCounts?.[id] ?? 0;
  if (category === "Sagas") return total >= 4;
  if (category === "Superheroes") {
    return (
      cnt(28) + cnt(878) + cnt(14) >= Math.ceil(total / 2) &&
      HERO_RX.test(`${col.name} ${col.overview}`)
    );
  }
  const gid = GENRE_IDS[category];
  if (gid == null) return false;
  return cnt(gid) >= Math.max(2, Math.ceil(total * 0.4));
}

export type CategoryHit = {
  id: number;
  name: string;
  backdrop: string | null;
  count: number;
};

export function useCategoryFeed(params: {
  tmdbKey: string;
  category: string;
  active: boolean;
  excludeNames: Set<string>;
  stripSuffix: (name: string) => string;
}): {
  hits: CategoryHit[];
  done: boolean;
  loading: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
} {
  const { tmdbKey, category, active, excludeNames, stripSuffix } = params;
  const [hits, setHits] = useState<CategoryHit[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const pageRef = useRef(0);
  const seenRef = useRef<Set<number>>(new Set());
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHits([]);
    setDone(!active);
    setLoading(false);
    pageRef.current = 0;
    seenRef.current = new Set();
    loadingRef.current = false;
  }, [category, active]);

  useEffect(() => {
    if (!active || done) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        void (async () => {
          const found: CategoryHit[] = [];
          let exhausted = false;
          for (let i = 0; i < PAGES_PER_PULL && found.length < MIN_MATCHES_PER_PULL; i++) {
            const next = pageRef.current + 1;
            const { hits: batch, totalPages } = await tmdbSearchCollections(
              tmdbKey,
              FEED_QUERY,
              next,
            ).catch(() => ({ hits: [], totalPages: 0 }));
            pageRef.current = next;
            if (batch.length === 0 || next >= totalPages) {
              exhausted = true;
              break;
            }
            const cols = await Promise.all(
              batch.map((h) =>
                seenRef.current.has(h.id)
                  ? Promise.resolve(null)
                  : tmdbCollection(tmdbKey, h.id).catch(() => null),
              ),
            );
            for (const c of cols) {
              if (!c || seenRef.current.has(c.id)) continue;
              seenRef.current.add(c.id);
              const display = stripSuffix(c.name);
              if (excludeNames.has(display.toLowerCase())) continue;
              if (!matchesCategory(c, category)) continue;
              found.push({
                id: c.id,
                name: display,
                backdrop: c.backdrop ?? null,
                count: c.parts.length,
              });
            }
          }
          setHits((prev) => [...prev, ...found]);
          if (exhausted) setDone(true);
          loadingRef.current = false;
          setLoading(false);
        })();
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, done, category, tmdbKey, excludeNames, stripSuffix]);

  return { hits, done, loading, sentinelRef };
}
