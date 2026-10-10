import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export type GridItem = { key: string; name: string; value: string; transparent?: boolean };

export function AvatarGrid({
  items,
  current,
  onPick,
  onDelete,
  tileBg,
}: {
  items: GridItem[];
  current?: string | null;
  onPick: (item: GridItem) => void;
  onDelete?: (item: GridItem) => void;
  tileBg?: string;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-3.5 gap-y-4">
      {items.map((it, i) => (
        <div
          key={it.key}
          className="animate-fade-in-soft"
          style={{ animationDelay: `${Math.min(i * 15, 220)}ms`, animationDuration: "300ms" }}
        >
          <AvatarTile
            item={it}
            selected={current === it.value}
            onPick={onPick}
            onDelete={onDelete}
            tileBg={tileBg}
          />
        </div>
      ))}
    </div>
  );
}

function AvatarTile({
  item,
  selected,
  onPick,
  onDelete,
  tileBg,
}: {
  item: GridItem;
  selected: boolean;
  onPick: (item: GridItem) => void;
  onDelete?: (item: GridItem) => void;
  tileBg?: string;
}) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="group relative flex w-full flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={() => onPick(item)}
        title={item.name}
        className="flex w-full flex-col items-stretch gap-2 text-start outline-none"
      >
        <span
          style={tileBg ? { background: tileBg } : undefined}
          className={`relative block aspect-square w-full overflow-hidden rounded-[13px] transition-[box-shadow,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-active:translate-y-0 motion-reduce:transform-none ${
            tileBg ? "" : "bg-elevated"
          } ${
            selected
              ? "shadow-[0_10px_28px_-12px_rgba(0,0,0,0.7)] ring-2 ring-accent ring-offset-2 ring-offset-surface"
              : "ring-1 ring-edge-soft group-hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] group-hover:ring-edge group-focus-visible:ring-ink-subtle"
          }`}
        >
          <img
            src={item.value}
            alt={item.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover transition-[transform,opacity] duration-300 ease-out group-hover:scale-[1.07] group-active:scale-[0.99] motion-reduce:transform-none ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </span>
        <span
          className={`truncate px-0.5 text-[11.5px] leading-tight transition-colors ${
            selected ? "font-semibold text-ink" : "text-ink-subtle group-hover:text-ink-muted"
          }`}
        >
          {item.name}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item);
          }}
          aria-label={t("Delete {name}", { name: item.name })}
          className="absolute end-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-canvas/85 text-ink-muted opacity-0 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft backdrop-blur-sm transition-all duration-150 hover:bg-danger hover:text-white group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 motion-reduce:active:scale-100"
        >
          <Trash2 size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
