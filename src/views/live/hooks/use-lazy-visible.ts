import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const INITIAL_BATCH = 24;
const BATCH_SIZE = 24;
const MAX_SHOWN = 1500;

const SHOWN_CACHE = new Map<string, number>();

export function useLazyVisible<T>(
  items: T[],
  resetKey: unknown,
  rootRef?: RefObject<HTMLElement | null>,
): {
  visible: T[];
  sentinelRef: (el: HTMLDivElement | null) => void;
  hasMore: boolean;
  loadMore: () => void;
} {
  const cacheKey = String(resetKey);
  const cacheKeyRef = useRef(cacheKey);
  const [shown, setShown] = useState(() => {
    const cached = SHOWN_CACHE.get(cacheKey);
    if (cached == null) return INITIAL_BATCH;
    return Math.min(MAX_SHOWN, Math.max(INITIAL_BATCH, cached));
  });
  const itemsLenRef = useRef(items.length);
  itemsLenRef.current = items.length;
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (cacheKeyRef.current === cacheKey) return;
    cacheKeyRef.current = cacheKey;
    setShown(INITIAL_BATCH);
    SHOWN_CACHE.set(cacheKey, INITIAL_BATCH);
  }, [cacheKey]);

  useEffect(() => {
    SHOWN_CACHE.set(cacheKey, shown);
  }, [cacheKey, shown]);

  // observing from an effect, not from the ref callback: React assigns child
  // refs before parent ones, so the scroll container is still null at that point
  useEffect(() => {
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setShown((n) => {
          const len = itemsLenRef.current;
          const ceiling = Math.min(len, MAX_SHOWN);
          if (n >= ceiling) return n;
          return Math.min(ceiling, n + BATCH_SIZE);
        });
      },
      { root: rootRef?.current ?? null, rootMargin: "300px 0px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [sentinel, rootRef]);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => setSentinel(el), []);

  const loadMore = useCallback(() => {
    setShown((n) => {
      const ceiling = Math.min(itemsLenRef.current, MAX_SHOWN);
      if (n >= ceiling) return n;
      return Math.min(ceiling, n + BATCH_SIZE);
    });
  }, []);

  const ceiling = Math.min(items.length, MAX_SHOWN);
  return {
    visible: items.slice(0, Math.min(shown, ceiling)),
    sentinelRef,
    hasMore: shown < ceiling,
    loadMore,
  };
}
