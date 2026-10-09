import { Poster } from "@/components/poster";
import type { FeaturedItem } from "@/lib/social/featured-lists";

export function SharedListPosters({
  items,
  onOpenMeta,
}: {
  items: FeaturedItem[];
  onOpenMeta?: (id: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpenMeta?.(item.id, item.type, { name: item.name, poster: item.poster })}
          disabled={!onOpenMeta}
          className="group text-start disabled:cursor-default"
        >
          <Poster
            src={item.poster || undefined}
            seed={item.name || item.id}
            ratio="portrait"
            className="rounded-[12px] ring-1 ring-edge-soft shadow-[0_4px_16px_-6px_rgba(0,0,0,0.5)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform group-hover:shadow-[0_22px_44px_-16px_rgba(0,0,0,0.65)] motion-safe:group-hover:[transform:translate3d(0,-0.4rem,0)_scale(1.03)]"
            lazy
          />
          {item.name && <div className="mt-2 truncate text-[12.5px] text-ink-muted">{item.name}</div>}
        </button>
      ))}
    </div>
  );
}
