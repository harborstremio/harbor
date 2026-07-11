import { daysFromTodayLocal, formatAirDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import type { TmdbDetail } from "@/lib/providers/tmdb";
import { CalendarClock } from "lucide-react";

import { Tooltip } from "./tooltip";

export function UpcomingCta({ detail, onTry }: { detail: TmdbDetail | null; onTry: () => void }) {
  const t = useT();
  const date = detail?.kind === "movie" ? detail?.releaseDate : detail?.firstAirDate;
  const friendly = upcomingDateLabel(t, date);
  return (
    <Tooltip label={t("Not officially released yet. Click to search anyway in case of an early release.")}>
      <button
        onClick={onTry}
        className="group flex h-12 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border border-edge bg-elevated/40 px-7 text-[15px] font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[transform,background-color,border-color,color] duration-200 hover:border-ink-subtle hover:bg-elevated/70 hover:text-ink active:scale-[0.98]"
      >
        <CalendarClock size={18} strokeWidth={2} />
        <span>{t("Upcoming")}</span>
        {friendly && (
          <span className="text-[13.5px] font-medium tracking-[0.04em] text-ink-subtle group-hover:text-ink-muted">
            · {friendly}
          </span>
        )}
      </button>
    </Tooltip>
  );
}

function upcomingDateLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  date: string | null | undefined,
): string | null {
  const d = daysFromTodayLocal(date);
  if (d == null || d <= 0) return null;
  if (d === 1) return t("tomorrow");
  if (d < 7) return t("in {d} days", { d });
  if (d < 14) return t("next week");
  if (d < 60) return t("in {n}wks", { n: Math.round(d / 7) });
  if (date) return formatAirDate(date);
  return null;
}
