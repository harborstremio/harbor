import { useState } from "react";
import type { MangaSummary } from "@/lib/manga/types";
import { initials } from "./types";

function Cover({ item }: { item: MangaSummary }) {
  const [failed, setFailed] = useState(false);
  const show = item.cover && !failed;
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-elevated harbor-card-ring shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65)]">
      {show ? (
        <img
          src={item.cover}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
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
}: {
  items: MangaSummary[];
  onOpen?: (item: MangaSummary) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-x-4 gap-y-5">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen?.(m)}
          className="group flex flex-col gap-2 text-start"
        >
          <div className="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
            <Cover item={m} />
          </div>
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{m.title}</p>
        </button>
      ))}
    </div>
  );
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
