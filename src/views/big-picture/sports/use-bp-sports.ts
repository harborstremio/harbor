import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pushBigPicture } from "@/lib/big-picture";
import { useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { getGroupLabel, type SportsGame } from "@/lib/sports/espn";
import { involvesTeam, useFavourites } from "@/lib/sports/favourites";
import { HOT_EVENT_LEAGUES, hotEvents } from "@/lib/sports/hot-events";
import { eventCards, mergeSlices } from "@/lib/sports/hub-cache";
import { HUB_DEFAULTS, HUB_GROUPS, HUB_LEAGUES, dayStamp, hubLeague } from "@/lib/sports/hub-data";
import { featuredEvents } from "@/lib/sports/hub-discovery";
import { currentLiveGames, liveDateRange, liveScoreboardKeys } from "@/lib/sports/live-schedule";
import {
  gamesInSportsSelection,
  selectedSportsLeagues,
  sportsSelectionScope,
} from "@/lib/sports/personalization";
import { syncSportsReminders } from "@/lib/sports/reminders";
import { useSportsHub } from "@/views/sports/use-hub";
import { useBpT } from "../bp-i18n";
import { useBpPersistedState } from "../bp-view-state";
import { bpSportsForYouRows, bpSportsHotRows, bpSportsLeagueRows } from "./bp-sports-rows";
import type { BpSportsMode, BpSportsRowModel, BpSportsSelect } from "./bp-sports-types";

const LIVE_SCOREBOARDS = liveScoreboardKeys(HUB_LEAGUES);
const HOT_LEAGUE_LIMIT = 24;
const UPCOMING_BROWSE_LIMIT = 16;
const TODAY_MS = 60_000;

export type BpSportsStatus = {
  busy: boolean;
  failed: boolean;
  failedKeys: string[];
  stale: boolean;
  at: number;
};

export type BpSportsState = {
  mode: BpSportsMode;
  setMode: (mode: BpSportsMode) => void;
  group: string;
  setGroup: (key: string) => void;
  groups: { key: string; label: string }[];
  showGroups: boolean;
  day: string;
  setDay: (day: string) => void;
  today: string;
  liveDays: ReadonlySet<string>;
  dateTitle: string;
  heroes: SportsGame[];
  rows: BpSportsRowModel[];
  status: BpSportsStatus;
  empty: boolean;
  personalized: boolean;
  signature: string;
  open: BpSportsSelect;
  browse: (group: string) => void;
  refresh: () => void;
};

export function useBpSports(active: boolean): BpSportsState {
  const t = useBpT();
  const locale = useUiLanguage();
  const { settings } = useSettings();
  const fav = useFavourites();
  const [mode, setStoredMode] = useBpPersistedState<BpSportsMode>("sportsMode", "for-you");
  const [requestedGroup, setRequestedGroup] = useState("all");
  const [browsing, setBrowsing] = useState(false);
  const [today, setToday] = useState(() => dayStamp(new Date()));
  const [day, setDay] = useState(today);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setToday(dayStamp(new Date())), TODAY_MS);
    return () => clearInterval(timer);
  }, [active]);

  const stamped = useRef(today);
  useEffect(() => {
    if (stamped.current === today) return;
    const was = stamped.current;
    stamped.current = today;
    setDay((current) => (current === was ? today : current));
  }, [today]);

  const selected = useMemo(
    () =>
      selectedSportsLeagues(HUB_LEAGUES, settings.sportsLeagues, !!fav.personalized, HUB_DEFAULTS),
    [settings.sportsLeagues, fav.personalized],
  );
  const scope = useMemo(
    () => sportsSelectionScope(HUB_LEAGUES, selected, requestedGroup, browsing, ""),
    [selected, requestedGroup, browsing],
  );
  const { group, leagues } = scope;
  const groups = useMemo(
    () =>
      HUB_GROUPS.filter(
        (item) => scope.groups.has(item.key) || (browsing && item.key === group),
      ).map((item) => ({ key: item.key, label: getGroupLabel(item) })),
    [scope.groups, browsing, group, locale],
  );
  const esportsLeagues = useMemo(
    () => selected.filter((key) => HUB_LEAGUES.find((def) => def.key === key)?.group === "esports"),
    [selected],
  );

  const boardLeagues = useMemo(() => {
    if (mode === "live") return LIVE_SCOREBOARDS;
    const others = leagues.filter((key) => {
      const def = HUB_LEAGUES.find((item) => item.key === key);
      return def?.group !== "soccer" || /^\d+$/.test(def.path);
    });
    const soccer =
      group === "soccer" ||
      (group === "all" &&
        leagues.some((key) => HUB_LEAGUES.find((item) => item.key === key)?.group === "soccer"));
    return soccer ? ["SOCCER_ALL", ...others] : others;
  }, [leagues, group, mode]);

  const liveRange = useMemo(() => liveDateRange(today), [today]);
  const boardDay = mode === "live" ? liveRange : day;
  const boardOn = active && mode !== "hot" && mode !== "explore";
  const boardFeed = useSportsHub(
    boardLeagues,
    boardDay,
    boardOn,
    refresh,
    mode === "live" ? "live" : "day",
  );
  const boardGames = useMemo(
    () =>
      mode === "live"
        ? boardFeed.games
        : gamesInSportsSelection(boardFeed.games, HUB_LEAGUES, leagues),
    [boardFeed.games, leagues, mode],
  );
  const upcomingLeagues = useMemo(
    () => (browsing ? leagues.slice(0, UPCOMING_BROWSE_LIMIT) : leagues),
    [leagues, browsing],
  );
  const upcomingOn = active && mode !== "hot" && mode !== "live" && mode !== "explore";
  const upcomingFeed = useSportsHub(upcomingLeagues, today, upcomingOn, refresh, "upcoming");
  const upcomingGames = useMemo(
    () => gamesInSportsSelection(upcomingFeed.games, HUB_LEAGUES, leagues),
    [upcomingFeed.games, leagues],
  );

  const all = useMemo(
    () =>
      mergeSlices([
        { at: 1, games: upcomingGames },
        { at: 2, games: boardGames },
      ]),
    [boardGames, upcomingGames],
  );
  useEffect(() => syncSportsReminders(all), [all]);

  const hotLeagues = useMemo(
    () => [...new Set([...HOT_EVENT_LEAGUES, ...fav.leagues])].slice(0, HOT_LEAGUE_LIMIT),
    [fav.leagues],
  );
  const hotFeed = useSportsHub(hotLeagues, today, active && mode === "hot", refresh, "upcoming");
  const hot = useMemo(() => {
    if (mode !== "hot") return [];
    const pool = mergeSlices([
      { at: 1, games: all },
      { at: 2, games: hotFeed.games },
    ]);
    return hotEvents(pool, Date.now(), (game) =>
      fav.teams.some((team) => involvesTeam(game, team)),
    );
  }, [mode, all, hotFeed.games, fav.teams]);

  const live = useMemo(() => boardGames.filter((game) => game.state === "in"), [boardGames]);
  const liveDays = useMemo(
    () => new Set(live.map((game) => dayStamp(new Date(game.startMs)))),
    [live],
  );
  const next = useMemo(
    () => eventCards(all.filter((game) => game.state === "pre" && game.startMs >= Date.now())),
    [all],
  );
  const filtered = useMemo(
    () => (group === "all" ? all : all.filter((game) => hubLeague(game.league)?.group === group)),
    [all, group],
  );
  const coming = useMemo(
    () =>
      next.filter((game) =>
        group === "all"
          ? selected.some((key) => HUB_LEAGUES.find((def) => def.key === key)?.tag === game.league)
          : hubLeague(game.league)?.group === group,
      ),
    [next, group, selected],
  );
  const heroes = useMemo(
    () => (mode === "for-you" ? featuredEvents(live, group === "all" ? next : coming) : []),
    [mode, live, next, coming, group],
  );

  const dateTitle = useMemo(
    () =>
      new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)).toLocaleDateString(
        locale,
        { weekday: "long", month: "long", day: "numeric" },
      ),
    [day, locale],
  );

  const rows = useMemo(() => {
    if (mode === "live") return bpSportsLeagueRows(currentLiveGames(boardGames), "live");
    if (mode === "schedule") return bpSportsLeagueRows(eventCards(boardGames), "schedule");
    if (mode === "hot") return bpSportsHotRows(hot, t);
    if (mode === "explore") return [];
    return bpSportsForYouRows({
      t,
      live,
      following: filtered.filter((game) => fav.teams.some((team) => involvesTeam(game, team))),
      coming,
      fights: next.filter((game) =>
        ["combat", "boxing"].includes(hubLeague(game.league)?.group || ""),
      ),
      esports: all.filter((game) => hubLeague(game.league)?.group === "esports"),
      dayGames: eventCards(boardGames),
      pitchGame:
        boardGames.find(
          (game) => game.state === "in" && hubLeague(game.league)?.group === "soccer",
        ) ??
        boardGames.find(
          (game) => game.state === "pre" && hubLeague(game.league)?.group === "soccer",
        ) ??
        null,
      dateTitle,
      otherDay: day !== today,
      showFights: group === "all" || group === "combat" || group === "boxing",
      showEsports: group === "all" && esportsLeagues.length > 0,
    });
  }, [
    mode,
    boardGames,
    hot,
    locale,
    live,
    filtered,
    fav.teams,
    coming,
    next,
    all,
    dateTitle,
    day,
    today,
    group,
    esportsLeagues,
  ]);

  const busy =
    mode === "hot"
      ? hotFeed.pending > 0
      : mode !== "explore" &&
        (boardFeed.pending > 0 || (mode !== "live" && upcomingFeed.pending > 0));
  const failed =
    mode === "hot"
      ? hotFeed.failed > 0
      : boardFeed.failed + (mode === "live" ? 0 : upcomingFeed.failed) > 0;
  const failedKeys =
    mode === "hot"
      ? hotFeed.failedKeys
      : [...boardFeed.failedKeys, ...(mode === "live" ? [] : upcomingFeed.failedKeys)];
  const stale =
    mode === "hot" ? hotFeed.stale : boardFeed.stale || (mode !== "live" && upcomingFeed.stale);
  const at = mode === "hot" ? hotFeed.at : boardFeed.at || (mode === "live" ? 0 : upcomingFeed.at);

  const setMode = useCallback(
    (value: BpSportsMode) => {
      setStoredMode(value);
      if (value !== "schedule") setDay(today);
      if (value === "for-you" || value === "live") {
        setRequestedGroup("all");
        setBrowsing(false);
      }
    },
    [setStoredMode, setDay, today],
  );

  const browse = useCallback(
    (key: string) => {
      setBrowsing(true);
      setRequestedGroup(key);
      setStoredMode("for-you");
    },
    [setStoredMode],
  );

  const setGroup = useCallback((key: string) => {
    setRequestedGroup(key);
    setBrowsing(false);
  }, []);

  const open = useCallback<BpSportsSelect>((game) => {
    pushBigPicture({ kind: "sports-event", game });
  }, []);

  const refreshAll = useCallback(() => setRefresh((n) => n + 1), []);

  const signature = useMemo(
    () => [mode, group, day, ...rows.map((row) => `${row.key}:${row.games.length}`)].join("|"),
    [mode, group, day, rows],
  );

  return {
    mode,
    setMode,
    group,
    setGroup,
    groups,
    showGroups: mode === "for-you" || mode === "schedule",
    day,
    setDay,
    today,
    liveDays,
    dateTitle,
    heroes,
    rows,
    status: { busy, failed, failedKeys, stale, at },
    empty:
      (mode === "for-you" && filtered.length === 0) ||
      (mode !== "for-you" && mode !== "explore" && !busy && rows.length === 0),
    personalized: !!fav.personalized || settings.sportsLeagues.length > 0,
    signature,
    open,
    browse,
    refresh: refreshAll,
  };
}
