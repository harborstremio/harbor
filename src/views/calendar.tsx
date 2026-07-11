import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth";
import {
  applyCalendarFilter,
  groupByDate,
  todayLocalISO,
  type CalendarFilter,
  type CalendarItem,
} from "@/lib/calendar";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useSimkl } from "@/lib/simkl/provider";
import { library, type LibraryItem } from "@/lib/stremio";
import { useTrakt } from "@/lib/trakt/provider";
import { useScrollMemory, useView } from "@/lib/view";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarSkeleton } from "./calendar/calendar-skeleton";
import { CustomCalendarBar } from "./calendar/custom-bar";
import { DayModal } from "./calendar/day-modal";
import { EmptyState, ErrorState, NoKeyState, NotSignedInState } from "./calendar/empty-states";
import { MonthGrid } from "./calendar/month-grid";
import { SourceSwitcher } from "./calendar/source-switcher";
import { useCalendarData } from "./calendar/use-calendar-data";
import {
  buildLibraryNameSet,
  buildMonthCells,
  calendarEpisodeHint,
  calendarToMeta,
  FILTERS,
  MONTH_NAMES,
  normalizeName,
} from "./calendar/utils";

export function CalendarView() {
  const t = useT();
  const { settings, update } = useSettings();
  const { authKey } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const { openSettings, openMeta } = useView();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory("calendar", scrollRef);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [dayModal, setDayModal] = useState<string | null>(null);

  const source = settings.calendarSource;
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();

  const { items, loading, error } = useCalendarData({
    source,
    authKey,
    traktConnected,
    simklConnected,
    settings,
    year,
    month,
  });

  useEffect(() => {
    if (!authKey || source !== "all") {
      setLibraryItems([]);
      return;
    }
    let cancelled = false;
    library(authKey)
      .then((rows) => {
        if (!cancelled) setLibraryItems(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authKey, source]);

  const libraryNames = useMemo(() => buildLibraryNameSet(libraryItems), [libraryItems]);

  const filtered = useMemo(() => {
    if (source !== "all" && source !== "simkl-anticipated") return items;
    let out = applyCalendarFilter(items, filter);
    if (source === "all" && watchlistOnly) {
      out = out.filter((i) => {
        const t = i.type === "tv" ? "tv" : "movie";
        return libraryNames.has(`${normalizeName(i.name)}::${t}`);
      });
    }
    return out;
  }, [source, items, filter, watchlistOnly, libraryNames]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const cells = useMemo(
    () => buildMonthCells(year, month, settings.weekStartsMonday),
    [year, month, settings.weekStartsMonday],
  );

  const openItem = useCallback(
    (item: CalendarItem) => {
      openMeta(calendarToMeta(item), { episodeHint: calendarEpisodeHint(item) ?? undefined });
    },
    [openMeta],
  );

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const todayISO = todayLocalISO();
  const dayModalItems = dayModal ? (grouped.get(dayModal) ?? []) : [];

  const showAllControls = source === "all";
  const showPremiereFilters = source === "simkl-anticipated";

  let body: React.ReactNode;
  if (source === "library" && !authKey) {
    body = <NotSignedInState onSignIn={() => setShowAuth(true)} />;
  } else if (source === "all" && !settings.tmdbKey) {
    body = <NoKeyState onSetup={() => openSettings("library")} />;
  } else if (error) {
    body = <ErrorState message={error} />;
  } else if (loading && filtered.length === 0) {
    body = <CalendarSkeleton />;
  } else if (filtered.length === 0) {
    body = <EmptyState source={source} filter={filter} watchlistOnly={watchlistOnly} />;
  } else {
    body = (
      <MonthGrid
        cells={cells}
        grouped={grouped}
        todayISO={todayISO}
        weekStartsMonday={settings.weekStartsMonday}
        onOpenItem={openItem}
        onOpenDay={(iso) => setDayModal(iso)}
      />
    );
  }

  return (
    <main className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-edge-soft px-12 pb-5 pt-24">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">{t("Releases")}</span>
            <h1 className="font-display text-[44px] font-medium leading-none tracking-tight text-ink">
              {t("Calendar")}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={goPrev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors hover:border-edge hover:text-ink"
              aria-label={t("Previous month")}
            >
              <ChevronLeft size={16} strokeWidth={2.2} className="dir-icon" />
            </button>
            <button
              onClick={goToday}
              className="h-10 rounded-full border border-edge-soft px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {t("Today")}
            </button>
            <div className="flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-full border border-edge-soft px-5 text-[14px] font-semibold text-ink">
              <CalendarIcon size={14} strokeWidth={2} className="text-ink-subtle" />
              {t(MONTH_NAMES[month])} {year}
            </div>
            <button
              onClick={goNext}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors hover:border-edge hover:text-ink"
              aria-label={t("Next month")}
            >
              <ChevronRight size={16} strokeWidth={2.2} className="dir-icon" />
            </button>
          </div>
        </div>
        <nav className="mt-6 flex flex-wrap items-center gap-3">
          <SourceSwitcher
            value={source}
            onChange={(s) => update({ calendarSource: s })}
            traktConnected={traktConnected}
            simklConnected={simklConnected}
          />
          <button
            onClick={() => update({ weekStartsMonday: !settings.weekStartsMonday })}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
              settings.weekStartsMonday
                ? "bg-ink text-canvas"
                : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            {t("Start week on Monday")}
          </button>
          {source === "custom" && (
            <CustomCalendarBar
              tmdbKey={settings.tmdbKey}
              traktConnected={traktConnected}
              value={settings.customCalendar}
              onChange={(next) => update({ customCalendar: next })}
            />
          )}
          {showAllControls && (
            <>
              <span className="mx-1 h-5 w-px bg-edge-soft" />
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  const count = f.id === "all" ? filtered.length : applyCalendarFilter(items, f.id).length;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                        active
                          ? "bg-ink text-canvas"
                          : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
                      }`}
                    >
                      {t(f.label)}
                      <span className={`text-[11px] tabular-nums ${active ? "text-canvas/65" : "text-ink-subtle"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => authKey && setWatchlistOnly((v) => !v)}
                  disabled={!authKey}
                  title={!authKey ? t("Sign in to filter by your library") : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    watchlistOnly
                      ? "bg-ink text-canvas"
                      : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
                  }`}
                >
                  <Star size={11} strokeWidth={2.4} className={watchlistOnly ? "fill-canvas" : ""} />
                  {t("Watchlist only")}
                </button>
              </div>
            </>
          )}
          {showPremiereFilters && (
            <>
              <span className="mx-1 h-5 w-px bg-edge-soft" />
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  const count = f.id === "all" ? items.length : applyCalendarFilter(items, f.id).length;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                        active
                          ? "bg-ink text-canvas"
                          : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
                      }`}
                    >
                      {t(f.label)}
                      <span className={`text-[11px] tabular-nums ${active ? "text-canvas/65" : "text-ink-subtle"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </nav>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 py-8">
        {body}
      </div>

      {dayModal && dayModalItems.length > 0 && (
        <DayModal
          dateISO={dayModal}
          items={dayModalItems}
          onClose={() => setDayModal(null)}
          onOpenItem={(it) => {
            setDayModal(null);
            openItem(it);
          }}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  );
}
