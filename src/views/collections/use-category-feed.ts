import { useCallback, useEffect, useRef, useState } from "react";
import {
  tmdbCollection,
  tmdbSearchCollections,
  type TmdbCollection,
} from "@/lib/providers/tmdb";

const FEED_QUERY = "collection";
const PAGES_PER_PULL = 4;
const MIN_MATCHES_PER_PULL = 6;
const RECHECK_MS = 300;
const AUTO_PULLS = 4;

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

// rootMargin expands the root box, but the target rect is clipped by every
// scrolling ancestor first, so a viewport root buys no lead time inside one.
export function nearestScrollRoot(el: Element): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return null;
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
  const doneRef = useRef(false);
  doneRef.current = done;
  const runRef = useRef(0);
  const nearRef = useRef(false);
  const autoRef = useRef(0);
  const timerRef = useRef(0);
  const pullRef = useRef<() => void>(() => {});
  const armedRef = useRef<Element | null>(null);
  const armedIdRef = useRef("");
  const ioRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    runRef.current += 1;
    setHits([]);
    setDone(!active);
    setLoading(false);
    pageRef.current = 0;
    seenRef.current = new Set();
    loadingRef.current = false;
    autoRef.current = 0;
    return () => window.clearTimeout(timerRef.current);
  }, [category, active]);

  const pull = useCallback(async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    const run = runRef.current;
    setLoading(true);
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
    // A category switch resets the page cursor and empties the list, so a pull
    // still in flight from the old category must land nowhere: releasing the
    // mutex here would also hand it to the pull that already holds it.
    if (runRef.current !== run) return;
    setHits((prev) => [...prev, ...found]);
    if (exhausted) setDone(true);
    loadingRef.current = false;
    setLoading(false);
    if (exhausted) return;
    // A pull that matched nothing leaves the page the same height, so the
    // sentinel never crosses a threshold again and the feed would stall. This
    // re-check is what keeps it walking pages. The delay is what makes it
    // terminate: it gives the browser time to deliver the crossing this pull's
    // own hits caused, so a page that grew past the sentinel reads nearRef
    // false and stops, and the cap stops a page that cannot grow at all.
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (doneRef.current || !nearRef.current || autoRef.current >= AUTO_PULLS) return;
      autoRef.current += 1;
      pullRef.current();
    }, RECHECK_MS);
  }, [tmdbKey, category, excludeNames, stripSuffix]);
  pullRef.current = () => void pull();

  // Armed against the sentinel ELEMENT and the feed identity, never against the
  // paging state. Keyed on `tick` it was rebuilt after every settled pull, and a
  // fresh observer reports its first entry immediately from whatever it finds,
  // before React had laid out the hits just added, so it pulled again: this feed
  // and useBpCollectionFeed run concurrently on the same page and both walked
  // their whole chain with no input. That is the incident recorded at
  // bp-streams.tsx:208. The stop conditions are read from refs inside the
  // callback so they are current at delivery time.
  //
  // No dependency array on purpose. views/collections mounts this sentinel only
  // while `done` is false, so on the render that turns the feed active it is
  // still absent, and a [active, category] effect would arm against a null ref
  // and never look again: picking a category would load nothing at all.
  useEffect(() => {
    const id = active ? `${category}|${tmdbKey}` : "";
    const el = active ? sentinelRef.current : null;
    if (el === armedRef.current && id === armedIdRef.current) return;
    armedRef.current = el;
    armedIdRef.current = id;
    ioRef.current?.disconnect();
    ioRef.current = null;
    if (!el) return;
    const io = new IntersectionObserver(
      (rows) => {
        const near = rows[rows.length - 1]?.isIntersecting ?? false;
        if (near && !nearRef.current) autoRef.current = 0;
        nearRef.current = near;
        if (near && !doneRef.current) pullRef.current();
      },
      { root: nearestScrollRoot(el), rootMargin: "1200px 0px" },
    );
    io.observe(el);
    ioRef.current = io;
  });

  useEffect(() => () => ioRef.current?.disconnect(), []);

  return { hits, done, loading, sentinelRef };
}
