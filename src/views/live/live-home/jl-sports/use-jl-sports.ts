import { useEffect, useMemo, useState } from "react";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";
import {
  buildSportsChannelIndex,
  channelsForGame,
  type GameChannel,
  type SportsChannelIndex,
} from "@/lib/jl/sports/channels";
import {
  effectiveTeams,
  useJlFavoritePlayers,
  useJlSportsFavorites,
  type JlFavoritePlayer,
} from "@/lib/jl/sports/favorites";
import { fetchCalendar } from "@/lib/jl/sports/college-data";
import { useFollowedColleges } from "@/lib/jl/sports/college-follows";
import {
  collegeFavorite,
  collegeGames,
  linkCollegesToVision,
  SCHOOL_SOURCE,
} from "@/lib/jl/sports/college-games";
import type { College } from "@/lib/jl/sports/colleges";
import { fetchJlScoreboard, fetchTeamGames } from "@/lib/jl/sports/feed";
import { logoUrl } from "@/lib/jl/sports/sidearm";
import { useVisionVersion, vision, visionTeamFor } from "@/lib/jl/sports/vision";
import { followedGamesThisWeek, selectTopGames, teamsMissingFromScoreboard } from "@/lib/jl/sports/gameday";
import { alsoTodayGroups, teamSlideInfo } from "@/lib/jl/sports/hub-sections";
import { isFavoriteGame, rankGames, type JlFavoriteTeam, type RankedGame } from "@/lib/jl/sports/rank";
import { useActiveKid } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { useOddsApiGames } from "./use-sports-extras";

export const JL_SPORTS_LEAGUES = ["NFL", "NCAAF", "NBA", "NCAAB", "NHL", "MLB", "EPL", "UCL", "MLS"];

const POLL_MS = 30_000;
const TICKER_GAMES = 16;
const DAY_MS = 24 * 3600000;
// Event channel names carry no year; the index is rebuilt at most every ten minutes.
const INDEX_BUCKET_MS = 10 * 60000;

export type JlHubGame = RankedGame & { channels: GameChannel[] };

/** A followed player and their team's next game this week, if any. */
export type JlPlayerSlide = { player: JlFavoritePlayer; next: JlHubGame | null };

/** A followed team: how ESPN lists it (logo, colours) and its game on now or next this week. */
export type JlTeamSlide = { team: JlFavoriteTeam; side: SportsSide | null; next: JlHubGame | null };

/** "Also today": the day's other games, one group per league. */
export type JlAlsoToday = { league: string; label: string; live: number; items: JlHubGame[] };

/** The teams the hub follows: ESPN favorites plus colleges followed on their College page. */
export function useHubTeams(): JlFavoriteTeam[] {
  const teams = useJlSportsFavorites();
  const colleges = useFollowedColleges();
  return useMemo(() => [...teams, ...colleges.map(collegeFavorite)], [teams, colleges]);
}

/** A followed college's games from its own athletics site (college-games.ts). */
async function schoolGames(colleges: readonly College[]): Promise<SportsGame[]> {
  const now = Date.now();
  const lists = await Promise.all(
    colleges.map(async (c) => {
      if (!c.site) return [];
      const cal = await fetchCalendar(c.site).catch(() => null);
      return cal ? collegeGames(c, cal.events, now, { logo: logoUrl(c.site) }) : [];
    }),
  );
  return lists.flat();
}

/** A school's mascot from its JL Vision team, for the wordmark's second line ("BISON"). */
function withVisionMascot(game: SportsGame): SportsGame {
  if (game.source !== SCHOOL_SOURCE) return game;
  const side = (s: SportsSide): SportsSide => {
    const mascot = visionTeamFor(game.league, s.id)?.mascot;
    return mascot && !s.nickname ? { ...s, nickname: mascot, name: `${s.location ?? s.name} ${mascot}` } : s;
  };
  return { ...game, home: side(game.home), away: side(game.away) };
}

/**
 * Scoreboards for JL's leagues, the schedules of followed teams that aren't on them, and the
 * games of colleges followed on their College page.
 */
export function useJlGames(favorites: JlFavoriteTeam[], enabled = true): SportsGame[] {
  const [games, setGames] = useState<SportsGame[]>([]);
  const favoritesKey = favorites.map((f) => `${f.league}:${f.id}`).join(",");
  const colleges = useFollowedColleges();
  const collegesKey = colleges.map((c) => c.id).join(",");
  const visionVersion = useVisionVersion();
  useEffect(() => {
    vision.setDeviceLinks("colleges", linkCollegesToVision(colleges, vision.teams()));
  }, [colleges, visionVersion]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const boards = (await Promise.all(JL_SPORTS_LEAGUES.map((l) => fetchJlScoreboard(l)))).flat();
      // Followed colleges aren't ESPN teams; their games come from their own sites.
      const missing = teamsMissingFromScoreboard(boards, favorites).filter(
        (f) => !f.id.startsWith("ncaa-"),
      );
      const [extra, school] = await Promise.all([
        Promise.all(missing.map((f) => fetchTeamGames(f.league, f.id))).then((l) => l.flat()),
        schoolGames(colleges),
      ]);
      const seen = new Set<string>();
      const merged: SportsGame[] = [];
      for (const g of [...boards, ...extra, ...school]) {
        const key = `${g.league}:${g.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(g);
      }
      if (!cancelled) setGames(merged);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // favoritesKey and collegesKey capture every change to the followed teams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesKey, collegesKey, enabled]);

  // visionVersion: a mascot can arrive after the games.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => games.map(withVisionMascot), [games, visionVersion]);
}

/** Which of the viewer's channels carry each game; empty while Smart Channel Finder is off. */
export function useSportsChannelIndex(
  channels: IptvChannel[],
  epg: EpgIndex | null,
  nowMs: number,
): SportsChannelIndex {
  const { settings } = useSettings();
  const finder = settings.sportsChannelFinder;
  const bucket = Math.floor(nowMs / INDEX_BUCKET_MS);
  return useMemo(
    () => buildSportsChannelIndex(finder ? channels : [], epg, new Date(bucket * INDEX_BUCKET_MS)),
    [channels, epg, bucket, finder],
  );
}

export function useJlSports(params: {
  channels: IptvChannel[];
  epg: EpgIndex | null;
  nowMs: number;
  /** False while the page is parked: no polling, the last games stay on screen. */
  active?: boolean;
}) {
  const { channels, epg, nowMs, active = true } = params;
  const { settings } = useSettings();
  const { sportsTopGames, sportsScoreTicker } = settings;
  // Harbor's odds setting covers every sports surface; kids' profiles never see lines.
  const kid = useActiveKid();
  const sportsOdds = settings.sportsShowOdds && !kid;
  const teams = useHubTeams();
  const players = useJlFavoritePlayers();
  const favorites = useMemo(() => effectiveTeams(teams, players), [teams, players]);
  const games = useJlGames(favorites, active);
  // Smart Channel Finder off: no channel matching, so every game offers "Ways to watch" only.
  const index = useSportsChannelIndex(channels, epg, nowMs);

  const hub = useMemo(() => {
    const now = new Date(nowMs);
    const channelCache = new Map<string, GameChannel[]>();
    const channelsOf = (g: SportsGame) => {
      const key = `${g.league}:${g.id}`;
      let found = channelCache.get(key);
      if (!found) {
        found = channelsForGame(g, index, now);
        channelCache.set(key, found);
      }
      return found;
    };
    const ranked = rankGames(games, favorites, { now, watchable: (g) => channelsOf(g).length > 0 });
    const followed = followedGamesThisWeek(games, favorites, now);
    const top: JlHubGame[] = selectTopGames(ranked, followed).map((r) => ({ ...r, channels: channelsOf(r.game) }));
    // The ticker follows your teams through the day: live, today's kick-offs, and today's finals.
    const ticker: JlHubGame[] = games
      .filter((g) => isFavoriteGame(g, favorites) && Math.abs(g.startMs - now.getTime()) < DAY_MS)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, TICKER_GAMES)
      .map((game) => ({ game, score: 0, reasons: [], mine: true, channels: channelsOf(game) }));
    const hubItem = (g: SportsGame): JlHubGame =>
      top.find((r) => r.game.id === g.id && r.game.league === g.league) ?? {
        game: g,
        score: 0,
        reasons: [],
        mine: isFavoriteGame(g, favorites),
        channels: channelsOf(g),
      };
    const teamSlides: JlTeamSlide[] = teamSlideInfo(games, teams, now).map(({ team, side, next }) => ({
      team,
      side,
      next: next ? hubItem(next) : null,
    }));
    const shownTop = sportsTopGames ? top : [];
    const alsoToday: JlAlsoToday[] = alsoTodayGroups(games, {
      now: now.getTime(),
      exclude: new Set(shownTop.map((r) => `${r.game.league}:${r.game.id}`)),
    }).map((g) => ({ league: g.league, label: g.label, live: g.live, items: g.games.map(hubItem) }));
    const playerSlides: JlPlayerSlide[] = players.map((player) => {
      const team = player.teamId ? [{ league: player.league, id: player.teamId, name: player.teamName ?? "" }] : [];
      const next = followedGamesThisWeek(games, team, now)[0];
      const ranked = next ? top.find((r) => r.game.id === next.id && r.game.league === next.league) : undefined;
      return {
        player,
        next: ranked ?? (next ? { game: next, score: 0, reasons: [], mine: true, channels: channelsOf(next) } : null),
      };
    });
    return {
      top: shownTop,
      ticker: sportsScoreTicker ? ticker : [],
      teams,
      players,
      playerSlides,
      teamSlides,
      alsoToday,
      games,
      favorites,
      channelsFor: channelsOf,
    };
  }, [games, favorites, index, nowMs, teams, players, sportsTopGames, sportsScoreTicker]);

  // Odds overlay: The Odds API's line when the viewer has a key, else ESPN's; none when off.
  const oddsGames = useOddsApiGames(useMemo(() => (sportsOdds ? hub.top.map((r) => r.game) : []), [hub.top, sportsOdds]));
  const top = useMemo(
    () => hub.top.map((r, i) => ({ ...r, game: sportsOdds ? (oddsGames[i] ?? r.game) : { ...r.game, odds: null } })),
    [hub.top, oddsGames, sportsOdds],
  );
  const alsoToday = useMemo(
    () =>
      sportsOdds
        ? hub.alsoToday
        : hub.alsoToday.map((g) => ({
            ...g,
            items: g.items.map((r) => ({ ...r, game: { ...r.game, odds: null } })),
          })),
    [hub.alsoToday, sportsOdds],
  );
  return useMemo(() => ({ ...hub, top, alsoToday }), [hub, top, alsoToday]);
}
