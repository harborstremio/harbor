import { useEffect, useRef, useState, type RefObject } from "react";
import { CoverImg } from "@/components/cover-img";
import { VirtualGrid } from "@/components/virtual-grid";
import type { MangaSummary } from "@/lib/manga/types";
import { initials } from "./types";

// Decoding many posters at once saturates the connection and stalls the main
// thread. Cap how many cover images mount/load at a time so a handful load and
// the rest queue as slots free up.
const MAX_LOADING = 6;
let loading = 0;
const waiters: Array<() => void> = [];

function requestCover(grant: () => void): () => void {
  let owned = false;
  const claim = () => {
    if (loading < MAX_LOADING) {
      owned = true;
      loading += 1;
      grant();
    } else {
      waiters.push(claim);
    }
  };
  claim();
  return () => {
    if (!owned) return;
    owned = false;
    loading -= 1;
    waiters.shift()?.();
  };
}

function Cover({ item }: { item: MangaSummary }) {
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !item.cover) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Reveal is permanent once granted (releasing frees the slot for the
        // next cover but never un-renders an already decoded image), so once
        // done we stop asking for another slot.
        if (entries[0]?.isIntersecting && !releaseRef.current && !doneRef.current) {
          releaseRef.current = requestCover(() => setRevealed(true));
        }
      },
      { root: null, rootMargin: "1000px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [item.cover]);

  const show = item.cover && revealed && !failed;
  return (
    <div
      ref={rootRef}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 174px" }}
      className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-elevated harbor-card-ring ring-1 ring-inset ring-black/10"
    >
      {show ? (
        <CoverImg
          src={item.cover}
          alt=""
          draggable={false}
          width={116}
          height={174}
          decoding="async"
          onLoad={() => {
            doneRef.current = true;
            releaseRef.current?.();
            releaseRef.current = null;
          }}
          onError={() => {
            setFailed(true);
            doneRef.current = true;
            releaseRef.current?.();
            releaseRef.current = null;
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-[22px] font-bold text-ink-subtle">
          {initials(item.title)}
        </div>
      )}
    </div>
  );
}

export function MangaGrid({
  items,
  onOpen,
  scrollRef,
}: {
  items: MangaSummary[];
  onOpen?: (item: MangaSummary) => void;
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const card = (m: MangaSummary) => (
    <button
      key={m.id}
      type="button"
      onClick={() => onOpen?.(m)}
      className="group flex w-full flex-col gap-2 text-start"
    >
      <div
        className="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
      >
        <Cover item={m} />
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{m.title}</p>
    </button>
  );

  const grid = (ref: RefObject<HTMLElement | null>) => (
    <VirtualGrid
      items={items}
      scrollRef={ref}
      minColumnWidth={116}
      estimateRowHeight={230}
      gapX={16}
      gapY={24}
      overscan={1}
      className="w-full"
      getKey={(m) => m.id}
      renderItem={(m) => card(m)}
    />
  );

  // Without an external scroll container (in-panel source browse) we still must
  // virtualize, otherwise every page of results mounts all its cards at once
  // and the page lags once several pages have loaded. Give the grid its own
  // bounded scroll surface so it always windows.
  if (!scrollRef || scrollRef.current === null) {
    return (
      <div ref={innerRef} className="max-h-[72vh] w-full overflow-y-auto">
        {grid(innerRef)}
      </div>
    );
  }
  return grid(scrollRef);
}

export function MangaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-x-4 gap-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse motion-reduce:animate-none">
          <div className="aspect-[2/3] w-full rounded-xl bg-elevated/60" />
          <div className="mt-2 h-3.5 w-4/5 rounded bg-elevated/50" />
        </div>
      ))}
    </div>
  );
}
