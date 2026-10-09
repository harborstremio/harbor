import { useDragScroll } from "@/lib/use-drag-scroll";
import { useEffect, useRef } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";

const DAYS_BACK = 7;
const DAYS_AHEAD = 7;

export type DayCell = { key: string; date: Date };

export function ymdKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}${m}${day}`;
}

export function todayKey(): string {
  return ymdKey(new Date());
}

export function buildDays(anchor: Date): DayCell[] {
  const out: DayCell[] = [];
  for (let i = -DAYS_BACK; i <= DAYS_AHEAD; i += 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i);
    out.push({ key: ymdKey(d), date: d });
  }
  return out;
}

export function SportsDateBar({
  days,
  selected,
  today,
  liveDays,
  onSelect,
}: {
  days: DayCell[];
  selected: string;
  today: string;
  liveDays: Set<string>;
  onSelect: (key: string) => void;
}) {
  const t = useT();
  const lang = useUiLanguage();
  const locale = lang;
  const activeRef = useRef<HTMLButtonElement>(null);
  const { ref, handlers } = useDragScroll<HTMLDivElement>();

  useEffect(() => {
    const button = activeRef.current;
    const rail = button?.parentElement?.parentElement;
    if (button && rail)
      rail.scrollLeft =
        button.offsetLeft - rail.offsetLeft - (rail.clientWidth - button.clientWidth) / 2;
  }, [selected]);

  return (
    <div
      ref={ref}
      {...handlers}
      className="cursor-grab select-none overflow-x-auto px-6 pb-3.5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="relative flex w-max min-w-full items-center justify-center gap-1">
        {days.map((day) => {
          const active = day.key === selected;
          const isToday = day.key === today;
          const live = liveDays.has(day.key);
          const weekday = isToday
            ? t("Today")
            : day.date.toLocaleDateString(locale, { weekday: "short" });
          const shell = active ? "bg-elevated/70" : "hover:bg-surface/70";

          return (
            <button
              key={day.key}
              ref={active ? activeRef : undefined}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(day.key)}
              title={day.date.toLocaleDateString(locale, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              className={`sports-day flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg ${shell}`}
            >
              <span
                className={`text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
                  active ? "text-accent" : isToday ? "text-ink-muted" : "text-ink-subtle"
                }`}
              >
                {weekday}
              </span>
              <span
                className={`sports-day-num tabular-nums leading-none ${
                  active
                    ? "text-[21px] font-bold text-ink"
                    : isToday
                      ? "text-[16px] font-bold text-ink"
                      : "text-[16px] font-semibold text-ink-muted"
                }`}
              >
                {day.date.getDate()}
              </span>
              <span
                className={`mt-[3px] h-1 w-1 rounded-full ${live ? "bg-danger" : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
