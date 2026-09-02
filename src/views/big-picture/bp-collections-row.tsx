import { useSettings } from "@/lib/settings";
import { BpCollectionCard, BpCollectionCardSkeleton } from "./bp-collection-card";
import { useBpT } from "./bp-i18n";
import { useBpCuratedRow } from "./use-bp-collection-feed";
import type { BpCollectionTarget } from "./use-bp-collections";
import { BpRowHeader, type BpRowLead } from "./bp-row-header";

const CELL_WIDTH = "clamp(230px, 19vw, 340px)";
const PLACEHOLDERS = 6;

export function BpCollectionsRow({
  onOpen,
  limit = 30,
  autofocusFirst,
  lead,
}: {
  onOpen: (target: BpCollectionTarget) => void;
  limit?: number;
  autofocusFirst?: boolean;
  lead?: BpRowLead;
}) {
  const t = useBpT();
  const { settings } = useSettings();
  const { entries, settled, rowRef } = useBpCuratedRow(limit);
  if (!settings.tmdbKey) return null;
  if (settled && entries.length === 0) return null;

  const title = lead?.title ?? t("Collections");

  return (
    // While the feed resolves this row holds its height with skeletons that are
    // not focusable, so the rail index exists and bpRailStep steps over it. The
    // focusable lead tile that used to sit beside them is gone, and nothing
    // seeds the ring here, so an unreachable row is the correct state for a row
    // with nothing to act on yet.
    <section
      ref={rowRef}
      data-bp-row
      data-bp-row-key="collections"
      data-bp-row-tab={lead?.tab}
      aria-label={lead ? title : undefined}
      className="relative"
    >
      <BpRowHeader title={title} lead={lead} />
      <div
        data-bp-scroll-x
        className="flex gap-[clamp(11px,1vw,20px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {entries.map((entry, i) => (
          <BpCollectionCard
            key={entry.key}
            entry={entry}
            onOpen={(e) =>
              e.open.kind === "tmdb"
                ? onOpen({
                    collectionId: e.open.collectionId,
                    name: e.open.name,
                    image: e.open.image,
                  })
                : undefined
            }
            autofocus={autofocusFirst && i === 0}
            width={CELL_WIDTH}
          />
        ))}
        {!settled && entries.length === 0 && (
          // Six pulsing plates on the Home screen was six live render surfaces.
          <div aria-hidden className="flex shrink-0 gap-[clamp(11px,1vw,20px)]">
            {Array.from({ length: PLACEHOLDERS }).map((_, i) => (
              <div key={i} className="shrink-0" style={{ width: CELL_WIDTH }}>
                <BpCollectionCardSkeleton />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
