import { useEffect, useMemo, useState } from "react";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";
import { buildSportsChannelIndex, channelsForGame, type GameChannel } from "@/lib/jl/sports/channels";
import {
  effectiveTeams,
  useJlFavoritePlayers,
  useJlSportsFavorites,
  type JlFavoritePlayer,
} from "@/lib/jl/sports/favorites";
import { fetchJlScoreboard, fetchTeamGames } from "@/lib/jl/sports/feed";
import { followedGamesThisWeek, selectTopGames, teamsMissingFromScoreboard } from "@/lib/jl/sports/gameday";
import { isFavoriteGame, rankGames, type JlFavoriteTeam, type RankedGame } from "@/lib/jl/sports/rank";
import { useSettings } from "@/lib/settings";
import type { SportsGame } from "@/lib/sports/espn";
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

/** Scoreboards for JL's leagues plus the schedules of followed teams that aren't on them. */
function useJlGames(favorites: JlFavoriteTeam[]): SportsGame[] {
  const [games, setGames] = useState<SportsGame[]>([]);
  const favoritesKey = favorites.map((f) => `${f.league}:${f.id}`).join(",");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const boards = (await Promise.all(JL_SPORTS_LEAGUES.map((l) => fetchJlScoreboard(l)))).flat();
      const missing = teamsMissingFromScoreboard(boards, favorites);
      const extra = (await Promise.all(missing.map((f) => fetchTeamGames(f.league, f.id)))).flat();
      const seen = new Set<string>();
      const merged: SportsGame[] = [];
      for (const g of [...boards, ...extra]) {
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
    // favoritesKey captures every change to the followed teams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesKey]);

  return games;
}

export function useJlSports(params: { channels: IptvChannel[]; epg: EpgIndex | null; nowMs: number }) {
  const { channels, epg, nowMs } = params;
  const { settings } = useSettings();
  const { sportsTopGames, sportsChannelFinder, sportsScoreTicker, sportsOdds } = settings;
  const teams = useJlSportsFavorites();
  const players = useJlFavoritePlayers();
  const favorites = useMemo(() => effectiveTeams(teams, players), [teams, players]);
  const games = useJlGames(favorites);
  const bucket = Math.floor(nowMs / INDEX_BUCKET_MS);

  // Smart Channel Finder off: no channel matching, so every game offers "Ways to watch" only.
  const index = useMemo(
    () => buildSportsChannelIndex(sportsChannelFinder ? channels : [], epg, new Date(bucket * INDEX_BUCKET_MS)),
    [channels, epg, bucket, sportsChannelFinder],
  );

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
      top: sportsTopGames ? top : [],
      ticker: sportsScoreTicker ? ticker : [],
      teams,
      players,
      playerSlides,
    };
  }, [games, favorites, index, nowMs, teams, players, sportsTopGames, sportsScoreTicker]);

  // Odds overlay: The Odds API's line when the viewer has a key, else ESPN's; none when off.
  const oddsGames = useOddsApiGames(useMemo(() => (sportsOdds ? hub.top.map((r) => r.game) : []), [hub.top, sportsOdds]));
  const top = useMemo(
    () => hub.top.map((r, i) => ({ ...r, game: sportsOdds ? (oddsGames[i] ?? r.game) : { ...r.game, odds: null } })),
    [hub.top, oddsGames, sportsOdds],
  );
  return useMemo(() => ({ ...hub, top }), [hub, top]);
}
