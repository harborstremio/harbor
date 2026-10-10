import { useCallback, useEffect, useMemo } from "react";
import { channelsForGame } from "@/lib/jl/sports/channels";
import { effectiveTeams, useJlFavoritePlayers } from "@/lib/jl/sports/favorites";
import { watchGameOn } from "@/lib/jl/sports/now-watching";
import { selectTickerGames } from "@/lib/jl/sports/ticker";
import { useActiveKid } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { ScoreTickerBar } from "./score-ticker";
import { publishScoreTicker, useTickerDismissed, type ScoreTickerItem } from "./score-ticker-store";
import { useActiveLiveChannels } from "./use-active-live-channels";
import { useHubTeams, useJlGames, useSportsChannelIndex } from "./use-jl-sports";

function channelIdOf(metaId: string | undefined): string | null {
  return metaId?.startsWith("iptv:") ? metaId.slice(5) : null;
}

/**
 * One per window: the single ESPN poll (through the shared scoreboard cache) and channel match
 * behind every score ticker on screen, and the bar across the top. Nothing loads while neither
 * the bar nor the player overlay can show, or after ✕.
 */
export function ScoreTickerHost({
  bar,
  overlay,
  playing,
}: {
  bar: boolean;
  overlay: boolean;
  /** What the player is showing, full screen or docked in a hub's hero. */
  playing: { meta: { id?: string }; isLive?: boolean } | null;
}) {
  const { settings } = useSettings();
  const { openMatchDetail } = useView();
  const kid = useActiveKid();
  const dismissed = useTickerDismissed();
  const active = !dismissed && (bar || overlay);

  const live = useActiveLiveChannels(active);
  const teams = useHubTeams();
  const players = useJlFavoritePlayers();
  const favorites = useMemo(() => effectiveTeams(teams, players), [teams, players]);
  const games = useJlGames(favorites, active);
  const index = useSportsChannelIndex(live.channels, live.epg, live.nowMs);

  const items = useMemo(() => {
    const now = new Date(live.nowMs);
    return selectTickerGames(games, favorites, live.nowMs).map((t) => ({
      ...t,
      channels: channelsForGame(t.game, index, now),
    }));
  }, [games, favorites, index, live.nowMs]);

  const playingChannelId = channelIdOf(playing?.meta.id);
  // Live TV channels play as "iptv:<channel id>", so a channel id means a live channel is on.
  const watchingLive = playingChannelId !== null;
  const { play } = live;
  // A game on one of your channels plays it as the Sports Hub's Watch does; any other opens its
  // match centre.
  const select = useCallback(
    (item: ScoreTickerItem) => {
      const first = item.channels[0]?.channel;
      if (!first) openMatchDetail(item.game);
      else if (first.id !== playingChannelId) watchGameOn(first, item.game, play);
    },
    [openMatchDetail, play, playingChannelId],
  );
  const showOdds = settings.sportsShowOdds && !kid;

  useEffect(() => {
    publishScoreTicker({ items, bar, overlay, watchingLive, playingChannelId, showOdds, select });
  }, [items, bar, overlay, watchingLive, playingChannelId, showOdds, select]);
  useEffect(() => () => publishScoreTicker(null), []);

  return <ScoreTickerBar />;
}
