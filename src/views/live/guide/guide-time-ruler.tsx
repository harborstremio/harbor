import { useT } from "@/lib/i18n";
import { formatTimeLabel, PX_PER_MIN, RULER_HEIGHT_PX } from "./guide-utils";

export function GuideTimeRuler({
  windowStart,
  windowMinutes,
  todayMs,
}: {
  windowStart: number;
  windowMinutes: number;
  todayMs: number;
}) {
  const t = useT();
  const slotMin = 30;
  const slots: { ms: number; left: number; major: boolean }[] = [];
  for (let m = 0; m < windowMinutes; m += slotMin) {
    slots.push({
      ms: windowStart + m * 60_000,
      left: m * PX_PER_MIN,
      major: m % 60 === 0,
    });
  }
  return (
    <div
      className="sticky top-0 z-30 flex border-b border-edge-soft/60 bg-surface/95 backdrop-blur"
      style={{ height: RULER_HEIGHT_PX }}
    >
      {slots.map((slot) => (
        <div key={slot.ms} className="relative shrink-0" style={{ width: slotMin * PX_PER_MIN }}>
          <div className="flex h-full flex-col items-start justify-center gap-0.5 ps-2.5">
            <span
              className={`text-[12px] tabular-nums leading-none ${
                slot.major ? "font-semibold text-ink" : "font-medium text-ink-subtle"
              }`}
            >
              {formatTimeLabel(slot.ms)}
            </span>
            {slot.major && (
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle">
                {t(dayHint(slot.ms, todayMs))}
              </span>
            )}
          </div>
          {slot.major && <div className="absolute bottom-0 start-0 h-2 w-px bg-edge-soft" />}
        </div>
      ))}
    </div>
  );
}

function dayHint(ms: number, todayMs: number): string {
  const d = new Date(ms);
  const today = new Date(todayMs);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  const diffDays = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}
