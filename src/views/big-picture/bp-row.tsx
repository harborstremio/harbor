import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";
import { isAndroidTv } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import type { HomeRow } from "@/views/home/home-types";
import { BpTile, type BpTileShape } from "./bp-tile";
import { BpRowHeader, type BpRowLead } from "./bp-row-header";
import { bpTrackGliding } from "./bp-track-glide";
import { prefetchBpHeroArt, prefetchBpRowNeighbours } from "./bp-art-prefetch";
import { onBpCardVisible } from "./bp-card-visible";
import { bpRingMoving } from "./bp-ring-motion";

const CHUNK = 10;
const NEAR_END_PX = 900;

// A television pages exactly one cell per keypress and its track is about
// 1140px wide, so a fixed 900px lookahead is most of a screenful: a fresh
// ten-cell row has only ~523px of overflow and is therefore inside the trigger
// at scrollLeft 0. The FIRST arrow press into every row mounted ten more tiles,
// and centerScroll fires a scroll on every horizontal press, so a viewer who
// pokes three cells into eight rows paid for eighty tiles they never looked at.
// Measured over an eight second navigation window on a Stick 4K Max that growth
// is Nodes +1192 and LayoutObjects +1254, NET, and Chromium styles and lays out
// every one of them on every later frame.
//
// A quarter of the track instead, which is between two and three poster cells at
// any viewport rather than a pixel count that means different things at
// different sizes. At 1140 the row now pages when the ring reaches cell four of
// ten, leaving five mounted cells of runway ahead of it, which is over 450ms at
// the 90ms autorepeat gate.
//
// Android TV only. Desktop keeps the 900px, which is the right lookahead for a
// mouse or trackpad producing a stream of scroll events rather than one centred
// jump per press.
const TV_NEAR_END = 0.25;

// TRAP, for whoever tries to take this further. The obvious next step is to move
// the page-in off the press entirely and grow on the ring settle, the way
// bp-home's row warmer waits on bpRingMoving. Do NOT do that without solving the
// pacing first: bpArtSrc arms a src IMMEDIATELY when `moving` is false and only
// queues it for the 3-per-frame pacer while the ring is in flight, so a grow
// timed to land after the settle turns ten new tiles into ten unpaced decodes.
// That is the twenty-simultaneous-decode regression, which took a Down press
// from 49ms to 1946ms, arriving through a different door. Today's mid-burst
// mount is queued and paced, and that is the only reason it is safe.

// Desktop's numbered row is exactly ten and never pages, views/home/customizable-rows.tsx.
const RANK_MAX = 10;

/**
 * The rows the user numbered, from the same setting desktop reads.
 *
 * Array.isArray rather than `?? []`: settings.update is a shallow replace with
 * no normalisation, so a homeRows synced from another device lands verbatim and
 * a non-array `numerals` would throw inside render on a television that has no
 * customize page to correct it from.
 */
export function useBpNumerals(): ReadonlySet<string> {
  const { settings } = useSettings();
  const raw = settings.homeRows?.numerals;
  return useMemo(() => new Set(Array.isArray(raw) ? raw : []), [raw]);
}

// Desktop's gate, views/home/customizable-rows.tsx: numbered plus a full ten
// titles. A short row falls back to plain posters rather than numbering to nine.
export function bpRowShape(row: HomeRow, numerals: ReadonlySet<string>): BpTileShape {
  return numerals.has(row.key) && row.metas.length >= RANK_MAX ? "rank" : "poster";
}

function dedupe(existing: Meta[], incoming: Meta[]): Meta[] {
  const seen = new Set(existing.map((m) => m.id));
  const out: Meta[] = [];
  for (const m of incoming) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export function BpRow({
  title,
  metas,
  shape = "poster",
  onSelect,
  autofocusFirst,
  cornerOf,
  row,
  lead,
}: {
  title: string;
  metas: Meta[];
  shape?: BpTileShape;
  onSelect: (meta: Meta) => void;
  autofocusFirst?: boolean;
  cornerOf?: (meta: Meta) => ReactNode;
  row?: HomeRow;
  lead?: BpRowLead;
}) {
  const { settings } = useSettings();
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(CHUNK);
  const [extra, setExtra] = useState<Meta[]>([]);
  const pageRef = useRef(row?.page ?? 1);
  const exhaustedRef = useRef(!row?.fetcher || !row?.hasMore);
  const busyRef = useRef(false);
  const ranked = shape === "rank";

  useEffect(() => {
    setExtra([]);
    setShown(CHUNK);
    pageRef.current = row?.page ?? 1;
    exhaustedRef.current = !row?.fetcher || !row?.hasMore;
  }, [row?.key]);

  // The cap is here rather than at the caller so a ranked row cannot page past
  // ten however it was fed, which is also why loadMore refuses below: reaching
  // the end of a ranked row would otherwise fetch a page nothing can draw.
  const all = useMemo(
    () => (ranked ? metas.slice(0, RANK_MAX) : extra.length > 0 ? [...metas, ...extra] : metas),
    [ranked, metas, extra],
  );

  const shownRef = useRef(shown);
  shownRef.current = shown;
  const totalRef = useRef(all.length);
  totalRef.current = all.length;

  const loadMore = useCallback(async () => {
    const fetcher = row?.fetcher;
    if (!fetcher || ranked || exhaustedRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const next = pageRef.current + 1;
      const page = await fetcher(next);
      pageRef.current = next;
      if (page.length === 0) {
        exhaustedRef.current = true;
        return;
      }
      setExtra((prev) => {
        const merged = dedupe([...metas, ...prev], page);
        if (merged.length === 0) exhaustedRef.current = true;
        return merged.length > 0 ? [...prev, ...merged] : prev;
      });
    } catch {
      exhaustedRef.current = true;
    } finally {
      busyRef.current = false;
    }
  }, [row?.fetcher, row?.key, metas, ranked]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const tv = isAndroidTv();
    const onScroll = () => {
      // A glide fires a scroll event per frame where a jump fired one per press,
      // and setShown adds a CHUNK on each, so one press would page in a hundred
      // tiles instead of ten. bp-track-glide clears its entry before the final
      // write, so the settling event still gets through and pages exactly once.
      if (bpTrackGliding(track)) return;
      const width = track.clientWidth;
      const isRtl = getComputedStyle(track).direction === "rtl";
      const scrolled = isRtl ? -track.scrollLeft : track.scrollLeft;
      const remaining = track.scrollWidth - (scrolled + width);
      // A collapsed track (empty:hidden, a row still resolving) reports 0 and
      // would read as "at the end" on every scroll it never has.
      const near = tv ? (width >= 2 ? width * TV_NEAR_END : -1) : NEAR_END_PX;
      if (remaining > near) return;
      setShown((n) => (n >= totalRef.current ? n : n + CHUNK));
      if (shownRef.current >= totalRef.current - CHUNK) void loadMore();
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [all.length, loadMore]);

  const leads = useMemo(() => all.slice(0, 1).map((m) => m.background), [all]);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || leads.length === 0) return;
    let timer = 0;
    const stop = onBpCardVisible(section, () => {
      timer = window.setTimeout(() => prefetchBpHeroArt(leads), 300);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [leads]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let timer = 0;
    const onFocus = (e: FocusEvent) => {
      const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-bp-focusable]");
      if (!cell) return;
      const cells = [...track.querySelectorAll<HTMLElement>("[data-bp-focusable]")];
      const index = cells.indexOf(cell);
      if (index < 0) return;
      window.clearTimeout(timer);
      const tick = () => {
        if (bpRingMoving()) {
          timer = window.setTimeout(tick, 90);
          return;
        }
        prefetchBpRowNeighbours(all, index, settings.tmdbKey);
      };
      timer = window.setTimeout(tick, 90);
    };
    track.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(timer);
      track.removeEventListener("focusin", onFocus);
    };
  }, [all, settings.tmdbKey]);

  if (all.length === 0) return null;

  // The header is a SIBLING of the track, never a child of it, and the paging
  // above leans on that. Right at the last cell moves the ring onto the header's
  // see-all; because the see-all is outside [data-bp-scroll-x], centerScroll
  // finds no track to glide, no scroll event fires, and onScroll never adds a
  // CHUNK. Move the header inside the track and every trip to the end of a row
  // mounts ten more tiles nobody asked to see.
  return (
    <section
      ref={sectionRef}
      data-bp-row
      data-bp-row-key={lead?.rowKey ?? row?.key ?? title}
      data-bp-row-tab={lead?.tab}
      aria-label={lead ? title : undefined}
      className="relative"
    >
      <BpRowHeader title={title} lead={lead} />
      <div
        ref={trackRef}
        data-bp-scroll-x
        className="flex gap-[var(--bp-track-gap)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(12px,1.5vh,24px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {all.slice(0, shown).map((m, i) => (
          <BpTile
            key={`${m.id}-${i}`}
            meta={m}
            shape={shape}
            rank={ranked ? i + 1 : undefined}
            onSelect={onSelect}
            autofocus={autofocusFirst && i === 0}
            corner={cornerOf?.(m)}
          />
        ))}
      </div>
    </section>
  );
}
