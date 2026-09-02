import type { Meta } from "@/lib/cinemeta";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpTile } from "./bp-tile";
import {
  BpCollectionEmpty,
  BpCollectionGrid,
  BpCollectionShell,
  BpCollectionSkeleton,
} from "./bp-collection-shell";
import { useBpT } from "./bp-i18n";
import { useBpCollectionDetail } from "./use-bp-collections";

const POSTER_BOX: BpArtBox = { min: 96, vw: 8, max: 158 };
const POSTER_CELL = bpBoxCss(POSTER_BOX);

export function BpCollectionDetail({
  collectionId,
  name,
  image,
  onSelect,
}: {
  collectionId: number;
  name: string;
  image?: string | null;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const detail = useBpCollectionDetail(collectionId, name);
  const backdrop = detail.image ?? image ?? null;
  const empty = !detail.loading && detail.parts.length === 0;

  return (
    <BpCollectionShell
      backdrop={backdrop}
      header={
        <>
          {detail.poster && (
            <img
              src={bpCardArt(detail.poster, bpBoxPx(POSTER_BOX))}
              alt=""
              decoding="async"
              className="shrink-0 rounded-[var(--bp-r-md)] object-cover shadow-[0_18px_44px_-18px_rgba(0,0,0,0.9)]"
              style={{ width: POSTER_CELL, aspectRatio: "2 / 3" }}
            />
          )}
          <div className="flex min-w-0 flex-col gap-[clamp(5px,0.7vh,11px)]">
            <span data-bp-eyebrow className="text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              {t("Collection")}
            </span>
            <h1 data-bp-coll-title className="text-[clamp(24px,4.4vh,54px)] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
              {detail.name}
            </h1>
            <span data-bp-coll-meta className="text-[clamp(11.5px,1.55vh,18px)] font-semibold text-ink-muted">
              {detail.parts.length > 0
                ? [t("{count} films", { count: detail.parts.length }), detail.years]
                    .filter(Boolean)
                    .join("  ·  ")
                : ""}
            </span>
            {detail.overview && (
              <p data-bp-coll-overview className="line-clamp-2 max-w-[62ch] text-[clamp(12.5px,1.75vh,20px)] font-medium text-ink-muted">
                {detail.overview}
              </p>
            )}
          </div>
        </>
      }
    >
      {detail.parts.length > 0 && (
        <BpCollectionGrid>
          {detail.parts.map((m, i) => (
            <BpTile key={`${m.id}-${i}`} meta={m} onSelect={onSelect} autofocus={i === 0} />
          ))}
        </BpCollectionGrid>
      )}
      {detail.loading && detail.parts.length === 0 && <BpCollectionSkeleton />}
      {empty && <BpCollectionEmpty text={t("No films found in this collection.")} />}
    </BpCollectionShell>
  );
}
