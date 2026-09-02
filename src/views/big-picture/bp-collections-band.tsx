import { pushBigPicture } from "@/lib/big-picture";
import { useSettings } from "@/lib/settings";
import { BpCollectionCard, BpCollectionCardSkeleton } from "./bp-collection-card";
import { useBpT } from "./bp-i18n";
import { BpLeadTile } from "./bp-lead-tile";
import { useBpCuratedRow } from "./use-bp-collection-feed";

const CELL = "clamp(230px, 19vw, 340px)";
const PLACEHOLDERS = 6;

// BpCollectionsRow owns its own track, so the band is rebuilt here to seat the
// leading label tile as the first cell inside it.
export function BpCollectionsBand({ limit = 30 }: { limit?: number }) {
  const t = useBpT();
  const { settings } = useSettings();
  const { entries, settled, rowRef } = useBpCuratedRow(limit);
  if (!settings.tmdbKey) return null;
  if (settled && entries.length === 0) return null;

  return (
    <section ref={rowRef} data-bp-row data-bp-row-key="collections-band" aria-label={t("Collections")} className="relative">
      <div
        data-bp-scroll-x
        className="flex items-stretch gap-[clamp(11px,1vw,20px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {entries.map((entry) => (
          <BpCollectionCard
            key={entry.key}
            entry={entry}
            onOpen={(e) =>
              e.open.kind === "tmdb"
                ? pushBigPicture({
                    kind: "tmdb-collection",
                    collectionId: e.open.collectionId,
                    name: e.open.name,
                    image: e.open.image,
                  })
                : undefined
            }
            width={CELL}
          />
        ))}
        {!settled && entries.length === 0 && (
          <div aria-hidden className="flex shrink-0 gap-[clamp(11px,1vw,20px)]">
            {Array.from({ length: PLACEHOLDERS }).map((_, i) => (
              <div key={i} className="shrink-0" style={{ width: CELL }}>
                <BpCollectionCardSkeleton />
              </div>
            ))}
          </div>
        )}
        <BpLeadTile
          label={t("View all")}
          action={t("Collections")}
          restoreKey="bp-lead:collections"
          width={CELL}
          ratio="16 / 9"
          onSelect={() => pushBigPicture({ kind: "collections" })}
        />
      </div>
    </section>
  );
}
