import type { CalendarItem } from "@/lib/calendar";
import { useT } from "@/lib/i18n";
import { CalendarChip } from "./calendar-chip";
import type { Cell } from "./types";
import { orderedWeekdayNames } from "./utils";

export function MonthGrid({
  cells,
  grouped,
  todayISO,
  weekStartsMonday,
  onOpenItem,
  onOpenDay,
  hideTypeTag,
}: {
  cells: Cell[];
  grouped: Map<string, CalendarItem[]>;
  todayISO: string;
  weekStartsMonday: boolean;
  onOpenItem: (item: CalendarItem) => void;
  onOpenDay: (iso: string) => void;
  hideTypeTag: boolean;
}) {
  const t = useT();
  const cap = 2;
  const weekdays = orderedWeekdayNames(weekStartsMonday);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-2">
        {weekdays.map((d) => (
          <div
            key={d}
            className="px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
          >
            {t(d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          const events = grouped.get(cell.iso) ?? [];
          const isToday = cell.iso === todayISO;
          return (
            <div
              key={cell.iso}
              className={`flex min-h-[136px] flex-col gap-1.5 rounded-xl border p-2 transition-colors ${
                cell.inMonth
                  ? isToday
                    ? "border-ink/60 bg-elevated/40"
                    : "border-edge-soft bg-elevated/15"
                  : "border-edge-soft/40 bg-canvas/30 opacity-50"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-[12.5px] font-semibold tabular-nums ${
                    isToday ? "text-ink" : cell.inMonth ? "text-ink-muted" : "text-ink-subtle"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {events.length > 0 && (
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                    {events.length}
                  </span>
                )}
              </div>
              <div className="flex min-h-0 flex-col gap-1.5">
                {events.slice(0, cap).map((item) => (
                  <CalendarChip
                    key={item.id}
                    item={item}
                    onOpen={onOpenItem}
                    hideTypeTag={hideTypeTag}
                  />
                ))}
                {events.length > cap && (
                  <button
                    onClick={() => onOpenDay(cell.iso)}
                    className="self-start rounded px-1 text-start text-[11px] text-ink-subtle transition-colors hover:text-ink"
                  >
                    {t("+{n} more", { n: events.length - cap })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
