import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import {
  DEFAULT_SPORTS_LEAGUES,
  getGroupLabel,
  getLeagueLabel,
  liveCount,
  sortGames,
  type SportsGame,
} from "@/lib/sports/espn";
import { involvesTeam, orderedFavouriteTeams, useFavourites } from "@/lib/sports/favourites";
import {
  SPORTS_GROUPS,
  SPORTS_LEAGUES,
  fetchSportsBoard,
  lockedLeagues,
  sportsLeagueByTag,
} from "@/lib/sports/provider";
import { SportsHeroCarousel } from "./sports/hero-carousel";
import { WatchSources, useSportsChannelIndex } from "./sports/watch-sources";
import { useWatchGame } from "./sports/watch-flow";
import { FavouritesRail } from "./sports/favourites-rail";
import { TeamPicker } from "./sports/team-picker";
import { FavouriteTeamRows } from "./sports/team-row";
import { SportsDateBar, buildDays, todayKey } from "./sports/date-bar";
import { SportsTabs, ALL_TAB, FAVORITES_TAB, type SportTab } from "./sports/sport-tabs";
import { LeagueSection } from "./sports/league-section";
import { EmptyDay, LockedLeaguesNote, SectionDivider, SideRail } from "./sports/board-states";

type Rung = "sm" | "md" | "lg";

const TAB_STORAGE = "harbor.sports.group";
const COLLAPSE_STORAGE = "harbor.sports.collapsed";
const POLL_MS = 15_000;

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function keyToDate(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
}

export function SportsView({ active = false }: { active?: boolean }) {
  const t = useT();
  const lang = useUiLanguage();
  const locale = lang === "ar" ? "ar-SA" : "en-US";
  const { openMatchDetail, openSettings } = useView();
  const { settings } = useSettings();
  const fav = useFavourites();
  const channelIndex = useSportsChannelIndex();
  const watchGame = useWatchGame(channelIndex);

  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("sports", scrollRef, active);

  const [rung, setRung] = useState<Rung>("md");
  const [today, setToday] = useState(todayKey);
  const [day, setDay] = useState(today);
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_STORAGE) || ALL_TAB;
    } catch {
      return ALL_TAB;
    }
  });
  const [games, setGames] = useState<SportsGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!scrollEl) return;
    const measure = () => {
      const w = scrollEl.clientWidth;
      setRung(w >= 1400 ? "lg" : w >= 1040 ? "md" : "sm");
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [scrollEl]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      setToday(todayKey());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [active]);

  const favTeams = useMemo(() => orderedFavouriteTeams(fav), [fav]);

  const leagueKeys = useMemo(() => {
    if (tab === FAVORITES_TAB) {
      const keys = new Set(fav.leagues);
      for (const team of favTeams) keys.add(team.leagueKey);
      return keys.size > 0 ? [...keys] : DEFAULT_SPORTS_LEAGUES;
    }
    if (tab === ALL_TAB) return SPORTS_LEAGUES.map((l) => l.key);
    return SPORTS_LEAGUES.filter((l) => l.group === tab).map((l) => l.key);
  }, [tab, fav.leagues, favTeams]);

  const fetchKey = leagueKeys.join(",");
  const keyed = settings.sportsApiKey.trim() !== "";
  const locked = useMemo(() => lockedLeagues(leagueKeys), [fetchKey, keyed]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let seq = 0;
    setGames([]);
    setLoading(true);
    const run = () => {
      const mine = ++seq;
      const accept = (next: SportsGame[], done: boolean) => {
        if (cancelled || mine !== seq) return;
        setGames(next);
        if (done || next.length > 0) setLoading(false);
      };
      fetchSportsBoard(leagueKeys, day, (partial) => accept(partial, false))
        .then((next) => accept(next, true))
        .catch(() => {
          if (!cancelled && mine === seq) setLoading(false);
        });
    };
    run();
    if (day !== today) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, fetchKey, keyed, day, today]);

  const pickTab = (key: string) => {
    setTab(key);
    try {
      localStorage.setItem(TAB_STORAGE, key);
    } catch {}
  };

  const toggleSection = (tag: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [tag]: !prev[tag] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const board = useMemo(() => {
    if (tab !== FAVORITES_TAB) return games;
    const tags = new Set(
      SPORTS_LEAGUES.filter((l) => fav.leagues.includes(l.key)).map((l) => l.tag),
    );
    if (tags.size === 0 && favTeams.length === 0) return games;
    return games.filter(
      (g) => tags.has(g.league) || favTeams.some((team) => involvesTeam(g, team)),
    );
  }, [games, tab, fav.leagues, favTeams]);

  const tabs: SportTab[] = useMemo(
    () => SPORTS_GROUPS.map((g) => ({ key: g.key, label: getGroupLabel(g) })),
    [lang],
  );

  const days = useMemo(() => buildDays(keyToDate(today)), [today]);

  const sections = useMemo(() => {
    const byTag = new Map<string, SportsGame[]>();
    for (const game of board) {
      const list = byTag.get(game.league);
      if (list) list.push(game);
      else byTag.set(game.league, [game]);
    }
    const out = [...byTag.entries()].map(([tag, list]) => {
      const def = sportsLeagueByTag(tag);
      const ordered = sortGames(list);
      const starts = ordered.map((g) => g.startMs).filter((ms) => ms > 0);
      return {
        tag,
        title: def ? getLeagueLabel(def) : tag,
        logo: def?.logo,
        games: ordered,
        live: liveCount(ordered),
        soonest: starts.length ? Math.min(...starts) : Number.MAX_SAFE_INTEGER,
      };
    });
    out.sort((a, b) => (b.live > 0 ? 1 : 0) - (a.live > 0 ? 1 : 0) || a.soonest - b.soonest);
    return out;
  }, [board, lang]);

  const heroGames = useMemo(() => board.filter((g) => g.state !== "post").slice(0, 8), [board]);
  const liveDays = useMemo(() => new Set(liveCount(board) > 0 ? [day] : []), [board, day]);
  const renderChannels = useCallback(
    (game: SportsGame) => <WatchSources game={game} index={channelIndex} />,
    [channelIndex],
  );
  const onWatch = useCallback(
    (game: SportsGame) => {
      if (!watchGame(game)) openMatchDetail(game);
    },
    [watchGame, openMatchDetail],
  );

  const gridCols =
    rung === "lg"
      ? "grid-cols-[264px_minmax(0,780px)_300px]"
      : rung === "md"
        ? "grid-cols-[minmax(0,1fr)_300px]"
        : "grid-cols-1";
  const favClass = rung === "sm" ? "order-2" : rung === "md" ? "col-span-full" : "";
  const listClass = rung === "sm" ? "order-1" : "";
  const railClass = rung === "sm" ? "order-3" : "";

  const dateText = keyToDate(day).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main
      ref={scrollCb}
      data-w={rung}
      className="relative flex-1 overflow-y-auto overflow-x-hidden bg-canvas"
    >
      <SportsHeroCarousel
        games={heroGames}
        pending={loading && heroGames.length === 0 && day >= today}
        onOpen={openMatchDetail}
        onWatch={onWatch}
      />

      <div className="sticky top-20 z-30 border-b border-edge-soft bg-canvas/95 backdrop-blur-xl">
        <SportsTabs
          tabs={tabs}
          selected={tab}
          favoriteCount={fav.teams.length + fav.leagues.length}
          onSelect={pickTab}
          onManageFavorites={() => setPicker(true)}
        />
        <SportsDateBar
          days={days}
          selected={day}
          today={today}
          liveDays={liveDays}
          onSelect={setDay}
        />
      </div>

      <div className={`grid justify-center gap-6 px-6 pb-16 pt-6 ${gridCols}`}>
        <FavouritesRail board={board} className={favClass} />

        <div className={`min-w-0 ${listClass}`}>
          {favTeams.length > 0 && (
            <div className="mb-8 flex flex-col gap-8">
              <FavouriteTeamRows board={board} />
            </div>
          )}
          <SectionDivider label={day === today ? `${t("Today")} · ${dateText}` : dateText} />
          {loading && sections.length === 0 ? (
            <div className="flex flex-col gap-5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[200px] animate-pulse rounded-lg bg-elevated/60 motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <EmptyDay onToday={() => setDay(today)} showToday={day !== today} />
          ) : (
            sections.map((section) => (
              <LeagueSection
                key={section.tag}
                title={section.title}
                logo={section.logo}
                games={section.games}
                nowMs={nowMs}
                collapsed={!!collapsed[section.tag]}
                onToggle={() => toggleSection(section.tag)}
                onOpen={openMatchDetail}
                renderChannels={renderChannels}
              />
            ))
          )}
          <LockedLeaguesNote leagues={locked} onConnect={() => openSettings("library")} />
        </div>

        <div className={railClass}>
          <SideRail games={board} onOpen={openMatchDetail} />
        </div>
      </div>

      {picker && <TeamPicker onClose={() => setPicker(false)} />}
    </main>
  );
}
