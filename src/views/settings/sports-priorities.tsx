import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  moveLeague,
  normalizeDayFocus,
  normalizePriority,
  SPORT_CHOICES,
  WEEKDAYS,
  type Weekday,
} from "@/lib/jl/sports/sport-priorities";
import { useSettings } from "@/lib/settings";

const DAY_LABEL: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors hover:border-edge hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30";

const chip = (on: boolean) =>
  `flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
    on
      ? "border-accent bg-accent/15 text-ink"
      : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
  }`;

/**
 * My sports: which sports the Sports Hub ranks, in your order, and which sport leads each day.
 * Used in Settings → Sports and in the Sports Hub's "Teams & players" panel.
 */
export function SportPrioritiesEditor() {
  const t = useT();
  const { settings, update } = useSettings();
  const priority = normalizePriority(settings.sportsPriority);
  const focus = normalizeDayFocus(settings.sportsDayFocus);
  const label = (league: string) =>
    t(SPORT_CHOICES.find((c) => c.league === league)?.label ?? league);
  const off = SPORT_CHOICES.filter((c) => !priority.includes(c.league));

  const setPriority = (next: string[]) => update({ sportsPriority: next });
  const toggleFocus = (day: Weekday, league: string) => {
    const list = focus[day] ?? [];
    const next = list.includes(league) ? list.filter((l) => l !== league) : [...list, league];
    update({ sportsDayFocus: { ...focus, [day]: next } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] text-ink-subtle">
          {t(
            "Your sports, most important first. The Top 10, the slider and today's sections follow this order. Sports you remove only show up when one of your teams plays.",
          )}
        </p>
        <ol className="flex flex-col gap-1.5">
          {priority.map((league, i) => (
            <li
              key={league}
              className="flex items-center gap-2 rounded-xl border border-edge-soft bg-canvas/40 py-1.5 ps-3 pe-1.5"
            >
              <span className="w-5 text-[13px] font-bold tabular-nums text-accent">{i + 1}</span>
              <span className="flex-1 text-[14px] font-semibold text-ink">{label(league)}</span>
              <button
                type="button"
                className={ICON_BUTTON}
                disabled={i === 0}
                onClick={() => setPriority(moveLeague(priority, league, -1))}
                aria-label={t("Move {sport} up", { sport: label(league) })}
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                disabled={i === priority.length - 1}
                onClick={() => setPriority(moveLeague(priority, league, 1))}
                aria-label={t("Move {sport} down", { sport: label(league) })}
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                className="h-8 rounded-full px-3 text-[12px] font-medium text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => setPriority(priority.filter((l) => l !== league))}
              >
                {t("Remove")}
              </button>
            </li>
          ))}
        </ol>
        {off.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[12px] text-ink-subtle">{t("Add:")}</span>
            {off.map((c) => (
              <button
                key={c.league}
                type="button"
                className={chip(false)}
                onClick={() => setPriority([...priority, c.league])}
              >
                + {t(c.label)}
              </button>
            ))}
          </div>
        )}
      </div>

      {priority.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Game days")}
          </h4>
          <p className="text-[12.5px] text-ink-subtle">
            {t("Pick the sport that comes first on each day, like college football on Saturday.")}
          </p>
          <div className="flex flex-col gap-1.5">
            {WEEKDAYS.map((day) => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0 text-[13px] font-medium text-ink">
                  {t(DAY_LABEL[day])}
                </span>
                {priority.map((league) => {
                  const on = (focus[day] ?? []).includes(league);
                  return (
                    <button
                      key={league}
                      type="button"
                      aria-pressed={on}
                      className={chip(on)}
                      onClick={() => toggleFocus(day, league)}
                    >
                      {label(league)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
