import { useMemo } from "react";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";
import { buildSportsChannelIndex, channelsForGame, type GameChannel } from "@/lib/jl/sports/channels";
import { useJlSportsFavorites } from "@/lib/jl/sports/favorites";
import { isFavoriteGame, rankGames, type RankedGame } from "@/lib/jl/sports/rank";
import type { SportsGame } from "@/lib/sports/espn";
import { useSports } from "../use-sports";

export const JL_SPORTS_LEAGUES = ["NFL", "NCAAF", "NBA", "NCAAB", "NHL", "MLB"];

const TOP_GAMES = 10;
const TICKER_GAMES = 16;
// Event channel names carry no year; the index is rebuilt at most every ten minutes.
const INDEX_BUCKET_MS = 10 * 60000;

export type JlHubGame = RankedGame & { channels: GameChannel[] };

export function useJlSports(params: { channels: IptvChannel[]; epg: EpgIndex | null; nowMs: number }) {
  const { channels, epg, nowMs } = params;
  const games = useSports({ enabled: true, leagues: JL_SPORTS_LEAGUES });
  const favorites = useJlSportsFavorites();
  const bucket = Math.floor(nowMs / INDEX_BUCKET_MS);

  const index = useMemo(
    () => buildSportsChannelIndex(channels, epg, new Date(bucket * INDEX_BUCKET_MS)),
    [channels, epg, bucket],
  );

  return useMemo(() => {
    const now = new Date(nowMs);
    const channelCache = new Map<string, GameChannel[]>();
    const channelsOf = (g: SportsGame) => {
      let found = channelCache.get(g.id);
      if (!found) {
        found = channelsForGame(g, index, now);
        channelCache.set(g.id, found);
      }
      return found;
    };
    const ranked = rankGames(games, favorites, { now, watchable: (g) => channelsOf(g).length > 0 });
    const top: JlHubGame[] = ranked.slice(0, TOP_GAMES).map((r) => ({ ...r, channels: channelsOf(r.game) }));
    // The ticker follows your teams through the whole day, finals included.
    const ticker: JlHubGame[] = games
      .filter((g) => isFavoriteGame(g, favorites))
      .slice(0, TICKER_GAMES)
      .map((game) => ({ game, score: 0, reasons: [], mine: true, channels: channelsOf(game) }));
    return { top, ticker, favorites };
  }, [games, favorites, index, nowMs]);
}
