import { useMemo } from "react";
import type { SportsGame } from "@/lib/sports/espn";
import { useActiveLiveChannels } from "./use-active-live-channels";
import { useGameStories } from "./game-stories";
import { useJlSports } from "./use-jl-sports";
import { useJlSportsDialogs } from "./use-jl-sports-dialogs";
import { usePrefetchTeamArt } from "./use-sports-extras";

/**
 * Everything JL's Sports Hub pieces need on the Sports page: the viewer's active IPTV provider
 * (as Live TV shows it, so Watch plays their own channels), the ranked games, Game Stories and
 * the shared dialogs. Loads nothing while the page is parked.
 */
export function useJlSportsPage(params: {
  active: boolean;
  onOpenGame: (game: SportsGame) => void;
  /** Harbor's featured events, so their teams' art is asked for with the rest of the page. */
  featured?: SportsGame[];
}) {
  const { active, onOpenGame, featured } = params;
  const { channels, activeSourceId, epg, nowMs, play } = useActiveLiveChannels(active);

  const sports = useJlSports({ channels, epg, nowMs, active });
  const dialogs = useJlSportsDialogs({ players: sports.players, onPlay: play, onOpenGame });
  const stories = useGameStories({ ...sports, nowMs });

  // Every team on the page asks TheSportsDB at once (one list per league), hero first.
  const artGames = useMemo(
    () => [
      ...sports.top.map((r) => r.game),
      ...(featured ?? []),
      ...sports.alsoToday.flatMap((g) => g.items.map((r) => r.game)),
    ],
    [sports.top, sports.alsoToday, featured],
  );
  const artTeams = useMemo(
    () =>
      sports.teamSlides.flatMap((s) => (s.side ? [{ league: s.team.league, side: s.side }] : [])),
    [sports.teamSlides],
  );
  usePrefetchTeamArt(artGames, artTeams);

  return {
    sports,
    actions: dialogs.actions,
    dialogs: dialogs.dialogs,
    stories,
    channels,
    activeSourceId,
    epg,
    nowMs,
    play,
  };
}
