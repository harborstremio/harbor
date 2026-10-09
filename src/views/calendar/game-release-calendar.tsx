import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { gameReleaseCalendar, type GameCalendarRelease } from "@/lib/games/release-calendar";
import type { SavedReleaseRequest } from "@/lib/games/saved-releases-load";
import type { GameSummary } from "@/lib/games/types";
import { useGameAccess } from "../games/game-access";
import { GameArt } from "../games/game-art";
import { useSavedGameReleases } from "../games/use-saved-game-releases";
import { buildMonthCells, orderedWeekdayNames } from "./utils";
import "./game-release-calendar.css";

type CalendarProps = { year: number; month: number; weekStartsMonday: boolean; active: boolean };

export function GameCalendarPanel(props: CalendarProps) {
  const access = useGameAccess();
  return <GameReleaseCalendar key={access.profile} {...props} games={access.saved} open={(game, origin) => access.navigate({ game }, origin)}/>;
}

export function GameReleaseCalendar({ games, year, month, weekStartsMonday, active, open, request }: CalendarProps & {
  games: GameSummary[];
  open: (game: GameSummary, origin: HTMLElement) => void;
  request?: SavedReleaseRequest;
}) {
  const t = useT(), language = useUiLanguage();
  const root = useRef<HTMLElement>(null), refreshButton = useRef<HTMLButtonElement>(null);
  const returnOrigin = useRef<{ element: HTMLElement; gameId: string } | null>(null), previouslyActive = useRef(active);
  const [query, setQuery] = useState(""), [platform, setPlatform] = useState("");
  const [expandedDay, setExpandedDay] = useState<string | null>(null), dayDetailsId = useId(), dayTrigger = useRef<HTMLButtonElement | null>(null);
  const expandedFocus = useRef(false);
  const data = useSavedGameReleases(games, active, request);
  const calendar = useMemo(() => gameReleaseCalendar(games, data.results, year, month, query, platform), [games, data.results, year, month, query, platform]);
  useEffect(() => { if (platform !== calendar.platform) setPlatform(calendar.platform); }, [platform, calendar.platform]);
  const cells = useMemo(() => buildMonthCells(year, month, weekStartsMonday), [year, month, weekStartsMonday]);
  useLayoutEffect(() => {
    if (expandedDay && (!calendar.days.has(expandedDay) || !cells.some(cell => cell.inMonth && cell.iso === expandedDay))) {
      if (active && expandedFocus.current && document.activeElement === document.body) root.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      expandedFocus.current = false;
      setExpandedDay(null);
    }
  }, [active, calendar.days, cells, expandedDay]);
  const today = new Date(), todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(language, { month: "long", year: "numeric", timeZone: "UTC" });

  useLayoutEffect(() => {
    if (active && !previouslyActive.current && returnOrigin.current) {
      const origin = returnOrigin.current;
      const target = origin.element.isConnected && origin.element.getClientRects().length ? origin.element :
        [...(root.current?.querySelectorAll<HTMLElement>("[data-calendar-game]") ?? [])].find(element => element.dataset.calendarGame === origin.gameId && element.getClientRects().length);
      (target ?? root.current?.querySelector<HTMLElement>("h2"))?.focus({ preventScroll: true });
      returnOrigin.current = null;
    }
    previouslyActive.current = active;
  }, [active]);

  const openGame = (entry: GameCalendarRelease, element: HTMLElement) => {
    returnOrigin.current = { element, gameId: entry.game.id };
    open(entry.game, element);
  };
  const card = (entry: GameCalendarRelease, window = false) => <button key={entry.key} className="game-calendar-card" data-calendar-game={entry.game.id} onClick={event => openGame(entry, event.currentTarget)}>
    <GameArt src={entry.game.capsule}/>
    <span className="game-calendar-card-copy"><strong dir="auto">{entry.game.name}</strong>
      {window && <b dir="auto">{entry.release?.label || t("games.watchlist.unknown")}</b>}
      <small dir="auto">{[entry.source, entry.release?.platform, entry.release?.region?.replace(/_/g, " ")].filter(Boolean).join(" · ") || entry.game.platforms.join(" · ")}</small>
      {entry.retained ? <em>{t("games.watchlist.saved")}</em> : !entry.checked ? <em>{t(data.pending.includes(entry.game.id) ? "games.watchlist.checking" : "games.calendar.unchecked")}</em> : entry.failed ? <em>{t("games.watchlist.unavailable")}</em> : null}
    </span>
  </button>;
  const refresh = () => { if (!data.loading) data.retry(); };

  return <section ref={root} className="game-calendar">
    <div className="game-calendar-heading"><div><h2 tabIndex={-1}>{t("games.calendar.source")}</h2><p>{t("games.calendar.note")}</p></div>
      {!!games.length && <button ref={refreshButton} className="game-calendar-refresh" aria-label={t("games.watchlist.refresh")} aria-disabled={data.loading} onClick={refresh}><RefreshCw size={18}/><span>{t("games.watchlist.refresh")}</span></button>}
    </div>
    {!games.length ? <div className="game-calendar-empty"><h3>{t("games.savedEmpty")}</h3><p>{t("games.calendar.empty")}</p></div> : <>
      <div className="game-calendar-tools"><label><Search size={17}/><input type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} aria-label={t("games.calendar.search")} placeholder={t("games.calendar.search")}/></label>
        <Dropdown value={calendar.platform} onChange={setPlatform} ariaLabel={t("games.calendar.platform")} size="sm" options={[{ value: "", label: t("games.calendar.allPlatforms") }, ...calendar.platforms.map(value => ({ value, label: value }))]}/>
      </div>
      <div className="game-calendar-coverage"><span role="status">{t(data.loading ? "games.watchlist.checking" : "games.watchlist.coverage", { count: data.checked.toLocaleString(language), total: games.length.toLocaleString(language) })}</span>
        {data.checked < games.length && <button aria-disabled={data.loading} onClick={() => { if (data.loading) return; refreshButton.current?.focus({ preventScroll: true }); data.more(); }}>{t("games.watchlist.checkMore")}</button>}
      </div>
      {data.failed && <div className="game-calendar-error" role="status"><span>{t("games.watchlist.partial")}</span><button aria-disabled={data.loading} onClick={() => { if (!data.loading) { refreshButton.current?.focus({ preventScroll: true }); data.retry(); } }}>{t("common.retry")}</button></div>}
      <p className="game-calendar-source-note">{t("games.calendar.dates")}</p>
      <div className="game-calendar-month" aria-label={monthLabel}>
        <div className="game-calendar-weekdays">{orderedWeekdayNames(weekStartsMonday).map(day => <span key={day}>{t(day)}</span>)}</div>
        <div className="game-calendar-grid">{Array.from({ length: 6 }, (_, week) => <Fragment key={week}>{cells.slice(week * 7, week * 7 + 7).map(cell => {
          const entries = cell.inMonth ? calendar.days.get(cell.iso) ?? [] : [];
          return <section key={cell.iso} className={`game-calendar-day${cell.inMonth ? "" : " is-outside"}${cell.iso === todayISO ? " is-today" : ""}`} aria-label={dateLabel(cell.iso)}>
            <h3><time dateTime={cell.iso} aria-current={cell.iso === todayISO ? "date" : undefined}>{cell.date.getDate().toLocaleString(language)}</time></h3>
            {entries.slice(0, 2).map(entry => card(entry))}
            {entries.length > 2 && <button className="game-calendar-more" aria-expanded={expandedDay === cell.iso} aria-controls={expandedDay === cell.iso ? dayDetailsId : undefined} onClick={event => { dayTrigger.current = event.currentTarget; setExpandedDay(value => value === cell.iso ? null : cell.iso); }}>{t("+{n} more", { n: entries.length - 2 })}</button>}
          </section>;
        })}{expandedDay && calendar.days.has(expandedDay) && cells.slice(week * 7, week * 7 + 7).some(cell => cell.iso === expandedDay) && <section id={dayDetailsId} className="game-calendar-expanded" onFocusCapture={() => { expandedFocus.current = true; }} onBlurCapture={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) expandedFocus.current = false; }} aria-label={dateLabel(expandedDay)}><header><h3>{dateLabel(expandedDay)}</h3><button aria-label={t("common.close")} onClick={() => { setExpandedDay(null); (dayTrigger.current?.isConnected ? dayTrigger.current : root.current?.querySelector<HTMLElement>("h2"))?.focus({ preventScroll: true }); }}><X size={17}/></button></header><div>{calendar.days.get(expandedDay)!.map(entry => card(entry))}</div></section>}</Fragment>)}</div>
      </div>
      <div className="game-calendar-agenda">{[...calendar.days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, entries]) => <section key={day}><h3><time dateTime={day}>{dateLabel(day)}</time></h3><div>{entries.map(entry => card(entry))}</div></section>)}</div>
      {!calendar.days.size && <p className="game-calendar-empty-month">{t("games.calendar.noDays", { month: monthLabel })}</p>}
      {!!calendar.windows.length && <section className="game-calendar-band"><h3>{t("games.calendar.windows")}</h3><p>{t("games.calendar.windowsNote")}</p><div>{calendar.windows.map(entry => card(entry, true))}</div></section>}
      {!!calendar.undated.length && <details className="game-calendar-band game-calendar-undated"><summary>{t("games.calendar.undated")}<span>{calendar.undated.length.toLocaleString(language)}</span></summary><p>{t("games.calendar.undatedNote")}</p><div>{calendar.undated.map(entry => card(entry, true))}</div></details>}
      {!!calendar.cancelled && <p className="game-calendar-source-note">{t("games.calendar.cancelled", { count: calendar.cancelled.toLocaleString(language) })}</p>}
    </>}
  </section>;
}
