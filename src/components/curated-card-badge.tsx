import { cardBadge } from "@/lib/curated/registry";
import type { CuratedList, CuratedListItem } from "@/lib/curated/types";

export function CuratedCardBadge({ list, item }: { list: CuratedList; item: CuratedListItem }) {
  const label = cardBadge(list, item);
  if (!label) return null;
  return (
    <span className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3]">
      <span className="absolute bottom-1.5 start-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-md bg-canvas/95 px-1.5 text-[11px] font-semibold tabular-nums leading-none text-ink">
        {label}
      </span>
    </span>
  );
}
