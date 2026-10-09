import { useEffect, useRef, type RefObject } from "react";
import { observe } from "@/lib/visibility";

const RECHECK_MS = 300;
const AUTO_PAGES = 4;

/**
 * The sentinel pattern bp-library-sections and bp-streams already ship, lifted
 * out so a page cannot get it subtly wrong on its own.
 *
 * Observed ONCE, never re-observed on growth. lib/visibility shares a single
 * observer, so unobserving and re-observing the same node hands it a fresh
 * initial entry from whatever the browser finds before React has laid out the
 * page just added: the sentinel still measures close, which pages again, which
 * re-observes. That is the loop that mounted 1017 rows with no input. Every
 * stop condition is read from a ref inside the callback for the same reason.
 */
export function useBpAutoPage(
  shown: number,
  hasMore: boolean,
  onMore: () => void,
): RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nearRef = useRef(false);
  const autoRef = useRef(0);
  const moreRef = useRef(onMore);
  moreRef.current = onMore;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    return observe(el, (visible) => {
      if (visible && !nearRef.current) autoRef.current = 0;
      nearRef.current = visible;
      if (visible && hasMoreRef.current) moreRef.current();
    });
  }, []);

  // The case the re-observe used to cover: a page that lands without pushing the
  // sentinel out of the band crosses no threshold, so nothing would ask for the
  // next one. The delay lets the browser deliver the crossing this page's own
  // cells caused, and the cap stops a list that cannot grow past the sentinel.
  useEffect(() => {
    if (!hasMore) return;
    const timer = window.setTimeout(() => {
      if (!nearRef.current || !hasMoreRef.current || autoRef.current >= AUTO_PAGES) return;
      autoRef.current += 1;
      moreRef.current();
    }, RECHECK_MS);
    return () => window.clearTimeout(timer);
  }, [shown, hasMore]);

  return sentinelRef;
}
