import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export type SegmentedItem = { id: string; label: string; icon?: ReactNode; badge?: number };

export function MarketSegmented({
  items,
  active,
  onSelect,
}: {
  items: SegmentedItem[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex w-fit flex-wrap items-center gap-1 rounded-md bg-elevated p-1 ring-1 ring-edge-soft/60">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[15.5px] font-semibold leading-[22px] transition-colors ${
              on ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
            }`}
          >
            {it.icon && <span className="inline-flex shrink-0">{it.icon}</span>}
            {t(it.label)}
            {it.badge != null && it.badge > 0 && (
              <span className="ms-0.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-[13px] font-bold leading-[17px] tabular-nums text-canvas">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
