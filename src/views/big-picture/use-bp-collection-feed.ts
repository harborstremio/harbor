import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLLECTIONS_CATALOG } from "@/lib/collections-catalog";
import { useCollections } from "@/lib/collections";
import { useSettings } from "@/lib/settings";
import { nearestScrollRoot, useCategoryFeed } from "@/views/collections/use-category-feed";
import {
  BP_COLLECTIONS_ALL,
  BP_CURATED_NAMES,
  bpMapLimit,
  bpStripCollectionSuffix,
  resolveBpCollection,
} from "./use-bp-collections";
import {
  HYDRATE_LANES,
  STEPS_PER_PULL,
  categoryEntry,
  makeCtx,
  ownedEntry,
  step,
  tmdbEntry,
  type BpCollectionEntry,
  type BpCollectionSource,
  type Ctx,
} from "./bp-collection-steps";

export {
  BP_COLLECTION_SOURCES,
  type BpCollectionEntry,
  type BpCollectionOpen,
  type BpCollectionSource,
} from "./bp-collection-steps";

const RECHECK_MS = 300;
const AUTO_PULLS = 4;

export function useBpCuratedRow(limit: number): {
  entries: BpCollectionEntry[];
  settled: boolean;
  rowRef: (el: HTMLElement | null) => void;
} {
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);
  const [entries, setEntries] = useState<BpCollectionEntry[]>([]);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!node || seen) return;
    const io = new IntersectionObserver(
      (rows) => {
        if (!rows.some((r) => r.isIntersecting)) return;
        setSeen(true);
        io.disconnect();
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, seen]);

  useEffect(() => {
    if (!seen || !key) return;
    let alive = true;
    setSettled(false);
    const slice = COLLECTIONS_CATALOG.slice(0, limit).map((c, i) => ({ c, i }));
    const found = new Array<BpCollectionEntry | null>(slice.length).fill(null);
    void bpMapLimit(slice, HYDRATE_LANES, async ({ c, i }) => {
      const hit = await resolveBpCollection(key, c.id, c.name);
      if (!alive || !hit) return;
      found[i] = tmdbEntry(
        hit.id,
        bpStripCollectionSuffix(hit.name || c.name),
        hit.backdrop ?? null,
        hit.parts.length,
      );
      setEntries(found.filter((e): e is BpCollectionEntry => e !== null));
    })
      .catch(() => {})
      .then(() => {
        if (alive) setSettled(true);
      });
    return () => {
      alive = false;
    };
  }, [seen, key, limit]);

  return { entries, settled, rowRef: setNode };
}

export type BpCollectionFeed = {
  entries: BpCollectionEntry[];
  loading: boolean;
  done: boolean;
  tvdbCapped: boolean;
  communityFailed: boolean;
  tvdbFailed: boolean;
  sentinels: React.RefObject<HTMLDivElement | null>[];
};

export function useBpCollectionFeed(
  source: BpCollectionSource,
  category: string,
): BpCollectionFeed {
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const owned = useCollections();

  const mine = useMemo(
    () =>
      source === "all" || source === "mine"
        ? owned.map((c) => ownedEntry(c, "mine", null))
        : [],
    [owned, source],
  );

  const [chain, setChain] = useState<BpCollectionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [chainDone, setChainDone] = useState(false);
  const [tvdbCapped, setTvdbCapped] = useState(false);
  const [communityFailed, setCommunityFailed] = useState(false);
  const [tvdbFailed, setTvdbFailed] = useState(false);
  const ctxRef = useRef<Ctx | null>(null);
  const busyRef = useRef(false);
  const runRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  doneRef.current = chainDone;
  const nearRef = useRef(false);
  const autoRef = useRef(0);
  const timerRef = useRef(0);
  const pullRef = useRef<() => void>(() => {});
  const armedRef = useRef<Element | null>(null);
  const armedIdRef = useRef("");
  const ioRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    runRef.current += 1;
    const ctx = makeCtx(source, category, key);
    ctxRef.current = ctx;
    busyRef.current = false;
    autoRef.current = 0;
    setChain([]);
    setLoading(false);
    setTvdbCapped(false);
    setCommunityFailed(false);
    setTvdbFailed(false);
    setChainDone(ctx.phases.length === 0);
    return () => window.clearTimeout(timerRef.current);
  }, [source, category, key]);

  const pull = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx || busyRef.current || ctx.at >= ctx.phases.length) return;
    busyRef.current = true;
    const run = runRef.current;
    setLoading(true);
    const added: BpCollectionEntry[] = [];
    for (let i = 0; i < STEPS_PER_PULL && added.length === 0 && ctx.at < ctx.phases.length; i += 1) {
      added.push(...(await step(ctx)));
    }
    // Clearing the mutex before the staleness check would let an abandoned run
    // hand the lock to nobody, so two pulls could then share one ctx and page.
    if (runRef.current !== run) return;
    busyRef.current = false;
    if (added.length > 0) setChain((prev) => [...prev, ...added]);
    setTvdbCapped(ctx.tvdbMore);
    setCommunityFailed(ctx.communityFailed);
    setTvdbFailed(ctx.tvdbFailed);
    const finished = ctx.at >= ctx.phases.length;
    setChainDone(finished);
    setLoading(false);
    if (finished) return;
    // The short page keeps loading from here rather than from a rebuilt
    // observer. The delay is what makes it terminate: it gives the browser time
    // to deliver the crossing this pull's own cards caused, so a page that grew
    // past the sentinel reads nearRef false and stops, and the cap stops a page
    // that cannot grow at all.
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (doneRef.current || !nearRef.current || autoRef.current >= AUTO_PULLS) return;
      autoRef.current += 1;
      pullRef.current();
    }, RECHECK_MS);
  }, []);
  pullRef.current = () => void pull();

  // Armed against the sentinel ELEMENT and the feed identity, never against the
  // paging state. Keyed on `tick` it was rebuilt after every settled pull, and a
  // fresh observer reports its first entry immediately from whatever it finds,
  // before React had laid out the cards just added, so it pulled again and the
  // chain loaded to exhaustion with no input. That is the incident recorded at
  // bp-streams.tsx:208. The stop conditions are read from refs inside the
  // callback so they are current at delivery time.
  //
  // No dependency array on purpose, and the element compare is why: a caller is
  // free to mount the sentinel a render later than the feed it belongs to, and
  // a fixed-dependency effect would arm against a null ref and never look again.
  // useCategoryFeed carries the same shape for the same reason.
  useEffect(() => {
    const id = `${source}|${category}|${key}`;
    const el = sentinelRef.current;
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
      { root: nearestScrollRoot(el), rootMargin: "900px 0px" },
    );
    io.observe(el);
    ioRef.current = io;
  });

  useEffect(() => () => ioRef.current?.disconnect(), []);

  const catActive =
    Boolean(key) && source === "tmdb" && category !== BP_COLLECTIONS_ALL && chainDone;

  const cat = useCategoryFeed({
    tmdbKey: key,
    category,
    active: catActive,
    excludeNames: BP_CURATED_NAMES,
    stripSuffix: bpStripCollectionSuffix,
  });

  // The category feed mints the same tmdb:<id> keys the curated phase does and
  // has no view of ctx.seen, so the merge is the only place a collision dies.
  const entries = useMemo(() => {
    const out: BpCollectionEntry[] = [];
    const keys = new Set<string>();
    for (const e of [...mine, ...chain, ...cat.hits.map(categoryEntry)]) {
      if (keys.has(e.key)) continue;
      keys.add(e.key);
      out.push(e);
    }
    return out;
  }, [mine, chain, cat.hits]);

  return {
    entries,
    loading: loading || (catActive && cat.loading),
    done: chainDone && (!catActive || cat.done),
    tvdbCapped,
    communityFailed,
    tvdbFailed,
    sentinels: [sentinelRef, cat.sentinelRef],
  };
}
