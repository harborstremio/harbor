import { SportsSelect } from "./sports/sports-select";
import { SportsHotEventsSkeleton, SportsRailSkeleton } from "./sports/sports-skeletons";
import { LeagueLogo } from "./sports/league-logo";
import { lazy, Suspense, useMemo, useRef, useState, useEffect } from "react";
import { ArrowUp, ArrowRight, CalendarDays, Star } from "lucide-react";
import { SportsRefreshButton } from "./sports/refresh-button";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import type { EsportsMatch } from "@/lib/sports/esports-feeds";
import { officialBroadcastSource } from "@/lib/sports/esports-streams";
import { getGroupLabel, getLeagueLabel, type SportsGame } from "@/lib/sports/espn";
import { involvesTeam, useFavourites } from "@/lib/sports/favourites";
import { dayStamp, HUB_DEFAULTS, HUB_GROUPS, HUB_LEAGUES, hubLeague } from "@/lib/sports/hub-data";
import { syncSportsReminders } from "@/lib/sports/reminders";
import { diverseEvents, featuredEvents } from "@/lib/sports/hub-discovery";
import { currentLiveGames, liveDateRange, liveScoreboardKeys } from "@/lib/sports/live-schedule";
import { eventCards, mergeSlices } from "@/lib/sports/hub-cache";
import { HubRow } from "./sports/hub-cards";
import { HubCarousel } from "./sports/hub-carousel";
import { HubPitchSpotlight } from "./sports/hub-pitch-spotlight";
import { HubSchedule } from "./sports/hub-schedule";
import { SportsDateBar, buildDays } from "./sports/date-bar";
import { useSportsHub } from "./sports/use-hub";
import "./sports/hub.css";
import "./sports/esports-hub.css";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { SportsExplorer } from "./sports/sports-explorer";
import { SportIcon } from "./sports/sport-icon";
import {
  selectedSportsLeagues,
  sportsSelectionScope,
  gamesInSportsSelection,
} from "@/lib/sports/personalization";
import { SportsAccessGate } from "./sports/access-gate";
import { SportsNoProviderNote } from "./sports/no-provider-note";
import { SportsPersonalizeHint } from "./sports/personalize-hint";
import { heroFeatured } from "@/lib/jl/sports/hub-sections";
import { GameStoriesRow } from "./live/live-home/jl-sports/game-stories";
import { AlsoToday, JlSportsHub } from "./live/live-home/jl-sports/jl-sports-hub";
import { LiveSportsChannels } from "./live/live-home/jl-sports/live-sports-channels";
import { JlSportsHero } from "./live/live-home/jl-sports/sports-hero";
import type { JlHubGame } from "./live/live-home/jl-sports/use-jl-sports";
import { useJlSportsPage } from "./live/live-home/jl-sports/use-jl-sports-page";

const LIVE_SCOREBOARDS = liveScoreboardKeys(HUB_LEAGUES);

const HotEvents = lazy(() => import("./sports/hot-events").then((m) => ({ default: m.HotEvents })));
const EsportsMatchRail = lazy(() =>
  import("./sports/esports-match-rail").then((m) => ({ default: m.EsportsMatchRail })),
);
const EsportsArena = lazy(() =>
  import("./sports/esports-hub").then((m) => ({ default: m.EsportsHub })),
);
const Personalize = lazy(() =>
  import("./sports/hub-personalize").then((m) => ({ default: m.HubPersonalize })),
);
const LinkedEsportsMatch = lazy(() => import("./sports/esports-match").then(m => ({ default: m.EsportsMatchView })));

export function SportsView({ active = false }: { active?: boolean }) {
  const { sportsEvent } = useView();
  return (
    <SportsAccessGate active={active}>
      {sportsEvent ? <LinkedEsportsEvent match={sportsEvent} active={active} /> : <SportsHubView active={active} />}
    </SportsAccessGate>
  );
}

function LinkedEsportsEvent({ match, active }: { match: EsportsMatch; active: boolean }) {
  const { goBack, openPlayer } = useView();
  return <main className="sh-page"><Suspense fallback={null}>{active && <LinkedEsportsMatch key={`${match.game}:${match.id}`} match={match} onClose={goBack} onWatch={stream => {
    const source = officialBroadcastSource(stream); if (source) openPlayer(source);
  }} />}</Suspense></main>;
}

function SportsHubView({ active = false }: { active?: boolean }) {
  const t = useT();
  const locale = useUiLanguage();
  const { settings } = useSettings();
  const fav = useFavourites();
  const { openMatchDetail } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("sports", scrollRef, active);
  const { ref: sportRail, handlers: sportHandlers } = useDragScroll<HTMLDivElement>();
  const [tab, setTab] = useState("home");
  const [requestedGroup, setGroup] = useState("all");
  const [browsing, setBrowsing] = useState(false);
  const [esportsHeroTarget, setEsportsHeroTarget] = useState<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = bodyRef.current?.animate(
      [
        { opacity: 0.6, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [tab, requestedGroup]);
  const [today, setToday] = useState(() => dayStamp(new Date()));
  const [day, setDay] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const [setup, setSetup] = useState(false);
  const eventTrigger = useRef<{ element: HTMLElement; label: string | null } | null>(null);
  useEffect(() => {
    if (!active || !eventTrigger.current) return;
    let attempts = 0;
    let frame = 0;
    const restore = () => {
      const saved = eventTrigger.current;
      // Schedule rows can be remounted by viewport virtualization while the page is parked.
      const target = saved?.element.isConnected ? saved.element : saved?.label
        ? scrollRef.current?.querySelector<HTMLElement>(`[aria-label="${CSS.escape(saved.label)}"]`)
        : null;
      if (target?.getClientRects().length) {
        target.focus({ preventScroll: true });
        eventTrigger.current = null;
      } else if (++attempts < 20) frame = requestAnimationFrame(restore);
      else eventTrigger.current = null;
    };
    frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  const [showTop, setShowTop] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState("");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setToday(dayStamp(new Date())), 60_000);
    return () => clearInterval(timer);
  }, [active]);
  const selected = useMemo(
    () =>
      selectedSportsLeagues(HUB_LEAGUES, settings.sportsLeagues, !!fav.personalized, HUB_DEFAULTS),
    [settings.sportsLeagues, fav.personalized],
  );
  const scope = useMemo(
    () => sportsSelectionScope(HUB_LEAGUES, selected, requestedGroup, browsing, leagueFilter),
    [selected, requestedGroup, browsing, leagueFilter],
  );
  const { group, leagues } = scope;
  const personalGroups = HUB_GROUPS.filter(
    (g) => scope.groups.has(g.key) || (browsing && g.key === group),
  );
  const esportsLeagues = leagues.filter(
    (key) => HUB_LEAGUES.find((l) => l.key === key)?.group === "esports",
  );
  useEffect(() => {
    if (!setup) {
      setGroup("all");
      setLeagueFilter("");
      setBrowsing(false);
    }
  }, [settings.sportsLeagues]);
  const boardLeagues = useMemo(() => {
    if (tab === "live") return LIVE_SCOREBOARDS;
    if (scope.leagueFilter) return leagues;
    const others = leagues.filter((key) => {
      const def = HUB_LEAGUES.find((l) => l.key === key);
      return def?.group !== "soccer" || /^\d+$/.test(def.path);
    });
    return group === "soccer" ||
      (group === "all" &&
        leagues.some((key) => HUB_LEAGUES.find((l) => l.key === key)?.group === "soccer"))
      ? ["SOCCER_ALL", ...others]
      : others;
  }, [leagues, group, scope.leagueFilter, tab]);
  const liveRange = useMemo(() => liveDateRange(today), [today]);
  const boardDay = tab === "live" ? liveRange : day;
  const boardFeed = useSportsHub(
    boardLeagues,
    boardDay,
    active && (tab === "live" || group !== "esports") && tab !== "hot" && tab !== "explore",
    refresh,
    tab === "live" ? "live" : "day",
  );
  const board = {
    ...boardFeed,
    games: useMemo(
      () =>
        tab === "live"
          ? boardFeed.games
          : gamesInSportsSelection(boardFeed.games, HUB_LEAGUES, leagues),
      [boardFeed.games, leagues, tab],
    ),
  };
  const upcomingLeagues = useMemo(
    () => (browsing ? leagues.slice(0, 16) : leagues),
    [leagues, browsing],
  );
  const upcomingFeed = useSportsHub(
    upcomingLeagues,
    today,
    active && group !== "esports" && tab !== "hot" && tab !== "live" && tab !== "explore",
    refresh,
    "upcoming",
  );
  const upcoming = {
    ...upcomingFeed,
    games: useMemo(
      () => gamesInSportsSelection(upcomingFeed.games, HUB_LEAGUES, leagues),
      [upcomingFeed.games, leagues],
    ),
  };
  const all = useMemo(
    () =>
      mergeSlices([
        { at: 1, games: upcoming.games },
        { at: 2, games: board.games },
      ]),
    [board.games, upcoming.games],
  );
  const liveNow = useMemo(() => currentLiveGames(board.games), [board.games]);
  useEffect(() => syncSportsReminders(all), [all]);
  const next = useMemo(
    () => eventCards(all.filter((g) => g.state === "pre" && g.startMs >= Date.now())),
    [all],
  );
  const filtered = group === "all" ? all : all.filter((g) => hubLeague(g.league)?.group === group);
  const live = board.games.filter((g) => g.state === "in");
  const following = filtered.filter((g) => fav.teams.some((team) => involvesTeam(g, team)));
  const fights = next.filter((g) =>
    ["combat", "boxing"].includes(hubLeague(g.league)?.group || ""),
  );
  const coming = next.filter((g) =>
    group === "all"
      ? selected.some((k) => HUB_LEAGUES.find((l) => l.key === k)?.tag === g.league)
      : hubLeague(g.league)?.group === group,
  );
  const heroes = featuredEvents(live, group === "all" ? next : coming);
  const pitchGame =
    board.games.find((g) => g.state === "in" && hubLeague(g.league)?.group === "soccer") ||
    board.games.find((g) => g.state === "pre" && hubLeague(g.league)?.group === "soccer");
  const open = (game: SportsGame) => {
    const trigger = document.activeElement;
    eventTrigger.current = trigger instanceof HTMLElement
      ? { element: trigger, label: trigger.getAttribute("aria-label") }
      : null;
    if (
      game.source === "thesportsdb-hub" ||
      game.source === "opendota" ||
      ["combat", "motorsport", "golf"].includes(hubLeague(game.league)?.group || "")
    )
      openMatchDetail(game, all.filter((item) => item.league === game.league && item.context?.id === game.context?.id));
    else openMatchDetail(game);
  };
  // JL Media Vision's pieces of the hub: ranked Top 10, Game Stories, the viewer's own sports
  // channels and the Watch chooser that plays a game on them.
  const jl = useJlSportsPage({ active, onOpenGame: open, featured: heroes });
  const jlTopKeys = new Set(jl.sports.top.map((r) => `${r.game.league}:${r.game.id}`));
  const jlFeatured: JlHubGame[] = heroFeatured(heroes, jlTopKeys).map((game) => ({
    game,
    score: 0,
    reasons: [],
    mine: false,
    channels: jl.sports.channelsFor(game),
  }));
  const jlHome = tab === "home" && group !== "esports";
  // JL's pieces follow the viewer's own sports, not a single sport or league picked below.
  const jlAll = jlHome && group === "all" && !scope.leagueFilter;
  const jlHero =
    jlHome &&
    jl.sports.top.length +
      jl.sports.teamSlides.length +
      jl.sports.playerSlides.length +
      jlFeatured.length >
      0;
  // Harbor's schedule already lists every game of the leagues it shows, so "Also today" only
  // keeps the leagues it doesn't.
  const scheduleTags = new Set([
    ...board.games.map((g) => g.league),
    ...HUB_LEAGUES.filter((l) => leagues.includes(l.key)).map((l) => l.tag),
  ]);
  const jlAlsoToday = jl.sports.alsoToday.filter((g) => !scheduleTags.has(g.league));
  const busy =
    tab !== "hot" &&
    tab !== "explore" &&
    (tab === "live" || group !== "esports") &&
    (board.pending > 0 || (tab !== "live" && upcoming.pending > 0));
  const failures =
    group === "esports" && tab !== "live"
      ? 0
      : board.failed + (tab === "live" ? 0 : upcoming.failed);
  const statusStale = board.stale || (tab !== "live" && upcoming.stale);
  const brokenLeagues = useMemo(
    () => [
      ...new Set(
        [...board.failedKeys, ...(tab === "live" ? [] : upcoming.failedKeys)]
          .map((key) => key.split("@")[0])
          .map((key) =>
            key === "SOCCER_ALL"
              ? "Soccer"
              : HUB_LEAGUES.find((l) => l.key === key)?.labelEn || key,
          ),
      ),
    ],
    [board.failedKeys, upcoming.failedKeys, tab],
  );
  const brokenShown =
    brokenLeagues.slice(0, 3).join(", ") +
    (brokenLeagues.length > 3 ? ` +${brokenLeagues.length - 3}` : "");
  const latest = board.at || (tab === "live" ? 0 : upcoming.at);
  const days = buildDays(new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)));
  const dateTitle = new Date(
    +day.slice(0, 4),
    +day.slice(4, 6) - 1,
    +day.slice(6, 8),
  ).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
  return (
    <main
      ref={scrollRef}
      className="sports-hub"
      onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 700)}
      aria-label={t("Sports")}
    >
      {jlHero && (
        <JlSportsHero
          top={jl.sports.top}
          teamSlides={jl.sports.teamSlides}
          playerSlides={jl.sports.playerSlides}
          featured={jlFeatured}
          actions={jl.actions}
          onOpenGame={open}
          bleed
          flush
        />
      )}
      <header className={jlHero ? "sh-masthead sh-masthead-after-hero" : "sh-masthead"}>
        <div>
          <span className="sh-eyebrow">HARBOR SPORTS</span>
          <h1>{t("Every game. Your game.")}</h1>
        </div>
        <SportsPersonalizeHint
          active={active && !setup}
          onPersonalize={() => setSetup(true)}
        />
      </header>
      <nav className="sh-view-tabs" aria-label={t("Sports navigation")}>
        {[
          ["home", "For you"],
          ["live", "Live now"],
          ["schedule", "Schedule"],
          ["explore", "Explore sports"],
          ["hot", "Hot Events"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              if (key === "home" || key === "live") {
                setLeagueFilter("");
                setGroup("all");
                setBrowsing(false);
              }
            }}
          >
            {t(label)}
          </button>
        ))}
        {tab !== "hot" && (
          <span
            className="sh-update-status"
            role="status"
            title={brokenLeagues.length ? brokenLeagues.join(", ") : undefined}
          >
            {busy ? (
              t("Updating schedules…")
            ) : failures || statusStale ? (
              t("Some schedules are unavailable")
            ) : (
              t("Up to date")
            )}
          </span>
        )}
        <SportsRefreshButton busy={busy} onRefresh={() => setRefresh((n) => n + 1)} />
      </nav>
      {tab === "home" && group !== "esports" && (
        <HubCarousel
          games={heroes}
          active={active && !setup}
          onOpen={open}
          onCustomize={() => setSetup(true)}
          loading={busy}
          stale={board.stale || upcoming.stale}
        />
      )}
      {tab === "home" && group === "esports" && !browsing && (
        <div className="sh-carousel" ref={setEsportsHeroTarget} />
      )}
      <div className="sh-body" ref={bodyRef}>
        <SportsNoProviderNote />
        {tab !== "explore" && tab !== "hot" && tab !== "live" && (
          <div
            ref={sportRail}
            {...sportHandlers}
            className="sh-sport-tabs"
            aria-label={t("Filter by sport")}
          >
            <button
              aria-pressed={group === "all"}
              onClick={() => {
                setGroup("all");
                setLeagueFilter("");
                setBrowsing(false);
              }}
            >
              {t("Your sports")}
            </button>
            {personalGroups.map((g) => (
              <button
                key={g.key}
                aria-pressed={group === g.key}
                onClick={() => {
                  setGroup(g.key);
                  setLeagueFilter("");
                  setBrowsing(browsing && g.key === group && !scope.groups.has(g.key));
                }}
              >
                <SportIcon name={g.key} size={20} />
                {getGroupLabel(g)}
              </button>
            ))}
            <button
              onClick={() => {
                setTab("explore");
                setGroup("all");
              }}
            >
              {t("All sports")}
              <ArrowRight size={14} />
            </button>
          </div>
        )}
        {tab !== "explore" && tab !== "hot" && tab !== "live" && group !== "esports" && (
          <>
            <div className="sh-date-dock">
              <button
                className="sh-icon"
                aria-label={t("Jump to today")}
                onClick={() => setDay(today)}
              >
                <CalendarDays size={18} />
              </button>
              <SportsDateBar
                days={days}
                selected={day}
                today={today}
                liveDays={new Set(live.map((game) => dayStamp(new Date(game.startMs))))}
                onSelect={setDay}
              />
              <label className="sh-calendar-input" title={t("Choose date")}>
                <CalendarDays size={18} />
                <input
                  type="date"
                  aria-label={t("Choose date")}
                  value={`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`}
                  onChange={(e) => {
                    if (e.target.value) setDay(e.target.value.replaceAll("-", ""));
                  }}
                />
              </label>
              <SportsSelect
                className="sh-league-select"
                ariaLabel={t("Filter by league")}
                value={scope.leagueFilter}
                onChange={setLeagueFilter}
                options={[
                  {
                    value: "",
                    label: t("All leagues"),
                    left: <SportIcon name="trophy" size={20} />,
                  },
                  ...scope.options.map((l) => ({
                    value: l.key,
                    label: getLeagueLabel(l),
                    left: <LeagueLogo league={l} size={20} />,
                  })),
                ]}
              />
            </div>
          </>
        )}
        {tab !== "hot" && group !== "esports" && (statusStale || failures > 0) && (
          <div className="sh-feed-note" role="status">
            <span>
              {t(
                tab === "live"
                  ? "Some live scores are unavailable."
                  : statusStale
                    ? "Showing saved schedules while feeds reconnect."
                    : "Some feeds did not respond. Available events are still shown.",
              )}
              {brokenLeagues.length > 0 && ` · ${brokenShown}`}
              {latest > 0 &&
                ` · ${t("Last update")} ${new Date(latest).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`}
            </span>
            <button
              className="sh-text-button"
              disabled={busy}
              onClick={() => setRefresh((n) => n + 1)}
            >
              {t("Retry")}
            </button>
          </div>
        )}
        {tab !== "explore" && tab !== "hot" && tab !== "live" && group === "esports" && (
          <Suspense fallback={<SportsRailSkeleton />}>
            {browsing ? (
              <EsportsArena active={active && !setup} refresh={refresh} />
            ) : (
              <EsportsMatchRail
                heroTarget={tab === "home" ? esportsHeroTarget : null}
                leagueKeys={leagues}
                active={active && !setup}
                refresh={refresh}
                onExplore={() => setBrowsing(true)}
              />
            )}
          </Suspense>
        )}
        {tab === "home" && group !== "esports" && (
          <>
            {!fav.personalized && !settings.sportsLeagues.length && (
              <button className="sh-personalize-banner" onClick={() => setSetup(true)}>
                <span className="sh-banner-icon">
                  <Star size={22} />
                </span>
                <span>
                  <strong>{t("Less searching. More of your sport.")}</strong>
                  <small>
                    {t("Pick your sports, leagues and teams. We will bring them to the front.")}
                  </small>
                </span>
                <span className="sh-banner-action">
                  {t("Make it yours")}
                  <ArrowRight size={18} />
                </span>
              </button>
            )}
            {jlAll && (
              <>
                <JlSportsHub
                  top={jl.sports.top}
                  ticker={jl.sports.ticker}
                  favorites={jl.sports.teams}
                  actions={jl.actions}
                  onOpenGame={open}
                  onLeagues={() => {
                    setTab("explore");
                    setGroup("all");
                  }}
                />
                <GameStoriesRow stories={jl.stories} onWatch={jl.actions.watch} onOpenGame={open} />
              </>
            )}
            <HubRow
              title={t(
                live.some((game) => game.savedAt === undefined)
                  ? "Live now"
                  : "Latest saved scores",
              )}
              description={t("The action happening across your sports.")}
              games={live}
              onOpen={open}
              stale={board.stale}
            />
            <HubRow
              title={t("Your teams")}
              games={following.filter((g) => g.state !== "post")}
              onOpen={open}
              stale={board.stale || upcoming.stale}
            />
            {day !== today && (
              <HubSchedule
                title={dateTitle}
                games={board.games}
                onOpen={open}
                stale={board.stale}
                loading={board.pending > 0}
                failed={board.failed > 0}
              />
            )}
            <HubRow
              title={t("Coming up")}
              description={t("Clear your calendar. These are worth a look.")}
              games={diverseEvents(coming)}
              onOpen={open}
              stale={upcoming.stale}
            />
            {(group === "all" || group === "combat" || group === "boxing") && (
              <HubRow
                title={t("Fight nights")}
                description={t("The headline events. The full card. The next big matchup.")}
                games={fights}
                onOpen={open}
                stale={upcoming.stale}
              />
            )}
            {jlAll && (
              <LiveSportsChannels
                active={active}
                channels={jl.channels}
                activeSourceId={jl.activeSourceId}
                epg={jl.epg}
                nowMs={jl.nowMs}
                games={jl.sports.top}
                onPlay={jl.play}
              />
            )}
            {pitchGame && <HubPitchSpotlight game={pitchGame} active={active} onOpen={open} />}
            {group === "all" && esportsLeagues.length > 0 && (
              <Suspense fallback={<SportsRailSkeleton />}>
                <EsportsMatchRail
                  leagueKeys={esportsLeagues}
                  active={active && !setup}
                  refresh={refresh}
                  onExplore={() => {
                    setBrowsing(true);
                    setGroup("esports");
                    setLeagueFilter("");
                    scrollRef.current?.scrollTo({ top: 0 });
                  }}
                />
              </Suspense>
            )}
            {day === today && (
              <HubSchedule
                title={dateTitle}
                games={board.games}
                onOpen={open}
                stale={board.stale}
                loading={board.pending > 0}
                failed={board.failed > 0}
              />
            )}
            {jlAll && (
              <AlsoToday
                groups={jlAlsoToday}
                favorites={jl.sports.teams}
                actions={jl.actions}
                onOpenGame={open}
              />
            )}
            {!filtered.length && (
              <div className="sh-empty">
                <CalendarDays size={30} />
                <h2>
                  {t(
                    busy
                      ? "Your sports are on their way"
                      : "No events available for this selection",
                  )}
                </h2>
                <p>
                  {t(
                    busy
                      ? "Browse sports or set up your favorites while schedules arrive."
                      : "Try another sport or date. Saved schedules will appear here when a feed is unavailable.",
                  )}
                </p>
                <button className="sh-button" onClick={() => setTab("explore")}>
                  {t("Explore sports")}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
        {tab === "live" && (
          <>
            <HubSchedule
              key="live-now"
              title={t("Live now")}
              games={liveNow}
              onOpen={open}
              stale={board.stale}
              loading={busy}
              failed={failures > 0 || board.stale}
              liveOnly
            />
            {(group === "all" || group === "esports") && (
              <Suspense fallback={<SportsRailSkeleton />}>
                <EsportsMatchRail
                  liveOnly
                  active={active && !setup}
                  refresh={refresh}
                  onExplore={() => {
                    setTab("home");
                    setBrowsing(true);
                    setGroup("esports");
                    setLeagueFilter("");
                    scrollRef.current?.scrollTo({ top: 0 });
                  }}
                />
              </Suspense>
            )}
          </>
        )}
        {tab === "schedule" && group !== "esports" && (
          <HubSchedule
            title={dateTitle}
            games={board.games}
            onOpen={open}
            stale={board.stale}
            loading={board.pending > 0}
            failed={board.failed > 0}
          />
        )}
        {tab === "hot" && (
          <Suspense fallback={<SportsHotEventsSkeleton />}>
            <HotEvents
              seed={all}
              active={active && !setup}
              refresh={refresh}
              favourites={fav.teams}
              onOpen={open}
              onExplore={() => setTab("explore")}
            />
          </Suspense>
        )}
        {tab === "explore" && (
          <SportsExplorer
            onSport={(key) => {
              setBrowsing(true);
              setGroup(key);
              setLeagueFilter("");
              setTab("home");
              scrollRef.current?.scrollTo({ top: 0 });
            }}
          />
        )}
        <footer className="sh-footer">
          <span>{t("Schedules and scores: ESPN · TheSportsDB")}</span>
          <span>{t("Coverage varies by league. Streams depend on your available sources.")}</span>
          <span>
            {t(
              "Use only sources you are authorized to access. Harbor does not bypass subscriptions or access restrictions.",
            )}
          </span>
        </footer>
      </div>
      {showTop && (
        <button
          className="sh-back-top"
          aria-label={t("Back to top")}
          onClick={() => {
            scrollRef.current?.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
            scrollRef.current
              ?.querySelector<HTMLButtonElement>(".sh-masthead button")
              ?.focus({ preventScroll: true });
          }}
        >
          <ArrowUp size={18} />
          {t("Back to top")}
        </button>
      )}
      {jl.dialogs}
      <Suspense fallback={null}>
        {setup && <Personalize selected={selected} onClose={() => setSetup(false)} />}{" "}
      </Suspense>
    </main>
  );
}
