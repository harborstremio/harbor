import type { Meta } from "@/lib/cinemeta";
import { PickCard } from "./pick-card";
import { Row, usePosterRow } from "./row";

export type ShelfMeta = {
  id: string;
  title: string;
  kicker?: string;
};

export function FeedShelf({
  shelf,
  items,
  onEndReached,
  flagRerun = false,
  scrollKey,
  onViewAll,
}: {
  shelf: ShelfMeta;
  items: Meta[] | null;
  onEndReached?: () => void;
  flagRerun?: boolean;
  scrollKey?: string;
  onViewAll?: () => void;
}) {
  const sizing = usePosterRow();

  if (items === null) {
    return (
      <Row {...sizing} title={<ShelfTitle shelf={shelf} />} scrollKey={scrollKey} alwaysActive>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`${sizing.shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]"} rounded-xl bg-elevated/35`}
          />
        ))}
      </Row>
    );
  }

  if (items.length === 0) return null;

  return (
    <Row
      {...sizing}
      title={<ShelfTitle shelf={shelf} />}
      onEndReached={onEndReached}
      scrollKey={scrollKey}
      onViewAll={onViewAll}
    >
      {items.map((m) => (
        <PickCard key={m.id} meta={m} flagRerun={flagRerun} />
      ))}
    </Row>
  );
}

function ShelfTitle({ shelf }: { shelf: ShelfMeta }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[17px] font-medium tracking-tight text-ink">{shelf.title}</span>
      {shelf.kicker && (
        <span className="text-[12px] font-medium text-ink-subtle">{shelf.kicker}</span>
      )}
    </span>
  );
}
