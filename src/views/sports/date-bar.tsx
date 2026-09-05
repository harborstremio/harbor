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
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selected]);

  return (
    <div className="overflow-x-auto px-6 pb-3.5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max min-w-full items-center justify-center gap-1">
        {days.map((day) => {
          const active = day.key === selected;
          const isToday = day.key === today;
          const live = liveDays.has(day.key);
          const weekday = isToday
            ? t("Today")
            : day.date.toLocaleDateString(locale, { weekday: "short" });
          const shell = active
            ? "bg-elevated ring-1 ring-accent/50"
            : isToday
              ? "ring-1 ring-edge hover:bg-surface"
              : "hover:bg-surface";

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
              className={`flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg transition-colors duration-150 ${shell}`}
            >
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${
                  active ? "text-ink" : "text-ink-subtle"
                }`}
              >
                {weekday}
              </span>
              <span
                className={`text-[16px] font-bold tabular-nums leading-none ${
                  active || isToday ? "text-ink" : "text-ink-muted"
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
