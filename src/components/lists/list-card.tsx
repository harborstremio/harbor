import { Layers } from "lucide-react";
import type { CustomList } from "@/lib/custom-lists";
import { relativeTime } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { Poster, posterPlate } from "@/components/poster";

export function ListCard({
  list,
  onOpen,
}: {
  list: CustomList;
  onOpen?: (id: string) => void;
}) {
  const t = useT();
  const covers = list.items.slice(0, 3);
  const count = list.items.length;

  return (
    <button
      onClick={() => onOpen?.(list.id)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-edge-soft bg-surface text-start transition-colors hover:bg-elevated"
    >
      <div className="relative h-[136px] overflow-hidden bg-canvas">
        {covers.length === 0 ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: posterPlate(list.id) }}
          >
            <Layers size={22} strokeWidth={1.6} className="text-ink-subtle" />
          </div>
        ) : (
          <div className="absolute inset-0">
            {covers.map((it, i) => (
              <div
                key={it.id}
                className="absolute left-1/2 top-1/2 w-[70px] overflow-hidden rounded-lg shadow-[0_10px_24px_-12px_rgba(0,0,0,0.75)] ring-1 ring-black/25"
                style={{ transform: fan(i, covers.length), zIndex: i }}
              >
                <Poster src={it.poster} seed={it.id} ratio="portrait" className="!rounded-lg" />
              </div>
            ))}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface/95 to-transparent" />
      </div>

      <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
        <h3 className="line-clamp-1 font-display text-[16px] font-medium leading-tight text-ink">
          {list.name}
        </h3>
        <p className="text-[12px] text-ink-subtle">
          {count === 1 ? t("1 item") : t("{n} items", { n: count })}
          {list.updatedAt > 0 &&
            ` · ${t("Updated {when}", { when: relativeTime(list.updatedAt) })}`}
        </p>
      </div>
    </button>
  );
}

function fan(i: number, total: number): string {
  const off = i - (total - 1) / 2;
  return `translate(-50%, -50%) translateX(${off * 30}px) rotate(${off * 7}deg)`;
}
