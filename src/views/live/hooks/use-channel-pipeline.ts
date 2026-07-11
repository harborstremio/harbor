import { applyUserChannelOrder, applyUserGroupOrder } from "@/lib/iptv/channel-order";
import { useChannelStatsVersion } from "@/lib/iptv/channel-stats";
import { FAVORITES_GROUP_KEY, useFavorites } from "@/lib/iptv/favorites";
import { useGroupPrefs } from "@/lib/iptv/group-order";
import { sortChannelsByGroupRelevance, sortGroupsByRelevance } from "@/lib/iptv/group-relevance";
import { usePinnedOrder } from "@/lib/iptv/pins";
import { arabicAwareMatch } from "@/lib/iptv/rtl";
import { filterChannelsByRegion, promoteTopChannelsToFront, rowsForRegion } from "@/lib/iptv/top-networks";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { isLiveChannel } from "@/lib/iptv/vod-classify";
import { useEffect, useMemo } from "react";

import { useChannelFilter } from "./use-channel-filter";

type Favorites = ReturnType<typeof useFavorites>;
type ViewMode = "home" | "grid" | "guide" | "multiview";

export function useChannelPipeline(params: {
  playlist: IptvPlaylist | null | undefined;
  region: string;
  preferredLanguages: string[];
  mode: ViewMode;
  group: string | null;
  query: string;
  favorites: Favorites;
  allPlaylists: Map<string, IptvPlaylist>;
  allSources: IptvPlaylistSource[];
}) {
  const { playlist, region, preferredLanguages, mode, group, query, favorites, allPlaylists, allSources } = params;
  const inFavorites = group === FAVORITES_GROUP_KEY;
  const langKey = preferredLanguages.join(",");
  const sourceId = playlist?.id ?? "";
  const groupPrefs = useGroupPrefs(sourceId);

  const liveChannels = useMemo(() => (playlist?.channels ?? []).filter(isLiveChannel), [playlist?.channels]);
  const sortedChannels = useMemo(
    () => sortChannelsByGroupRelevance(liveChannels, region, preferredLanguages),
    [liveChannels, region, langKey],
  );
  const pinnedOrder = usePinnedOrder();
  const statsVersion = useChannelStatsVersion();
  const userChannels = useMemo(
    () => applyUserChannelOrder(sortedChannels, pinnedOrder),
    [sortedChannels, pinnedOrder, statsVersion],
  );
  const shownChannels = useMemo(() => {
    if (groupPrefs.hidden.length === 0) return userChannels;
    const h = new Set(groupPrefs.hidden);
    return userChannels.filter((c) => !h.has(c.group ?? "Uncategorized"));
  }, [userChannels, groupPrefs]);
  const liveGroups = useMemo(() => {
    const set = new Set<string>();
    for (const c of liveChannels) if (c.group) set.add(c.group);
    return [...set];
  }, [liveChannels]);
  const sortedGroups = useMemo(
    () => sortGroupsByRelevance(liveGroups, region, preferredLanguages),
    [liveGroups, region, langKey],
  );
  const userGroups = useMemo(() => applyUserGroupOrder(sortedGroups, groupPrefs), [sortedGroups, groupPrefs]);

  const topRows = useMemo(() => rowsForRegion(region), [region]);
  const showTopRows = mode === "grid" && group === null && !query.trim() && topRows.length > 0;

  const regionChannels = useMemo(() => filterChannelsByRegion(shownChannels, region), [shownChannels, region]);

  const orderedChannels = useMemo(() => {
    if (mode !== "guide") return shownChannels;
    if (group !== null) return shownChannels;
    if (query.trim()) return shownChannels;
    if (topRows.length === 0) return shownChannels;
    return promoteTopChannelsToFront(shownChannels, topRows, regionChannels);
  }, [shownChannels, mode, group, query, topRows, regionChannels]);

  useEffect(() => {
    if (!inFavorites) return;
    for (const pl of allPlaylists.values()) favorites.hydrate(pl.channels);
  }, [inFavorites, allPlaylists, favorites]);

  const mvChannels = useMemo<IptvChannel[]>(() => {
    const out: IptvChannel[] = [];
    const seen = new Set<string>();
    for (const pl of allPlaylists.values()) {
      for (const c of pl.channels) {
        if (!isLiveChannel(c) || seen.has(c.url)) continue;
        seen.add(c.url);
        out.push(c);
      }
    }
    return sortChannelsByGroupRelevance(out, region, preferredLanguages);
  }, [allPlaylists, region, langKey]);

  const favoriteChannels = useMemo(() => {
    if (!inFavorites) return [];
    const nameById = new Map(allSources.map((s) => [s.id, s.name] as const));
    const ready = [...favorites.items.values()].filter((f) => f.url);
    ready.sort((a, b) => {
      const na = nameById.get(a.sourceId) ?? a.sourceId;
      const nb = nameById.get(b.sourceId) ?? b.sourceId;
      return na.localeCompare(nb) || a.name.localeCompare(b.name);
    });
    return ready.map<IptvChannel>((f) => ({
      id: f.id,
      tvgId: f.tvgId,
      name: f.name,
      logo: f.logo,
      group: nameById.get(f.sourceId) ?? "Favorites",
      url: f.url,
      catchupSource: null,
      durationSec: null,
      attrs: {},
    }));
  }, [inFavorites, favorites.items, allSources]);

  const { visible: standardVisible, counts } = useChannelFilter(
    orderedChannels,
    inFavorites ? null : group,
    query,
    favorites.ids,
  );

  const visible = useMemo(() => {
    if (!inFavorites) return standardVisible;
    const q = query.trim().toLowerCase();
    if (!q) return favoriteChannels;
    return favoriteChannels.filter((ch) => arabicAwareMatch(`${ch.name} ${ch.group ?? ""}`, q));
  }, [inFavorites, standardVisible, favoriteChannels, query]);

  const groupLogos = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const ch of shownChannels) {
      const g = ch.group ?? "Uncategorized";
      if (!m.has(g) && ch.logo) m.set(g, ch.logo);
    }
    return m;
  }, [shownChannels]);

  return {
    sortedGroups: userGroups,
    topRows,
    showTopRows,
    regionChannels,
    shownChannels,
    mvChannels,
    visible,
    counts,
    groupLogos,
  };
}
