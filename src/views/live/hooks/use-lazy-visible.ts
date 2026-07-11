import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_BATCH = 24;
const BATCH_SIZE = 24;
const MAX_SHOWN = 1500;

const SHOWN_CACHE = new Map<string, number>();

export function useLazyVisible<T>(
  items: T[],
  resetKey: unknown,
): {
  visible: T[];
  sentinelRef: (el: HTMLDivElement | null) => void;
  hasMore: boolean;
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
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (cacheKeyRef.current === cacheKey) return;
    cacheKeyRef.current = cacheKey;
    setShown(INITIAL_BATCH);
    SHOWN_CACHE.set(cacheKey, INITIAL_BATCH);
  }, [cacheKey]);

  useEffect(() => {
    SHOWN_CACHE.set(cacheKey, shown);
  }, [cacheKey, shown]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
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
      { rootMargin: "150px 0px" },
    );
    obs.observe(el);
    observerRef.current = obs;
  }, []);

  const ceiling = Math.min(items.length, MAX_SHOWN);
  return {
    visible: items.slice(0, Math.min(shown, ceiling)),
    sentinelRef,
    hasMore: shown < ceiling,
  };
}
