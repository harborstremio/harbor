import { useEffect, useMemo, useRef } from "react";
import { useUiLanguage } from "@/lib/i18n";
import { SFX } from "@/lib/sfx";
import { dayStamp } from "@/lib/sports/hub-data";
import { buildDays } from "@/views/sports/date-bar";
import { useBpT } from "../bp-i18n";

const TRACK =
  "flex items-stretch gap-[clamp(7px,0.7vw,14px)] overflow-x-auto py-[22px] ps-[18px] -my-[22px] -ms-[18px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const CELL =
  "flex h-[clamp(58px,7.2vh,86px)] w-[clamp(62px,4.9vw,92px)] shrink-0 flex-col items-center justify-center gap-[3px] rounded-[var(--bp-r-sm)] transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none";

const WEEKDAY =
  "text-[calc(clamp(11px,1.35vh,15px)*var(--bp-up,1))] font-bold uppercase tracking-[0.1em] leading-none";

const NUMBER =
  "text-[calc(clamp(18px,2.4vh,27px)*var(--bp-up,1))] font-bold tabular-nums leading-none";

export function BpSportsDateBand({
  day,
  today,
  liveDays,
  onSelect,
}: {
  day: string;
  today: string;
  liveDays: ReadonlySet<string>;
  onSelect: (day: string) => void;
}) {
  const t = useBpT();
  const lang = useUiLanguage();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const days = useMemo(() => {
    const parsed = new Date(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8));
    const anchor = Number.isFinite(parsed.getTime()) ? parsed : new Date();
    return buildDays(anchor).map((cell) => ({ key: dayStamp(cell.date), date: cell.date }));
  }, [today]);

  useEffect(() => {
    const track = trackRef.current;
    const cell = activeRef.current;
    if (!track || !cell) return;
    if (track.contains(document.activeElement)) return;
    track.scrollLeft =
      cell.offsetLeft - track.offsetLeft - (track.clientWidth - cell.clientWidth) / 2;
  }, [day, days]);

  return (
    <section
      data-bp-row
      data-bp-row-key="sports-dates"
      aria-label={t("Choose a day")}
      className="relative"
    >
      <div ref={trackRef} data-bp-scroll-x className={TRACK}>
        {days.map((cell) => {
          const selected = cell.key === day;
          const isToday = cell.key === today;
          const live = liveDays.has(cell.key);
          const weekday = isToday
            ? t("Today")
            : cell.date.toLocaleDateString(lang, { weekday: "short" });
          const full = cell.date.toLocaleDateString(lang, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          return (
            <button
              key={cell.key}
              ref={selected ? activeRef : undefined}
              type="button"
              data-bp-focusable
              data-bp-chip
              data-bp-restore-key={`sports-day:${cell.key}`}
              data-bp-autofocus={selected ? "true" : undefined}
              aria-pressed={selected}
              aria-label={full}
              onClick={() => {
                SFX.click();
                onSelect(cell.key);
              }}
              className={`${CELL} ${
                selected
                  ? "bg-[var(--bp-on)] text-ink"
                  : isToday
                    ? "border border-[var(--bp-edge-2)] text-ink-subtle"
                    : "border border-transparent text-ink-subtle"
              }`}
            >
              <span className={WEEKDAY}>{weekday}</span>
              <span className={NUMBER}>{cell.date.getDate()}</span>
              <span
                aria-hidden
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ background: live ? "var(--bp-live)" : "transparent" }}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
