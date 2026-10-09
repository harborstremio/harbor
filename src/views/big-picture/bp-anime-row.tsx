import type { Meta } from "@/lib/cinemeta";
import { animeCardBadges } from "./bp-anime-badges";
import { BpCwCard } from "./bp-cw-row";
import { useBpT } from "./bp-i18n";
import { BpSkeletonRow } from "./bp-page-skeleton";
import { BpRow } from "./bp-row";
import { BpRowHeader } from "./bp-row-header";
import type { BpAnimeRow } from "./use-bp-anime";

export { animeCardBadges };

const TRACK =
  "flex gap-[clamp(21px,1.9vw,32px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(12px,1.5vh,24px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// No autofocus prop. Anime seeds the hero, the picks or the chips and never a
// deep row, so a row here can never hold the page's marker: bp-anime records
// why arriving with the rail already scrolled is the wrong answer.
export function BpAnimeRailBody({
  row,
  onSelect,
  onSeeAll,
}: {
  row: BpAnimeRow;
  onSelect: (m: Meta) => void;
  onSeeAll?: () => void;
}) {
  const t = useBpT();

  if (row.cwItems) {
    if (row.cwItems.length === 0) {
      return row.loading ? <BpSkeletonRow title={row.title} wide /> : null;
    }
    return (
      // data-bp-row-key, which this branch had no version of. bpRailStep reads
      // the key off the section and falls back to "", which makes
      // readBpRowPosition skip the lookup entirely, so this row never restored
      // its remembered cell: Down out of card seven and back Up landed on card
      // one, where the same two presses return you to card seven on Home.
      <section data-bp-row data-bp-row-key={row.id} className="relative">
        <BpRowHeader title={row.title} />
        <div data-bp-scroll-x className={TRACK}>
          {row.cwItems.map((item) => (
            <BpCwCard key={item._id} item={item} onSelect={onSelect} />
          ))}
        </div>
      </section>
    );
  }

  if (row.notice) {
    return (
      <section data-bp-row data-bp-row-key={row.id}>
        <BpRowHeader title={row.title} />
        <p className="mx-[var(--bp-gutter)] max-w-[min(36vw,410px)] text-[clamp(15px,1.9vh,22px)] leading-[1.6] text-ink-muted">
          {row.notice}
        </p>
      </section>
    );
  }

  if (row.metas.length === 0) {
    return row.loading ? <BpSkeletonRow title={row.title} /> : null;
  }

  return (
    <BpRow
      title={row.title}
      metas={row.metas}
      onSelect={onSelect}
      shape={row.ranked ? "rank" : "poster"}
      cornerOf={animeCardBadges}
      row={row.source}
      lead={{
        rowKey: row.id,
        title: row.title,
        action: onSeeAll ? t("See all") : undefined,
        open: onSeeAll,
      }}
    />
  );
}
