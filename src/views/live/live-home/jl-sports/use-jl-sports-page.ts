import { useEffect, useMemo, useState } from "react";
import { readActiveId, resolveActiveSource } from "@/lib/iptv/active-source";
import { useFavorites } from "@/lib/iptv/favorites";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { useSettings } from "@/lib/settings";
import type { SportsGame } from "@/lib/sports/espn";
import { useChannelPipeline } from "../../hooks/use-channel-pipeline";
import { useEpg, useNowTick } from "../../hooks/use-epg";
import { useIptvPlaylist } from "../../hooks/use-iptv-playlist";
import { useLiveActions } from "../../hooks/use-live-actions";
import { useXtreamEpgFallback } from "../../hooks/use-xtream-epg-fallback";
import { useGameStories } from "./game-stories";
import { useJlSports } from "./use-jl-sports";
import { useJlSportsDialogs } from "./use-jl-sports-dialogs";
import { usePrefetchTeamArt } from "./use-sports-extras";

const EMPTY_CHANNELS: IptvChannel[] = [];
const EMPTY_PLAYLISTS = new Map<string, IptvPlaylist>();
const EMPTY_SOURCES: IptvPlaylistSource[] = [];

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
  const { settings } = useSettings();
  const sources = usePlaylists();

  // Live TV owns the active-source choice; re-read it whenever this page is shown.
  const [activeId, setActiveId] = useState<string | null>(() => readActiveId());
  useEffect(() => {
    if (active) setActiveId(readActiveId());
  }, [active]);
  const activeSource = useMemo(() => resolveActiveSource(sources, activeId), [sources, activeId]);

  const { state } = useIptvPlaylist(active ? activeSource : null);
  const cachedForActive = getCachedPlaylist(activeSource?.id ?? "");
  const playlist =
    state.kind === "ready"
      ? state.playlist
      : cachedForActive && cachedForActive.id === activeSource?.id
        ? cachedForActive
        : null;
  const epgOnlyUrls = useMemo(
    () => sources.filter((s) => s.kind === "epg").map((s) => s.epgUrl || s.url),
    [sources],
  );
  const { index: baseEpg } = useEpg(active ? activeSource : null, epgOnlyUrls);
  const epg = useXtreamEpgFallback(activeSource, playlist?.channels ?? EMPTY_CHANNELS, baseEpg);
  const nowMs = useNowTick(30_000);

  const favorites = useFavorites();
  const region = settings.region || "US";
  const preferredLanguages =
    settings.preferredLanguages.length > 0 ? settings.preferredLanguages : ["English"];
  const { shownChannels } = useChannelPipeline({
    playlist,
    region,
    preferredLanguages,
    mode: "home",
    group: null,
    query: "",
    favorites,
    allPlaylists: EMPTY_PLAYLISTS,
    allSources: EMPTY_SOURCES,
  });
  const { handlePlay } = useLiveActions({ epg, activeId: activeSource?.id ?? null, playlist });

  const sports = useJlSports({ channels: shownChannels, epg, nowMs, active });
  const dialogs = useJlSportsDialogs({ players: sports.players, onPlay: handlePlay, onOpenGame });
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
    channels: shownChannels,
    activeSourceId: activeSource?.id ?? null,
    epg,
    nowMs,
    play: handlePlay,
  };
}
