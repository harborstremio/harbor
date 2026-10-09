import { useEffect, useRef } from "react";
import { GENRE_PALETTE } from "@/components/genre-tiles";
import { pushBigPicture } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { observe } from "@/lib/visibility";
import { BpCollectionSkeleton } from "./bp-collection-shell";
import { BpEmptyState } from "./bp-empty";
import { BP_POSTER_COLUMNS, BpGrid, BpGridScroller } from "./bp-grid";
import { useBpT } from "./bp-i18n";
import { BpTile } from "./bp-tile";
import type { BpGenreStatus } from "./use-bp-genre-grid";

export function BpGenreGrid({
  genre,
  metas,
  status,
  onMore,
  onRetry,
  onSelect,
}: {
  genre: string;
  metas: Meta[];
  status: BpGenreStatus;
  onMore: () => void;
  onRetry: () => void;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef(onMore);
  const palette = GENRE_PALETTE[genre] ?? GENRE_PALETTE.Drama;

  useEffect(() => {
    moreRef.current = onMore;
  });

  // Armed once, on the sentinel element, never re-armed on metas.length.
  // lib/visibility shares one observer, so re-observing the same node is handed
  // a fresh initial entry from whatever the browser finds before React has laid
  // out the page just added: still close, so it pages, so it re-observes. This
  // only ever stopped because twenty results happened to overflow the scroller,
  // which is geometry, not a stop condition. Same shape as bp-streams:208.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    return observe(el, (visible) => {
      if (visible) moreRef.current();
    });
  }, []);

  return (
    <div className="relative flex h-full flex-col pt-[var(--bp-page-top)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[38vh]"
        style={{
          background: `linear-gradient(to bottom, oklch(from ${palette.from} l c h / 0.34), transparent)`,
        }}
      />
      <div className="relative flex flex-col gap-[clamp(2px,0.4vh,6px)] px-[var(--bp-gutter)]">
        <span
          className="text-[clamp(9.5px,1.25vh,14px)] font-bold uppercase tracking-[0.2em]"
          style={{ color: palette.ink }}
        >
          {t("Genre")}
        </span>
        <h1 className="font-display text-[clamp(22px,3.6vh,50px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {t(genre)}
        </h1>
      </div>
      <div className="relative mt-[clamp(9px,1.3vh,20px)] flex min-h-0 flex-1 flex-col px-[var(--bp-gutter)]">
        <BpGridScroller>
          {status === "ready" && (
            // Seeds its own first tile rather than leaning on bp-discover's
            // overlay effect to focus bpFocusables(overlay)[0] on its behalf,
            // which also makes this page safe to route to directly.
            <BpGrid columns={BP_POSTER_COLUMNS}>
              {metas.map((m, i) => (
                <BpTile
                  key={`${m.id}-${i}`}
                  meta={m}
                  onSelect={onSelect}
                  autofocus={i === 0}
                  fluid
                />
              ))}
            </BpGrid>
          )}
          {status === "loading" && <BpCollectionSkeleton />}
          {status === "no-key" && (
            <BpEmptyState
              message={t("Genre shelves are built from TMDB. Add a key in Setup to fill this one.")}
              action={t("Open Setup")}
              icon="setup"
              onAction={() => pushBigPicture({ kind: "settings" })}
            />
          )}
          {status === "failed" && (
            <BpEmptyState
              message={t("Couldn't reach TMDB for {genre} titles.", { genre: t(genre) })}
              action={t("Try again")}
              onAction={onRetry}
            />
          )}
          {status === "filtered" && (
            // The infinite-scroll sentinel is gated on there being tiles, so a
            // first page the anime filter empties never asks for a second one
            // and the shelf is stuck. This button is that request.
            <BpEmptyState
              message={t("Everything on this page of {genre} is hidden by your anime filter.", {
                genre: t(genre),
              })}
              action={t("Show more")}
              onAction={onMore}
            />
          )}
          {status === "empty" && (
            <BpEmptyState
              message={t("Nothing in {genre} right now.", { genre: t(genre) })}
              action={t("Try again")}
              onAction={onRetry}
            />
          )}
          <div ref={sentinelRef} className="h-px w-full" />
        </BpGridScroller>
      </div>
    </div>
  );
}
