import { useEffect, useMemo, useState } from "react";
import { readActiveId, resolveActiveSource } from "@/lib/iptv/active-source";
import { useFavorites } from "@/lib/iptv/favorites";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { useSettings } from "@/lib/settings";
import { useChannelPipeline } from "../../hooks/use-channel-pipeline";
import { useEpg, useNowTick } from "../../hooks/use-epg";
import { useIptvPlaylist } from "../../hooks/use-iptv-playlist";
import { useLiveActions } from "../../hooks/use-live-actions";
import { useXtreamEpgFallback } from "../../hooks/use-xtream-epg-fallback";

const EMPTY_CHANNELS: IptvChannel[] = [];
const EMPTY_PLAYLISTS = new Map<string, IptvPlaylist>();
const EMPTY_SOURCES: IptvPlaylistSource[] = [];

/**
 * The viewer's active IPTV provider as Live TV shows it: its channels, guide and the play action
 * Live TV uses, so sports surfaces outside Live TV play the viewer's own channels. Loads nothing
 * while inactive; the shared playlist and guide caches keep what was already loaded.
 */
export function useActiveLiveChannels(active: boolean) {
  const { settings } = useSettings();
  const sources = usePlaylists();

  // Live TV owns the active-source choice; re-read it whenever this becomes active.
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

  return {
    channels: shownChannels,
    activeSourceId: activeSource?.id ?? null,
    epg,
    nowMs,
    play: handlePlay,
  };
}
