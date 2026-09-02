import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyCalendarFilter,
  groupByDate,
  todayLocalISO,
  type CalendarFilter,
  type CalendarItem,
} from "@/lib/calendar";
import { CalendarSkeleton } from "./calendar/calendar-skeleton";
import { CalendarConfigRail } from "./calendar/config/config-rail";
import { buildActiveCount } from "./calendar/config/rail-sources";
import { useCalendarData } from "./calendar/use-calendar-data";
import { useAuth } from "@/lib/auth";
import { library, type LibraryItem } from "@/lib/stremio";
import { useSettings } from "@/lib/settings";
import { useTrakt } from "@/lib/trakt/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useScrollMemory, useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { AuthModal } from "@/components/auth-modal";
import { RemindersManagerButton } from "@/components/reminders-manager";
import { clearUnseenReminders } from "@/lib/reminders";
import { DayModal } from "./calendar/day-modal";
import { EmptyState, ErrorState, NoKeyState, NotSignedInState } from "./calendar/empty-states";
import { MonthGrid } from "./calendar/month-grid";
import { SourceSwitcher } from "./calendar/source-switcher";
import {
  buildLibraryNameSet,
  buildMonthCells,
  CALENDAR_POSTER_SIZES,
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
  const [animeDub, setAnimeDub] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory("calendar", scrollRef);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [dayModal, setDayModal] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(() => {
    try {
      return localStorage.getItem("harbor.calendar.filtersOpen") !== "0";
    } catch {
      return true;
    }
  });
  const [railOverlay, setRailOverlay] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1600,
  );
  const railHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("harbor.calendar.filtersOpen", configOpen ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [configOpen]);

  useEffect(() => {
    const el = railHostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setRailOverlay(w < 1360);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    clearUnseenReminders();
  }, []);

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
    animeDub,
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
    const hideAnime = (list: CalendarItem[]) =>
      settings.hideContent.anime ? list.filter((i) => !i.isAnime) : list;
    if (source !== "all" && source !== "simkl-anticipated") return hideAnime(items);
    // All upcoming is exclusively movies and TV — anime lives in the dedicated Anime source.
    const f: CalendarFilter = source === "all" && filter === "anime" ? "all" : filter;
    let out = hideAnime(applyCalendarFilter(items, f));
    if (source === "all") out = out.filter((i) => !i.isAnime);
    if (source === "all" && watchlistOnly) {
      out = out.filter((i) => {
        const t = i.type === "tv" ? "tv" : "movie";
        return libraryNames.has(`${normalizeName(i.name)}::${t}`);
      });
    }
    return out;
  }, [source, items, filter, watchlistOnly, libraryNames, settings.hideContent.anime]);

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
  const hideTypeTag = source === "anime";
  const filtersActiveCount = buildActiveCount(settings.customCalendar);
  const filters =
    settings.hideContent.anime || source === "all"
      ? FILTERS.filter((f) => f.id !== "anime")
      : FILTERS;

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
    body = (
      <EmptyState
        source={source}
        filter={filter}
        watchlistOnly={watchlistOnly}
        animeDub={animeDub}
      />
    );
  } else {
    body = (
      <MonthGrid
        cells={cells}
        grouped={grouped}
        todayISO={todayISO}
        weekStartsMonday={settings.weekStartsMonday}
        onOpenItem={openItem}
        onOpenDay={(iso) => setDayModal(iso)}
        hideTypeTag={hideTypeTag}
      />
    );
  }

  return (
    <main data-tv-chrome-offset className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-edge-soft px-12 pb-5 pt-24">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
              {t("Releases")}
            </span>
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
            <span className="mx-1 h-5 w-px bg-edge-soft" />
            <RemindersManagerButton
              onOpenItem={(r) =>
                openMeta({ id: r.id, type: "series", name: r.name, poster: r.poster })
              }
            />
          </div>
        </div>
        <nav className="mt-6 flex flex-wrap items-center gap-3">
          <SourceSwitcher
            value={source}
            onChange={(s) => update({ calendarSource: s })}
            traktConnected={traktConnected}
            simklConnected={simklConnected}
          />
          {source === "anime" && (
            <div className="flex items-center gap-1 rounded-full border border-edge-soft bg-elevated/30 p-1">
              {(["sub", "dub"] as const).map((mode) => {
                const active = animeDub === (mode === "dub");
                return (
                  <button
                    key={mode}
                    onClick={() => setAnimeDub(mode === "dub")}
                    aria-pressed={active}
                    className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      active
                        ? "bg-ink text-canvas"
                        : "text-ink-muted hover:bg-raised/60 hover:text-ink"
                    }`}
                  >
                    {t(mode === "sub" ? "Sub" : "Dub")}
                  </button>
                );
              })}
            </div>
          )}
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
          <div className="flex items-center gap-1 rounded-full border border-edge-soft bg-elevated/30 p-1">
            {CALENDAR_POSTER_SIZES.map(({ value, label }) => {
              const active = settings.calendarPosterSize === value;
              return (
                <button
                  key={value}
                  onClick={() => update({ calendarPosterSize: value })}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "bg-ink text-canvas"
                      : "text-ink-muted hover:bg-raised/60 hover:text-ink"
                  }`}
                >
                  {t(label)}
                </button>
              );
            })}
          </div>
          {source === "custom" && railOverlay && (
            <button
              type="button"
              onClick={() => setConfigOpen((o) => !o)}
              aria-pressed={configOpen}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
                configOpen
                  ? "bg-ink text-canvas"
                  : "border border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
              }`}
            >
              <SlidersHorizontal size={14} strokeWidth={2.2} />
              {t("Filters")}
              {filtersActiveCount > 0 && (
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums ${
                    configOpen ? "bg-canvas/20 text-canvas" : "bg-accent-soft text-accent"
                  }`}
                >
                  {filtersActiveCount}
                </span>
              )}
            </button>
          )}
          {showAllControls && (
            <>
              <span className="mx-1 h-5 w-px bg-edge-soft" />
              <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => {
                  const active = filter === f.id;
                  const count =
                    f.id === "all" ? filtered.length : applyCalendarFilter(items, f.id).length;
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
                      <span
                        className={`text-[11px] tabular-nums ${
                          active ? "text-canvas/65" : "text-ink-subtle"
                        }`}
                      >
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
                  <Star
                    size={11}
                    strokeWidth={2.4}
                    className={watchlistOnly ? "fill-canvas" : ""}
                  />
                  {t("Watchlist only")}
                </button>
              </div>
            </>
          )}
          {showPremiereFilters && (
            <>
              <span className="mx-1 h-5 w-px bg-edge-soft" />
              <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => {
                  const active = filter === f.id;
                  const count =
                    f.id === "all" ? items.length : applyCalendarFilter(items, f.id).length;
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
                      <span
                        className={`text-[11px] tabular-nums ${
                          active ? "text-canvas/65" : "text-ink-subtle"
                        }`}
                      >
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

      <div ref={railHostRef} className="relative flex min-h-0 flex-1">
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto px-12 py-8">
          {body}
        </div>
        {source === "custom" && (
          <CalendarConfigRail
            open={configOpen}
            onOpenChange={setConfigOpen}
            tmdbKey={settings.tmdbKey}
            traktConnected={traktConnected}
            value={settings.customCalendar}
            onChange={(next) => update({ customCalendar: next })}
            resultCount={filtered.length}
            onConnectTrakt={() => openSettings("trakt")}
            overlay={railOverlay}
          />
        )}
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
          hideTypeTag={hideTypeTag}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  );
}
