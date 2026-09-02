import { useEffect, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { observe } from "@/lib/visibility";
import { BpGrid } from "./bp-grid";
import { BpTile } from "./bp-tile";
import { BpCwCard } from "./bp-cw-row";
import { useBpT } from "./bp-i18n";
import type { BpLibSection } from "./bp-library-types";

// Height driven, NOT the width based BP_POSTER_COLUMNS a horizontal rail uses.
// The library is a VERTICAL grid, so a poster whose height is 1.5x its own
// width overflows the band above --bp-hint-h on a short window and the next row
// paints under it. 18vh of width caps the row height near 27vh so a full row
// clears the hint bar at 1080, 800 and below. NEEDS AN EYE: 18 is an apparent
// size across a room, push it live and judge bigger or smaller.
const LIB_POSTER_COLUMNS =
  "repeat(auto-fill, minmax(clamp(122px, 18vh, 186px), 1fr))";

const WIDE_COLUMNS =
  "repeat(auto-fill, minmax(clamp(240px, 20vw, 400px), 1fr))";
const RECHECK_MS = 300;
const AUTO_PAGES = 4;

export function BpLibrarySections({
  sections,
  episodes,
  shown,
  hasMore,
  onMore,
  onSelect,
}: {
  sections: BpLibSection[];
  episodes: boolean;
  shown: number;
  hasMore: boolean;
  onMore: () => void;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nearRef = useRef(false);
  const autoRef = useRef(0);
  const timerRef = useRef(0);
  const moreRef = useRef(onMore);
  moreRef.current = onMore;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  // Observed once, never re-observed on growth. lib/visibility shares one
  // observer, so re-running this unobserved and re-observed the same node, and
  // a re-observed target is delivered a fresh initial entry from whatever the
  // browser finds, before React had laid out the page just added: the sentinel
  // still measured close, which paged again, which re-observed. That is the
  // shape recorded at bp-streams.tsx:208. onMore changes identity on every
  // parent render, so it used to re-arm on renders that had nothing to do with
  // paging at all.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    return observe(el, (visible) => {
      if (visible && !nearRef.current) autoRef.current = 0;
      nearRef.current = visible;
      if (visible && hasMoreRef.current) moreRef.current();
    });
  }, []);

  // The case the re-observe used to cover: a page that lands without pushing
  // the sentinel out of the band crosses no threshold, so nothing would ask for
  // the next one. The delay lets the browser deliver the crossing this page's
  // own cells caused, so a grid that grew past the sentinel stops here, and the
  // cap stops one that cannot grow.
  useEffect(() => {
    if (!hasMore) return;
    timerRef.current = window.setTimeout(() => {
      if (!nearRef.current || !hasMoreRef.current || autoRef.current >= AUTO_PAGES) return;
      autoRef.current += 1;
      moreRef.current();
    }, RECHECK_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [shown, hasMore]);

  let cell = 0;

  return (
    <div className="flex flex-col">
      {sections.map((section) => (
        <section key={section.label || "all"} className="flex flex-col">
          {section.label && (
            <h3 className="pt-[clamp(8px,1vh,16px)] text-[clamp(11px,1.5vh,17px)] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              {t(section.label)}
              <span className="ms-2 opacity-60">{section.total}</span>
            </h3>
          )}
          <BpGrid
            columns={episodes ? WIDE_COLUMNS : LIB_POSTER_COLUMNS}
            gap={episodes ? "clamp(11px,1vw,20px)" : undefined}
          >
            {section.items.map((entry) => {
              const first = cell++ === 0;
              return entry.item && episodes ? (
                <BpCwCard
                  key={entry.key}
                  item={entry.item}
                  onSelect={onSelect}
                  autofocus={first}
                  fluid
                />
              ) : (
                <BpTile
                  key={entry.key}
                  meta={entry.meta}
                  shape={episodes ? "wide" : "poster"}
                  fluid
                  onSelect={onSelect}
                  autofocus={first}
                />
              );
            })}
          </BpGrid>
        </section>
      ))}
      <div ref={sentinelRef} className="h-px w-full" />
    </div>
  );
}
