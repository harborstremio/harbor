import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { orderedWeekdayNames } from "./utils";

const CHIPS_PER_CELL = [
  2, 0, 1, 3, 0, 1, 0, 2, 1, 0, 0, 2, 1, 3, 0, 1, 0, 2, 0, 1, 2, 0, 1, 0, 3, 1, 0, 2, 0, 1, 0, 2, 1,
  0, 1, 0, 2, 0, 1, 3, 0, 1,
];

export function CalendarSkeleton() {
  const t = useT();
  const { settings } = useSettings();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-2">
        {orderedWeekdayNames(settings.weekStartsMonday).map((d) => (
          <div
            key={d}
            className="px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle"
          >
            {t(d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {CHIPS_PER_CELL.map((chips, i) => (
          <div
            key={i}
            className="flex min-h-[112px] flex-col gap-1.5 rounded-xl border border-edge-soft bg-elevated/15 p-2"
          >
            <span className="h-3 w-5 animate-pulse rounded bg-ink/10" />
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: chips }).map((_, j) => (
                <span key={j} className="h-5 w-full animate-pulse rounded-md bg-ink/[0.07]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
